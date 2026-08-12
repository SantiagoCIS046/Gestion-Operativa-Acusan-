import { Router } from 'express'
import { PqrController } from './pqr.controller.js'

const router = Router()

// Endpoints GET, POST, PUT
router.get('/', PqrController.listar)
router.get('/:id', PqrController.obtenerDetalle)
router.post('/', PqrController.radicar)
router.put('/:id/responder', PqrController.responder)

export default router
