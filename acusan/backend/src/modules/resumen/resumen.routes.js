import { Router } from 'express'

import { requireAuth } from '../../middlewares/auth.middleware.js'
import { ResumenController } from './resumen.controller.js'

const router = Router()

router.get('/', requireAuth, ResumenController.obtener)

export default router
