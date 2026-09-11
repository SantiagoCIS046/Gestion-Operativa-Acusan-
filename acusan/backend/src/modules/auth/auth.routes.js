import { Router } from 'express'
import { AuthController } from './auth.controller.js'
import { verificarToken } from '../../middlewares/auth.middleware.js'

const router = Router()

// --- RUTAS PÚBLICAS DE AUTENTICACIÓN ---
// registro: crea SIEMPRE Funcionario Operativo (el rol del body se ignora);
// la asignación de roles la hace el ADMIN en /api/admin/usuarios.
// reset-password fue eliminado: el restablecimiento lo media el Administrador.
router.post('/login', AuthController.login)
router.post('/registro', AuthController.registro)
router.post('/recuperar-password', AuthController.solicitarRecuperacion)

// --- RUTAS PRIVADAS ---
router.get('/me', verificarToken, AuthController.me)

export default router
