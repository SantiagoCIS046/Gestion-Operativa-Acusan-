/**
 * evidencias.controller.js — Handlers HTTP de las sesiones de evidencias.
 *
 * Los roles se declaran en las rutas; aquí quedan las verificaciones de
 * propiedad (EMPLEADO_CAMPO solo toca sus propias sesiones/fotos) y el
 * evento Socket.io a la sala de operadores al cerrar una sesión.
 */

import { EvidenciasService } from './evidencias.service.js'
import { emitirEventoSeguro } from '../../config/socket.config.js'
import logger from '../../config/logger.js'

const responderError = (res, error, accion) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message })
  }
  logger.error('H-EXTRAS-EV', `${accion} ERR`, error.message)
  return res.status(500).json({ success: false, message: `Error al ${accion} evidencia(s)`, error: error.message })
}

export const EvidenciasController = {
  /** POST /evidencias/iniciar — EMPLEADO_CAMPO abre sesión con foto inicial */
  async iniciar(req, res) {
    try {
      const cedula = req.usuario?.cedula
      const funcionario = req.usuario?.nombre
      if (!cedula || !funcionario) {
        return res.status(400).json({ success: false, message: 'Token de empleado inválido: faltan cedula o nombre.' })
      }

      const { cuadrillaArea, descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps } = req.body || {}
      if (!fotoBase64) {
        return res.status(400).json({ success: false, message: 'La foto inicial (fotoBase64) es obligatoria.' })
      }

      const { horaExtra, evidencia } = await EvidenciasService.iniciarSesion({
        cedula, funcionario, cuadrillaArea, descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps
      })

      logger.create(
        'H-EXTRAS-EV',
        'INICIAR',
        `Cédula: ${cedula} | Área: ${horaExtra.cuadrillaArea} | Sesión: ${horaExtra.id}`
      )
      res.status(201).json({ success: true, message: 'Sesión iniciada. Recuerde tomar la foto final al terminar.', data: { horaExtra, evidencia } })
    } catch (error) {
      responderError(res, error, 'iniciar sesión de')
    }
  },

  /** POST /evidencias/:horaExtraId/finalizar — dueño cierra con foto final */
  async finalizar(req, res) {
    try {
      const cedula = req.usuario?.cedula
      if (!cedula) {
        return res.status(400).json({ success: false, message: 'Token de empleado inválido: no contiene cédula.' })
      }

      const { descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps } = req.body || {}
      if (!fotoBase64) {
        return res.status(400).json({ success: false, message: 'La foto final (fotoBase64) es obligatoria.' })
      }

      const { horaExtra, aviso } = await EvidenciasService.finalizarSesion(req.params.horaExtraId, {
        cedula, descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps
      })

      logger.success(
        'H-EXTRAS-EV',
        'FINALIZAR',
        `Cédula: ${cedula} | Horas: ${horaExtra.cantidadHoras} (${horaExtra.tipoRecargo}) | Sesión: ${horaExtra.id}`
      )

      // Aviso en vivo a los operadores internos (sala "operadores")
      emitirEventoSeguro('nueva_evidencia_horas_extra', {
        cedula,
        funcionario: horaExtra.funcionario,
        cuadrillaArea: horaExtra.cuadrillaArea,
        horas: horaExtra.cantidadHoras,
        tipo: horaExtra.tipoRecargo
      })

      res.json({ success: true, message: 'Sesión finalizada. Queda pendiente de revisión.', data: horaExtra, ...(aviso && { aviso }) })
    } catch (error) {
      responderError(res, error, 'finalizar sesión de')
    }
  },

  /** POST /evidencias/:horaExtraId/anular — dueño o Encargado/Admin */
  async anular(req, res) {
    try {
      const anulada = await EvidenciasService.anularSesion(req.params.horaExtraId, {
        cedula: req.usuario?.cedula,
        rol: req.usuario?.rol,
        motivo: req.body?.motivo
      })
      logger.warn(
        'H-EXTRAS-EV',
        'ANULAR',
        `Sesión: ${anulada.id} | Cédula: ${anulada.cedula} | Por: ${req.usuario?.cedula || req.usuario?.email || 'anónimo'} | Motivo: ${req.body?.motivo || '(sin motivo)'}`
      )
      res.json({ success: true, message: 'Sesión anulada.', data: anulada })
    } catch (error) {
      responderError(res, error, 'anular sesión de')
    }
  },

  /** GET /evidencias/mi-sesion-activa — EMPLEADO_CAMPO restaura su sesión */
  async miSesionActiva(req, res) {
    try {
      const cedula = req.usuario?.cedula
      if (!cedula) {
        return res.status(400).json({ success: false, message: 'Token de empleado inválido: no contiene cédula.' })
      }
      const data = await EvidenciasService.miSesionActiva(cedula)
      res.json({ success: true, data })
    } catch (error) {
      responderError(res, error, 'consultar sesión activa de')
    }
  },

  /** GET /evidencias/:id/foto — binario inline; campo solo ve sus fotos */
  async obtenerFoto(req, res) {
    try {
      const { id } = req.params
      const rol = req.usuario?.rol

      if (rol === 'EMPLEADO_CAMPO') {
        const evidencia = await EvidenciasService.obtenerEvidencia(id)
        if (!evidencia || evidencia.cedula !== req.usuario?.cedula) {
          return res.status(403).json({ success: false, message: 'Solo puede ver sus propias evidencias.' })
        }
      }

      const foto = await EvidenciasService.obtenerFoto(id)
      if (!foto) {
        return res.status(404).json({ success: false, message: 'La evidencia no tiene foto adjunta' })
      }
      res.setHeader('Content-Type', foto.mime)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(foto.nombre)}"`)
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.send(foto.buffer)
    } catch (error) {
      responderError(res, error, 'obtener foto de')
    }
  },

  /** GET /evidencias — listado interno con filtros (sin fotos) */
  async listar(req, res) {
    try {
      const { estadoEvidencia, cedula, desde, hasta, cuadrillaArea, horaExtraId } = req.query
      const evidencias = await EvidenciasService.listarEvidencias({ estadoEvidencia, cedula, desde, hasta, cuadrillaArea, horaExtraId })
      res.json({ success: true, data: evidencias })
    } catch (error) {
      responderError(res, error, 'listar')
    }
  },

  /** PUT /evidencias/revisar/:horaExtraId — dictamen de las evidencias */
  async revisar(req, res) {
    try {
      const { estadoEvidencia, observaciones } = req.body || {}
      const revisado = await EvidenciasService.revisar(req.params.horaExtraId, { estadoEvidencia, observaciones })
      logger.update(
        'H-EXTRAS-EV',
        'REVISAR',
        `Sesión: ${revisado.id} | ${estadoEvidencia} | Por: ${req.usuario?.email || 'anónimo'}${observaciones ? ` | "${observaciones}"` : ''}`
      )
      res.json({ success: true, message: `Evidencias marcadas como ${estadoEvidencia}`, data: revisado })
    } catch (error) {
      responderError(res, error, 'revisar')
    }
  }
}
