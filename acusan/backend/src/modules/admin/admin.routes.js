/**
 * admin.routes.js — Rutas exclusivas del Administrador del Sistema
 * Todas requieren token JWT válido + rol ADMIN (doble protección aplicada en app.js)
 */

import { Router } from 'express'
import { AdminController } from './admin.controller.js'

const router = Router()

// Listar todos los usuarios
router.get('/usuarios', AdminController.listarUsuarios)

// Editar datos de un usuario (nombre, cargo, rol, activo, cédula, password opcional)
router.put('/usuarios/:id', AdminController.editarUsuario)

// Eliminar usuario del sistema
router.delete('/usuarios/:id', AdminController.eliminarUsuario)

export default router
