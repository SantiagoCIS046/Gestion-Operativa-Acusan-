import { HorasExtrasService } from './horas-extras.service.js'

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

      res.status(201).json({
        success: true,
        message: 'Horas extras registradas correctamente',
        data: nuevaHora
      })
    } catch (error) {
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

      res.json({
        success: true,
        message: `Horas extras marcadas como ${estado}`,
        data: horaActualizada
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al actualizar horas extras', error: error.message })
    }
  }
}
