// Controlador de radicados: traduce HTTP ↔ servicio con el mismo contrato
// del resto de la API ({ success, message?, data }). El servicio devuelve
// filas ya mapeadas (estado derivado, adjuntos sin bytes, permisos).

import { RadicadoService } from './radicado.service.js'
import { ExcelService } from './excel.service.js'

// Los ids de Mongo son ObjectId de 24 hex; uno mal formado es un 404 limpio
const ES_OBJECTID = /^[a-f\d]{24}$/i

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en el módulo de radicados.',
  })
}

export const RadicadoController = {
  /** GET /api/radicados */
  async listar(req, res) {
    try {
      const radicados = await RadicadoService.listar(req.usuario, req.query)
      res.json({ success: true, data: radicados })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/radicados/:id — detalle con adjuntos y línea de tiempo */
  async obtener(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const radicado = await RadicadoService.obtener(req.usuario, req.params.id)
      res.json({ success: true, data: radicado })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/radicados (multipart: datos del radicado + pdf) */
  async crear(req, res) {
    try {
      const radicado = await RadicadoService.crear(req.usuario, req.body || {}, req.file)
      res.status(201).json({
        success: true,
        message: `Radicado ${radicado.numeroRadicado} dirigido a ${radicado.area?.codigo ?? ''}.`,
        data: radicado,
      })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  /** PUT /api/radicados/:id */
  async actualizar(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const radicado = await RadicadoService.actualizar(req.usuario, req.params.id, req.body || {})
      res.json({
        success: true,
        message: `Radicado ${radicado.numeroRadicado} actualizado.`,
        data: radicado,
      })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  /** DELETE /api/radicados/:id — elimina el radicado y todo lo derivado */
  async eliminar(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const eliminado = await RadicadoService.eliminar(req.usuario, req.params.id)
      res.json({
        success: true,
        message: `Radicado ${eliminado.numeroRadicado} eliminado.`,
        data: eliminado,
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/radicados/:id/reabrir { motivo, fechaLimite? } — solo gerencia */
  async reabrir(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const radicado = await RadicadoService.reabrir(req.usuario, req.params.id, req.body || {})
      res.json({
        success: true,
        message: radicado.fechaLimite
          ? `Radicado ${radicado.numeroRadicado} reabierto con nuevo plazo.`
          : `Radicado ${radicado.numeroRadicado} reabierto: vuelve a estar pendiente.`,
        data: radicado,
      })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  /** POST /api/radicados/:id/responder (multipart: pdf) */
  async responder(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const radicado = await RadicadoService.responder(
        req.usuario,
        req.params.id,
        req.file,
        req.body || {},
      )
      res.json({
        success: true,
        message:
          radicado.resultadoRespuesta === 'a_tiempo'
            ? `Respuesta del radicado ${radicado.numeroRadicado} registrada: entregada correctamente.`
            : `Respuesta del radicado ${radicado.numeroRadicado} registrada: entregada con retraso.`,
        data: radicado,
      })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  /** POST /api/radicados/:id/pdf/radicado (multipart: pdf) — reemplaza el original */
  async reemplazarPdfRadicado(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
      const radicado = await RadicadoService.reemplazarPdfRadicado(req.usuario, req.params.id, req.file)
      res.json({
        success: true,
        message: `PDF del radicado ${radicado.numeroRadicado} reemplazado.`,
        data: radicado,
      })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  // Común de GET /:id/pdf/radicado y /pdf/respuesta: sirve el adjunto
  // vigente del tipo pedido (Content-Type application/pdf, inline).
  async servirPdf(req, res, tipo) {
    if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El radicado no existe.' }
    const { datos, nombre, numeroRadicado } = await RadicadoService.obtenerPdf(
      req.usuario,
      req.params.id,
      tipo,
    )
    res.setHeader('Content-Type', 'application/pdf')
    // inline: el navegador lo muestra, no lo descarga. El nombre seguro va
    // en filename= (ASCII) y el original en filename* (UTF-8).
    const base = tipo === 'respuesta' ? `respuesta-${numeroRadicado}` : `radicado-${numeroRadicado}`
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${base}.pdf"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    )
    res.send(datos)
  },

  /** GET /api/radicados/:id/pdf/radicado — PDF original del radicado */
  async obtenerPdfRadicado(req, res) {
    try {
      await RadicadoController.servirPdf(req, res, 'radicado')
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/radicados/:id/pdf/respuesta — PDF de la respuesta vigente */
  async obtenerPdfRespuesta(req, res) {
    try {
      await RadicadoController.servirPdf(req, res, 'respuesta')
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/radicados/export.xlsx — todo el inventario + hoja Resumen */
  async exportar(req, res) {
    try {
      const { buffer, nombre } = await ExcelService.generarExport(req.usuario)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombre}"`,
      )
      res.send(buffer)
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/radicados/plantilla.xlsx — plantilla de importación */
  async plantilla(req, res) {
    try {
      const { buffer, nombre } = await ExcelService.generarPlantilla()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombre}"`,
      )
      res.send(buffer)
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/radicados/import (multipart: xlsx) — crea/actualiza por fila */
  async importar(req, res) {
    try {
      const resultado = await ExcelService.procesarImportacion(req.usuario, req.file?.buffer)
      const mensaje = resultado.errores.length
        ? `Importación con ${resultado.errores.length} fila(s) con error (revísalas en pantalla).`
        : `Importación lista: ${resultado.creados} creados, ${resultado.actualizados} actualizados.`
      res.json({ success: true, message: mensaje, data: resultado })
    } catch (error) {
      responder(res, error, 400)
    }
  },
}

export default RadicadoController
