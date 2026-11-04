// Rutas de avisos internos — SOLO gerencia (LIDER_GENERAL).

import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { AvisosController } from './avisos.controller.js'

const router = Router()

const soloGerencia = [requireAuth, requireRole('LIDER_GENERAL')]

router.get('/', ...soloGerencia, AvisosController.listar)
router.post('/:id/atender', ...soloGerencia, AvisosController.atender)

export default router
