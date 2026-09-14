// ocr.controller.js — Endpoint de escaneo documental del motor OCR Python
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ocr/escanear — recibe el archivo ORIGINAL en base64 (no el
// comprimido para BD), lo reenvía al servicio Python y devuelve los campos
// interpretados. Contrato de respuesta:
//   { success, data: { metodo, paginas, texto, tipo?, campos, confianza?, faltantes? } }

import { OcrService } from './ocr.service.js'
import logger from '../../config/logger.js'

const DOMINIOS_VALIDOS = ['permisos', 'radicados']

export const OcrController = {
  async escanear (req, res) {
    try {
      const { archivoBase64, nombreArchivo, mimeType, dominio, tipo, texto } = req.body || {}

      if (!DOMINIOS_VALIDOS.includes(dominio)) {
        return res.status(400).json({
          success: false,
          message: "Campo 'dominio' requerido: 'permisos' | 'radicados'"
        })
      }

      if (!archivoBase64 && !texto) {
        return res.status(400).json({
          success: false,
          message: "Se requiere 'archivoBase64' (PDF/imagen) o 'texto'"
        })
      }

      if (archivoBase64 && archivoBase64.length > OcrService.MAX_BASE64_LENGTH) {
        return res.status(413).json({
          success: false,
          message: 'El documento excede el límite de 40 MB del motor OCR'
        })
      }

      const { status, codigo, cuerpo } = await OcrService.escanearEnPython({
        archivoBase64, nombreArchivo, mimeType, dominio, tipo, texto
      })

      if (status !== 200) {
        // 503 (caído) / 504 (timeout) / 502 (error del Python) — el
        // frontend usa `codigo` para decidir el fallback en silencio.
        logger.warn('OCR-PY', `ESCANEO ${status}`, `${codigo} · ${req.usuario?.correo || req.usuario?.nombre || 'usuario'} · ${nombreArchivo || '(sin nombre)'}`)
        return res.status(status).json(cuerpo)
      }

      logger.info('OCR-PY', 'ESCANEO OK', `${cuerpo?.metodo} · ${dominio} · ${nombreArchivo || '(sin nombre)'}`)

      // Convención success/data del resto de la API
      const { success, message, ...datos } = cuerpo
      return res.status(200).json({ success: true, message, data: datos })
    } catch (error) {
      logger.error('OCR-PY', 'ERROR 500', error.message)
      return res.status(500).json({
        success: false,
        message: `Error en el puente del motor OCR: ${error.message}`
      })
    }
  }
}
