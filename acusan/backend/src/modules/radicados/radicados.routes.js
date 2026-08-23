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
// OCR real en el navegador (pdfjs + tesseract) → el servidor parsea el texto extraído
router.post('/extraer-campos', verificarToken, RadicadosController.extraerCampos)
router.get('/descargar-excel', RadicadosController.descargarExcel)
// Documento original bajo demanda (el listado viaja sin Base64 por peso)
router.get('/:id/archivo', RadicadosController.servirArchivo)

export default router
