import { Router } from 'express'
import { RadicadosController } from './radicados.controller.js'
import { verificarRol } from '../../middlewares/auth.middleware.js'

const router = Router()

// Todas estas rutas asumen el prefijo '/api/radicados' con verificarToken previo en app.js

// ── Rutas específicas (ANTES de /:id para no ser capturadas) ────────────────
router.get('/descargar-excel', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.descargarExcel)
router.post('/extraer-campos', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.extraerCampos)
router.post('/extraer-campos-respuesta', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.extraerCamposRespuesta)

// ── Oficios de respuesta de radicados (archivo histórico del módulo) ────────
router.get('/expedientes', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.listarExpedientes)
router.get('/respuestas', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.listarRespuestas)
router.post('/respuestas', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.crearRespuesta)
router.get('/respuestas/:id/archivo', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.obtenerArchivoRespuesta)
router.delete('/respuestas/:id', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.eliminarRespuesta)

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.listar)
router.post('/', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.crear)
router.put('/:id/estado', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.actualizarEstado)
router.put('/:id/archivo', verificarRol('RADICADOS', 'ENCARGADO', 'ADMIN'), RadicadosController.adjuntarArchivo)
router.get('/:id/archivo', verificarRol('RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN'), RadicadosController.obtenerArchivo)
router.delete('/:id', verificarRol('ADMIN'), RadicadosController.eliminar)

export default router
