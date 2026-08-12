import { Router } from 'express'
import { PermisosController } from './permisos.controller.js'

const router = Router()

// Todas estas rutas asumen el prefijo '/api/permisos'

// Obtener permisos para el encargado (Operativo)
router.get('/encargado', PermisosController.listarEncargado)

// Obtener permisos validados para Gerencia
router.get('/gerencia/pendientes', PermisosController.listarGerenciaPendientes)

// Registrar la validación del OCR
router.post('/validar-ocr', PermisosController.validarOCR)

// Endpoints generales de consulta y dictamen
router.get('/', PermisosController.listar)
router.get('/:id', PermisosController.obtenerDetalle)
router.post('/', PermisosController.registrar)
router.put('/:id/dictamen', PermisosController.dictaminar)

export default router
