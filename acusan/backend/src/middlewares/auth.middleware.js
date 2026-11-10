// Middlewares de autenticación y permisos del módulo de vencimientos.
// Reemplazan a verificarToken/verificarRol del sistema anterior.

import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import logger from '../config/logger.js'

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

    // cuentaVigente (montado antes en app.js) ya leyó la cuenta de la base:
    // el rol y el área vigentes mandan sobre los que traía el token.
    req.usuario = req.cuentaActual ?? extraerUsuario(payload)
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

// ─────────────────────────────────────────────────────────────────────────────
// cuentaVigente: la cuenta del token se valida contra la base en CADA petición
// (con una caché corta). Sin esto, desactivar una cuenta, cambiarle el rol o
// restablecerle la contraseña no surtía efecto hasta que el token vencía (8 h).
//   - cuenta borrada o desactivada → 401
//   - token emitido antes de sesionesDesde (cambio/restablecimiento) → 401
//   - contraseña temporal pendiente de cambio → 403 salvo /api/me*
// Se monta en app.js sobre /api; sin cabecera Bearer no hace nada (las rutas
// públicas siguen igual) y un token inválido lo rechaza luego requireAuth.
// ─────────────────────────────────────────────────────────────────────────────

const ES_OBJECTID = /^[a-f\d]{24}$/i
const TTL_CACHE_MS = 5_000
const cache = new Map()

/** Olvida la cuenta en caché (tras editarla, para que el cambio aplique ya). */
export function invalidarCuenta(id) {
  if (id) cache.delete(String(id))
  else cache.clear()
}

async function leerCuenta(id) {
  const enCache = cache.get(id)
  if (enCache && Date.now() - enCache.t < TTL_CACHE_MS) return enCache.cuenta
  const cuenta = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, email: true, rol: true, areaId: true,
      activo: true, sesionesDesde: true, debeCambiarPassword: true,
    },
  })
  cache.set(id, { cuenta, t: Date.now() })
  return cuenta
}

export async function cuentaVigente(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next()

  let payload
  try {
    payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
  } catch {
    return next() // requireAuth responderá 401
  }
  if (!ES_OBJECTID.test(String(payload?.id ?? ''))) return next()

  try {
    const cuenta = await leerCuenta(String(payload.id))
    if (!cuenta || !cuenta.activo) {
      return res.status(401).json({
        success: false,
        codigo: 'CUENTA_INACTIVA',
        message: 'Tu cuenta fue desactivada. Contacta a gerencia o a tu líder de área.',
      })
    }
    if (cuenta.sesionesDesde && payload.iat < Math.floor(cuenta.sesionesDesde.getTime() / 1000)) {
      return res.status(401).json({
        success: false,
        codigo: 'SESION_CERRADA',
        message: 'Tu contraseña cambió: inicia sesión nuevamente.',
      })
    }
    const ruta = req.originalUrl.split('?')[0]
    if (cuenta.debeCambiarPassword && !ruta.startsWith('/api/me')) {
      return res.status(403).json({
        success: false,
        codigo: 'DEBE_CAMBIAR_PASSWORD',
        message: 'Debes cambiar tu contraseña temporal antes de continuar.',
      })
    }
    req.cuentaActual = {
      id: cuenta.id,
      nombre: cuenta.nombre,
      email: cuenta.email,
      rol: cuenta.rol,
      areaId: cuenta.areaId,
    }
    next()
  } catch (error) {
    logger.error('AUTH', 'CUENTA', `No se pudo verificar la cuenta: ${error.message}`)
    res.status(503).json({ success: false, message: 'No se pudo verificar la sesión. Intenta de nuevo.' })
  }
}
