// /api/areas — áreas visibles según el rol del token (con líder, miembros
// y estado activa/inactiva del mapa de estructura).
// Estructurar (crear/editar/activar/eliminar) es solo gerencia: el backend
// responde 403 a cualquier otro rol.

import { cliente } from './cliente.js'

export const AreasAPI = {
  listar: () => cliente.get('/areas'),
  crear: (datos) => cliente.post('/areas', datos),
  actualizar: (id, datos) => cliente.put(`/areas/${id}`, datos),
  // Línea verde (activa) / roja (inactiva) del mapa de estructura
  cambiarEstado: (id, activa) => cliente.patch(`/areas/${id}/estado`, { activa }),
  eliminar: (id) => cliente.del(`/areas/${id}`),
  // Registro del movimiento de las áreas (auditoría del mapa)
  movimientos: (params) => cliente.get('/areas/movimientos', params),
}

export default AreasAPI
