import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'

// Rutas modulares
import permisosRoutes from './modules/permisos/permisos.routes.js'
import horasExtrasRoutes from './modules/horas-extras/horas-extras.routes.js'
import pqrRoutes from './modules/pqr/pqr.routes.js'

// Cargar variables de entorno
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares globales
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// Endpoint de verificación / salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Gestión Operativa Acuasan API',
    timestamp: new Date().toISOString()
  })
})

// Registro de módulos
app.use('/api/permisos', permisosRoutes)
app.use('/api/horas-extras', horasExtrasRoutes)
app.use('/api/pqr', pqrRoutes)

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
  app.listen(PORT, () => {
    console.log(`=========================================`)
    console.log(`  ACUASAN E.S.P. - SERVIDOR OPERATIVO    `)
    console.log(`  API en ejecución: http://localhost:${PORT}`)
    console.log(`=========================================`)
  })
}

export default app
