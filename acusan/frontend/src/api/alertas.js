// /api/alertas — listado por rol, atender y ejecutar la revisión

import { cliente } from './cliente.js'

export const AlertasAPI = {
  listar: (params) => cliente.get('/alertas', params),
  atender: (id) => cliente.post(`/alertas/${id}/atender`, {}),
  ejecutar: (datos) => cliente.post('/alertas/ejecutar', datos),
}

export default AlertasAPI
