import { Router } from 'express'
import { verificarRol } from '../../middlewares/auth.middleware.js'
import { OcrController } from './ocr.controller.js'

// Rutas bajo '/api/ocr' con verificarToken previo en app.js.
// Unión de roles de los consumidores naturales del motor:
// ventanilla de radicados y encargado de permisos (+ ADMIN).
const router = Router()

router.post(
  '/escanear',
  verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'),
  OcrController.escanear
)

// Flujo asíncrono para permisos (el escaneo tarda más que la vida útil de
// una conexión del lambda): enrolar trabajo + consultar estado por jobId.
// Sin RADICADOS en los roles: radicados conserva el flujo síncrono.
router.post(
  '/trabajos',
  verificarRol('ENCARGADO', 'ADMIN'),
  OcrController.iniciarTrabajo
)

router.get(
  '/trabajos/:jobId',
  verificarRol('ENCARGADO', 'ADMIN'),
  OcrController.estadoTrabajo
)

export default router
