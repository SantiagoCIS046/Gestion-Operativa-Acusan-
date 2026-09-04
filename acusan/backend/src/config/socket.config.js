/**
 * socket.config.js — Servidor de WebSockets (Socket.io) de Acuusan.
 *
 * Se adjunta a la instancia HTTP de Express en app.js (donde corre app.listen):
 * los WebSockets exigen un proceso persistente, por eso solo se inicializa
 * fuera de Vercel (serverless no mantiene conexiones — el backend productivo
 * corre en Railway/Render).
 *
 * Seguridad:
 *  - CORS restringido a los orígenes del frontend (Vercel + localhost de dev).
 *  - Autenticación con el MISMO JWT de la API (handshake.auth.token o header
 *    Authorization). Sin token válido la conexión se rechaza.
 *  - Los sockets autenticados entran a la sala "operadores": los eventos con
 *    datos de ciudadanos (nueva_alerta_pqr) se emiten SOLO a esa sala.
 */
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import logger from './logger.js'

let io = null

// ─── Orígenes permitidos (CORS) ───────────────────────────────────────────────
// FRONTEND_URLS: lista separada por comas. Default = Vercel de producción + dev
function origenesPermitidos() {
  return (process.env.FRONTEND_URLS || 'https://acuusan.vercel.app,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

// ─── Inicialización ───────────────────────────────────────────────────────────
export function inicializarSocketServer(servidorHttp) {
  if (io) return io

  io = new Server(servidorHttp, {
    cors: {
      origin: origenesPermitidos(),
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  // Autenticación: mismo JWT que verifica auth.middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return next(new Error('Autenticación requerida: conecte con { auth: { token } }'))
    }

    try {
      socket.usuario = jwt.verify(token, process.env.JWT_SECRET)
      next()
    } catch {
      next(new Error('Token inválido o expirado'))
    }
  })

  io.on('connection', (socket) => {
    socket.join('operadores')
    logger.info('SOCKET', 'OPERADOR ON', `${socket.usuario?.email} (${socket.usuario?.rol}) — ${socket.id}`)

    socket.on('disconnect', (razon) => {
      logger.info('SOCKET', 'OPERADOR OFF', `${socket.usuario?.email} — ${razon}`)
    })
  })

  logger.success('SOCKET', 'LISTO', `WebSockets activos — orígenes: ${origenesPermitidos().join(', ')}`)
  return io
}

// ─── Acceso para los workers ──────────────────────────────────────────────────
export function obtenerIO() {
  if (!io) {
    throw new Error('Socket.io no inicializado: invoque inicializarSocketServer(servidorHttp) en app.listen')
  }
  return io
}

/**
 * Emite un evento a la sala de operadores SIN poder romper al worker.
 * Devuelve true si había sockets inicializados (no garantiza oyentes).
 */
export function emitirEventoSeguro(nombreEvento, payload) {
  try {
    if (!io) {
      // Normal en Vercel/test: el worker sigue funcionando sin tiempo real
      logger.warn('SOCKET', 'SIN INIT', `emit "${nombreEvento}" ignorado — Socket.io no está activo en este proceso`)
      return false
    }
    io.to('operadores').emit(nombreEvento, payload)
    return true
  } catch (error) {
    logger.error('SOCKET', 'EMIT ERR', `"${nombreEvento}" — ${error.message}`)
    return false
  }
}
