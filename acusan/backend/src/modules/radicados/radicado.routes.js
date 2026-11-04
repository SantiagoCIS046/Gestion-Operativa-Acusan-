import { Router } from 'express'
import multer from 'multer'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { RadicadoController } from './radicado.controller.js'

const router = Router()

// Subida de PDFs (radicado y respuesta): en memoria (nada toca disco),
// máx 10 MB, solo application/pdf. El servicio revalida la firma mágica
// %PDF- por si el contenido no es un PDF real.
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) {
      return cb(new Error('SOLO_PDF'))
    }
    cb(null, true)
  },
})

// Traduce los errores de multer a respuestas 400 claras (mensaje único de
// la spec R2 para tipo/tamaño)
function manejarSubidaPdf(middleware) {
  return (req, res, next) =>
    middleware(req, res, (err) => {
      if (!err) return next()
      const mensaje =
        err.message === 'SOLO_PDF' || err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo debe ser un PDF de hasta 10 MB.'
          : 'No se pudo recibir el archivo.'
      res.status(400).json({ success: false, message: mensaje })
    })
}

// Subida del Excel de importación: en memoria, máx 5 MB, solo .xlsx
const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) {
      return cb(new Error('SOLO_XLSX'))
    }
    cb(null, true)
  },
})
function manejarSubidaXlsx(middleware) {
  return (req, res, next) =>
    middleware(req, res, (err) => {
      if (!err) return next()
      const mensaje =
        err.message === 'SOLO_XLSX' || err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo debe ser un Excel (.xlsx) de hasta 5 MB.'
          : 'No se pudo recibir el archivo.'
      res.status(400).json({ success: false, message: mensaje })
    })
}

// Lectura: cualquier rol (el servicio recorta por área según el token)
router.get('/', requireAuth, RadicadoController.listar)

// Excel: rutas literales ANTES de /:id para que no las trague el parámetro
router.get('/export.xlsx', requireAuth, requireRole('LIDER_GENERAL'), RadicadoController.exportar)
router.get('/plantilla.xlsx', requireAuth, requireRole('LIDER_GENERAL'), RadicadoController.plantilla)
router.post(
  '/import',
  requireAuth,
  requireRole('LIDER_GENERAL'),
  manejarSubidaXlsx(uploadXlsx.single('archivo')),
  RadicadoController.importar,
)

// Detalle completo: datos, adjuntos (metadatos) y línea de tiempo de eventos
router.get('/:id', requireAuth, RadicadoController.obtener)

// PDFs: verlos puede cualquier rol con acceso al área (el servicio valida)
router.get('/:id/pdf/radicado', requireAuth, RadicadoController.obtenerPdfRadicado)
router.get('/:id/pdf/respuesta', requireAuth, RadicadoController.obtenerPdfRespuesta)

// Registro y edición: solo gerencia (crea con el PDF del radicado adjunto;
// el campo multipart del archivo se llama "archivo")
router.post('/', requireAuth, requireRole('LIDER_GENERAL'), manejarSubidaPdf(uploadPdf.single('archivo')), RadicadoController.crear)
router.put('/:id', requireAuth, requireRole('LIDER_GENERAL'), RadicadoController.actualizar)
router.delete('/:id', requireAuth, requireRole('LIDER_GENERAL'), RadicadoController.eliminar)

// Reemplaza el PDF original (p. ej. el relleno de una importación)
router.post(
  '/:id/pdf/radicado',
  requireAuth,
  requireRole('LIDER_GENERAL'),
  manejarSubidaPdf(uploadPdf.single('archivo')),
  RadicadoController.reemplazarPdfRadicado,
)

// Respuesta del área: el líder del área o el encargado asignado, con su PDF
router.post('/:id/responder', requireAuth, manejarSubidaPdf(uploadPdf.single('archivo')), RadicadoController.responder)

// Reabrir un radicado respondido (con nueva fecha límite opcional = renovar):
// solo gerencia, con motivo obligatorio
router.post('/:id/reabrir', requireAuth, requireRole('LIDER_GENERAL'), RadicadoController.reabrir)

export default router
