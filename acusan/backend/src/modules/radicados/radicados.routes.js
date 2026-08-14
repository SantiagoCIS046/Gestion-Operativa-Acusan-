import { Router } from 'express'
import multer from 'multer'
import { RadicadosController } from './radicados.controller.js'
import { verificarToken } from '../../middlewares/auth.middleware.js'

const upload = multer({ storage: multer.memoryStorage() })
const router = Router()

// --- RUTAS DE RADICADOS ---
router.get('/', RadicadosController.obtenerTodos)
router.post('/', verificarToken, RadicadosController.crear)
router.put('/:id', verificarToken, RadicadosController.actualizarEstado)
router.post('/extraer-pdf', upload.single('archivoPdf'), RadicadosController.extraerPdf)
router.get('/descargar-excel', RadicadosController.descargarExcel)

export default router
