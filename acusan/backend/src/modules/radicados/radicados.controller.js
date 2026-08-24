import { RadicadosService } from './radicados.service.js'
import logger from '../../config/logger.js'
import fs from 'fs'

export const RadicadosController = {
  async obtenerTodos(req, res) {
    try {
      const radicados = await RadicadosService.obtenerTodos()
      res.json({
        success: true,
        data: radicados
      })
    } catch (error) {
      logger.error('RADICADOS', 'LISTAR ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al consultar radicados' })
    }
  },

  async crear(req, res) {
    try {
      // registradoPor: fuente de verdad = usuario autenticado (para filtros Eliana/Román reales)
      const payload = {
        ...req.body,
        registradoPor: req.usuario?.nombre || req.body.registradoPor || 'Encargada'
      }
      const nuevo = await RadicadosService.crear(payload)

      const usuario = req.usuario?.email || 'anónimo'
      const radicado = nuevo?.numeroRadicado || nuevo?.id || '?'
      logger.create(
        'RADICADOS',
        'CREAR',
        `Por: ${usuario} | Radicado: ${radicado}`
      )

      res.status(201).json({
        success: true,
        message: 'Radicado registrado exitosamente',
        data: nuevo
      })
    } catch (error) {
      logger.error('RADICADOS', 'CREAR ERR', error.message)
      // 503: el radicado NO se persistió — el cliente lo conservará como pendiente local
      res.status(503).json({
        success: false,
        message: 'El radicado no pudo guardarse en la base de datos. Quedará pendiente de sincronización.'
      })
    }
  },

  async actualizarEstado(req, res) {
    try {
      const { id } = req.params
      const { estado } = req.body
      const actualizado = await RadicadosService.actualizarEstado(id, estado)

      if (!actualizado) {
        return res.status(404).json({
          success: false,
          message: 'El radicado no existe en la base de datos (posiblemente es un registro local pendiente de sincronizar)'
        })
      }

      const usuario = req.usuario?.email || 'anónimo'
      logger.update(
        'RADICADOS',
        'ACTUALIZAR',
        `Por: ${usuario} | ID: ${id} | Nuevo estado: ${estado}`
      )

      // Sin Base64 en la respuesta (mismo criterio que el listado): el archivo
      // se sirve bajo demanda desde /:id/archivo
      const { archivoBase64, ...actualizadoLigero } = actualizado

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: { ...actualizadoLigero, hasArchivo: Boolean(archivoBase64) }
      })
    } catch (error) {
      logger.error('RADICADOS', 'ACTUAL ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(503).json({ success: false, message: 'Error al actualizar el estado' })
    }
  },

  async extraerCampos(req, res) {
    try {
      const { texto, nombreArchivo } = req.body || {}
      if (!texto || !String(texto).trim()) {
        return res.status(400).json({ success: false, message: 'No se recibió texto para analizar' })
      }

      const resultado = await RadicadosService.parsearTexto(String(texto), nombreArchivo)

      logger.info(
        'RADICADOS',
        'EXTRAER CAMPOS',
        `Archivo: ${nombreArchivo || '?'} | Texto: ${String(texto).length} caracteres`
      )

      res.json({ success: true, data: resultado })
    } catch (error) {
      logger.error('RADICADOS', 'CAMPOS ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al analizar el texto del documento' })
    }
  },

  async servirArchivo(req, res) {
    try {
      const { id } = req.params
      const radicado = await RadicadosService.obtenerPorId(id)
      if (!radicado || !radicado.archivoBase64) {
        return res.status(404).json({ success: false, message: 'El radicado no tiene documento adjunto' })
      }

      const dataUrl = radicado.archivoBase64
      const matches = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
      if (!matches) {
        return res.status(422).json({ success: false, message: 'Formato de documento almacenado no soportado' })
      }

      const mime = matches[1] || 'application/pdf'
      const buffer = Buffer.from(matches[2], 'base64')
      const nombreSeguro = (radicado.archivoNombre || 'Radicado.pdf').replace(/["\r\n]/g, '')

      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', `inline; filename="${nombreSeguro}"`)
      res.setHeader('Cache-Control', 'private, max-age=300')
      return res.send(buffer)
    } catch (error) {
      logger.error('RADICADOS', 'ARCHIVO ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al servir el documento del radicado' })
    }
  },

  async extraerPdf(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se ha adjuntado ningún archivo PDF' })
      }
      const resultado = await RadicadosService.extraerPdf(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      )

      logger.info(
        'RADICADOS',
        'EXTRAER PDF',
        `Archivo: ${req.file.originalname} | Tamaño: ${(req.file.size / 1024).toFixed(1)}KB`
      )

      res.json({
        success: true,
        data: resultado
      })
    } catch (error) {
      logger.error('RADICADOS', 'PDF ERR', `${req.file?.originalname || '?'} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al procesar el archivo PDF' })
    }
  },

  async descargarExcel(req, res) {
    try {
      const { filePath, fileName } = await RadicadosService.generarExcel()

      const usuario = req.usuario?.email || 'anónimo'
      logger.info('RADICADOS', 'EXCEL', `Descarga de reporte por: ${usuario} | Archivo: ${fileName}`)

      res.download(filePath, fileName, (err) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      logger.error('RADICADOS', 'EXCEL ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al generar el reporte Excel' })
    }
  },

  async eliminar(req, res) {
    try {
      const { id } = req.params
      const eliminado = await RadicadosService.eliminar(id)

      if (!eliminado) {
        return res.status(404).json({
          success: false,
          message: 'El radicado no existe en la base de datos'
        })
      }

      const usuario = req.usuario?.email || 'anónimo'
      logger.update('RADICADOS', 'ELIMINAR', `Por: ${usuario} | ID: ${id} | N°: ${eliminado.numeroRadicado}`)

      res.json({
        success: true,
        message: `Radicado ${eliminado.numeroRadicado} eliminado correctamente`
      })
    } catch (error) {
      logger.error('RADICADOS', 'ELIMINAR ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al eliminar el radicado' })
    }
  }
}

