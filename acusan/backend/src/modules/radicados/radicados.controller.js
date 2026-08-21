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
      const nuevo = await RadicadosService.crear(req.body)

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
      res.status(500).json({ success: false, message: 'Error al registrar el radicado' })
    }
  },

  async actualizarEstado(req, res) {
    try {
      const { id } = req.params
      const { estado } = req.body
      const actualizado = await RadicadosService.actualizarEstado(id, estado)

      const usuario = req.usuario?.email || 'anónimo'
      logger.update(
        'RADICADOS',
        'ACTUALIZAR',
        `Por: ${usuario} | ID: ${id} | Nuevo estado: ${estado}`
      )

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: actualizado
      })
    } catch (error) {
      logger.error('RADICADOS', 'ACTUAL ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al actualizar el estado' })
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
  }
}
