import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { AlertaController } from './alerta.controller.js'

const router = Router()

// Lectura: cualquier rol (el servicio recorta por área según el token)
router.get('/', requireAuth, AlertaController.listar)

// Ejecutar la revisión: solo lider_general (área opcional, forzar opcional)
router.post(
  '/ejecutar',
  requireAuth,
  requireRole('LIDER_GENERAL'),
  AlertaController.ejecutar,
)

// Atender: el servicio valida que sea lider_general o el lider_area del área
router.post('/:id/atender', requireAuth, AlertaController.atender)

export default router
