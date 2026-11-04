import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { AreaController } from './area.controller.js'

const router = Router()

// Estructurar las áreas (crear, editar, estado, eliminar) es EXCLUSIVO de
// gerencia. El servicio vuelve a validar el rol: el permiso no depende solo
// de la ruta.
const soloGerencia = [requireRole('LIDER_GENERAL')]

router.get('/', requireAuth, AreaController.listar)
// Antes de /:id para que "movimientos" no se lea como un id de área
router.get('/movimientos', requireAuth, ...soloGerencia, AreaController.movimientos)
router.post('/', requireAuth, ...soloGerencia, AreaController.crear)
router.put('/:id', requireAuth, ...soloGerencia, AreaController.actualizar)
router.patch('/:id/estado', requireAuth, ...soloGerencia, AreaController.estado)
router.delete('/:id', requireAuth, ...soloGerencia, AreaController.eliminar)

export default router
