import { Router } from 'express'
import { RadicadosController } from './radicados.controller.js'

const router = Router()

// ── Rutas específicas (ANTES de /:id para no ser capturadas) ────────────────
router.get('/descargar-excel', RadicadosController.descargarExcel)
router.post('/extraer-campos', RadicadosController.extraerCampos)

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', RadicadosController.listar)
router.post('/', RadicadosController.crear)
router.put('/:id/estado', RadicadosController.actualizarEstado)
router.put('/:id/archivo', RadicadosController.adjuntarArchivo)
router.get('/:id/archivo', RadicadosController.obtenerArchivo)
router.delete('/:id', RadicadosController.eliminar)

export default router
