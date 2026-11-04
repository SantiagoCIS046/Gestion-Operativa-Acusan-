// Extensión de Prisma que cifra y descifra los campos sensibles de forma
// transparente (2026-11-03). El resto del código sigue escribiendo y leyendo
// `radicado.asunto`, `adjunto.contenido`, etc. como siempre:
//
//   ESCRITURA (create/update/upsert/createMany/updateMany, también anidadas):
//     los campos de CAMPOS_CIFRADOS se cifran antes de llegar a MongoDB, y
//     Radicado.numeroRadicado escribe además su índice ciego
//     (numeroRadicadoIndice).
//   LECTURA: todo resultado (incluidos include/select anidados) se descifra.
//   FILTROS: `where: { numeroRadicado: 'RAD-2026-0042' }` se traduce solo al
//     índice ciego. Cualquier otro filtro u orden sobre un campo cifrado
//     (contains, startsWith, orderBy…) LANZA un error explícito: sobre datos
//     cifrados la base no puede comparar, así que esas búsquedas se hacen en
//     memoria después de descifrar (ver RadicadoService.listar).
//
// Las agregaciones crudas ($runCommandRaw) NO pasan por aquí: quien las use
// descifra con descifrarProfundo (ver services/metricasInformes.js).

import { cifrarTexto, cifrarBytes, cifrarJson, indiceCiego, descifrarProfundo } from './cifrado.js'

// Campo → tipo de cifrado, por modelo de Prisma
export const CAMPOS_CIFRADOS = {
  Radicado: {
    numeroRadicado: 'texto',
    asunto: 'texto',
    descripcion: 'texto',
    remitente: 'texto',
    instrucciones: 'texto',
    observacionesRespuesta: 'texto',
    numeroOficioRespuesta: 'texto',
  },
  Adjunto: { nombreOriginal: 'texto', contenido: 'bytes' },
  // Los mensajes y detalles repiten número y asunto del radicado
  Alerta: { mensaje: 'texto' },
  RadicadoEvento: { detalle: 'texto' },
  // Foto de radicados vencidos del informe (número, asunto, encargado)
  Informe: { criticos: 'json' },
}

// Relaciones de Prisma entre modelos (para escrituras anidadas y filtros)
export const RELACIONES = {
  Area: { usuarios: 'Usuario', radicados: 'Radicado' },
  Usuario: { area: 'Area', accesos: 'RegistroAcceso' },
  RegistroAcceso: { usuario: 'Usuario' },
  EjecucionAlerta: { alertas: 'Alerta' },
  Alerta: { ejecucion: 'EjecucionAlerta', radicado: 'Radicado' },
  Radicado: { area: 'Area', adjuntos: 'Adjunto', eventos: 'RadicadoEvento', alertas: 'Alerta' },
  Adjunto: { radicado: 'Radicado' },
  RadicadoEvento: { radicado: 'Radicado' },
}

const CIFRADORES = { texto: cifrarTexto, bytes: cifrarBytes, json: cifrarJson }

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && !(v instanceof Date)

function errorCampoCifrado(modelo, campo, uso) {
  const e = new Error(
    `${modelo}.${campo} está cifrado: no se puede usar en ${uso} de la base de datos. ` +
      'Filtra u ordena en memoria después de leer (los resultados ya vienen descifrados).',
  )
  e.code = 'CAMPO_CIFRADO'
  return e
}

// ── Escrituras ────────────────────────────────────────────────────────────────

function cifrarValor(tipo, valor) {
  // Sintaxis de update { set: valor } para escalares (no aplica a Json)
  if (tipo !== 'json' && esObjeto(valor) && 'set' in valor) {
    return { ...valor, set: CIFRADORES[tipo](valor.set) }
  }
  return CIFRADORES[tipo](valor)
}

/** Cifra el objeto `data` de un modelo (o un arreglo de ellos). Devuelve una copia. */
export function cifrarDatos(modelo, data) {
  if (Array.isArray(data)) return data.map((d) => cifrarDatos(modelo, d))
  if (!esObjeto(data)) return data
  const campos = CAMPOS_CIFRADOS[modelo] ?? {}
  const relaciones = RELACIONES[modelo] ?? {}
  const salida = {}
  for (const [k, v] of Object.entries(data)) {
    if (campos[k]) {
      salida[k] = cifrarValor(campos[k], v)
      if (modelo === 'Radicado' && k === 'numeroRadicado') {
        const plano = esObjeto(v) && 'set' in v ? v.set : v
        if (typeof plano === 'string') salida.numeroRadicadoIndice = indiceCiego(plano)
      }
    } else if (relaciones[k] && esObjeto(v)) {
      salida[k] = cifrarEscrituraAnidada(relaciones[k], v)
    } else {
      salida[k] = v
    }
  }
  return salida
}

// Si el objeto trae { where, data } es un envoltorio; si no, son los datos.
const datosDeEnvoltorio = (modelo, v) =>
  esObjeto(v) && 'data' in v ? { ...v, data: cifrarDatos(modelo, v.data) } : cifrarDatos(modelo, v)

const porCadaUno = (v, fn) => (Array.isArray(v) ? v.map(fn) : fn(v))

/** Escrituras anidadas: { create, createMany, update, updateMany, upsert, connectOrCreate } */
export function cifrarEscrituraAnidada(modelo, ops) {
  const salida = { ...ops }
  if (ops.create !== undefined) salida.create = cifrarDatos(modelo, ops.create)
  if (ops.createMany !== undefined) {
    salida.createMany = { ...ops.createMany, data: cifrarDatos(modelo, ops.createMany.data) }
  }
  if (ops.update !== undefined) salida.update = porCadaUno(ops.update, (u) => datosDeEnvoltorio(modelo, u))
  if (ops.updateMany !== undefined) {
    salida.updateMany = porCadaUno(ops.updateMany, (u) => ({ ...u, data: cifrarDatos(modelo, u.data) }))
  }
  if (ops.upsert !== undefined) {
    salida.upsert = porCadaUno(ops.upsert, (u) => ({
      ...u,
      create: cifrarDatos(modelo, u.create),
      update: datosDeEnvoltorio(modelo, u.update),
    }))
  }
  if (ops.connectOrCreate !== undefined) {
    salida.connectOrCreate = porCadaUno(ops.connectOrCreate, (c) => ({ ...c, create: cifrarDatos(modelo, c.create) }))
  }
  return salida
}

// ── Filtros ───────────────────────────────────────────────────────────────────

const OPERADORES_RELACION = ['is', 'isNot', 'some', 'every', 'none']

/**
 * Traduce un `where`: numeroRadicado por igualdad → índice ciego; null se
 * permite (null nunca se cifra); todo lo demás sobre campos cifrados lanza.
 */
export function prepararWhere(modelo, where) {
  if (Array.isArray(where)) return where.map((w) => prepararWhere(modelo, w))
  if (!esObjeto(where)) return where
  const campos = CAMPOS_CIFRADOS[modelo] ?? {}
  const relaciones = RELACIONES[modelo] ?? {}
  const salida = {}
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND' || k === 'OR' || k === 'NOT') {
      salida[k] = prepararWhere(modelo, v)
    } else if (campos[k]) {
      if (v === null || (esObjeto(v) && Object.keys(v).length === 1 && (v.equals === null || v.not === null))) {
        salida[k] = v // filtros de nulo: válidos sobre datos cifrados
      } else if (modelo === 'Radicado' && k === 'numeroRadicado' && typeof v === 'string') {
        salida.numeroRadicadoIndice = indiceCiego(v)
      } else if (modelo === 'Radicado' && k === 'numeroRadicado' && esObjeto(v) && Object.keys(v).length === 1 && typeof v.equals === 'string') {
        salida.numeroRadicadoIndice = indiceCiego(v.equals)
      } else if (modelo === 'Radicado' && k === 'numeroRadicado' && esObjeto(v) && Object.keys(v).length === 1 && Array.isArray(v.in)) {
        salida.numeroRadicadoIndice = { in: v.in.map((n) => indiceCiego(n)) }
      } else {
        throw errorCampoCifrado(modelo, k, 'filtros')
      }
    } else if (relaciones[k] && esObjeto(v)) {
      const rel = relaciones[k]
      const conOperador = Object.keys(v).some((op) => OPERADORES_RELACION.includes(op))
      salida[k] = conOperador
        ? Object.fromEntries(Object.entries(v).map(([op, f]) => [op, OPERADORES_RELACION.includes(op) ? prepararWhere(rel, f) : f]))
        : prepararWhere(rel, v)
    } else {
      salida[k] = v
    }
  }
  return salida
}

function verificarOrden(modelo, orderBy) {
  const campos = CAMPOS_CIFRADOS[modelo] ?? {}
  for (const o of Array.isArray(orderBy) ? orderBy : [orderBy]) {
    if (!esObjeto(o)) continue
    for (const k of Object.keys(o)) if (campos[k]) throw errorCampoCifrado(modelo, k, 'ordenamientos')
  }
}

// ── Preparación de los argumentos de cada operación ──────────────────────────

const OPS_ESCRITURA_DATA = new Set(['create', 'update', 'updateMany', 'createMany', 'createManyAndReturn', 'updateManyAndReturn'])

export function prepararArgs(modelo, operacion, args) {
  if (!args || !tocaCifrado(modelo)) return args
  const salida = { ...args }
  if (args.where !== undefined) salida.where = prepararWhere(modelo, args.where)
  if (args.orderBy !== undefined) verificarOrden(modelo, args.orderBy)
  if (args.cursor !== undefined) salida.cursor = prepararWhere(modelo, args.cursor)
  if (OPS_ESCRITURA_DATA.has(operacion) && args.data !== undefined) salida.data = cifrarDatos(modelo, args.data)
  if (operacion === 'upsert') {
    if (args.create !== undefined) salida.create = cifrarDatos(modelo, args.create)
    if (args.update !== undefined) salida.update = cifrarDatos(modelo, args.update)
  }
  return salida
}

// Modelos que tienen campos cifrados o relaciones hacia ellos
function tocaCifrado(modelo) {
  return Boolean(CAMPOS_CIFRADOS[modelo] || RELACIONES[modelo])
}

// ── La extensión ──────────────────────────────────────────────────────────────

export const extensionCifrado = {
  name: 'cifrado-datos-sensibles',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const resultado = await query(prepararArgs(model, operation, args))
        return descifrarProfundo(resultado)
      },
    },
  },
}

export default extensionCifrado
