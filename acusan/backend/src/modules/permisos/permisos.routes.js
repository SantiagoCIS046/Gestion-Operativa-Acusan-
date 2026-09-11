import { Router } from 'express'
import { PermisosController } from './permisos.controller.js'
import { verificarRol } from '../../middlewares/auth.middleware.js'

const router = Router()

// Todas estas rutas asumen el prefijo '/api/permisos' con verificarToken previo en app.js

// Obtener permisos para el encargado (Ramón y Admin)
router.get('/encargado', verificarRol('ENCARGADO', 'ADMIN'), PermisosController.listarEncargado)

// Obtener permisos validados para Gerencia y Admin
router.get('/gerencia/pendientes', verificarRol('GERENCIA', 'ADMIN'), PermisosController.listarGerenciaPendientes)

// Registrar la validación del OCR (Ramón y Admin)
router.post('/validar-ocr', verificarRol('ENCARGADO', 'ADMIN'), PermisosController.validarOCR)

// Endpoints generales de consulta (Encargado, Gerencia, Admin)
router.get('/', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), PermisosController.listar)

// Crear/registrar permisos (Ramón y Admin)
router.post('/', verificarRol('ENCARGADO', 'ADMIN'), PermisosController.registrar)

// Servir archivo de soporte (Encargado, Gerencia, Admin)
router.get('/:id/archivo', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), PermisosController.servirArchivo)

// Detalle del permiso (Encargado, Gerencia, Admin)
router.get('/:id', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), PermisosController.obtenerDetalle)

// Actualizar / Eliminar permiso (Ramón y Admin)
router.put('/:id', verificarRol('ENCARGADO', 'ADMIN'), PermisosController.actualizar)
router.delete('/:id', verificarRol('ENCARGADO', 'ADMIN'), PermisosController.eliminar)

// Dictamen / Aprobación gerencial (Gerencia y Admin)
router.put('/:id/dictamen', verificarRol('GERENCIA', 'ADMIN'), PermisosController.dictaminar)

export default router
