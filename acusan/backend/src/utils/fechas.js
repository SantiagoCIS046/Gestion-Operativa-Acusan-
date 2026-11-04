// Utilidades de fechas del módulo de radicados.
// Todo el conteo se hace en días de CALENDARIO de la zona America/Bogotá
// (UTC-5, sin horario de verano), no en milisegundos absolutos: un radicado
// que vence el 20 sigue "venciendo el 20" sin importar la hora.

export const ZONA_HORARIA = 'America/Bogota'

export const ESTADO_VENCIDO = 'vencido'

const MS_POR_DIA = 24 * 60 * 60 * 1000

// Colombia es UTC-5 fijo (sin horario de verano): la medianoche de Bogotá
// de un día de calendario es ese día a las 05:00Z. Esa es la convención de
// almacenamiento de fechaRadicacion/fechaLimite: así el mismo Date muestra
// el día correcto tanto en hora local como al contar días de calendario con
// estas utilidades.
export const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000

// Fecha de calendario 'YYYY-MM-DD' de un instante en la zona dada.
// ('en-CA' produce exactamente el formato ISO corto.)
// Exportada desde el módulo de radicados: comparar el día de la respuesta
// contra el día límite en calendario bogotano.
export function fechaCalendario(instante, zona = ZONA_HORARIA) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante)
}

// Hoy en Bogotá como 'YYYY-MM-DD'. Acepta un instante opcional para pruebas.
export function hoyBogota(ahora = new Date()) {
  return fechaCalendario(ahora)
}

// Instante UTC de la medianoche de una fecha 'YYYY-MM-DD'.
function medianocheUTC(fechaISO) {
  return Date.parse(`${fechaISO}T00:00:00.000Z`)
}

// Normaliza cualquier entrada (Date, 'YYYY-MM-DD', ISO con hora) a su
// fecha de calendario interpretada en horario de Bogotá.
export function aCalendarioBogota(fecha) {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha
  }
  return fechaCalendario(new Date(fecha))
}

// Date correspondiente a la medianoche de Bogotá del día de calendario
// hoy+n (n=0 → hoy, n=-3 → hace 3 días, n=30 → dentro de 30 días).
// Útil para sembrar fechas y para cotas de rango en consultas.
export function enDias(n, hoy = hoyBogota()) {
  return new Date(medianocheUTC(hoy) + OFFSET_BOGOTA_MS + n * MS_POR_DIA)
}

// Días de calendario entre hoy (Bogotá) y la fecha:
// positivo = aún no vence · 0 = vence hoy · negativo = ya venció.
export function diasHasta(fecha, hoy = hoyBogota()) {
  const objetivo = medianocheUTC(aCalendarioBogota(fecha))
  const actual = medianocheUTC(hoy)
  return Math.round((objetivo - actual) / MS_POR_DIA)
}

// -------------------------------------------------------------
// RADICADOS
// La ventana de "por vencer" del semáforo visual.
// -------------------------------------------------------------
export const RADICADO_DIAS_POR_VENCER = 7

export const RADICADO_SANO = 'sano'
export const RADICADO_POR_VENCER = 'por_vencer'

// Días de calendario restantes hasta la fecha límite de un radicado.
// Positivo = aún hay plazo · 0 = vence hoy · negativo = vencido.
export function diasRestantes(fechaLimite, hoy = hoyBogota()) {
  return diasHasta(fechaLimite, hoy)
}

// Estado visual de un radicado PENDIENTE según su fecha límite:
// 'sano' | 'por_vencer' | 'vencido' (día límite inclusive → por_vencer).
// El estado ALMACENADO (pendiente/respondido) vive en el modelo; este es el
// derivado por plazo que alimenta el semáforo.
export function estadoRadicado(fechaLimite, hoy = hoyBogota()) {
  const dias = diasRestantes(fechaLimite, hoy)
  if (dias < 0) return ESTADO_VENCIDO
  if (dias <= RADICADO_DIAS_POR_VENCER) return RADICADO_POR_VENCER
  return RADICADO_SANO
}

export const RESULTADO_A_TIEMPO = 'a_tiempo'
export const RESULTADO_CON_RETRASO = 'con_retraso'

// Resultado de una respuesta comparando DÍAS DE CALENDARIO bogotanos:
// responder el mismo día de la límite (o antes) es 'a_tiempo'; a partir del
// día siguiente es 'con_retraso'.
export function resultadoRespuesta(fechaRespuesta, fechaLimite) {
  const respuesta = medianocheUTC(aCalendarioBogota(fechaRespuesta))
  const limite = medianocheUTC(aCalendarioBogota(fechaLimite))
  return respuesta <= limite ? RESULTADO_A_TIEMPO : RESULTADO_CON_RETRASO
}

// Medianoche de Bogotá (05:00Z) de un día 'YYYY-MM-DD' — la convención de
// almacenamiento de todo el modelo — y su inverso sobre un Date así creado.
// Las usa src/lib/calendarioCO.js para claves e instantes de periodos.
export function medianocheBogotaDe(isoFecha) {
  return new Date(medianocheUTC(isoFecha) + OFFSET_BOGOTA_MS)
}

// Suma n días de calendario a 'YYYY-MM-DD' (n puede ser negativo).
export function sumarDiasISO(isoFecha, n) {
  return new Date(medianocheUTC(isoFecha) + n * MS_POR_DIA).toISOString().slice(0, 10)
}

export function isoDe(date) {
  return new Date(date.getTime() - OFFSET_BOGOTA_MS).toISOString().slice(0, 10)
}

// -------------------------------------------------------------
// PERIODOS DE CALENDARIO (primitivas puras, lunes a domingo / mes
// calendario). El CORTE por días hábiles — festivos Colombia y días no
// laborales extra — vive en src/lib/calendarioCO.js, que reutiliza estas
// primitivas para ubicar claves y fines naturales de periodo.
// -------------------------------------------------------------

// Día de semana (0=domingo … 1=lunes) de un día 'YYYY-MM-DD'.
export function diaSemanaISO(isoFecha) {
  return new Date(medianocheUTC(isoFecha)).getUTCDay()
}

// Lunes de la semana bogotana de la fecha (ella misma si es lunes).
export function inicioSemana(fecha) {
  const d = aCalendarioBogota(fecha)
  return medianocheBogotaDe(sumarDiasISO(d, -((diaSemanaISO(d) + 6) % 7)))
}

// Domingo de la semana bogotana de la fecha (ella misma si es domingo).
export function finSemana(fecha) {
  const d = aCalendarioBogota(fecha)
  return medianocheBogotaDe(sumarDiasISO(d, 6 - ((diaSemanaISO(d) + 6) % 7)))
}

// Día 1 del mes bogotano de la fecha.
export function inicioMes(fecha) {
  const d = aCalendarioBogota(fecha)
  return medianocheBogotaDe(`${d.slice(0, 8)}01`)
}

// Último día del mes bogotano de la fecha (28/29/30/31 según el mes).
export function finMes(fecha) {
  const d = aCalendarioBogota(fecha)
  const [a, m] = d.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return medianocheBogotaDe(`${d.slice(0, 8)}${String(ultimo).padStart(2, '0')}`)
}
