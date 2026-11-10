// /api/informes — control periódico vivo: KPIs del mes y de cada semana,
// día por día y radicados por contestar al corte del periodo.

import { cliente } from './cliente.js'

export const InformesAPI = {
  // KPIs del mes + semanas con sus KPIs + ranking por área (o por encargado
  // cuando el alcance se fija a un área con ?areaId=)
  mes: (anio, mes, params) => cliente.get(`/informes/mes/${anio}/${mes}`, params),

  // KPIs + día por día + pendientes de UNA semana hábil del mes
  semana: (anio, mes, numero, params) => cliente.get(`/informes/mes/${anio}/${mes}/semana/${numero}`, params),

  // Por contestar al corte del mes, más atrasados primero (cursor para paginar)
  pendientes: (anio, mes, params) => cliente.get(`/informes/mes/${anio}/${mes}/pendientes`, params),

  // Excel del mes (resumen, semanas, por área/encargado y por contestar)
  excelMes: (anio, mes, params) => cliente.descargar(`/informes/mes/${anio}/${mes}/excel`, params),

  // Avisos de fin de periodo para gerencia (cierre semanal/mensual)
  avisos: () => cliente.get('/avisos'),
  atenderAviso: (id) => cliente.post(`/avisos/${id}/atender`, {}),
}

export default InformesAPI
