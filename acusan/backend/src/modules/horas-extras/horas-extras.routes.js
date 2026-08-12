import { Router } from 'express'
import { HorasExtrasController } from './horas-extras.controller.js'

const router = Router()

// Endpoints GET, POST, PUT
router.get('/', HorasExtrasController.listar)
router.post('/', HorasExtrasController.registrar)
router.put('/:id/dictamen', HorasExtrasController.dictaminar)

export default router
