/**
 * clasificadorRecargos.js — Motor de cálculo de horas extras y recargos.
 *
 * Módulo PURO (sin dependencias, sin BD). Dada una ventana [fechaInicio,
 * fechaFin] y un turno opcional, trocea el tiempo en los bordes del régimen
 * laboral colombiano y clasifica cada tramo:
 *
 *  - Jornada diurna: 06:00–21:00 · Jornada nocturna: 21:00–06:00.
 *  - Cada tramo se clasifica por el día calendario LOCAL (Colombia) en que
 *    cae su INICIO: domingo o festivo → FESTIVA_DIURNA / FESTIVA_NOCTURNA.
 *
 * Colombia es UTC-5 TODO el año (sin horario de verano): la hora local se
 * deriva restando 300 minutos al instante UTC — sin librería de zonas.
 *
 * Turno opcional {horaInicio, horaFin, jornadaEstandar} (horas "HH:mm"
 * locales, admite cruce de medianoche):
 *  - Si la sesión INICIA dentro del turno, las horas hasta el fin del turno
 *    son ordinarias informativas (horasOrdinariasDentroTurno) y las extras
 *    empiezan al salir del turno.
 *  - Si inicia después del fin del turno (o sin turno configurado), TODO es
 *    extra.
 *
 * El redondeo de horas es a múltiplos de 0.25 (cuartos de hora = minutos
 * múltiplos de 15), como en la práctica de nómina.
 */

import { esFestivo } from './festivos.colombia.js'

// Offset fijo de Colombia en minutos (UTC-5, todo el año)
const OFFSET_COLOMBIA_MIN = 300
const MS_DIA = 86400000
const MS_HORA = 3600000

// Bordes de la jornada laboral (minutos locales del día)
const MIN_DIURNA_INICIO = 6 * 60 // 06:00
const MIN_NOCTURNA_INICIO = 21 * 60 // 21:00

// Orden de desempate para tipoDominante (spec: NOCTURNA > DIURNA > FESTIVA_*)
const ORDEN_DOMINANCIA = ['NOCTURNA', 'DIURNA', 'FESTIVA_NOCTURNA', 'FESTIVA_DIURNA']

/** Instante → "epoch local" de Colombia (UTC - 300 min) */
const aEpochLocal = (fecha) => new Date(fecha).getTime() - OFFSET_COLOMBIA_MIN * 60000

/** Epoch local → 'YYYY-MM-DD' de la fecha local colombiana (el epoch local
 *  YA está desplazado: se lee directo como si fuera UTC) */
const cadenaDiaLocal = (epochLocal) => new Date(epochLocal).toISOString().slice(0, 10)

/** Día de la semana (0=domingo) de la fecha LOCAL: medianoche local del
 *  epoch local, leída en UTC (el desplazamiento ya está aplicado) */
const diaSemanaLocal = (epochLocal) => new Date(Math.floor(epochLocal / MS_DIA) * MS_DIA).getUTCDay()

/** Minuto local del día (0–1439) de un epoch local */
const minutoDelDia = (epochLocal) => Math.floor((epochLocal % MS_DIA) / 60000)

/** Minutos → horas redondeadas a múltiplos de 0.25 */
const minutosAHoras = (minutos) => Math.round((minutos / 60) * 4) / 4

/** 'HH:mm' → minutos del día. Devuelve null si el formato no es válido. */
export const parsearHHmm = (texto) => {
  if (typeof texto !== 'string') return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Fecha local de Colombia (UTC-5 fijo) de un instante, como Date ubicado en
 * la medianoche local (UTC 05:00) — determinista sin importar el huso del
 * servidor. Sirve para fijar fechaOperacion en los registros.
 */
export const fechaOperacionDe = (fecha) => {
  const epochLocal = aEpochLocal(fecha)
  const dia = Math.floor(epochLocal / MS_DIA) * MS_DIA
  return new Date(dia + OFFSET_COLOMBIA_MIN * 60000)
}

/**
 * Clasifica la ventana [fechaInicio, fechaFin] contra el régimen laboral y
 * (opcionalmente) un turno. Devuelve:
 * {
 *   DIURNA, NOCTURNA, FESTIVA_DIURNA, FESTIVA_NOCTURNA,  // horas extra por tipo
 *   totalHoras,             // suma de las extras (sin las ordinarias de turno)
 *   horasOrdinariasDentroTurno,
 *   tipoDominante,          // tipo con más horas (desempate NOCTURNA>DIURNA>FESTIVA_*)
 *   sinTurnoConfigurado,    // true cuando no se pasó turno
 *   festivosAplicados       // ['YYYY-MM-DD', ...] festivos que recargaron tramos
 * }
 */
export function clasificar(fechaInicio, fechaFin, turno = null) {
  const inicioMs = aEpochLocal(fechaInicio)
  const finMs = aEpochLocal(fechaFin)

  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)) {
    throw Object.assign(new Error('Fechas inválidas para clasificar la sesión.'), { status: 400 })
  }
  if (finMs <= inicioMs) {
    throw Object.assign(new Error('La fecha final debe ser posterior a la fecha inicial.'), { status: 400 })
  }

  // ── 1. Ventana ordinaria del turno ─────────────────────────────────────────
  let inicioExtraMs = inicioMs
  let minutosOrdinarios = 0

  if (turno) {
    const minInicio = parsearHHmm(turno.horaInicio)
    const minFin = parsearHHmm(turno.horaFin)
    if (minInicio === null || minFin === null || minInicio === minFin) {
      throw Object.assign(
        new Error(`Turno con horario inválido (${turno.horaInicio} → ${turno.horaFin}).`),
        { status: 400 }
      )
    }
    const cruzaMedianoche = minFin < minInicio
    const minutoInicioSesion = minutoDelDia(inicioMs)
    const dentroDelTurno = cruzaMedianoche
      ? minutoInicioSesion >= minInicio || minutoInicioSesion < minFin
      : minutoInicioSesion >= minInicio && minutoInicioSesion < minFin

    if (dentroDelTurno) {
      // Fin del turno sobre el día en que arranca la sesión (si cruza
      // medianoche y la sesión arranca en el tramo nocturno, el fin cae al
      // día siguiente; si arranca de madrugada en la cola del turno, el fin
      // es el de ese mismo día).
      const medianocheInicio = Math.floor(inicioMs / MS_DIA) * MS_DIA
      const finTurnoLocal =
        cruzaMedianoche && minutoInicioSesion >= minInicio ? minFin + 1440 : minFin
      const finTurnoMs = medianocheInicio + finTurnoLocal * 60000
      const finOrdinarioMs = Math.min(finTurnoMs, finMs)
      if (finOrdinarioMs > inicioMs) {
        minutosOrdinarios = Math.round((finOrdinarioMs - inicioMs) / 60000)
        inicioExtraMs = finOrdinarioMs
      }
    }
    // Si inicia fuera del turno (antes o después): todo es extra.
  }

  // ── 2. Trocear la ventana extra en los bordes 06:00 / 21:00 / medianoche ──
  const minutosPorTipo = { DIURNA: 0, NOCTURNA: 0, FESTIVA_DIURNA: 0, FESTIVA_NOCTURNA: 0 }
  const festivosAplicados = new Set()

  let t = inicioExtraMs
  while (t < finMs) {
    const medianoche = Math.floor(t / MS_DIA) * MS_DIA
    const bordes = [
      medianoche + MIN_DIURNA_INICIO * 60000,
      medianoche + MIN_NOCTURNA_INICIO * 60000,
      medianoche + MS_DIA
    ].filter((b) => b > t)
    const siguiente = Math.min(finMs, ...bordes)

    const minLocal = minutoDelDia(t)
    const esNocturno = minLocal >= MIN_NOCTURNA_INICIO || minLocal < MIN_DIURNA_INICIO
    const cadenaDia = cadenaDiaLocal(t)
    const diaSemana = diaSemanaLocal(t)
    const esDomingoOFestivo = diaSemana === 0 || esFestivo(cadenaDia)

    const tipo = esDomingoOFestivo
      ? (esNocturno ? 'FESTIVA_NOCTURNA' : 'FESTIVA_DIURNA')
      : (esNocturno ? 'NOCTURNA' : 'DIURNA')

    minutosPorTipo[tipo] += Math.round((siguiente - t) / 60000)
    // festivosAplicados: solo festivos reales que recargaron al menos un tramo
    // (un domingo solo no se reporta como festivo)
    if (diaSemana !== 0 && esFestivo(cadenaDia)) festivosAplicados.add(cadenaDia)

    t = siguiente
  }

  // ── 3. Resultado con redondeo a cuartos de hora ────────────────────────────
  const horasPorTipo = {
    DIURNA: minutosAHoras(minutosPorTipo.DIURNA),
    NOCTURNA: minutosAHoras(minutosPorTipo.NOCTURNA),
    FESTIVA_DIURNA: minutosAHoras(minutosPorTipo.FESTIVA_DIURNA),
    FESTIVA_NOCTURNA: minutosAHoras(minutosPorTipo.FESTIVA_NOCTURNA)
  }
  // Total = suma de los tipos YA redondeados: así totalHoras siempre cuadra
  // con el desglose que se muestra (redondear la suma cruda podía diferir en
  // tramos menores a 15 min repartidos entre varios tipos)
  const totalHoras = Object.values(horasPorTipo).reduce((a, b) => a + b, 0)

  let tipoDominante = null
  for (const tipo of ORDEN_DOMINANCIA) {
    if (horasPorTipo[tipo] > 0 && horasPorTipo[tipo] >= Math.max(...Object.values(horasPorTipo))) {
      tipoDominante = tipo
      break
    }
  }

  return {
    ...horasPorTipo,
    totalHoras,
    horasOrdinariasDentroTurno: minutosAHoras(minutosOrdinarios),
    tipoDominante,
    sinTurnoConfigurado: !turno,
    festivosAplicados: [...festivosAplicados].sort()
  }
}
