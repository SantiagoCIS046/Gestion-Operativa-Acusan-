// Avisos internos de fin de periodo (dirigidos al ROL de gerencia).
// Nacen solos en el cierre automático; revisar el informe los atiende.

import prisma from '../../config/prisma.js'

const ES_OBJECTID = /^[a-f\d]{24}$/i

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en los avisos internos.',
  })
}

export const AvisosController = {
  /** GET /api/avisos — últimos 50, pendientes primero */
  async listar(req, res) {
    try {
      const [avisos, pendientes] = await Promise.all([
        prisma.avisoInterno.findMany({ orderBy: [{ atendido: 'asc' }, { creadoEn: 'desc' }], take: 50 }),
        prisma.avisoInterno.count({ where: { atendido: false } }),
      ])
      res.json({ success: true, data: { avisos, pendientes } })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/avisos/:id/atender */
  async atender(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El aviso no existe.' }
      const aviso = await prisma.avisoInterno.findUnique({ where: { id: req.params.id } })
      if (!aviso) throw { status: 404, message: 'El aviso no existe.' }
      if (aviso.atendido) {
        return res.json({ success: true, message: 'El aviso ya estaba atendido.', data: aviso })
      }
      const data = await prisma.avisoInterno.update({
        where: { id: aviso.id },
        data: { atendido: true, atendidoEn: new Date(), atendidoPorId: req.usuario.id },
      })
      res.json({ success: true, message: 'Aviso atendido.', data })
    } catch (error) {
      responder(res, error)
    }
  },
}
