import { PqrService } from './pqr.service.js'

export const PqrController = {
  /**
   * Listar PQRs
   */
  async listar(req, res) {
    try {
      const { estado, matricula, prioridad } = req.query
      const pqrs = await PqrService.listar({ estado, matricula, prioridad })
      res.json({
        success: true,
        data: pqrs
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al listar PQRs', error: error.message })
    }
  },

  /**
   * Obtener detalle de PQR
   */
  async obtenerDetalle(req, res) {
    try {
      const { id } = req.params
      const pqr = await PqrService.obtenerPorId(id)
      if (!pqr) {
        return res.status(404).json({ success: false, message: 'PQR no encontrada' })
      }
      res.json({ success: true, data: pqr })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener PQR', error: error.message })
    }
  },

  /**
   * Radicar nueva PQR
   */
  async radicar(req, res) {
    try {
      const { usuario, cedulaNit, matricula, telefono, email, direccion, motivo, descripcion, prioridad } = req.body

      if (!usuario || !motivo || !descripcion) {
        return res.status(400).json({
          success: false,
          message: 'Usuario, motivo y descripción son campos obligatorios para radicar la PQR'
        })
      }

      const nuevaPqr = await PqrService.crear({
        usuario,
        cedulaNit,
        matricula,
        telefono,
        email,
        direccion,
        motivo,
        descripcion,
        prioridad
      })

      res.status(201).json({
        success: true,
        message: 'PQR radicada exitosamente con fecha de término legal',
        data: nuevaPqr
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al radicar PQR', error: error.message })
    }
  },

  /**
   * Responder formalmente a la PQR
   */
  async responder(req, res) {
    try {
      const { id } = req.params
      const { respuestaOficial, respondidoPor, nuevoEstado } = req.body

      if (!respuestaOficial) {
        return res.status(400).json({
          success: false,
          message: 'Debe incluir el texto de la respuesta oficial'
        })
      }

      const pqrActualizada = await PqrService.responder(id, {
        respuestaOficial,
        respondidoPor,
        nuevoEstado
      })

      res.json({
        success: true,
        message: 'Respuesta registrada y PQR actualizada satisfactoriamente',
        data: pqrActualizada
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al responder PQR', error: error.message })
    }
  }
}
