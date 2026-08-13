import jwt from 'jsonwebtoken'

/**
 * Middleware: Verifica que la solicitud tenga un JWT válido en el header Authorization
 * Uso: Authorization: Bearer <token>
 */
export const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Se requiere autenticación.'
      })
    }

    const token = authHeader.split(' ')[1]
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado. Inicie sesión nuevamente.'
    })
  }
}

/**
 * Middleware: Verifica que el usuario tenga uno de los roles permitidos
 * @param {...string} roles - Roles permitidos (ej: 'ENCARGADO', 'GERENCIA')
 */
export const verificarRol = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. No se encontró sesión activa.'
      })
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}. Su rol actual es: ${req.usuario.rol}`
      })
    }

    next()
  }
}
