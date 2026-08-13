import { Router } from 'express'
import { AuthController } from './auth.controller.js'
import { verificarToken } from '../../middlewares/auth.middleware.js'

const router = Router()

// --- RUTAS PÚBLICAS DE AUTENTICACIÓN ---
router.post('/login', AuthController.login)
router.post('/registro', AuthController.registro)
router.post('/recuperar-password', AuthController.solicitarRecuperacion)
router.post('/reset-password', AuthController.resetearPassword)

// --- RUTAS PRIVADAS ---
router.get('/me', verificarToken, AuthController.me)

export default router
