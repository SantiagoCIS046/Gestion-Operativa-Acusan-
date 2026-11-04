// Almacén de PDFs de radicados (modelo Adjunto, colección "adjuntos").
//
// Hoy los bytes viven en MongoDB porque el disco del hosting es efímero. El
// día que se muden a un bucket (S3 y amigos) SOLO cambia este archivo: es el
// ÚNICO lugar del código que toca `contenido`.
//
// Reglas del servicio:
// - Los bytes solo salen por leer(); toda otra lectura del código va con
//   omit: { contenido: true } para no arrastrar megas en las consultas.
// - guardar() valida la firma mágica %PDF-: un .txt renombrado no entra.
// - Límite duro: 10 MB por adjunto (lo mismo que filtra multer en la ruta).
// - Reemplazar un PDF NO borra el anterior: marcarHistorico() lo deja como
//   versión previa (vigente=false) y el nuevo queda como el vigente.

import prisma from '../config/prisma.js'

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
    return tx.adjunto.create({
      data: {
        radicadoId: meta.radicadoId,
        tipo,
        nombreOriginal: nombreLimpio(meta.nombreOriginal),
        tamano: buffer.length,
        contenido: buffer,
        subidoPorId: meta.subidoPorId,
      },
      omit: { contenido: true },
    })
  },

  /**
   * Devuelve { datos, nombre } del adjunto, o null si no existe.
   * ÚNICA lectura del código que trae `contenido`.
   */
  async leer(adjuntoId) {
    if (!adjuntoId) return null
    const doc = await prisma.adjunto.findUnique({ where: { id: adjuntoId } })
    if (!doc) return null
    return { datos: Buffer.from(doc.contenido), nombre: doc.nombreOriginal }
  },

  /**
   * Marca un adjunto como histórico (vigente=false). Null-safe.
   */
  async marcarHistorico(adjuntoId, tx = prisma) {
    if (!adjuntoId) return
    await tx.adjunto.updateMany({ where: { id: adjuntoId }, data: { vigente: false } })
  },
}

export default almacenPdf
