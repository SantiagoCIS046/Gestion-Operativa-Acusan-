import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'

// Cargar variables de entorno primero
dotenv.config()

// Rutas modulares
import authRoutes from './modules/auth/auth.routes.js'
import permisosRoutes from './modules/permisos/permisos.routes.js'
import horasExtrasRoutes from './modules/horas-extras/horas-extras.routes.js'
import pqrRoutes from './modules/pqr/pqr.routes.js'
import radicadosRoutes from './modules/radicados/radicados.routes.js'

// Middlewares de autenticación
import { verificarToken, verificarRol } from './middlewares/auth.middleware.js'

// Seed de usuarios iniciales
import { AuthService } from './modules/auth/auth.service.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares globales
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(morgan('dev'))

// Endpoint de verificación / salud (público)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Gestión Operativa Acuasan API',
    timestamp: new Date().toISOString()
  })
})

// --- RUTAS PÚBLICAS ---
app.use('/api/auth', authRoutes)

// --- RUTAS PRIVADAS & MODULARES ---
app.use('/api/permisos', verificarToken, permisosRoutes)
app.use('/api/horas-extras', verificarToken, horasExtrasRoutes)
app.use('/api/pqr', verificarToken, pqrRoutes)
app.use('/api/radicados', radicadosRoutes)


// Manejador global de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada en la API de Acuasan`
  })
})

// Manejador global de errores (500)
app.use((err, req, res, next) => {
  console.error('Error interno del servidor:', err)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno en el servidor de Acuasan',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Iniciar servidor solo si no está en modo test
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`=========================================`)
    console.log(`  ACUASAN E.S.P. - SERVIDOR OPERATIVO    `)
    console.log(`  API en ejecución: http://localhost:${PORT}`)
    console.log(`=========================================`)
    // Asegurar usuarios semilla al arrancar
    try {
      await AuthService.asegurarUsuariosIniciales()
    } catch (e) {
      console.warn('Advertencia al inicializar usuarios:', e.message)
    }
  })
}

export default app
