import { AreaService } from './area.service.js'

// Los ids de Mongo son ObjectId de 24 hex; uno mal formado es un 404 limpio
const ES_OBJECTID = /^[a-f\d]{24}$/i

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en el módulo de áreas.',
  })
}

export const AreaController = {
  /**
   * GET /api/areas
   * Áreas con líder y miembros, recortadas según el rol del token.
   */
  async listar(req, res) {
    try {
      const areas = await AreaService.listarAreas(req.usuario)
      res.json({ success: true, data: areas })
    } catch (error) {
      responder(res, error)
    }
  },

  /**
   * POST /api/areas — nueva área operativa. Solo gerencia.
   */
  async crear(req, res) {
    try {
      const area = await AreaService.crearArea(req.usuario, req.body || {})
      res.status(201).json({
        success: true,
        message: `Área ${area.codigo} creada con su encargado.`,
        data: area,
      })
    } catch (error) {
      // Sin porDefecto 400: los errores de validación traen status propio;
      // uno inesperado (BD caída, timeout) debe verse como 500, no como 400.
      responder(res, error)
    }
  },

  /**
   * PUT /api/areas/:id — editar código/nombre. Solo gerencia.
   */
  async actualizar(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El área no existe.' }
      const area = await AreaService.actualizarArea(req.usuario, req.params.id, req.body || {})
      res.json({ success: true, message: `Área ${area.codigo} actualizada.`, data: area })
    } catch (error) {
      responder(res, error)
    }
  },

  /**
   * PATCH /api/areas/:id/estado — activar/desactivar (línea verde/roja del
   * mapa). Solo gerencia. El movimiento queda en el registro.
   */
  async estado(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El área no existe.' }
      const activa = req.body?.activa
      if (typeof activa !== 'boolean') {
        throw { status: 400, message: 'Indique si el área queda activa o inactiva (activa: true|false).' }
      }
      const area = await AreaService.cambiarEstadoArea(req.usuario, req.params.id, activa)
      res.json({
        success: true,
        message: `Área ${area.codigo} ${activa ? 'activada' : 'desactivada'}.`,
        data: area,
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /**
   * GET /api/areas/movimientos — registro del movimiento de las áreas
   * (auditoría del mapa). ?areaId= filtra un área; ?limite= acota (máx 200).
   * Solo gerencia.
   */
  async movimientos(req, res) {
    try {
      const movimientos = await AreaService.listarMovimientos(req.usuario, {
        areaId: ES_OBJECTID.test(req.query.areaId || '') ? req.query.areaId : undefined,
        limite: req.query.limite,
      })
      res.json({ success: true, data: movimientos })
    } catch (error) {
      responder(res, error)
    }
  },

  /**
   * DELETE /api/areas/:id — eliminar área vacía. Solo gerencia.
   */
  async eliminar(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El área no existe.' }
      const area = await AreaService.eliminarArea(req.usuario, req.params.id)
      res.json({ success: true, message: `Área ${area.nombre} eliminada.`, data: { id: area.id } })
    } catch (error) {
      responder(res, error)
    }
  },
}
