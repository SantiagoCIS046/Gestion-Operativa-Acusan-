// Métricas del módulo de informes — agregaciones nativas de MongoDB en un
// solo viaje por consulta ($runCommandRaw: $match/$group/$cond/$facet).
// NUNCA se cuenta en Node: JS solo ordena los pocos grupos que devuelve el
// servidor (áreas, días ya acotados).
//
// Todas las cifras siguen las definiciones literales de la regla de
// informes, sobre los campos de texto AAAA-MM-DD bogotano (diaRadicacion,
// diaVencimiento, diaRespuesta — el servicio de radicados los escribe):
//   ENVIADOS    = diaRadicacion dentro del periodo [desde, hasta].
//   CONTESTADOS = diaRespuesta dentro del periodo; a tiempo si
//                 diaRespuesta <= diaVencimiento.
//   EN PROCESO  = diaRadicacion <= corte y (sin respuesta o
//                 diaRespuesta > corte). corte = último día del periodo si
//                 cerró, u HOY si está en curso.
//   VENCIDOS    = en proceso con diaVencimiento < corte.
//   VENCE PRONTO= en proceso con 0..7 días hasta el vencimiento.
//   CUMPLIMIENTO= aTiempo / contestados. TIEMPO DE RESPUESTA = promedio de
//                 días entre radicación y respuesta.
//
// areaId en las opciones filtra el alcance; sin él, la cifra es global.

import prisma from '../config/prisma.js'
import { descifrarProfundo } from '../lib/cifrado.js'

const COLECCION = 'radicados_v2'
const COLECCION_EVENTOS = 'radicado_eventos'
const DIA_MS = 24 * 60 * 60 * 1000

// $runCommandRaw devuelve { cursor: { firstBatch: [...] } } — el lote ES el
// resultado completo (los pipelines aquí nunca pagan el tope de 16MB).
// Las consultas crudas NO pasan por la extensión de cifrado: los campos
// sensibles (número, asunto, remitente, detalle) se descifran aquí.
async function aggregate(coleccion, pipeline) {
  const crudo = await prisma.$runCommandRaw({ aggregate: coleccion, pipeline, cursor: {} })
  return descifrarProfundo(crudo.cursor?.firstBatch ?? [])
}

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Diferencia en días entre dos fechas de texto 'AAAA-MM-DD' (medianoches
// UTC exactas: el resultado es entero).
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / DIA_MS)

const filtroArea = (areaId) => (areaId ? { areaId: { $oid: areaId } } : {})

// $cond reutilizable: ¿la respuesta llegó a tiempo? (texto ISO compara
// lexicográficamente igual que fechas)
const A_TIEMPO = { $lte: ['$diaRespuesta', '$diaVencimiento'] }

// Expresiones de agregación (NO sintaxis de $match): $gte/$lte/$gt son
// operadores de 2 argumentos dentro de $cond.
const enPeriodo = (campo, desde, hasta) => ({
  $and: [{ $gte: [`$${campo}`, desde] }, { $lte: [`$${campo}`, hasta] }],
})
const enProcesoAl = (corte) => ({
  $and: [
    { $lte: ['$diaRadicacion', corte] },
    // OJO: $eq con null NO matchea campos faltantes en expresiones (a
    // diferencia del query {campo: null}); $ifNull nivela missing y null.
    {
      $or: [
        { $eq: [{ $ifNull: ['$diaRespuesta', null] }, null] },
        { $gt: ['$diaRespuesta', corte] },
      ],
    },
  ],
})

// Redondea promedios a 1 decimal sin flotantes ruidosos (0.1 + 0.2).
const unDecimal = (x) => (x == null ? null : Math.round(x * 10) / 10)

// $runCommandRaw devuelve Extended JSON: ObjectId como { $oid }, fechas
// como { $date }. Se aplanan antes de salir del servicio.
const oidOf = (v) => (v && typeof v === 'object' && v.$oid ? v.$oid : v != null ? String(v) : null)
const fechaOf = (v) => (v && typeof v === 'object' && v.$date ? new Date(v.$date) : v ?? null)

// -------------------------------------------------------------
// KPIs del periodo: un solo aggregate con $facet (3 ramas).
// -------------------------------------------------------------
export async function kpis(desdeISO, hastaISO, corteISO, { areaId } = {}) {
  const [fila] = await aggregate(COLECCION, [
    { $match: filtroArea(areaId) },
    {
      $facet: {
        enviados: [
          { $match: { diaRadicacion: { $gte: desdeISO, $lte: hastaISO } } },
          { $count: 'n' },
        ],
        contestados: [
          { $match: { diaRespuesta: { $gte: desdeISO, $lte: hastaISO } } },
          {
            $group: {
              _id: null,
              n: { $sum: 1 },
              aTiempo: { $sum: { $cond: [A_TIEMPO, 1, 0] } },
              sumaDiasRespuesta: {
                $sum: {
                  $divide: [
                    { $subtract: [{ $dateFromString: { dateString: '$diaRespuesta' } }, { $dateFromString: { dateString: '$diaRadicacion' } }] },
                    DIA_MS,
                  ],
                },
              },
            },
          },
        ],
        proceso: [
          {
            $match: {
              diaRadicacion: { $lte: corteISO },
              $or: [{ diaRespuesta: null }, { diaRespuesta: { $gt: corteISO } }],
            },
          },
          {
            $group: {
              _id: null,
              n: { $sum: 1 },
              vencidos: { $sum: { $cond: [{ $lt: ['$diaVencimiento', corteISO] }, 1, 0] } },
              porVencer: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$diaVencimiento', corteISO] },
                        { $lte: [{ $divide: [{ $subtract: [{ $dateFromString: { dateString: '$diaVencimiento' } }, { $dateFromString: { dateString: corteISO } }] }, DIA_MS] }, 7] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ])

  const enviados = fila?.enviados?.[0]?.n ?? 0
  const c = fila?.contestados?.[0]
  const contestados = c?.n ?? 0
  const aTiempo = c?.aTiempo ?? 0
  const p = fila?.proceso?.[0]
  const enProceso = p?.n ?? 0
  const vencidos = p?.vencidos ?? 0

  return {
    enviados,
    contestados,
    aTiempo,
    conRetraso: contestados - aTiempo,
    // cumplimiento y promedio son null cuando no hubo contestados
    cumplimiento: contestados ? unDecimal(aTiempo / contestados) : null,
    diasPromedioRespuesta: contestados ? unDecimal(c.sumaDiasRespuesta / contestados) : null,
    enProceso,
    vencidos,
    porVencer: p?.porVencer ?? 0,
  }
}

// -------------------------------------------------------------
// Por grupo (áreas — o encargados si el alcance ya fija un área).
// Un aggregate por consulta; el nombre se resuelve con $lookup.
// -------------------------------------------------------------
export async function porGrupo(desdeISO, hastaISO, corteISO, { areaId, porEncargado = false } = {}) {
  const clave = porEncargado ? '$encargadoId' : '$areaId'
  const desdeColeccion = porEncargado ? 'usuarios' : 'areas'

  const filas = await aggregate(COLECCION, [
    { $match: filtroArea(areaId) },
    {
      $group: {
        _id: clave,
        nombre: { $first: null },
        enviados: { $sum: { $cond: [enPeriodo('diaRadicacion', desdeISO, hastaISO), 1, 0] } },
        contestados: { $sum: { $cond: [enPeriodo('diaRespuesta', desdeISO, hastaISO), 1, 0] } },
        aTiempo: {
          $sum: {
            $cond: [{ $and: [enPeriodo('diaRespuesta', desdeISO, hastaISO), A_TIEMPO] }, 1, 0],
          },
        },
        enProceso: { $sum: { $cond: [enProcesoAl(corteISO), 1, 0] } },
        vencidos: {
          $sum: {
            $cond: [{ $and: [enProcesoAl(corteISO), { $lt: ['$diaVencimiento', corteISO] }] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: desdeColeccion,
        localField: '_id',
        foreignField: '_id',
        as: 'ref',
      },
    },
    { $set: { nombre: { $arrayElemAt: ['$ref.nombre', 0] } } },
    { $unset: ['ref'] },
    { $sort: { contestados: -1, enProceso: -1, _id: 1 } },
  ])

  return filas.map((f) => ({
    id: oidOf(f._id),
    nombre: f.nombre ?? '(sin nombre)',
    enviados: f.enviados,
    contestados: f.contestados,
    aTiempo: f.aTiempo,
    conRetraso: f.contestados - f.aTiempo,
    cumplimiento: f.contestados ? unDecimal(f.aTiempo / f.contestados) : null,
    enProceso: f.enProceso,
    vencidos: f.vencidos,
  }))
}

// -------------------------------------------------------------
// Destacados del periodo — MÁS ACTIVA (más contestados; empate: mayor
// cumplimiento) y MÁS AFECTADA (más en proceso; empate: más vencidos).
// El orden fino se hace en JS sobre los pocos grupos que ya contó Mongo.
// -------------------------------------------------------------
export async function destacados(desdeISO, hastaISO, corteISO, opciones = {}) {
  const grupos = await porGrupo(desdeISO, hastaISO, corteISO, opciones)

  const conContestados = grupos.filter((g) => g.contestados > 0)
  const masActiva = conContestados.length
    ? conContestados.slice().sort((a, b) =>
        b.contestados - a.contestados ||
        (b.cumplimiento ?? -1) - (a.cumplimiento ?? -1) ||
        a.nombre.localeCompare(b.nombre),
      )[0]
    : null

  const conProceso = grupos.filter((g) => g.enProceso > 0)
  const masAfectada = conProceso.length
    ? conProceso.slice().sort((a, b) =>
        b.enProceso - a.enProceso ||
        b.vencidos - a.vencidos ||
        a.nombre.localeCompare(b.nombre),
      )[0]
    : null

  return { masActiva, masAfectada }
}

// -------------------------------------------------------------
// Día por día del rango (incluye sábados, domingos y festivos: el caller
// pone el tipo de cada día con calendarioCO). Un aggregate con $facet de
// dos agrupaciones (enviados y contestados por fecha de texto).
// -------------------------------------------------------------
export async function porDia(desdeISO, hastaISO, { areaId } = {}) {
  const [fila] = await aggregate(COLECCION, [
    { $match: filtroArea(areaId) },
    {
      $facet: {
        enviados: [
          { $match: { diaRadicacion: { $gte: desdeISO, $lte: hastaISO } } },
          { $group: { _id: '$diaRadicacion', n: { $sum: 1 } } },
        ],
        contestados: [
          { $match: { diaRespuesta: { $gte: desdeISO, $lte: hastaISO } } },
          { $group: { _id: '$diaRespuesta', n: { $sum: 1 } } },
        ],
      },
    },
  ])

  const mapaEnviados = new Map((fila?.enviados ?? []).map((d) => [d._id, d.n]))
  const mapaContestados = new Map((fila?.contestados ?? []).map((d) => [d._id, d.n]))

  const dias = []
  let f = desdeISO
  while (f <= hastaISO) {
    dias.push({ fecha: f, enviados: mapaEnviados.get(f) ?? 0, contestados: mapaContestados.get(f) ?? 0 })
    f = new Date(Date.parse(`${f}T00:00:00.000Z`) + DIA_MS).toISOString().slice(0, 10)
  }
  return dias
}

// -------------------------------------------------------------
// Radicados por contestar al corte — más atrasados primero, paginación
// por cursor (keyset sobre el mismo orden del sort: atrasoDias desc,
// diaVencimiento asc, _id asc). El cursor es opaco para el cliente.
// -------------------------------------------------------------
export async function pendientes(corteISO, { areaId, limite = 20, cursor, busqueda } = {}) {
  const despuesDe = cursor ? JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) : null
  const filtroKeyset = despuesDe
    ? {
        $or: [
          { atrasoDias: { $lt: despuesDe.a } },
          { atrasoDias: despuesDe.a, diaVencimiento: { $gt: despuesDe.v } },
          { atrasoDias: despuesDe.a, diaVencimiento: despuesDe.v, _id: { $gt: { $oid: despuesDe.i } } },
        ],
      }
    : {}

  // Filtro de "por contestar" al corte (se reutiliza para el buscador)
  const filtroPendientesAlCorte = {
    diaRadicacion: { $lte: corteISO },
    $or: [{ diaRespuesta: null }, { diaRespuesta: { $gt: corteISO } }],
  }

  // Buscador de la tabla "por contestar": número, asunto o remitente. Esos
  // campos están CIFRADOS en la base, así que Mongo no puede aplicarles un
  // $regex: se traen solo esos tres campos de los pendientes del alcance, se
  // descifran y filtran aquí, y el pipeline principal sigue con los _id que
  // coincidieron. Va ANTES del keyset para que página y total respeten el
  // mismo filtro.
  const texto = typeof busqueda === 'string' ? busqueda.trim().slice(0, 80) : ''
  let filtroBusqueda = null
  if (texto) {
    const patron = new RegExp(escaparRegex(texto), 'i')
    const candidatos = await aggregate(COLECCION, [
      { $match: filtroArea(areaId) },
      { $match: filtroPendientesAlCorte },
      { $project: { numeroRadicado: 1, asunto: 1, remitente: 1 } },
    ])
    const ids = candidatos
      .filter((r) => [r.numeroRadicado, r.asunto, r.remitente].some((t) => patron.test(String(t ?? ''))))
      .map((r) => ({ $oid: oidOf(r._id) }))
    filtroBusqueda = { _id: { $in: ids } }
  }

  const [fila] = await aggregate(COLECCION, [
    { $match: filtroArea(areaId) },
    ...(filtroBusqueda ? [{ $match: filtroBusqueda }] : []),
    { $match: filtroPendientesAlCorte },
    {
      $addFields: {
        atrasoDias: {
          $max: [
            0,
            {
              $divide: [
                { $subtract: [{ $dateFromString: { dateString: corteISO } }, { $dateFromString: { dateString: '$diaVencimiento' } }] },
                DIA_MS,
              ],
            },
          ],
        },
      },
    },
    ...(despuesDe ? [{ $match: filtroKeyset }] : []),
    { $sort: { atrasoDias: -1, diaVencimiento: 1, _id: 1 } },
    {
      $facet: {
        pagina: [{ $limit: limite + 1 }, { $project: { numeroRadicado: 1, asunto: 1, remitente: 1, areaId: 1, encargadoId: 1, diaVencimiento: 1, diaRadicacion: 1, atrasoDias: 1, prioridad: 1, categoria: 1 } }],
        total: [{ $count: 'n' }],
      },
    },
  ])

  const pagina = fila?.pagina ?? []
  const hayMas = pagina.length > limite
  const filas = pagina.slice(0, limite).map((r) => ({
    id: oidOf(r._id),
    numeroRadicado: r.numeroRadicado,
    asunto: r.asunto,
    remitente: r.remitente,
    areaId: oidOf(r.areaId),
    encargadoId: oidOf(r.encargadoId),
    diaRadicacion: r.diaRadicacion,
    diaVencimiento: r.diaVencimiento,
    atrasoDias: Math.round(r.atrasoDias),
    prioridad: r.prioridad,
    categoria: r.categoria,
  }))

  const ultimo = filas[filas.length - 1]
  const siguiente = hayMas && ultimo
    ? Buffer.from(
        JSON.stringify({ a: ultimo.atrasoDias, v: ultimo.diaVencimiento, i: ultimo.id }),
      ).toString('base64url')
    : null

  return { filas, total: fila?.total?.[0]?.n ?? 0, cursor: siguiente }
}

// -------------------------------------------------------------
// Movimiento de gerencia del periodo, desde la bitácora RadicadoEvento:
// enviados (CREADO), reasignaciones (ASIGNADO), prórrogas (PLAZO_CAMBIADO),
// respuestas (RESPONDIDO) y reabiertas (REABIERTO); ritmo por día (fecha
// bogotana via $dateToString con timezone) y últimos movimientos con su
// radicado y usuario ($lookup). Plazo medio = promedio de días entre
// radicación y vencimiento de los enviados del periodo.
// Dos agregados en total: eventos ($facet) y radicados.
// -------------------------------------------------------------
export async function gerencia(desdeInstante, hastaInstante, { areaId } = {}) {
  const [fila] = await aggregate(COLECCION_EVENTOS, [
    {
      $match: {
        fecha: { $gte: { $date: desdeInstante.toISOString() }, $lt: { $date: hastaInstante.toISOString() } },
      },
    },
    {
      $facet: {
        porTipo: [{ $group: { _id: '$tipo', n: { $sum: 1 } } }],
        porDia: [
          {
            $group: {
              _id: { fecha: { $dateToString: { date: '$fecha', format: '%Y-%m-%d', timezone: 'America/Bogota' } }, tipo: '$tipo' },
              n: { $sum: 1 },
            },
          },
        ],
        ultimos: [
          { $sort: { fecha: -1 } },
          { $limit: 20 },
          {
            $lookup: { from: COLECCION, localField: 'radicadoId', foreignField: '_id', as: 'radicado' },
          },
          {
            $lookup: { from: 'usuarios', localField: 'usuarioId', foreignField: '_id', as: 'usuario' },
          },
          {
            $project: {
              tipo: 1,
              detalle: 1,
              fecha: 1,
              numeroRadicado: { $arrayElemAt: ['$radicado.numeroRadicado', 0] },
              asunto: { $arrayElemAt: ['$radicado.asunto', 0] },
              usuario: { $arrayElemAt: ['$usuario.nombre', 0] },
            },
          },
        ],
      },
    },
  ])

  const contar = (tipo) => fila?.porTipo?.find((t) => t._id === tipo)?.n ?? 0

  // Ritmo por día: [{fecha, tipo, n}] plano
  const ritmo = (fila?.porDia ?? []).map((d) => ({ fecha: d._id.fecha, tipo: d._id.tipo, n: d.n }))

  // Plazo medio de los enviados del periodo (aggregate sobre radicados)
  const [plazo] = await aggregate(COLECCION, [
    {
      $match: {
        ...(areaId ? filtroArea(areaId) : {}),
        diaRadicacion: { $gte: desdeInstante.toISOString().slice(0, 10), $lte: new Date(hastaInstante.getTime() - 1).toISOString().slice(0, 10) },
      },
    },
    {
      $group: {
        _id: null,
        plazoMedioDias: {
          $avg: {
            $divide: [
              { $subtract: [{ $dateFromString: { dateString: '$diaVencimiento' } }, { $dateFromString: { dateString: '$diaRadicacion' } }] },
              DIA_MS,
            ],
          },
        },
      },
    },
  ])

  return {
    enviados: contar('creado'),
    reasignaciones: contar('asignado'),
    prorrogas: contar('plazo_cambiado'),
    respondidos: contar('respondido'),
    reabiertas: contar('reabierto'),
    plazoMedioDias: unDecimal(plazo?.plazoMedioDias ?? null),
    ritmo,
    ultimos: (fila?.ultimos ?? []).map((m) => ({
      tipo: m.tipo,
      detalle: m.detalle,
      fecha: fechaOf(m.fecha),
      numeroRadicado: m.numeroRadicado,
      asunto: m.asunto,
      usuario: m.usuario,
    })),
  }
}

// Reexportación práctica para armar comparaciones sin repetir imports.
export { diasEntre }
