// Rutas del calendario hábil — lectura autenticada para todos los roles;
// administración de días no laborales solo gerencia (LIDER_GENERAL).

import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { CalendarioController } from './calendario.controller.js'

const router = Router()

router.get('/hoy', requireAuth, CalendarioController.hoy)
router.get('/festivos', requireAuth, CalendarioController.festivos)
router.get('/dia', requireAuth, CalendarioController.dia)
router.get('/sumar-habiles', requireAuth, CalendarioController.sumarHabiles)
router.get('/no-laborales', requireAuth, requireRole('LIDER_GENERAL'), CalendarioController.listarNoLaborales)
router.post('/no-laborales', requireAuth, requireRole('LIDER_GENERAL'), CalendarioController.crearNoLaboral)
router.delete('/no-laborales/:id', requireAuth, requireRole('LIDER_GENERAL'), CalendarioController.borrarNoLaboral)
router.get('/', requireAuth, CalendarioController.mes)

export default router
