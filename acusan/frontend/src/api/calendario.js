// /api/calendario — calendario hábil (tira "Hoy", mes, festivos, día).
// `mes` trae el mapa `enviados` (radicados por fecha de radicación) y `dia`
// los radicados enviados esa fecha. `area` (opcional, solo gerencia) filtra
// mes y día por área.

import { cliente } from './cliente.js'

export const CalendarioAPI = {
  hoy: () => cliente.get('/calendario/hoy'),
  mes: (anio, mes, area) => cliente.get('/calendario', { anio, mes, area }),
  festivos: (anio) => cliente.get('/calendario/festivos', { anio }),
  dia: (fecha, area) => cliente.get('/calendario/dia', { fecha, area }),
  listarNoLaborales: () => cliente.get('/calendario/no-laborales'),
  crearNoLaboral: (datos) => cliente.post('/calendario/no-laborales', datos),
  borrarNoLaboral: (id) => cliente.del(`/calendario/no-laborales/${id}`),
}

export default CalendarioAPI
