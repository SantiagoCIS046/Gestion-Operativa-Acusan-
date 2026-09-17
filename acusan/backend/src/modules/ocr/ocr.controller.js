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
  },

  /**
   * POST /api/ocr/trabajos — enrola un escaneo ASÍNCRONO en el motor Python.
   * El escaneo de un permiso escaneado tarda ~100s/página en el motor free:
   * ninguna conexión HTTP puede esperarlo dentro del lambda (maxDuration
   * 300). Aquí el POST solo sube el documento y devuelve { jobId } en 202;
   * el cliente consulta el estado con GET /api/ocr/trabajos/:jobId.
   */
  async iniciarTrabajo (req, res) {
    try {
      const { archivoBase64, nombreArchivo, mimeType, dominio, tipo } = req.body || {}

      // Solo permisos migra al flujo asíncrono: radicados conserva el
      // endpoint síncrono + fallback de navegador que ya funciona.
      if (dominio !== 'permisos') {
        return res.status(400).json({
          success: false,
          message: "El flujo asíncrono solo aplica a dominio 'permisos'"
        })
      }

      if (!archivoBase64) {
        return res.status(400).json({
          success: false,
          message: "Se requiere 'archivoBase64' (PDF/imagen) para el escaneo asíncrono"
        })
      }

      if (archivoBase64.length > OcrService.MAX_BASE64_LENGTH) {
        return res.status(413).json({
          success: false,
          message: 'El documento excede el límite de 40 MB del motor OCR'
        })
      }

      const { status, codigo, cuerpo } = await OcrService.iniciarTrabajoPython({
        archivoBase64, nombreArchivo, mimeType, dominio, tipo
      })

      if (status !== 202) {
        // 429 ocupado / 503 caído / 504 timeout / 502 error-python
        logger.warn('OCR-PY', `TRABAJO INICIO ${status}`, `${codigo} · ${req.usuario?.correo || req.usuario?.nombre || 'usuario'} · ${nombreArchivo || '(sin nombre)'}`)
        return res.status(status).json(cuerpo)
      }

      logger.info('OCR-PY', 'TRABAJO INICIADO', `${cuerpo?.jobId} · ${nombreArchivo || '(sin nombre)'}`)
      return res.status(202).json({
        success: true,
        data: { jobId: cuerpo?.jobId, estado: cuerpo?.estado || 'procesando' }
      })
    } catch (error) {
      logger.error('OCR-PY', 'ERROR 500', error.message)
      return res.status(500).json({
        success: false,
        message: `Error en el puente del motor OCR: ${error.message}`
      })
    }
  },

  /**
   * GET /api/ocr/trabajos/:jobId — estado del escaneo asíncrono. Con
   * estado 'listo' y código 200 devuelve EXACTAMENTE la misma forma que
   * POST /escanear ({ success, data: { metodo, paginas, texto, campos,
   * confianza, faltantes, refuerzo } }) para que el frontend reutilice
   * aplicarCampos sin cambios.
   */
  async estadoTrabajo (req, res) {
    try {
      const { jobId } = req.params
      if (!jobId) {
        return res.status(400).json({ success: false, message: "Se requiere 'jobId'" })
      }

      const { status, codigo, cuerpo } = await OcrService.consultarTrabajoPython(jobId)

      if (status !== 200) {
        // 404 trabajo perdido (motor reiniciado) / 503 / 504 / 502
        logger.warn('OCR-PY', `TRABAJO ESTADO ${status}`, `${codigo} · ${jobId}`)
        return res.status(status).json(cuerpo)
      }

      if (cuerpo?.estado !== 'listo') {
        return res.status(200).json({ success: true, data: { estado: 'procesando' } })
      }

      const respuesta = cuerpo.respuesta || {}
      const codigoFinal = Number(cuerpo.codigo) || 200
      if (codigoFinal !== 200) {
        // El trabajo terminó en error del motor (p.ej. 400 ilegible): se
        // propaga con su mensaje real para que el usuario sepa el porqué.
        logger.warn('OCR-PY', `TRABAJO FIN ${codigoFinal}`, `${jobId} · ${respuesta?.message || ''}`)
        return res.status(codigoFinal).json(respuesta)
      }

      logger.info('OCR-PY', 'TRABAJO FIN OK', `${jobId} · ${respuesta?.metodo}`)
      const { success, message, ...datos } = respuesta
      return res.status(200).json({ success: true, message, data: { estado: 'listo', ...datos } })
    } catch (error) {
      logger.error('OCR-PY', 'ERROR 500', error.message)
      return res.status(500).json({
        success: false,
        message: `Error en el puente del motor OCR: ${error.message}`
      })
    }
  },

  /**
   * DELETE /api/ocr/trabajos/:jobId — cancela un escaneo abandonado (el
   * cliente cambió de archivo, agotó su techo de espera o recibió un error
   * fatal) para liberar el único slot del motor. 404 = ya no existe: éxito
   * silencioso (idempotente desde la vista del cliente).
   */
  async cancelarTrabajo (req, res) {
    try {
      const { jobId } = req.params
      if (!jobId) {
        return res.status(400).json({ success: false, message: "Se requiere 'jobId'" })
      }

      const { status, cuerpo } = await OcrService.cancelarTrabajoPython(jobId)
      if (status === 200) {
        logger.info('OCR-PY', 'TRABAJO CANCELADO', jobId)
        return res.status(200).json({ success: true, data: { estado: 'cancelado' } })
      }
      if (status === 404) {
        return res.status(200).json({ success: true, data: { estado: 'cancelado' } })
      }
      // 503/504/502: la cancelación es best-effort; se informa sin drama.
      logger.warn('OCR-PY', `TRABAJO CANCELAR ${status}`, `${jobId} · ${cuerpo?.message || ''}`)
      return res.status(200).json({ success: true, data: { estado: 'cancelado', advertencia: cuerpo?.message } })
    } catch (error) {
      logger.error('OCR-PY', 'ERROR 500', error.message)
      return res.status(500).json({
        success: false,
        message: `Error en el puente del motor OCR: ${error.message}`
      })
    }
  }
}
