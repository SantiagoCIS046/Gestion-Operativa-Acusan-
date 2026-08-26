import { Router } from 'express'
import multer from 'multer'
import { RadicadosController } from './radicados.controller.js'
import { verificarToken } from '../../middlewares/auth.middleware.js'

// El OCR pesado corre en el navegador (pdfjs + tesseract); /extraer-pdf es una
// vía legacy. Con límites y token: un multipart anónimo arbitrariamente grande
// materializaría el archivo completo en RAM y tumbaría el módulo entero.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})
const router = Router()

// --- RUTAS DE RADICADOS ---
router.get('/', RadicadosController.obtenerTodos)
router.post('/', verificarToken, RadicadosController.crear)
router.put('/:id', verificarToken, RadicadosController.actualizarEstado)
// Reparación: adjuntar/reemplazar el documento original de un radicado existente
router.put('/:id/archivo', verificarToken, RadicadosController.adjuntarArchivo)
router.delete('/:id', verificarToken, RadicadosController.eliminar)
router.post('/extraer-pdf', verificarToken, upload.single('archivoPdf'), RadicadosController.extraerPdf)
// OCR real en el navegador (pdfjs + tesseract) → el servidor parsea el texto extraído
router.post('/extraer-campos', verificarToken, RadicadosController.extraerCampos)
router.get('/descargar-excel', RadicadosController.descargarExcel)
// Documento original bajo demanda (el listado viaja sin Base64 por peso)
router.get('/:id/archivo', RadicadosController.servirArchivo)

export default router

