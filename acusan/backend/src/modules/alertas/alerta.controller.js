import { AlertaService } from './alerta.service.js'
import { sincronizarInformes } from '../../services/informes.js'
import { cifrarPendientes, totalCambiados } from '../../services/barridoCifrado.js'
import logger from '../../config/logger.js'

// Los ids de Mongo son ObjectId de 24 hex; uno mal formado es un 404 limpio
const ES_OBJECTID = /^[a-f\d]{24}$/i

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en el módulo de alertas.',
  })
}

export const AlertaController = {
  /** POST /api/alertas/ejecutar { areaId?, forzar? } — radicados (motor único) */
  async ejecutar(req, res) {
    try {
      const data = await AlertaService.ejecutarRevision({
        usuario: req.usuario,
        areaId: req.body?.areaId || null,
        forzar: req.body?.forzar === true,
      })
      res.json({
        success: true,
        message: `Revisión lista: ${data.nuevas} alerta(s) nueva(s), ${data.reenviadas} reenviada(s).`,
        data,
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST|GET /api/cron/alertas — revisión diaria sin usuario (secreto en .env) */
  async ejecutarCron(req, res) {
    try {
      const data = await AlertaService.ejecutarRevision({})
      // Mismo cron: cierre automático de informes (idempotente). Si falla,
      // la revisión de alertas ya quedó hecha — se reporta y no se rompe.
      let informes = null
      try {
        informes = await sincronizarInformes()
      } catch (e) {
        console.error('Sincronización de informes falló:', e.message)
      }
      // Mismo cron: barrido de cifrado. Cifra cualquier documento sensible
      // que haya entrado a la base por fuera de la aplicación. Si falla,
      // se reporta sin romper la revisión.
      let cifrado = null
      try {
        const resumen = await cifrarPendientes()
        cifrado = { cambiados: totalCambiados(resumen) }
        if (cifrado.cambiados) {
          logger.warn('CIFRADO', 'BARRIDO', `${cifrado.cambiados} documento(s) estaban sin cifrar y se cifraron.`)
        }
      } catch (e) {
        logger.error('CIFRADO', 'BARRIDO ERR', e.message)
      }
      res.json({ success: true, data: { ...data, informes, cifrado } })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/alertas?area= */
  async listar(req, res) {
    try {
      // Un areaId malformado haría explotar la consulta de Prisma (500)
      const { area } = req.query || {}
      if (area && !ES_OBJECTID.test(area)) {
        throw { status: 400, message: 'El área indicada no es válida.' }
      }
      const data = await AlertaService.listar(req.usuario, req.query)
      res.json({ success: true, data })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/alertas/:id/atender */
  async atender(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'La alerta no existe.' }
      const alerta = await AlertaService.atender(req.usuario, req.params.id)
      res.json({ success: true, message: 'Alerta atendida.', data: alerta })
    } catch (error) {
      responder(res, error, 400)
    }
  },
}
