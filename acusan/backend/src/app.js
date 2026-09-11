import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Cargar variables de entorno primero
dotenv.config()

// Logger centralizado
import logger from './config/logger.js'

// Rutas modulares
import authRoutes from './modules/auth/auth.routes.js'
import permisosRoutes from './modules/permisos/permisos.routes.js'
import { OcrController } from './modules/permisos/ocr.controller.js'
import horasExtrasRoutes from './modules/horas-extras/horas-extras.routes.js'
import pqrRoutes from './modules/pqr/pqr.routes.js'
import whatsappRoutes from './modules/pqr/whatsapp.routes.js'
import radicadosRoutes from './modules/radicados/radicados.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'

// Middlewares
import { verificarToken, verificarRol } from './middlewares/auth.middleware.js'
import { auditMiddleware } from './middlewares/audit.middleware.js'

// WebSockets (Socket.io): se adjuntan a la instancia HTTP creada por app.listen
import { inicializarSocketServer } from './config/socket.config.js'

// Seed de usuarios iniciales
import { AuthService } from './modules/auth/auth.service.js'

const app = express()
const PORT = process.env.PORT || 3000

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors())
// verify() conserva el cuerpo crudo del JSON: el webhook de WhatsApp lo
// necesita para validar la firma X-Hub-Signature-256 de Meta (byte-exacta)
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { req.rawBody = buf } }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(auditMiddleware) // 📋 Registro automático de cada request HTTP

// ─── Endpoint de salud (público) ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Gestión Operativa Acuasan API',
    timestamp: new Date().toISOString()
  })
})

// ─── Rutas públicas ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// Webhook de WhatsApp Cloud API — público por necesidad: Meta no puede enviar
// JWT. Se blinda con hub.verify_token (GET) + firma X-Hub-Signature-256 (POST)
app.use('/api/pqr/whatsapp', whatsappRoutes)

// OCR de permisos laborales — público (sin barrera de token para escaneo directo)
app.post('/api/permisos/ocr', OcrController.procesarOCR)

// ─── Rutas privadas & modulares ───────────────────────────────────────────────
app.use('/api/permisos',     verificarToken, permisosRoutes)
app.use('/api/horas-extras', verificarToken, horasExtrasRoutes)
app.use('/api/pqr',          verificarToken, pqrRoutes)
app.use('/api/radicados',    verificarToken, radicadosRoutes)

// ─── Rutas exclusivas ADMIN (doble protección: token + rol) ───────────────────
app.use('/api/admin', verificarToken, verificarRol('ADMIN'), adminRoutes)

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn('SISTEMA', 'RUTA 404', `${req.method} ${req.originalUrl}`)
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada en la API de Acuasan`
  })
})

// ─── Manejador global de errores 500 ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('SISTEMA', 'ERROR 500', `${req.method} ${req.originalUrl} — ${err.message}`)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno en el servidor de Acuasan',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// ─── Inicio del servidor ──────────────────────────────────────────────────────
// ─── Inicio del servidor ──────────────────────────────────────────────────────
// En Vercel la app corre como función serverless (api/index.js la exporta y
// Vercel la invoca por request): NO se debe arrancar listener allí —
// app.listen() al importarse provoca FUNCTION_INVOCATION_FAILED. Vercel define
// process.env.VERCEL automáticamente, así que sirve de guard.
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const servidor = app.listen(PORT, async () => {
    logger.startup(PORT, process.env.NODE_ENV || 'development')

    // WebSockets sobre ESTA instancia HTTP (requiere proceso persistente:
    // por eso va aquí y no en el export serverless de Vercel)
    inicializarSocketServer(servidor)

    try {
      await AuthService.asegurarUsuariosIniciales()
      logger.success('SISTEMA', 'SEED OK', 'Usuarios iniciales verificados en BD')
    } catch (e) {
      logger.warn('SISTEMA', 'SEED WARN', e.message)
    }

    logger.divider('Servidor listo — esperando peticiones')
  })
}

export default app
// WhatsApp webhook configurado y activo
