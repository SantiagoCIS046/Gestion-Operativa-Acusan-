// /api/resumen — indicadores del panel (kpis, ventanas, próximos a vencer)

import { cliente } from './cliente.js'

export const ResumenAPI = {
  obtener: (params) => cliente.get('/resumen', params),
}

export default ResumenAPI
