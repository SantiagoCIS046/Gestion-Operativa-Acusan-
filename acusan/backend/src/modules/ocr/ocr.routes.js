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

export default router
