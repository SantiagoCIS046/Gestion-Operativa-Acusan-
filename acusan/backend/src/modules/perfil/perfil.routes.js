import { Router } from 'express'

import { requireAuth } from '../../middlewares/auth.middleware.js'
import { PerfilController } from './perfil.controller.js'

const router = Router()

// Montado en /api → GET /api/me
router.get('/me', requireAuth, PerfilController.me)
router.post('/me/password', requireAuth, PerfilController.cambiarPassword)

export default router
