// Almacén de PDFs de radicados (modelo Adjunto, colección "adjuntos").
//
// Es el ÚNICO lugar del código que toca los bytes de un PDF. Los metadatos
// (nombre, tamaño, tipo, vigente) siempre viven en MongoDB; los bytes pueden
// vivir en tres almacenes, según ALMACEN_PDF:
//
//   mongo  (predeterminado) bytes cifrados dentro del documento Adjunto.
//   blob   Vercel Blob. Se activa creando un Blob Store en Vercel (Storage →
//          Blob), que define BLOB_READ_WRITE_TOKEN; con ese token y sin
//          ALMACEN_PDF explícito, los PDFs NUEVOS van a Blob.
//   disco  carpeta local (ALMACEN_PDF_DIR, por defecto backend/almacen-pdf):
//          para desarrollo y pruebas, no para Vercel (su disco es efímero).
//
// En blob y disco el objeto se guarda CIFRADO con la misma llave que la base
// (AES-256-GCM, firma "ENC1"): quien obtenga el archivo solo ve bytes
// ilegibles. El documento Adjunto guarda almacen + ubicacion.
//
// Cada adjunto recuerda su almacén: cambiar ALMACEN_PDF no rompe los PDFs ya
// guardados. Para mover los existentes: npm run pdfs:mover (backend/).
//
// Reglas del servicio:
// - Los bytes solo salen por leer(); toda otra lectura del código va con
//   omit: { contenido: true } para no arrastrar megas en las consultas.
// - guardar() valida la firma mágica %PDF-: un .txt renombrado no entra.
// - Límite duro: 10 MB por adjunto (lo mismo que filtra multer en la ruta).
// - Reemplazar un PDF NO borra el anterior: marcarHistorico() lo deja como
//   versión previa (vigente=false) y el nuevo queda como el vigente.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import prisma from '../config/prisma.js'
import logger from '../config/logger.js'
import { cifrarBytes, descifrarBytes } from '../lib/cifrado.js'

const LIMITE_PDF = 10 * 1024 * 1024

const esPdfReal = (buffer) => buffer?.subarray(0, 5).toString('latin1') === '%PDF-'

// El enum TipoAdjunto usa nombres declarados (RADICADO/RESPUESTA) aunque en
// BD se guarde el valor del dominio: traducción ida y vuelta en la frontera.
const TIPO_PRISMA = { radicado: 'RADICADO', respuesta: 'RESPUESTA' }

// Nombre de archivo saneado: sin ruta, recortado, siempre con extensión
function nombreLimpio(originalname) {
  const nombre = String(originalname || '')
    .split(/[\\/]/)
    .pop()
    .trim()
    .slice(0, 120)
  if (!nombre) return 'documento.pdf'
  return nombre.toLowerCase().endsWith('.pdf') ? nombre : `${nombre}.pdf`
}

// ── Almacenes externos ───────────────────────────────────────────────────────

const DIR_POR_DEFECTO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'almacen-pdf')
const dirDisco = () => process.env.ALMACEN_PDF_DIR || DIR_POR_DEFECTO

const disco = {
  async subir(clave, bytes) {
    const ruta = path.join(dirDisco(), clave)
    await fs.mkdir(path.dirname(ruta), { recursive: true })
    await fs.writeFile(ruta, bytes)
    return clave
  },
  async descargar(ubicacion) {
    return fs.readFile(path.join(dirDisco(), ubicacion))
  },
  async eliminar(ubicacion) {
    await fs.rm(path.join(dirDisco(), ubicacion), { force: true })
  },
}

// Vercel Blob (el SDK se carga solo si se usa). El objeto es "public" en el
// sentido de Blob (URL larga e imposible de adivinar), pero su contenido va
// cifrado: sin la llave del backend no se puede leer.
const blob = {
  async sdk() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('ALMACEN_PDF=blob requiere BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob).')
    }
    return import('@vercel/blob')
  },
  async subir(clave, bytes) {
    const { put } = await this.sdk()
    const r = await put(clave, bytes, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return r.url
  },
  async descargar(ubicacion) {
    const res = await fetch(ubicacion)
    if (!res.ok) throw new Error(`Blob respondió ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  },
  async eliminar(ubicacion) {
    const { del } = await this.sdk()
    await del(ubicacion, { token: process.env.BLOB_READ_WRITE_TOKEN })
  },
}

const EXTERNOS = { disco, blob }

/** Almacén para los PDFs NUEVOS: ALMACEN_PDF, o blob si hay token, o mongo. */
export function almacenActual() {
  const pedido = String(process.env.ALMACEN_PDF ?? '').trim().toLowerCase()
  if (pedido === 'mongo' || EXTERNOS[pedido]) return pedido
  if (pedido) logger.warn('PDF', 'ALMACÉN', `ALMACEN_PDF="${pedido}" no existe: se usa mongo`)
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'mongo'
}

const claveNueva = (radicadoId) => `adjuntos/${radicadoId}/${crypto.randomUUID()}.enc`

/** Sube bytes (cifrados) al almacén externo indicado; devuelve la ubicación. */
export async function subirExterno(almacen, radicadoId, buffer) {
  return EXTERNOS[almacen].subir(claveNueva(radicadoId), cifrarBytes(buffer))
}

/** Lee y descifra un objeto de un almacén externo. */
export async function leerExterno(almacen, ubicacion) {
  return Buffer.from(descifrarBytes(await EXTERNOS[almacen].descargar(ubicacion)))
}

export async function eliminarExterno(almacen, ubicacion) {
  if (!EXTERNOS[almacen] || !ubicacion) return
  try {
    await EXTERNOS[almacen].eliminar(ubicacion)
  } catch (error) {
    // Un objeto huérfano no debe impedir borrar el radicado: se registra
    logger.warn('PDF', 'BORRAR', `No se pudo borrar ${ubicacion} (${almacen}): ${error.message}`)
  }
}

export const almacenPdf = {
  LIMITE_PDF,

  /**
   * Guarda el buffer de un PDF como Adjunto del radicado y devuelve sus
   * metadatos — nunca los bytes.
   * meta: { radicadoId, tipo: 'radicado'|'respuesta', nombreOriginal, subidoPorId }
   */
  async guardar(buffer, meta, tx = prisma) {
    if (!buffer?.length) {
      throw { status: 400, message: 'Adjunta un PDF en el campo correspondiente.' }
    }
    if (!esPdfReal(buffer) || buffer.length > LIMITE_PDF) {
      // Mensaje unificado con el de multer en la ruta (spec R2)
      throw { status: 400, message: 'El archivo debe ser un PDF de hasta 10 MB.' }
    }
    const tipo = TIPO_PRISMA[meta?.tipo]
    if (!tipo) {
      throw { status: 400, message: 'Tipo de adjunto no válido.' }
    }
    if (!meta?.radicadoId || !meta?.subidoPorId) {
      throw { status: 400, message: 'El adjunto necesita radicado y usuario que lo sube.' }
    }

    const almacen = almacenActual()
    const datos = {
      radicadoId: meta.radicadoId,
      tipo,
      nombreOriginal: nombreLimpio(meta.nombreOriginal),
      tamano: buffer.length,
      subidoPorId: meta.subidoPorId,
      almacen,
    }
    if (almacen === 'mongo') {
      datos.contenido = buffer // la extensión de Prisma lo cifra al escribir
    } else {
      datos.ubicacion = await subirExterno(almacen, meta.radicadoId, buffer)
    }
    try {
      return await tx.adjunto.create({ data: datos, omit: { contenido: true } })
    } catch (error) {
      if (datos.ubicacion) await eliminarExterno(almacen, datos.ubicacion)
      throw error
    }
  },

  /**
   * Devuelve { datos, nombre } del adjunto, o null si no existe.
   * ÚNICA lectura del código que trae los bytes.
   */
  async leer(adjuntoId) {
    if (!adjuntoId) return null
    const doc = await prisma.adjunto.findUnique({ where: { id: adjuntoId } })
    if (!doc) return null
    // Los adjuntos previos al campo `almacen` no lo traen: viven en mongo
    const almacen = doc.almacen && doc.almacen !== 'mongo' ? doc.almacen : 'mongo'
    if (almacen === 'mongo') {
      if (!doc.contenido) return null
      return { datos: Buffer.from(doc.contenido), nombre: doc.nombreOriginal }
    }
    try {
      return { datos: await leerExterno(almacen, doc.ubicacion), nombre: doc.nombreOriginal }
    } catch (error) {
      logger.error('PDF', 'LEER', `Adjunto ${doc.id} (${almacen}): ${error.message}`)
      throw { status: 502, message: 'No se pudo recuperar el PDF del almacenamiento. Intente de nuevo.' }
    }
  },

  /**
   * Marca un adjunto como histórico (vigente=false). Null-safe.
   */
  async marcarHistorico(adjuntoId, tx = prisma) {
    if (!adjuntoId) return
    await tx.adjunto.updateMany({ where: { id: adjuntoId }, data: { vigente: false } })
  },

  /**
   * Borra los objetos externos de los adjuntos de un radicado (los
   * documentos Adjunto los borra quien elimina el radicado). Llamar ANTES de
   * borrar los documentos.
   */
  async eliminarDeRadicado(radicadoId) {
    const externos = await prisma.adjunto.findMany({
      where: { radicadoId, ubicacion: { not: null } },
      select: { almacen: true, ubicacion: true },
    })
    for (const a of externos) await eliminarExterno(a.almacen, a.ubicacion)
    return externos.length
  },
}

export default almacenPdf
