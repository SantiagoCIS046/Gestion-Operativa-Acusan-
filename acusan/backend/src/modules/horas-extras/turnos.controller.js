/**
 * turnos.controller.js — Handlers HTTP del CRUD de turnos.
 *
 * GET /api/horas-extras/turnos está abierto a cualquier autenticado: la app
 * de campo (EMPLEADO_CAMPO) siempre ve solo turnos activos; los roles
 * internos pueden pasar ?inactivos=true para la gestión.
 */

import { TurnosService } from './turnos.service.js'
import logger from '../../config/logger.js'

const responderError = (res, error, accion) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message })
  }
  logger.error('H-EXTRAS', `${accion} TURNO ERR`, error.message)
  return res.status(500).json({ success: false, message: `Error al ${accion} turno(s)`, error: error.message })
}

export const TurnosController = {
  async listar(req, res) {
    try {
      // La app de campo solo ve turnos activos, sin importar la query
      const esInterno = req.usuario?.rol !== 'EMPLEADO_CAMPO'
      const inactivos = esInterno && req.query.inactivos === 'true'
      const turnos = await TurnosService.listar({ inactivos })
      res.json({ success: true, data: turnos })
    } catch (error) {
      responderError(res, error, 'listar')
    }
  },

  async crear(req, res) {
    try {
      const turno = await TurnosService.crear(req.body || {})
      logger.create(
        'H-EXTRAS',
        'TURNO-CREAR',
        `${turno.nombre} (${turno.cuadrillaArea}) ${turno.horaInicio}→${turno.horaFin} | Por: ${req.usuario?.email || 'anónimo'}`
      )
      res.status(201).json({ success: true, message: 'Turno creado correctamente', data: turno })
    } catch (error) {
      responderError(res, error, 'crear')
    }
  },

  async actualizar(req, res) {
    try {
      const turno = await TurnosService.actualizar(req.params.id, req.body || {})
      logger.update(
        'H-EXTRAS',
        'TURNO-EDITAR',
        `${turno.nombre} → ${turno.horaInicio}→${turno.horaFin} | Por: ${req.usuario?.email || 'anónimo'}`
      )
      res.json({ success: true, message: 'Turno actualizado correctamente', data: turno })
    } catch (error) {
      responderError(res, error, 'actualizar')
    }
  },

  async eliminar(req, res) {
    try {
      const turno = await TurnosService.eliminar(req.params.id)
      logger.delete('H-EXTRAS', 'TURNO-BAJA', `${turno.nombre} (${turno.cuadrillaArea}) | Por: ${req.usuario?.email || 'anónimo'}`)
      res.json({ success: true, message: `Turno "${turno.nombre}" desactivado (eliminación lógica)`, data: { id: turno.id, activo: turno.activo } })
    } catch (error) {
      responderError(res, error, 'eliminar')
    }
  }
}
