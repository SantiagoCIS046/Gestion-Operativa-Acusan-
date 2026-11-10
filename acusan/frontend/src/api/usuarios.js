// /api/usuarios — administración de cuentas (gerencia: todas; líder de área:
// los usuarios de su área). Ver backend/src/modules/usuarios.

import { cliente } from './cliente.js'

export const UsuariosAPI = {
  // { usuarios, solicitudesPendientes, correoHabilitado }
  listar: (params) => cliente.get('/usuarios', params),
  obtener: (id) => cliente.get(`/usuarios/${id}`),
  // { nombre, email, rol?, areaId?, password? } → { usuario, passwordTemporal, invitacionEnviada }
  crear: (datos) => cliente.post('/usuarios', datos),
  // { nombre?, email?, rol?, areaId?, activo?, reasignarA? }
  actualizar: (id, datos) => cliente.put(`/usuarios/${id}`, datos),
  restablecerPassword: (id) => cliente.post(`/usuarios/${id}/restablecer-password`, {}),
  aprobar: (id, datos) => cliente.post(`/usuarios/${id}/aprobar`, datos),
  rechazar: (id) => cliente.del(`/usuarios/${id}`),
}

export default UsuariosAPI
