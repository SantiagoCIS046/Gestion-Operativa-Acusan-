import { ResumenService } from './resumen.service.js'

export const ResumenController = {
  /**
   * GET /api/resumen — panel por área con KPIs, ventanas y próximos a vencer.
   */
  async obtener(req, res) {
    try {
      const resumen = await ResumenService.obtener(req.usuario)
      res.json({ success: true, data: resumen })
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error al construir el resumen.',
      })
    }
  },
}
