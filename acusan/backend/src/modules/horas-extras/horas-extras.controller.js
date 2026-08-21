import { HorasExtrasService } from './horas-extras.service.js'
import logger from '../../config/logger.js'

export const HorasExtrasController = {
  /**
   * Listar reporte de horas extras
   */
  async listar(req, res) {
    try {
      const { estado, cedula, cuadrillaArea } = req.query
      const horas = await HorasExtrasService.listar({ estado, cedula, cuadrillaArea })
      res.json({
        success: true,
        data: horas
      })
    } catch (error) {
      logger.error('H-EXTRAS', 'LISTAR ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al listar horas extras', error: error.message })
    }
  },

  /**
   * Registrar nuevo turno / recargo de horas extras
   */
  async registrar(req, res) {
    try {
      const { cedula, funcionario, cuadrillaArea, fechaOperacion, tipoRecargo, cantidadHoras, montoEstimado, justificacion } = req.body

      if (!cedula || !funcionario || !cuadrillaArea || !fechaOperacion || !tipoRecargo || !cantidadHoras) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios para registrar las horas extras'
        })
      }

      const nuevaHora = await HorasExtrasService.crear({
        cedula,
        funcionario,
        cuadrillaArea,
        fechaOperacion,
        tipoRecargo,
        cantidadHoras,
        montoEstimado,
        justificacion
      })

      const usuario = req.usuario?.email || 'anónimo'
      logger.create(
        'H-EXTRAS',
        'REGISTRAR',
        `Por: ${usuario} | Funcionario: ${funcionario} | Cuadrilla: ${cuadrillaArea} | Horas: ${cantidadHoras}h | Tipo: ${tipoRecargo}`
      )

      res.status(201).json({
        success: true,
        message: 'Horas extras registradas correctamente',
        data: nuevaHora
      })
    } catch (error) {
      logger.error('H-EXTRAS', 'REGISTRAR ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al registrar horas extras', error: error.message })
    }
  },

  /**
   * Dictaminar autorización por Gerencia
   */
  async dictaminar(req, res) {
    try {
      const { id } = req.params
      const { estado, autorizadoPor } = req.body

      if (!['APROBADO', 'RECHAZADO'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser APROBADO o RECHAZADO'
        })
      }

      const horaActualizada = await HorasExtrasService.dictaminar(id, {
        estado,
        autorizadoPor: autorizadoPor || 'Gerencia Acuasan'
      })

      const usuario = req.usuario?.email || 'anónimo'
      const nivel = estado === 'APROBADO' ? 'success' : 'warn'
      logger[nivel](
        'H-EXTRAS',
        'DICTAMINAR',
        `Por: ${usuario} | ID: ${id} | Estado: ${estado} | Autorizó: ${autorizadoPor || 'Gerencia'}`
      )

      res.json({
        success: true,
        message: `Horas extras marcadas como ${estado}`,
        data: horaActualizada
      })
    } catch (error) {
      logger.error('H-EXTRAS', 'DICTAM ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al actualizar horas extras', error: error.message })
    }
  }
}
