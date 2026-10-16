import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Cargar variables de entorno primero
dotenv.config()

// Logger centralizado
import logger from './config/logger.js'

// Rutas modulares
import authRoutes from './modules/auth/auth.routes.js'

// Middlewares
import { auditMiddleware } from './middlewares/audit.middleware.js'

// Seed de usuarios iniciales
import { AuthService } from './modules/auth/auth.service.js'

const app = express()
const PORT = process.env.PORT || 3000

// ─── Middlewares globales ─────────────────────────────────────────────────────
// CORS: lista de orígenes autorizados. En producción se controla con la
// variable de entorno FRONTEND_URLS (separados por coma). Siempre se incluyen
// los dominios institucionales fijos y los entornos de desarrollo local.
const ORIGENES_FIJOS = [
  'https://acuusan.vercel.app',          // Sistema principal Acuusan
  'https://acuusan.vercel.app',          // Alias secundario Acuusan
  'http://localhost:5173',               // Dev frontend principal
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]
const origenesExtra = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
const ORIGENES_PERMITIDOS = [...new Set([...ORIGENES_FIJOS, ...origenesExtra])]

app.use(cors({
  origin: (origin, callback) => {
    // Peticiones sin origen (curl, Postman, server-to-server) siempre OK
    if (!origin) return callback(null, true)
    if (ORIGENES_PERMITIDOS.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true)
    }
    callback(new Error(`CORS: origen no autorizado → ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(auditMiddleware) // 📋 Registro automático de cada request HTTP

// ─── Endpoint de salud (público) ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Gestión Operativa Acuusan API',
    timestamp: new Date().toISOString()
  })
})

// ─── Rutas públicas ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn('SISTEMA', 'RUTA 404', `${req.method} ${req.originalUrl}`)
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada en la API de Acuusan`
  })
})

// ─── Manejador global de errores 500 ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('SISTEMA', 'ERROR 500', `${req.method} ${req.originalUrl} — ${err.message}`)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno en el servidor de Acuusan',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// ─── Inicio del servidor ──────────────────────────────────────────────────────
// En Vercel la app corre como función serverless (api/index.js la exporta y
// Vercel la invoca por request): NO se debe arrancar listener allí —
// app.listen() al importarse provoca FUNCTION_INVOCATION_FAILED. Vercel define
// process.env.VERCEL automáticamente, así que sirve de guard.
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const servidor = app.listen(PORT, '0.0.0.0', async () => {
    logger.startup(PORT, process.env.NODE_ENV || 'development')

    try {
      await AuthService.asegurarUsuariosIniciales()
      logger.success('SISTEMA', 'SEED OK', 'Usuarios iniciales verificados en BD')
    } catch (e) {
      logger.warn('SISTEMA', 'SEED WARN', e.message)
    }

    logger.divider('Servidor listo — esperando peticiones')
  })

  // ── Error del servidor HTTP ─────────────────────────────────────────────────
  // EADDRINUSE ocurre en Windows cuando nodemon reinicia antes de que el SO
  // libere el puerto. Al capturarlo aquí evitamos el crash con stacktrace.
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn('SISTEMA', 'EADDRINUSE', `Puerto ${PORT} ocupado — nodemon volverá a intentarlo al próximo guardado`)
    } else {
      logger.error('SISTEMA', 'SERVER ERR', err.message)
    }
  })

  // ── Cierre limpio compatible con Windows + nodemon ──────────────────────────
  // closeAllConnections() (Node ≥ 18.2) fuerza el cierre de conexiones keep-alive
  // que de otro modo bloquean el puerto en Windows incluso después de que
  // nodemon envíe SIGTERM/SIGINT.
  const apagarLimpio = (callback) => {
    if (typeof servidor.closeAllConnections === 'function') {
      servidor.closeAllConnections()        // cierra keep-alives inmediatamente
    }
    servidor.close(() => {
      if (callback) callback()
      else process.exit(0)
    })
  }

  // nodemon en Windows usa SIGUSR2 para reiniciar; re-emitimos la señal DESPUÉS
  // de cerrar el servidor para que nodemon pueda arrancar el nuevo proceso.
  process.once('SIGUSR2', () => {
    apagarLimpio(() => process.kill(process.pid, 'SIGUSR2'))
  })
  process.on('SIGINT', () => apagarLimpio())
  process.on('SIGTERM', () => apagarLimpio())
}

export default app
