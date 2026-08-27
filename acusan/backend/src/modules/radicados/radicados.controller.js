import { RadicadosService } from './radicados.service.js'
import logger from '../../config/logger.js'

/**
 * Errores Prisma conocidos → respuesta HTTP clara (evita 500 engañosos).
 * P2025 = registro no encontrado para update/delete.
 */
const responderError = (res, error, accion) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message })
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Radicado no encontrado' })
  }
  logger.error('RADICADOS', `${accion} ERR`, error.message)
  return res.status(500).json({
    success: false,
    message: `Error al ${accion} radicado(s)`,
    error: error.message
  })
}

export const RadicadosController = {
  async listar(req, res) {
    try {
      const radicados = await RadicadosService.listar()
      res.json({ success: true, data: radicados })
    } catch (error) {
      responderError(res, error, 'listar')
    }
  },

  async crear(req, res) {
    try {
      const operador = req.usuario?.email || 'anónimo'
      const nuevo = await RadicadosService.crear(req.body || {})
      logger.create('RADICADOS', 'RADICAR', `${nuevo.numeroRadicado} | Por: ${operador} | Pet: ${nuevo.peticionario || '(sin peticionario)'}`)
      res.status(201).json({
        success: true,
        message: `Radicado ${nuevo.numeroRadicado} guardado en la base de datos`,
        data: nuevo
      })
    } catch (error) {
      responderError(res, error, 'crear')
    }
  },

  async actualizarEstado(req, res) {
    try {
      const { id } = req.params
      const { estado } = req.body || {}
      if (!estado) {
        return res.status(400).json({ success: false, message: 'El campo estado es obligatorio' })
      }
      const actualizado = await RadicadosService.actualizarEstado(id, estado)
      logger.update('RADICADOS', 'ESTADO', `${actualizado.numeroRadicado} → ${estado}`)
      res.json({ success: true, message: 'Estado actualizado', data: actualizado })
    } catch (error) {
      responderError(res, error, 'actualizar estado de')
    }
  },

  async eliminar(req, res) {
    try {
      const { id } = req.params
      const eliminado = await RadicadosService.eliminar(id)
      logger.delete('RADICADOS', 'ELIMINAR', `${eliminado.numeroRadicado} | Por: ${req.usuario?.email || 'anónimo'}`)
      res.json({ success: true, message: `Radicado ${eliminado.numeroRadicado} eliminado`, data: { id: eliminado.id } })
    } catch (error) {
      responderError(res, error, 'eliminar')
    }
  },

  /**
   * Documento ORIGINAL del radicado, servido como binario para que el
   * navegador lo muestre embebido (iframe/img) o lo descargue.
   */
  async obtenerArchivo(req, res) {
    try {
      const { id } = req.params
      const archivo = await RadicadosService.obtenerArchivo(id)
      if (!archivo) {
        return res.status(404).json({ success: false, message: 'El radicado no tiene documento adjunto' })
      }
      res.setHeader('Content-Type', archivo.mime)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.nombre)}"`)
      res.setHeader('Cache-Control', 'private, max-age=60')
      res.send(archivo.buffer)
    } catch (error) {
      responderError(res, error, 'obtener documento de')
    }
  },

  async adjuntarArchivo(req, res) {
    try {
      const { id } = req.params
      const { archivoBase64, archivoNombre } = req.body || {}
      if (!archivoBase64) {
        return res.status(400).json({ success: false, message: 'archivoBase64 es obligatorio' })
      }
      const actualizado = await RadicadosService.adjuntarArchivo(id, { archivoBase64, archivoNombre })
      logger.update('RADICADOS', 'ADJUNTAR', `${actualizado.numeroRadicado} ← ${archivoNombre || '(sin nombre)'}`)
      res.json({ success: true, message: 'Documento adjuntado', data: actualizado })
    } catch (error) {
      responderError(res, error, 'adjuntar documento a')
    }
  },

  /**
   * Recibe el texto extraído del PDF (OCR hecho en el navegador) y devuelve
   * los campos institucionales que se logran leer con certeza.
   * ?debug=1 → devuelve también el texto OCR recibido para diagnóstico.
   */
  async extraerCampos(req, res) {
    try {
      const { texto } = req.body || {}
      if (typeof texto !== 'string' || !texto.trim()) {
        return res.status(400).json({ success: false, message: 'El campo texto es obligatorio' })
      }
      const campos = RadicadosService.extraerCampos(texto)
      const respuesta = { success: true, data: campos }
      // Modo diagnóstico: muestra el texto OCR recibido y los campos extraídos
      if (req.query.debug === '1') {
        respuesta._debug = {
          textoOCR: texto,
          lineas: texto.split(/\r?\n/).filter(Boolean).length,
          caracteres: texto.length
        }
      }
      res.json(respuesta)
    } catch (error) {
      responderError(res, error, 'extraer campos de')
    }
  },

  async descargarExcel(req, res) {
    try {
      const csv = await RadicadosService.generarCsv()
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="radicados-acuasan.csv"')
      res.send(csv)
    } catch (error) {
      responderError(res, error, 'generar reporte de')
    }
  }
}

export default RadicadosController
