import { Router } from 'express'
import { PermisosController } from './permisos.controller.js'

const router = Router()

// GET: Listar solicitudes y obtener por ID
router.get('/', PermisosController.listar)
router.get('/:id', PermisosController.obtenerDetalle)

// POST: Registrar nueva solicitud y endpoint de procesamiento OCR
router.post('/', PermisosController.registrar)
router.post('/procesar-ocr', PermisosController.procesarOCR)

// PUT / PATCH: Aprobación o rechazo de gerencia
router.put('/:id/dictamen', PermisosController.dictaminar)

export default router
