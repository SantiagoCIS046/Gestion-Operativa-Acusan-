import { Router } from 'express'
import { AuthController } from './auth.controller.js'

const router = Router()

// --- RUTAS PÚBLICAS DE AUTENTICACIÓN ---
// registro: crea SIEMPRE rol USUARIO (el rol del body se ignora); la
// asignación de roles/áreas la hace después un líder desde la gestión.
// /me se movió a GET /api/me (módulo perfil).
router.post('/login', AuthController.login)
router.post('/registro', AuthController.registro)
router.post('/recuperar-password', AuthController.solicitarRecuperacion)
// App externa Horas Extras: verificar si la cédula existe y generar JWT de 12h para empleados de campo
router.get('/verificar-cedula/:cedula', AuthController.verificarCedula)
router.post('/token-empleado', AuthController.tokenEmpleado)

export default router
