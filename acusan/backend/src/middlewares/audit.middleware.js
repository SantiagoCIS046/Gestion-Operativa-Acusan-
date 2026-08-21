/**
 * audit.middleware.js — Middleware global de auditoría HTTP
 * Intercepta cada request, extrae usuario del JWT (si existe) y registra:
 * - Método HTTP, ruta, código de respuesta, tiempo de respuesta, usuario/IP
 */

import jwt from 'jsonwebtoken'
import logger from '../config/logger.js'

export const auditMiddleware = (req, res, next) => {
  const inicio = Date.now()

  // Intentar extraer usuario del token JWT (sin bloquear si no tiene)
  let usuarioStr = 'anónimo'
  try {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      usuarioStr = `${payload.email} (${payload.rol})`
    }
  } catch (_) {
    // Token inválido o ausente — no bloquear el request
  }

  // Interceptar el evento de finalización de respuesta
  res.on('finish', () => {
    const ms     = Date.now() - inicio
    const { method, originalUrl } = req

    // No loguear health checks ni assets estáticos para no saturar el log
    const ignorar = ['/api/health', '/favicon.ico']
    if (ignorar.includes(originalUrl)) return

    logger.http(method, originalUrl, res.statusCode, ms, usuarioStr)
  })

  next()
}
