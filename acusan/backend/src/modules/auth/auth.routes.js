import { Router } from 'express'
import { AuthController } from './auth.controller.js'

const router = Router()

// --- RUTAS PÚBLICAS DE AUTENTICACIÓN ---
// registro: crea SIEMPRE rol USUARIO, inactivo y pendiente de aprobación (el
// rol del body se ignora); gerencia lo aprueba desde Usuarios.
// /me se movió a GET /api/me (módulo perfil).
router.post('/login', AuthController.login)
router.get('/opciones', AuthController.opciones)
router.post('/registro', AuthController.registro)
router.post('/recuperar-password', AuthController.solicitarRecuperacion)
router.post('/restablecer', AuthController.restablecer)

export default router
