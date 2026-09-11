/**
 * ocr.controller.js — Endpoint para procesamiento OCR de permisos laborales
 * POST /api/permisos/ocr
 * Body: { archivoBase64, nombreArchivo, mimeType }
 * Responde: { success, campos, confianza, faltantes, textoExtraido? }
 */

import { procesarArchivoOCR } from './ocr.service.js'
import logger from '../../config/logger.js'

export const OcrController = {
  async procesarOCR(req, res) {
    try {
      const { archivoBase64, nombreArchivo, mimeType, texto } = req.body

      if (!archivoBase64 && !texto) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere archivoBase64 o texto.'
        })
      }

      // Límite de tamaño: 25 MB en Base64 (≈18 MB archivo real)
      if (archivoBase64 && archivoBase64.length > 33_000_000) {
        return res.status(413).json({
          success: false,
          message: 'El archivo supera el límite de 25 MB permitido para el procesamiento OCR.'
        })
      }

      const usuario = req.usuario?.email || 'anónimo'
      logger.info('OCR', 'REQUEST', `Por: ${usuario} | Archivo: ${nombreArchivo || 'sin-nombre'} | MIME: ${mimeType || '?'}`)

      const { campos, confianza, faltantes, textoExtraido } = await procesarArchivoOCR(
        archivoBase64,
        nombreArchivo || '',
        mimeType || '',
        texto || ''
      )

      return res.json({
        success: true,
        message: confianza >= 80
          ? `OCR completado con ${confianza}% de confianza`
          : `OCR parcial: ${confianza}% — campos faltantes: ${faltantes.join(', ')}`,
        campos,
        confianza,
        faltantes,
        // Texto extraído siempre incluido para diagnóstico (el frontend lo usa)
        textoExtraido: textoExtraido ? textoExtraido.slice(0, 5000) : ''
      })
    } catch (error) {
      logger.error('OCR', 'ERROR', error.message)
      return res.status(500).json({
        success: false,
        message: 'Error al procesar el documento OCR en el servidor.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}
