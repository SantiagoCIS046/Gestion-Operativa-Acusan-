import { AuthService } from './auth.service.js'

export const AuthController = {
  /**
   * POST /api/auth/login
   * Recibe email y password, retorna JWT + datos del usuario
   */
  async login(req, res) {
    try {
      const { email, password } = req.body
      const meta = {
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
        userAgent: req.headers['user-agent'] || null
      }
      const resultado = await AuthService.login(email, password, meta)

      res.json({
        success: true,
        message: `Bienvenido, ${resultado.usuario.nombre}`,
        data: resultado
      })
    } catch (error) {
      const status = error.status || 500
      res.status(status).json({
        success: false,
        message: error.message || 'Error al iniciar sesión'
      })
    }
  },

  /**
   * POST /api/auth/registro
   * Registra un nuevo usuario en la base de datos de MongoDB Atlas
   */
  async registro(req, res) {
    try {
      const resultado = await AuthService.registrarUsuario(req.body)
      res.status(201).json({
        success: true,
        message: `Usuario ${resultado.usuario.nombre} registrado exitosamente en el sistema Acuasan.`,
        data: resultado
      })
    } catch (error) {
      const status = error.status || 400
      res.status(status).json({
        success: false,
        message: error.message || 'Error al registrar el usuario'
      })
    }
  },

  /**
   * POST /api/auth/recuperar-password
   * Solicita el envío de código de verificación al correo
   */
  async solicitarRecuperacion(req, res) {
    try {
      const { email } = req.body
      const resultado = await AuthService.solicitarRecuperacion(email)
      res.json({
        success: true,
        message: resultado.message,
        data: resultado
      })
    } catch (error) {
      const status = error.status || 400
      res.status(status).json({
        success: false,
        message: error.message || 'Error al procesar la solicitud de recuperación'
      })
    }
  },

  /**
   * POST /api/auth/reset-password
   * Restablece e integra la nueva contraseña en la BD
   */
  async resetearPassword(req, res) {
    try {
      const { email, nuevaPassword } = req.body
      const resultado = await AuthService.resetearPassword({ email, nuevaPassword })
      res.json({
        success: true,
        message: resultado.message,
        data: resultado
      })
    } catch (error) {
      const status = error.status || 400
      res.status(status).json({
        success: false,
        message: error.message || 'Error al actualizar la contraseña'
      })
    }
  },

  /**
   * GET /api/auth/me
   * Retorna los datos del usuario autenticado (requiere token)
   */
  async me(req, res) {
    try {
      res.json({
        success: true,
        data: req.usuario
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener perfil del usuario' })
    }
  }
}
