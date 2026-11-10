import { PerfilService } from './perfil.service.js'

export const PerfilController = {
  /**
   * GET /api/me
   * Datos frescos del usuario autenticado (con su área).
   */
  async me(req, res) {
    try {
      const perfil = await PerfilService.obtenerPerfil(req.usuario.id)

      if (!perfil) {
        return res.status(401).json({
          success: false,
          message: 'Tu sesión ya no es válida: el usuario no existe o está desactivado.',
        })
      }

      res.json({ success: true, data: perfil })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el perfil.',
      })
    }
  },

  /** POST /api/me/password { actual, nueva } */
  async cambiarPassword(req, res) {
    try {
      const data = await PerfilService.cambiarPassword(req.usuario.id, req.body || {})
      res.json({ success: true, message: 'Contraseña actualizada.', data })
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'No se pudo cambiar la contraseña.',
      })
    }
  },
}
