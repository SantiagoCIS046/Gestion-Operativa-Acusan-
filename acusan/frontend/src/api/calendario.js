// /api/calendario — calendario hábil (tira "Hoy", mes, festivos, día).
// `mes` trae los mapas `enviados` (por fecha de radicación) y `vencen`
// (pendientes por fecha límite); `dia` lista ambos para esa fecha. `area` (opcional, solo gerencia) filtra
// mes y día por área.

import { cliente } from './cliente.js'

export const CalendarioAPI = {
  hoy: () => cliente.get('/calendario/hoy'),
  mes: (anio, mes, area) => cliente.get('/calendario', { anio, mes, area }),
  festivos: (anio) => cliente.get('/calendario/festivos', { anio }),
  dia: (fecha, area) => cliente.get('/calendario/dia', { fecha, area }),
  // Fecha = desde + N días hábiles (sin fines de semana, festivos ni no laborales)
  sumarHabiles: (desde, dias) => cliente.get('/calendario/sumar-habiles', { desde, dias }),
  listarNoLaborales: () => cliente.get('/calendario/no-laborales'),
  crearNoLaboral: (datos) => cliente.post('/calendario/no-laborales', datos),
  borrarNoLaboral: (id) => cliente.del(`/calendario/no-laborales/${id}`),
}

export default CalendarioAPI
