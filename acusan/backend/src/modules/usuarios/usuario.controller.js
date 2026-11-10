import { UsuarioService } from './usuario.service.js'

function responder(res, error) {
  res.status(error?.status || 500).json({
    success: false,
    message: error?.message || 'Error inesperado en la administración de usuarios.',
    ...(error?.codigo ? { codigo: error.codigo } : {}),
    ...(error?.pendientes !== undefined ? { pendientes: error.pendientes } : {}),
  })
}

export const UsuarioController = {
  async listar(req, res) {
    try {
      res.json({ success: true, data: await UsuarioService.listar(req.usuario, req.query) })
    } catch (error) {
      responder(res, error)
    }
  },

  async obtener(req, res) {
    try {
      res.json({ success: true, data: await UsuarioService.obtener(req.usuario, req.params.id) })
    } catch (error) {
      responder(res, error)
    }
  },

  async crear(req, res) {
    try {
      const data = await UsuarioService.crear(req.usuario, req.body || {})
      res.status(201).json({ success: true, message: `Cuenta de ${data.usuario.nombre} creada.`, data })
    } catch (error) {
      responder(res, error)
    }
  },

  async actualizar(req, res) {
    try {
      const data = await UsuarioService.actualizar(req.usuario, req.params.id, req.body || {})
      const extra = data.reasignados ? ` Se reasignaron ${data.reasignados} radicado(s) pendiente(s).` : ''
      res.json({ success: true, message: `Cuenta de ${data.usuario.nombre} actualizada.${extra}`, data })
    } catch (error) {
      responder(res, error)
    }
  },

  async restablecerPassword(req, res) {
    try {
      const data = await UsuarioService.restablecerPassword(req.usuario, req.params.id, req.body || {})
      res.json({ success: true, message: 'Contraseña restablecida.', data })
    } catch (error) {
      responder(res, error)
    }
  },

  async aprobar(req, res) {
    try {
      const data = await UsuarioService.aprobar(req.usuario, req.params.id, req.body || {})
      res.json({ success: true, message: `Cuenta de ${data.nombre} aprobada.`, data })
    } catch (error) {
      responder(res, error)
    }
  },

  async rechazar(req, res) {
    try {
      const data = await UsuarioService.rechazar(req.usuario, req.params.id)
      res.json({ success: true, message: 'Solicitud rechazada.', data })
    } catch (error) {
      responder(res, error)
    }
  },
}
