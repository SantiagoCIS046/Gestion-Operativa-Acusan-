/**
 * festivos.colombia.js — Calendario de festivos nacionales de Colombia.
 *
 * Módulo PURO (sin dependencias, sin BD): calcula los festivos de cualquier
 * año con el algoritmo Meeus/Jones/Butcher para el domingo de Pascua y las
 * reglas de la Ley 51 de 1982 (traslado al lunes siguiente).
 *
 * Reglas:
 *  - Fijos NO trasladables: 1-ene, 1-may, 20-jul, 7-ago, 8-dic, 25-dic,
 *    Jueves Santo (Pascua-3) y Viernes Santo (Pascua-2).
 *  - Trasladas al lunes siguiente cuando NO caen lunes: 6-ene, 19-mar,
 *    29-jun, 15-ago, 12-oct, 1-nov, 11-nov.
 *  - Móviles que SIEMPRE caen lunes (fechas ya desplazadas): Ascención
 *    (Pascua+43), Corpus Christi (Pascua+64), Sagrado Corazón (Pascua+71).
 *
 * Colombia no usa horario de verano: todo el país vive en UTC-5 fijo, así que
 * la fecha local se deriva restando 300 minutos al instante UTC.
 */

// Offset fijo de Colombia en minutos (UTC-5, todo el año)
const OFFSET_COLOMBIA_MIN = 300
const MS_DIA = 86400000

// Cache por año: el calendario no cambia entre llamadas del mismo proceso
const cachePorAnio = new Map()

/**
 * Domingo de Pascua del año (algoritmo Meeus/Jones/Butcher, calendario
 * gregoriano). Devuelve un Date en UTC-medianoche.
 */
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
  return new Date(Date.UTC(anio, mes - 1, dia))
}

const cadena = (d) => d.toISOString().slice(0, 10) // 'YYYY-MM-DD' (fechas UTC-medianoche)

const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * MS_DIA)

/**
 * Festivo trasladable (Ley 51/1982): si no cae lunes se mueve al lunes
 * siguiente; si ya es lunes se queda ese día.
 */
function trasladarALunes(fecha) {
  const diaSemana = fecha.getUTCDay() // 0=domingo ... 1=lunes
  if (diaSemana === 1) return fecha
  // Domingo → +1 día; martes a sábado → hasta el próximo lunes (8 - día)
  return sumarDias(fecha, diaSemana === 0 ? 1 : 8 - diaSemana)
}

/**
 * Construye la lista completa de festivos de un año, ordenada por fecha.
 * Cada entrada: { fecha: 'YYYY-MM-DD', descripcion }.
 */
export function festivosDelAnio(anio) {
  anio = Number(anio)
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2200) {
    throw Object.assign(new Error(`Año inválido para el calendario de festivos: ${anio}`), { status: 400 })
  }

  const enCache = cachePorAnio.get(anio)
  if (enCache) return enCache

  const p = pascua(anio)
  const juevesSanto = sumarDias(p, -3)
  const viernesSanto = sumarDias(p, -2)
  // Los tres móviles ya caen lunes por construcción (Pascua es domingo:
  // +43, +64 y +71 son múltiplos de 7 más 1 día)
  const ascension = sumarDias(p, 43)
  const corpusChristi = sumarDias(p, 64)
  const sagradoCorazon = sumarDias(p, 71)

  const lista = []

  // Fijos no trasladables
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 0, 1))), descripcion: 'Año Nuevo' })
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 4, 1))), descripcion: 'Día del Trabajo' })
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 6, 20))), descripcion: 'Grito de Independencia' })
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 7, 7))), descripcion: 'Batalla de Boyacá' })
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 11, 8))), descripcion: 'Inmaculada Concepción' })
  lista.push({ fecha: cadena(new Date(Date.UTC(anio, 11, 25))), descripcion: 'Navidad' })

  // Semana Santa (no trasladables)
  lista.push({ fecha: cadena(juevesSanto), descripcion: 'Jueves Santo' })
  lista.push({ fecha: cadena(viernesSanto), descripcion: 'Viernes Santo' })

  // Trasladas al lunes siguiente si no caen lunes
  const TRASLADABLES = [
    [[0, 6], 'Reyes Magos'],
    [[2, 19], 'San José'],
    [[5, 29], 'San Pedro y San Pablo'],
    [[7, 15], 'Asunción de la Virgen'],
    [[9, 12], 'Día de la Raza'],
    [[10, 1], 'Todos los Santos'],
    [[10, 11], 'Independencia de Cartagena']
  ]
  for (const [[mes, dia], descripcion] of TRASLADABLES) {
    lista.push({ fecha: cadena(trasladarALunes(new Date(Date.UTC(anio, mes, dia)))), descripcion })
  }

  // Móviles que siempre caen lunes
  lista.push({ fecha: cadena(ascension), descripcion: 'Ascención del Señor' })
  lista.push({ fecha: cadena(corpusChristi), descripcion: 'Corpus Christi' })
  lista.push({ fecha: cadena(sagradoCorazon), descripcion: 'Sagrado Corazón de Jesús' })

  lista.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0))
  cachePorAnio.set(anio, lista)
  return lista
}

/**
 * ¿La fecha es festivo nacional de Colombia?
 * Acepta un Date (se interpreta en hora local de Colombia, UTC-5 fijo)
 * o una cadena 'YYYY-MM-DD'.
 */
export function esFestivo(fecha) {
  let clave
  if (typeof fecha === 'string') {
    clave = fecha.slice(0, 10)
  } else if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    // Fecha local de Colombia del instante: UTC - 300 min → YYYY-MM-DD
    clave = new Date(fecha.getTime() - OFFSET_COLOMBIA_MIN * 60000).toISOString().slice(0, 10)
  } else {
    return false
  }
  const anio = Number(clave.slice(0, 4))
  if (!Number.isInteger(anio)) return false
  return festivosDelAnio(anio).some((f) => f.fecha === clave)
}
