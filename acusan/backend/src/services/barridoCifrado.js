// Barrido automático de cifrado (2026-11-04).
//
// La aplicación ya cifra todo lo que escribe (lib/extensionCifrado.js). Este
// barrido cubre lo que entre POR FUERA de la aplicación: un documento creado
// a mano en la consola de Atlas, un script que use el cliente sin cifrado,
// una importación directa a MongoDB… Busca en la base los campos sensibles
// que estén en texto plano y los cifra, con la misma llave y el mismo formato.
//
// Cuándo corre solo:
//   - en cada revisión diaria del cron (GET|POST /api/cron/alertas);
//   - al arrancar el servidor local (npm run dev / npm start).
// A mano: npm run datos:cifrar (backend/).
//
// Es idempotente y barato: con filtros de MongoDB pide SOLO los documentos
// que tienen algo sin cifrar (un $regex sobre el prefijo "enc:v1:" y, para
// los PDFs, una comparación de bits sobre la firma "ENC1"), así que cuando
// todo está cifrado no descarga nada.
//
// Carrera con la aplicación: la actualización va condicionada a que los
// textos sigan siendo los que se leyeron; si la app los cambió entretanto,
// ese documento se salta (la app ya lo dejó cifrado).

import { prismaSinCifrado as db } from '../config/prisma.js'
import {
  verificarClaves,
  cifrarTexto,
  descifrarTexto,
  cifrarBytes,
  descifrarBytes,
  cifrarJson,
  descifrarJson,
  estaCifradoTexto,
  estaCifradoBytes,
  estaCifradoJson,
  indiceCiego,
  MAGIA_BYTES,
  PREFIJO_TEXTO,
} from '../lib/cifrado.js'
import { CAMPOS_CIFRADOS } from '../lib/extensionCifrado.js'

const LOTE = 50
const LIMITE_POR_COLECCION = 5000

// Modelo de Prisma → colección y delegado del cliente SIN cifrado
const MODELOS = {
  Radicado: { coleccion: 'radicados_v2', delegado: () => db.radicado, nombre: 'radicados' },
  Adjunto: { coleccion: 'adjuntos', delegado: () => db.adjunto, nombre: 'adjuntos' },
  Alerta: { coleccion: 'alertas', delegado: () => db.alerta, nombre: 'alertas' },
  RadicadoEvento: { coleccion: 'radicado_eventos', delegado: () => db.radicadoEvento, nombre: 'eventos' },
  Informe: { coleccion: 'informes', delegado: () => db.informe, nombre: 'informes' },
}

// Máscaras de bits para reconocer la firma "ENC1" en los primeros 4 bytes de
// un BinData ($bitsAnyClear / $bitsAnySet funcionan sobre binarios).
const bin = (buf) => ({ $binary: { base64: buf.toString('base64'), subType: '00' } })
const MASCARA_UNOS = bin(MAGIA_BYTES)
const MASCARA_CEROS = bin(Buffer.from(MAGIA_BYTES.map((b) => ~b & 0xff)))

// Filtro crudo de MongoDB: documentos con ALGÚN campo sensible sin cifrar
export function filtroPendientes(modelo) {
  const condiciones = []
  for (const [campo, tipo] of Object.entries(CAMPOS_CIFRADOS[modelo])) {
    if (tipo === 'texto') {
      condiciones.push({ [campo]: { $type: 'string', $not: { $regex: `^${PREFIJO_TEXTO}` } } })
    } else if (tipo === 'json') {
      condiciones.push({ [campo]: { $exists: true, $ne: null, $not: { $type: 'string' } } })
    } else if (tipo === 'bytes') {
      // No empieza por "ENC1": algún bit que debería estar en 1 está en 0, o al revés
      condiciones.push({ [campo]: { $type: 'binData', $bitsAnyClear: MASCARA_UNOS } })
      condiciones.push({ [campo]: { $type: 'binData', $bitsAnySet: MASCARA_CEROS } })
    }
  }
  if (modelo === 'Radicado') condiciones.push({ numeroRadicadoIndice: null })
  return { $or: condiciones }
}

async function idsPendientes(modelo) {
  const { coleccion } = MODELOS[modelo]
  const crudo = await db.$runCommandRaw({
    aggregate: coleccion,
    pipeline: [{ $match: filtroPendientes(modelo) }, { $project: { _id: 1 } }, { $limit: LIMITE_POR_COLECCION }],
    cursor: {},
  })
  return (crudo.cursor?.firstBatch ?? []).map((d) => d._id?.$oid ?? String(d._id))
}

// Todos los ids (modo completo: migración inicial o --revertir)
async function idsTodos(modelo) {
  const delegado = MODELOS[modelo].delegado()
  const ids = []
  let cursor = null
  for (;;) {
    const filas = await delegado.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!filas.length) break
    ids.push(...filas.map((f) => f.id))
    cursor = filas[filas.length - 1].id
  }
  return ids
}

// Valor → { cambio, valor } según el modo
function procesar(tipo, v, revertir) {
  if (v === null || v === undefined) return { cambio: false, valor: v }
  if (tipo === 'texto') {
    if (revertir) return estaCifradoTexto(v) ? { cambio: true, valor: descifrarTexto(v) } : { cambio: false, valor: v }
    if (estaCifradoTexto(v)) return { cambio: false, valor: v }
    const cif = cifrarTexto(v)
    if (descifrarTexto(cif) !== v) throw new Error('Verificación de cifrado falló (texto).')
    return { cambio: true, valor: cif }
  }
  if (tipo === 'bytes') {
    if (revertir) return estaCifradoBytes(v) ? { cambio: true, valor: descifrarBytes(v) } : { cambio: false, valor: v }
    if (estaCifradoBytes(v)) return { cambio: false, valor: v }
    const original = Buffer.from(v)
    const cif = cifrarBytes(original)
    if (!descifrarBytes(cif).equals(original)) throw new Error('Verificación de cifrado falló (PDF).')
    return { cambio: true, valor: cif }
  }
  // json
  if (revertir) return estaCifradoJson(v) ? { cambio: true, valor: descifrarJson(v) } : { cambio: false, valor: v }
  if (estaCifradoJson(v)) return { cambio: false, valor: v }
  const cif = cifrarJson(v)
  if (JSON.stringify(descifrarJson(cif)) !== JSON.stringify(v)) throw new Error('Verificación de cifrado falló (json).')
  return { cambio: true, valor: cif }
}

/**
 * Cifra lo que falte. Opciones:
 *   simular  → solo cuenta, no escribe
 *   todo     → revisa todos los documentos (no solo los que el filtro marca)
 *   revertir → descifra todo de vuelta (implica todo)
 * Devuelve { coleccion: { revisados, cambiados, yaListos, saltados } }.
 */
export async function cifrarPendientes({ simular = false, todo = false, revertir = false } = {}) {
  verificarClaves()
  const completo = todo || revertir
  const resumen = {}
  const contar = (n, k) => {
    resumen[n] ??= { revisados: 0, cambiados: 0, yaListos: 0, saltados: 0 }
    resumen[n][k]++
  }
  const maximoPorAnio = new Map()

  for (const [modelo, { delegado: obtener, nombre }] of Object.entries(MODELOS)) {
    const delegado = obtener()
    const campos = CAMPOS_CIFRADOS[modelo]
    const ids = completo ? await idsTodos(modelo) : await idsPendientes(modelo)
    resumen[nombre] ??= { revisados: 0, cambiados: 0, yaListos: 0, saltados: 0 }

    for (let i = 0; i < ids.length; i += LOTE) {
      for (const id of ids.slice(i, i + LOTE)) {
        const select = { id: true, ...Object.fromEntries(Object.keys(campos).map((k) => [k, true])) }
        if (modelo === 'Radicado') select.numeroRadicadoIndice = true
        const fila = await delegado.findUnique({ where: { id }, select })
        if (!fila) continue
        contar(nombre, 'revisados')

        const data = {}
        const condicion = { id }
        for (const [campo, tipo] of Object.entries(campos)) {
          const { cambio, valor } = procesar(tipo, fila[campo], revertir)
          if (!cambio) continue
          data[campo] = valor
          // Actualización condicionada: el texto debe seguir siendo el leído
          if (tipo === 'texto') condicion[campo] = fila[campo]
        }

        if (modelo === 'Radicado') {
          const plano = estaCifradoTexto(fila.numeroRadicado) ? descifrarTexto(fila.numeroRadicado) : fila.numeroRadicado
          if (!revertir && typeof plano === 'string') {
            const indice = indiceCiego(plano)
            if (fila.numeroRadicadoIndice !== indice) data.numeroRadicadoIndice = indice
            const m = /^RAD-(\d{4})-(\d+)$/i.exec(plano.trim())
            if (m) maximoPorAnio.set(m[1], Math.max(maximoPorAnio.get(m[1]) ?? 0, parseInt(m[2], 10)))
          }
        }

        if (!Object.keys(data).length) {
          contar(nombre, 'yaListos')
          continue
        }
        if (simular) {
          contar(nombre, 'cambiados')
          continue
        }
        try {
          const r = await delegado.updateMany({ where: condicion, data })
          contar(nombre, r.count ? 'cambiados' : 'saltados')
        } catch (error) {
          // P2002: el número ya existe en otro radicado (un duplicado metido
          // por fuera). Se deja sin índice y se reporta; el resto sigue.
          if (error?.code === 'P2002') {
            contar(nombre, 'saltados')
            console.warn(`[CIFRADO] Radicado ${id}: número duplicado, no se pudo indexar.`)
          } else throw error
        }
      }
    }
  }

  // Consecutivo automático: que nunca quede por debajo de un número existente
  if (!revertir) {
    for (const [anio, max] of maximoPorAnio) {
      const id = `radicado-${anio}`
      const actual = await db.contador.findUnique({ where: { id } })
      contar('contadores', 'revisados')
      if (actual && actual.valor >= max) {
        contar('contadores', 'yaListos')
        continue
      }
      contar('contadores', 'cambiados')
      if (!simular) await db.contador.upsert({ where: { id }, create: { id, valor: max }, update: { valor: max } })
    }
  }

  return resumen
}

/** Total de documentos que cambiaron (para logs). */
export const totalCambiados = (resumen) =>
  Object.values(resumen).reduce((s, r) => s + (r.cambiados ?? 0), 0)

export default cifrarPendientes
