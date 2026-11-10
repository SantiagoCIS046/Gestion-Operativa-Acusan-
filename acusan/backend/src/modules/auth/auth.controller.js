import { AuthService } from './auth.service.js'

// Respuesta de error uniforme: { success: false, message }
function fallo(res, error, porDefecto, statusPorDefecto = 400) {
  res.status(error?.status || statusPorDefecto).json({
    success: false,
    message: error?.message || porDefecto,
  })
}

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
        userAgent: req.headers['user-agent'] || null,
      }
      const resultado = await AuthService.login(email, password, meta)
      res.json({ success: true, message: `Bienvenido, ${resultado.usuario.nombre}`, data: resultado })
    } catch (error) {
      fallo(res, error, 'Error al iniciar sesión', 500)
    }
  },

  /** GET /api/auth/opciones — { correoHabilitado } para la pantalla de login */
  opciones(req, res) {
    res.json({ success: true, data: AuthService.opciones() })
  },

  /**
   * POST /api/auth/registro
   * Solicitud de cuenta: queda pendiente de aprobación por gerencia
   */
  async registro(req, res) {
    try {
      const resultado = await AuthService.registrarUsuario(req.body)
      res.status(201).json({
        success: true,
        message: 'Solicitud enviada. Gerencia debe aprobar su cuenta antes de que pueda ingresar.',
        data: resultado,
      })
    } catch (error) {
      fallo(res, error, 'Error al registrar el usuario')
    }
  },

  /**
   * POST /api/auth/recuperar-password
   * Envía el enlace por correo (si está configurado) o indica a quién acudir
   */
  async solicitarRecuperacion(req, res) {
    try {
      const resultado = await AuthService.solicitarRecuperacion(req.body?.email)
      res.json({
        success: true,
        message: resultado.message,
        data: { email: resultado.email, correoHabilitado: resultado.correoHabilitado },
      })
    } catch (error) {
      fallo(res, error, 'Error al procesar la solicitud de recuperación')
    }
  },

  /** POST /api/auth/restablecer { token, password } — enlace del correo */
  async restablecer(req, res) {
    try {
      const resultado = await AuthService.restablecerConToken(req.body?.token, req.body?.password)
      res.json({
        success: true,
        message: 'Contraseña actualizada. Ya puede iniciar sesión con la nueva contraseña.',
        data: resultado,
      })
    } catch (error) {
      fallo(res, error, 'No se pudo restablecer la contraseña')
    }
  },
}
