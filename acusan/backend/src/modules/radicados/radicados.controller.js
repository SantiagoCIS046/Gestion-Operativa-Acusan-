import { RadicadosService } from './radicados.service.js'
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
      console.error('Error al obtener radicados:', error)
      res.status(500).json({ success: false, message: 'Error al consultar radicados' })
    }
  },

  async crear(req, res) {
    try {
      const nuevo = await RadicadosService.crear(req.body)
      res.status(201).json({
        success: true,
        message: 'Radicado registrado exitosamente',
        data: nuevo
      })
    } catch (error) {
      console.error('Error al crear radicado:', error)
      res.status(500).json({ success: false, message: 'Error al registrar el radicado' })
    }
  },

  async actualizarEstado(req, res) {
    try {
      const { id } = req.params
      const { estado } = req.body
      const actualizado = await RadicadosService.actualizarEstado(id, estado)
      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: actualizado
      })
    } catch (error) {
      console.error('Error al actualizar radicado:', error)
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
      res.json({
        success: true,
        data: resultado
      })
    } catch (error) {
      console.error('Error procesando PDF:', error)
      res.status(500).json({ success: false, message: 'Error al procesar el archivo PDF' })
    }
  },

  async descargarExcel(req, res) {
    try {
      const { filePath, fileName } = await RadicadosService.generarExcel()
      res.download(filePath, fileName, (err) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      console.error('Error generando Excel:', error)
      res.status(500).json({ success: false, message: 'Error al generar el reporte Excel' })
    }
  }
}
