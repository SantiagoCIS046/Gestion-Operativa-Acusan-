import { HorasExtrasService } from './horas-extras.service.js'
import logger from '../../config/logger.js'

export const HorasExtrasController = {
  /**
   * Listar reporte de horas extras (uso interno: Gerencia, Encargado, Admin)
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
   * Registrar nuevo turno / recargo de horas extras (uso interno: Encargado/Admin)
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
      const { estado, observaciones } = req.body

      if (!['APROBADO', 'RECHAZADO'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser APROBADO o RECHAZADO'
        })
      }

      // La identidad del dictaminador sale del JWT, jamás del body
      const autorizadoPor = req.usuario?.nombre || req.usuario?.email || 'Gerencia Acuasan'

      const horaActualizada = await HorasExtrasService.dictaminar(id, {
        estado,
        autorizadoPor,
        observaciones
      })

      const usuario = req.usuario?.email || 'anónimo'
      const nivel = estado === 'APROBADO' ? 'success' : 'warn'
      logger[nivel](
        'H-EXTRAS',
        'DICTAMINAR',
        `Por: ${usuario} | ID: ${id} | Estado: ${estado} | Autorizó: ${autorizadoPor}`
      )

      res.json({
        success: true,
        message: `Horas extras marcadas como ${estado}`,
        data: horaActualizada
      })
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message })
      }
      logger.error('H-EXTRAS', 'DICTAM ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al actualizar horas extras', error: error.message })
    }
  },

  /**
   * Re-ejecutar el clasificador sobre un registro PENDIENTE con sesión
   * inicio/fin (corrige horas/tipo si el turno del área cambió o el cálculo
   * quedó desactualizado). Responde con "aviso" describiendo la corrección.
   */
  async recalcular(req, res) {
    try {
      const { id } = req.params
      const { horaExtra, aviso } = await HorasExtrasService.recalcular(id)
      logger.update(
        'H-EXTRAS',
        'RECALCULAR',
        `Por: ${req.usuario?.email || 'anónimo'} | ID: ${id} | ${aviso}`
      )
      res.json({ success: true, message: aviso, data: horaExtra, aviso })
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message })
      }
      logger.error('H-EXTRAS', 'RECALC ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al recalcular horas extras', error: error.message })
    }
  },

  // ────────────────────────────────────────────────────────
  // APP EXTERNA (Portal del Empleado de Campo)
  // ────────────────────────────────────────────────────────

  /**
   * Consultar los registros propios del empleado autenticado por cédula.
   * El token contiene la cédula del empleado (generado por /api/auth/token-empleado).
   */
  async misRegistros(req, res) {
    try {
      // La cédula viene del JWT del empleado (no se puede suplantar)
      const cedula = req.usuario?.cedula
      if (!cedula) {
        return res.status(400).json({
          success: false,
          message: 'Token de empleado inválido: no contiene cédula.'
        })
      }

      const horas = await HorasExtrasService.listar({ cedula })
      res.json({ success: true, data: horas })
    } catch (error) {
      logger.error('H-EXTRAS', 'MIS-REGISTROS ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al obtener tus registros', error: error.message })
    }
  },

  /**
   * Registrar horas extras desde la app del empleado de campo.
   * Cédula y nombre del funcionario se extraen del JWT para evitar
   * que un empleado reporte horas a nombre de otro.
   */
  async autoRegistrar(req, res) {
    try {
      // Datos de identidad tomados del token — el empleado NO los envía en el body
      const cedula = req.usuario?.cedula
      const funcionario = req.usuario?.nombre

      if (!cedula || !funcionario) {
        return res.status(400).json({
          success: false,
          message: 'Token de empleado inválido: faltan cedula o nombre.'
        })
      }

      const { cuadrillaArea, fechaOperacion, horaInicio, horaFin, tipoRecargo, cantidadHoras, montoEstimado, justificacion } = req.body

      // Flujo plantilla: fecha + hora de entrada y hora de salida. El
      // clasificador del servidor determina diurna/nocturna/dominical/
      // festiva y las horas reconocidas — el empleado NO las declara.
      if (horaInicio || horaFin) {
        if (!cuadrillaArea || !fechaOperacion || !horaInicio || !horaFin) {
          return res.status(400).json({
            success: false,
            message: 'Faltan campos obligatorios: cuadrillaArea, fechaOperacion, horaInicio, horaFin'
          })
        }

        const { horaExtra, aviso } = await HorasExtrasService.crearDesdeHorario({
          cedula,
          funcionario,
          cuadrillaArea,
          fechaOperacion,
          horaInicio,
          horaFin,
          justificacion
        })

        logger.create(
          'H-EXTRAS-APP',
          'AUTOREPORTE',
          `Cédula: ${cedula} | Funcionario: ${funcionario} | Cuadrilla: ${cuadrillaArea} | ${fechaOperacion} ${horaInicio}→${horaFin} | Horas: ${horaExtra.cantidadHoras}h | Tipo: ${horaExtra.tipoRecargo}`
        )

        return res.status(201).json({
          success: true,
          message: aviso || 'Horas extras reportadas correctamente. Quedan pendientes de aprobación.',
          data: horaExtra,
          ...(aviso && { aviso })
        })
      }

      // Flujo manual legado: el empleado declara tipo y cantidad (compatibilidad)
      if (!cuadrillaArea || !fechaOperacion || !tipoRecargo || !cantidadHoras) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: cuadrillaArea, fechaOperacion, tipoRecargo, cantidadHoras'
        })
      }

      const nuevaHora = await HorasExtrasService.crear({
        cedula,
        funcionario,
        cuadrillaArea,
        fechaOperacion,
        tipoRecargo,
        cantidadHoras,
        montoEstimado: montoEstimado || 0,
        justificacion
      })

      logger.create(
        'H-EXTRAS-APP',
        'AUTOREPORTE',
        `Cédula: ${cedula} | Funcionario: ${funcionario} | Cuadrilla: ${cuadrillaArea} | Horas: ${cantidadHoras}h | Tipo: ${tipoRecargo}`
      )

      res.status(201).json({
        success: true,
        message: 'Horas extras reportadas correctamente. Quedan pendientes de aprobación.',
        data: nuevaHora
      })
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message })
      }
      logger.error('H-EXTRAS-APP', 'AUTOREPORTE ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al registrar las horas extras', error: error.message })
    }
  }
}
