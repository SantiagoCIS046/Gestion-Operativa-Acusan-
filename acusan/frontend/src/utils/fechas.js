// Utilidades de fechas del frontend (espejo de las convenciones del backend).
//
// El backend guarda todas las fechas a medianoche de Bogotá (05:00Z), así el
// día UTC de la cadena ISO coincide con el día de calendario bogotano: cortar
// la cadena es seguro para <input type="date"> y para mostrar en pantalla.

const MS_DIA = 24 * 60 * 60 * 1000

// 'YYYY-MM-DD' de cualquier fecha del backend (lista para inputs y compares)
export function fechaInput(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// Hoy del navegador como 'YYYY-MM-DD' (los usuarios del sistema están en Bogotá)
export function hoyISO() {
  const ahora = new Date()
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// DD/MM/AAAA corto institucional para listar en pantalla
export function fechaLarga(fecha) {
  const iso = fechaInput(fecha)
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Suma meses de calendario a 'YYYY-MM-DD' ajustando el día al último del mes
// (31 de enero + 1 mes = 28/29 de febrero, como en las renovaciones)
export function sumaMeses(fechaISO, meses) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(d, ultimoDia))
  return base.toISOString().slice(0, 10)
}

// Suma días a 'YYYY-MM-DD'
export function sumaDias(fechaISO, dias) {
  return new Date(Date.parse(`${fechaISO}T00:00:00.000Z`) + dias * MS_DIA).toISOString().slice(0, 10)
}
