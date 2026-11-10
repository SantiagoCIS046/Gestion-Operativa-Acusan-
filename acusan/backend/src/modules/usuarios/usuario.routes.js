import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { UsuarioController } from './usuario.controller.js'

// Administración de cuentas: gerencia (todas) y líderes de área (los
// usuarios de su área). El servicio vuelve a validar cada permiso.
const router = Router()
const administradores = [requireAuth, requireRole('LIDER_GENERAL', 'LIDER_AREA')]
const soloGerencia = [requireAuth, requireRole('LIDER_GENERAL')]

router.get('/', ...administradores, UsuarioController.listar)
router.post('/', ...administradores, UsuarioController.crear)
router.get('/:id', ...administradores, UsuarioController.obtener)
router.put('/:id', ...administradores, UsuarioController.actualizar)
router.post('/:id/restablecer-password', ...administradores, UsuarioController.restablecerPassword)
router.post('/:id/aprobar', ...soloGerencia, UsuarioController.aprobar)
router.delete('/:id', ...soloGerencia, UsuarioController.rechazar)

export default router
