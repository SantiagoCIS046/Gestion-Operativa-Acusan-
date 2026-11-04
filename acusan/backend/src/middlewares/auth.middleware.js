// Middlewares de autenticación y permisos del módulo de vencimientos.
// Reemplazan a verificarToken/verificarRol del sistema anterior.

import jwt from 'jsonwebtoken'

// Payload mínimo que exige el nuevo token (los de la era anterior no traen
// areaId y romperían los permisos: se rechazan para forzar re-login).
const CAMPOS_REQUERIDOS = ['id', 'rol', 'areaId']

function extraerUsuario(payload) {
  // Subset normalizado: nada más viaja en req.usuario
  return {
    id: payload.id,
    nombre: payload.nombre,
    email: payload.email,
    rol: payload.rol,
    areaId: payload.areaId,
  }
}

/**
 * Middleware: exige sesión válida (Authorization: Bearer <token>).
 * Popula req.usuario con { id, nombre, email, rol, areaId }.
 * 401 sin sesión o con token de una versión anterior.
 */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para continuar.',
      })
    }

    const token = authHeader.split(' ')[1]
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (CAMPOS_REQUERIDOS.some((c) => payload[c] === undefined)) {
      return res.status(401).json({
        success: false,
        message: 'Tu sesión pertenece a una versión anterior del sistema. Inicia sesión nuevamente.',
      })
    }

    req.usuario = extraerUsuario(payload)
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Tu sesión expiró o no es válida. Inicia sesión nuevamente.',
    })
  }
}

/**
 * Middleware factory: exige además uno de los roles indicados.
 * Usar SIEMPRE después de requireAuth.
 *   router.post('/x', requireAuth, requireRole('LIDER_GENERAL', 'LIDER_AREA'), ...)
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para continuar.',
      })
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        message: 'Tu rol no tiene permiso para esta acción.',
      })
    }

    next()
  }
