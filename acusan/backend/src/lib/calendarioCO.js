// Calendario hábil de Colombia — sin dependencias, sin tablas fijas ni APIs
// externas: los festivos se calculan para cualquier año (fijos, Ley
// Emiliani y los móviles de Pascua con el algoritmo gregoriano anónimo).
//
// Todos los días se manejan como 'YYYY-MM-DD' del CALENDARIO de
// America/Bogotá (UTC-5 fijo); los instantes que devuelven las funciones
// de periodo son medianoches de Bogotá (05:00Z), la convención del modelo.
//
// Además de los festivos oficiales, gerencia puede registrar días no
// laborales extra (modelo DiaNoLaboral): esHabil/tipoDia y los periodos
// los consideran. El resultado por año y la lista de no laborales viven
// en caché en memoria (se refresca con cargarDiasNoLaborales(true)).

import { PrismaClient } from '@prisma/client'

import {
  ZONA_HORARIA,
  OFFSET_BOGOTA_MS,
  aCalendarioBogota,
  fechaCalendario,
  hoyBogota,
  inicioSemana,
  finSemana,
  inicioMes,
  finMes,
  medianocheBogotaDe,
  sumarDiasISO,
  isoDe,
} from '../utils/fechas.js'

const MS_POR_DIA = 24 * 60 * 60 * 1000

const prisma = new PrismaClient()

export const TIPO_SEMANAL = 'semanal'
export const TIPO_MENSUAL = 'mensual'

// -------------------------------------------------------------
// Pascua (domingo) — algoritmo gregoriano anónimo (Meeus/Jones/Butcher)
// -------------------------------------------------------------
function pascua(anio) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return { mes, dia }
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function diaSemana(isoFecha) {
  return new Date(`${isoFecha}T00:00:00.000Z`).getUTCDay() // 0=domingo … 6=sábado
}

// Traslado Ley Emiliani: si no cae lunes, se mueve al lunes siguiente.
function trasladarALunes(isoFecha) {
  const d = diaSemana(isoFecha)
  return d === 1 ? isoFecha : sumarDiasISO(isoFecha, (8 - d) % 7)
}

// -------------------------------------------------------------
// Festivos oficiales del año (cacheado por año en memoria)
// -------------------------------------------------------------
const cacheFestivos = new Map() // anio → Map iso → [nombres]

export function festivosDelAnio(anio) {
  const ya = cacheFestivos.get(anio)
  if (ya) return [...ya.values()].flat()

  const p = pascua(anio)
  const pascuaISO = iso(anio, p.mes, p.dia)
  const agregar = (map, fecha, nombre, tipo) => {
    const previo = map.get(fecha) || []
    previo.push({ fecha, nombre, tipo })
    map.set(fecha, previo)
  }

  const crudos = new Map()
  // a. Fijos
  agregar(crudos, iso(anio, 1, 1), 'Año Nuevo', 'fijo')
  agregar(crudos, iso(anio, 5, 1), 'Día del Trabajo', 'fijo')
  agregar(crudos, iso(anio, 7, 20), 'Independencia de Colombia', 'fijo')
  agregar(crudos, iso(anio, 8, 7), 'Batalla de Boyacá', 'fijo')
  agregar(crudos, iso(anio, 12, 8), 'Inmaculada Concepción', 'fijo')
  agregar(crudos, iso(anio, 12, 25), 'Navidad', 'fijo')
  // b. Se trasladan al lunes siguiente (Ley Emiliani)
  agregar(crudos, trasladarALunes(iso(anio, 1, 6)), 'Reyes Magos', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 3, 19)), 'San José', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 6, 29)), 'San Pedro y San Pablo', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 8, 15)), 'Asunción de la Virgen', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 10, 12)), 'Día de la Raza', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 11, 1)), 'Todos los Santos', 'emiliani')
  agregar(crudos, trasladarALunes(iso(anio, 11, 11)), 'Independencia de Cartagena', 'emiliani')
  // c. Según Pascua: Jueves y Viernes Santo sin traslado; Ascensión,
  //    Corpus y Sagrado Corazón ya trasladados al lunes
  agregar(crudos, sumarDiasISO(pascuaISO, -3), 'Jueves Santo', 'pascua')
  agregar(crudos, sumarDiasISO(pascuaISO, -2), 'Viernes Santo', 'pascua')
  agregar(crudos, trasladarALunes(sumarDiasISO(pascuaISO, 43)), 'Ascensión del Señor', 'pascua')
  agregar(crudos, trasladarALunes(sumarDiasISO(pascuaISO, 64)), 'Corpus Christi', 'pascua')
  agregar(crudos, trasladarALunes(sumarDiasISO(pascuaISO, 71)), 'Sagrado Corazón', 'pascua')

  cacheFestivos.set(anio, crudos)
  return festivosDelAnio(anio)
}

function festivosOficialesDe(isoFecha) {
  const anio = Number(isoFecha.slice(0, 4))
  return festivosDelAnio(anio).filter((f) => f.fecha === isoFecha)
}

// -------------------------------------------------------------
// Días no laborales extra (gerencia) — caché en memoria
// -------------------------------------------------------------
let cacheNoLaborales = null // Map iso → nombre | null mientras no se cargue

export async function cargarDiasNoLaborales(refrescar = false) {
  if (cacheNoLaborales && !refrescar) return cacheNoLaborales
  const filas = await prisma.diaNoLaboral.findMany()
  cacheNoLaborales = new Map(filas.map((d) => [aCalendarioBogota(d.fecha), d.nombre]))
  return cacheNoLaborales
}

async function nombreNoLaboral(isoFecha) {
  const mapa = await cargarDiasNoLaborales()
  return mapa.get(isoFecha) || null
}

// -------------------------------------------------------------
// Clasificación de días
// -------------------------------------------------------------
export function esFestivo(fecha) {
  return festivosOficialesDe(aCalendarioBogota(fecha)).length > 0
}

export function nombreFestivoOficial(fecha) {
  const nombres = festivosOficialesDe(aCalendarioBogota(fecha)).map((f) => f.nombre)
  return nombres.length ? nombres.join(' y ') : null
}

// Nombre completo del día no hábil: festivos oficiales + no laborales
// extra registrados por gerencia (ambos si coinciden).
export async function nombreFestivo(fecha) {
  const isoFecha = aCalendarioBogota(fecha)
  const nombres = festivosOficialesDe(isoFecha).map((f) => f.nombre)
  const extra = await nombreNoLaboral(isoFecha)
  if (extra) nombres.push(extra)
  return nombres.length ? nombres.join(' y ') : null
}

// 'habil' | 'fin_de_semana' | 'festivo'. Un festivo que cae en fin de
// semana es 'fin_de_semana' (y conserva su nombre vía nombreFestivo).
// Los días no laborales extra cuentan como 'festivo'.
export async function tipoDia(fecha) {
  const isoFecha = aCalendarioBogota(fecha)
  const d = diaSemana(isoFecha)
  if (d === 0 || d === 6) return 'fin_de_semana'
  if (festivosOficialesDe(isoFecha).length > 0) return 'festivo'
  if (await nombreNoLaboral(isoFecha)) return 'festivo'
  return 'habil'
}

export async function esHabil(fecha) {
  return (await tipoDia(fecha)) === 'habil'
}

// Último día hábil <= la fecha.
export async function ultimoDiaHabil(fecha) {
  let isoFecha = aCalendarioBogota(fecha)
  for (let i = 0; i < 400; i++) {
    if (await esHabil(isoFecha)) return medianocheBogotaDe(isoFecha)
    isoFecha = sumarDiasISO(isoFecha, -1)
  }
  throw new Error(`Sin día hábil antes de ${isoFecha}`)
}

// Primer día hábil >= la fecha.
export async function siguienteDiaHabil(fecha) {
  let isoFecha = aCalendarioBogota(fecha)
  for (let i = 0; i < 400; i++) {
    if (await esHabil(isoFecha)) return medianocheBogotaDe(isoFecha)
    isoFecha = sumarDiasISO(isoFecha, 1)
  }
  throw new Error(`Sin día hábil después de ${isoFecha}`)
}

// Días hábiles de calendario entre a y b, inclusivos en ambos extremos.
export async function diasHabilesEntre(a, b) {
  const desde = aCalendarioBogota(a)
  const hasta = aCalendarioBogota(b)
  if (desde > hasta) return 0
  // Rango chico (semana/mes): día a día es más barato que precomputar
  const noLaborales = await cargarDiasNoLaborales()
  let n = 0
  let isoFecha = desde
  while (isoFecha <= hasta) {
    const d = diaSemana(isoFecha)
    if (d !== 0 && d !== 6 && !festivosOficialesDe(isoFecha).length && !noLaborales.has(isoFecha)) n++
    isoFecha = sumarDiasISO(isoFecha, 1)
  }
  return n
}

// Suma n días HÁBILES a la fecha (n negativo retrocede). La fecha base
// cuenta solo si es hábil: sumarDiasHabiles(viernes, 1) = lunes.
export async function sumarDiasHabiles(fecha, n) {
  const paso = n >= 0 ? 1 : -1
  let restantes = Math.abs(n)
  let isoFecha = aCalendarioBogota(fecha)
  while (restantes > 0) {
    isoFecha = sumarDiasISO(isoFecha, paso)
    if (await esHabil(isoFecha)) restantes--
  }
  return medianocheBogotaDe(isoFecha)
}

export async function diasHabilesDelMes(anio, mes) {
  return diasHabilesEntre(`${anio}-${String(mes).padStart(2, '0')}-01`, isoDe(finMes(`${anio}-${String(mes).padStart(2, '0')}-15`)))
}

// Todos los días del mes con su clasificación.
export async function calendarioDelMes(anio, mes) {
  const prefix = `${anio}-${String(mes).padStart(2, '0')}`
  const ultimo = Number(isoDe(finMes(`${prefix}-15`)).slice(8, 10))
  const dias = []
  for (let d = 1; d <= ultimo; d++) {
    const fecha = `${prefix}-${String(d).padStart(2, '0')}`
    dias.push({
      fecha,
      diaSemana: diaSemana(fecha),
      tipo: await tipoDia(fecha),
      nombreFestivo: await nombreFestivo(fecha),
    })
  }
  return dias
}

// -------------------------------------------------------------
// PERIODOS CON CORTE POR DÍAS HÁBILES
// Un periodo (semana o mes) termina al cierre de su último día hábil;
// lo que ocurre después (sábado, domingo o festivo posterior al corte)
// se cuenta en el periodo siguiente. Los periodos son contiguos: el
// hastaInstante de uno es exactamente el desdeInstante del siguiente.
//
// Semana: se identifica por su LUNES (clave). Mes: por su día 1.
// -------------------------------------------------------------
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

async function ultimoDiaHabilISO(isoFecha) {
  let f = isoFecha
  while (!(await esHabil(f))) f = sumarDiasISO(f, -1)
  return f
}

export async function periodoDe(tipo, fecha) {
  const dia = aCalendarioBogota(fecha)
  const claveISO = tipo === TIPO_SEMANAL ? isoDe(inicioSemana(dia)) : `${dia.slice(0, 8)}01`
  const finNaturalISO = tipo === TIPO_SEMANAL ? sumarDiasISO(claveISO, 6) : isoDe(finMes(dia))
  const hastaDiaISO = await ultimoDiaHabilISO(finNaturalISO)

  // Lo que ocurre después del corte (sábado, domingo o festivo posterior)
  // pertenece al periodo siguiente.
  if (dia > hastaDiaISO) {
    return periodoDe(tipo, sumarDiasISO(finNaturalISO, 1))
  }

  // desdeDia = día siguiente al último hábil del periodo anterior:
  // contigüidad exacta de instantes.
  const finNaturalAnteriorISO = sumarDiasISO(claveISO, -1)
  const desdeDiaISO = sumarDiasISO(await ultimoDiaHabilISO(finNaturalAnteriorISO), 1)

  const festivosIncluidos = []
  let f = desdeDiaISO
  while (f <= hastaDiaISO) {
    const nombre = await nombreFestivo(f)
    if (nombre) festivosIncluidos.push({ fecha: f, nombre })
    f = sumarDiasISO(f, 1)
  }

  return {
    clave: medianocheBogotaDe(claveISO),
    claveISO,
    desdeDia: medianocheBogotaDe(desdeDiaISO),
    hastaDia: medianocheBogotaDe(hastaDiaISO),
    desdeInstante: medianocheBogotaDe(desdeDiaISO),
    hastaInstante: medianocheBogotaDe(sumarDiasISO(hastaDiaISO, 1)),
    diasHabiles: await diasHabilesEntre(desdeDiaISO, hastaDiaISO),
    festivosIncluidos,
  }
}

export async function periodoAnterior(tipo, clave) {
  const isoClave = aCalendarioBogota(clave)
  if (tipo === TIPO_SEMANAL) return medianocheBogotaDe(sumarDiasISO(isoClave, -7))
  const [a, m] = isoClave.split('-').map(Number)
  const aa = m === 1 ? a - 1 : a
  const mm = m === 1 ? 12 : m - 1
  return medianocheBogotaDe(`${aa}-${String(mm).padStart(2, '0')}-01`)
}

async function periodoSiguiente(tipo, clave) {
  const isoClave = aCalendarioBogota(clave)
  if (tipo === TIPO_SEMANAL) return medianocheBogotaDe(sumarDiasISO(isoClave, 7))
  const [a, m] = isoClave.split('-').map(Number)
  const aa = m === 12 ? a + 1 : a
  const mm = m === 12 ? 1 : m + 1
  return medianocheBogotaDe(`${aa}-${String(mm).padStart(2, '0')}-01`)
}

// Claves de TODOS los periodos del tipo ya cerrados desde `desde` (una
// fecha cualquiera dentro del primer periodo considerado) hasta ahora.
// Cerrado = ahora >= hastaInstante: en la primera ejecución posterior a
// la medianoche del último día hábil. Devuelve las claves; el servicio
// filtra las que ya tienen informe. Nunca entra el periodo en curso.
export async function periodosCerradosPendientes(tipo, desde, ahora = new Date()) {
  let clave = (await periodoDe(tipo, desde)).clave
  const ahoraMs = ahora.getTime()
  const claves = []
  for (let i = 0; i < 2000; i++) {
    const p = await periodoDe(tipo, clave)
    if (p.hastaInstante.getTime() > ahoraMs) break
    claves.push(clave)
    clave = await periodoSiguiente(tipo, clave)
  }
  return claves
}

// Etiqueta canónica SIN consultas: la misma regla de etiquetaPeriodo pero
// derivada de campos que ya viven guardados en el informe (periodoInicio,
// periodoFin, diasHabiles). Sirve para re-rotular filas viejas en cada
// lectura — la etiqueta guardada puede ser de un formateador anterior.
// claveISO = lunes (semanal) o día 1 (mensual); hastaDiaISO = último día hábil.
export function etiquetaDesdeCampos(tipo, claveISO, hastaDiaISO, diasHabiles) {
  const [a1, m1, d1] = claveISO.slice(0, 10).split('-').map(Number)
  const [a2, m2, d2] = hastaDiaISO.slice(0, 10).split('-').map(Number)
  let rango
  if (tipo === TIPO_MENSUAL) {
    rango = `${MESES_LARGOS[m2 - 1]} ${a2}`
  } else if (a1 === a2 && m1 === m2) {
    rango = `Semana ${d1}–${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`
  } else if (a1 === a2) {
    rango = `Semana ${d1} ${MESES_CORTOS[m1 - 1]} – ${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`
  } else {
    rango = `Semana ${d1} ${MESES_CORTOS[m1 - 1]} ${a1} – ${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`
  }
  return `${rango} · ${diasHabiles} días hábiles`
}

export async function etiquetaPeriodo(tipo, clave) {
  const p = await periodoDe(tipo, clave)
  // El rango arranca en la CLAVE (lunes o día 1): el desdeDia contable
  // puede ser un sábado de la semana anterior.
  return etiquetaDesdeCampos(tipo, aCalendarioBogota(clave), p.hastaDia.toISOString(), p.diasHabiles)
}

// -------------------------------------------------------------
// SEMANAS DEL MES CON CORTE HÁBIL (regla de informes, 2026-10)
// El mes natural se parte en bloques de días hábiles CONTINUOS,
// numerados Semana 1, 2, 3… en orden. Un festivo intermedio corta el
// bloque (octubre 2026: S3 = mar 13 – vie 16 porque el lunes 12 es
// festivo); sábados, domingos y festivos posteriores cuentan en el
// bloque siguiente y las semanas suman exactamente el mes. Cada bloque
// expone sus instantes de corte [desde, hasta) con la convención del
// modelo para reuso directo en las consultas de métricas.
// -------------------------------------------------------------
export async function semanasDelMesHabil(anio, mes) {
  const prefix = `${anio}-${String(mes).padStart(2, '0')}`
  const ultimoDia = Number(isoDe(finMes(`${prefix}-15`)).slice(8, 10))
  const semanas = []
  let actual = null
  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = `${prefix}-${String(d).padStart(2, '0')}`
    if (!(await esHabil(fecha))) continue
    if (actual && sumarDiasISO(actual.finISO, 1) === fecha) {
      actual.finISO = fecha
      actual.diasHabiles += 1
    } else {
      actual = { inicioISO: fecha, finISO: fecha, diasHabiles: 1 }
      semanas.push(actual)
    }
  }
  semanas.forEach((s, i) => {
    s.numero = i + 1
    s.desdeInstante = medianocheBogotaDe(s.inicioISO)
    s.hastaInstante = medianocheBogotaDe(sumarDiasISO(s.finISO, 1))
  })
  return semanas
}

// Día y festivos para la tira "Hoy" y endpoints del calendario.
export async function resumenHoy(ahora = new Date()) {
  const dia = fechaCalendario(ahora, ZONA_HORARIA)
  const tipo = await tipoDia(dia)
  const proximo = await proximoFestivo(dia)
  return {
    fecha: dia,
    diaSemana: diaSemana(dia),
    tipo,
    nombreFestivo: await nombreFestivo(dia),
    proximoFestivo: proximo,
  }
}

async function proximoFestivo(desdeISO) {
  let f = sumarDiasISO(desdeISO, 1)
  for (let i = 0; i < 400; i++) {
    const nombre = await nombreFestivo(f)
    if (nombre) {
      return { fecha: f, nombre, faltanDias: Math.round((Date.parse(`${f}T00:00:00.000Z`) - Date.parse(`${desdeISO}T00:00:00.000Z`)) / MS_POR_DIA) }
    }
    f = sumarDiasISO(f, 1)
  }
  return null
}

export { hoyBogota, OFFSET_BOGOTA_MS }
