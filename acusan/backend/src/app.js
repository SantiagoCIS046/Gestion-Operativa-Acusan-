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
import horasExtrasRoutes from './modules/horas-extras/horas-extras.routes.js'
import pqrRoutes from './modules/pqr/pqr.routes.js'
import radicadosRoutes from './modules/radicados/radicados.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'

// Middlewares
import { verificarToken, verificarRol } from './middlewares/auth.middleware.js'
import { auditMiddleware } from './middlewares/audit.middleware.js'

// Seed de usuarios iniciales
import { AuthService } from './modules/auth/auth.service.js'

const app = express()
const PORT = process.env.PORT || 3000

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '50mb' }))
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

// ─── Rutas privadas & modulares ───────────────────────────────────────────────
app.use('/api/permisos',     verificarToken, permisosRoutes)
app.use('/api/horas-extras', verificarToken, horasExtrasRoutes)
app.use('/api/pqr',          verificarToken, pqrRoutes)
app.use('/api/radicados',    radicadosRoutes)

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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.startup(PORT, process.env.NODE_ENV || 'development')

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
