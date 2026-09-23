/**
 * reportes.controller.js — Handlers HTTP de reportes, nómina, dashboard y
 * calendario de festivos del módulo de horas extras.
 */

import { ReportesService } from './reportes.service.js'
import { festivosDelAnio } from './festivos.colombia.js'
import logger from '../../config/logger.js'

const responderError = (res, error, accion) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message })
  }
  logger.error('H-EXTRAS', `${accion} ERR`, error.message)
  return res.status(500).json({ success: false, message: `Error al ${accion}`, error: error.message })
}

const obtenerMesAnio = (req) => {
  const ahora = new Date(Date.now() - 300 * 60000) // hora local Colombia
  return {
    mes: req.query.mes || ahora.getUTCMonth() + 1,
    anio: req.query.anio || ahora.getUTCFullYear()
  }
}

export const ReportesController = {
  /** GET /reportes/mensual?mes=&anio=&cuadrillaArea= */
  async mensual(req, res) {
    try {
      const { mes, anio } = obtenerMesAnio(req)
      const reporte = await ReportesService.reporteMensual(mes, anio, req.query.cuadrillaArea)
      res.json({ success: true, data: reporte })
    } catch (error) {
      responderError(res, error, 'generar reporte mensual')
    }
  },

  /** GET /reportes/csv?mes=&anio= → attachment text/csv (BOM + separador ;) */
  async descargarCsv(req, res) {
    try {
      const { mes, anio } = obtenerMesAnio(req)
      const csv = await ReportesService.generarCsv(mes, anio, { cuadrillaArea: req.query.cuadrillaArea })
      const periodo = `${anio}-${String(mes).padStart(2, '0')}`
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="horas-extras-${periodo}.csv"`)
      res.send(csv)
    } catch (error) {
      responderError(res, error, 'generar CSV de')
    }
  },

  /** POST /nomina/enviar {mes, anio} — GERENCIA/ADMIN */
  async enviarNomina(req, res) {
    try {
      const { mes, anio } = req.body || {}
      if (!mes || !anio) {
        return res.status(400).json({ success: false, message: 'Los campos mes y anio son obligatorios.' })
      }
      const envio = await ReportesService.enviarNomina(mes, anio, req.usuario?.email || req.usuario?.cedula || 'anónimo')
      res.json({
        success: true,
        message: envio.emailEnviadoA
          ? `Periodo ${envio.periodo} enviado a nómina y correo notificado a ${envio.emailEnviadoA}.`
          : `Periodo ${envio.periodo} enviado a nómina. ${envio.emailError ? `El correo NO se pudo enviar: ${envio.emailError}` : ''}`.trim(),
        data: envio
      })
    } catch (error) {
      responderError(res, error, 'enviar nómina')
    }
  },

  /** GET /nomina/envios — GERENCIA/ADMIN */
  async listarEnvios(req, res) {
    try {
      const envios = await ReportesService.listarEnvios()
      res.json({ success: true, data: envios })
    } catch (error) {
      responderError(res, error, 'listar envíos de nómina')
    }
  },

  /** GET /dashboard?mes=&anio= */
  async dashboard(req, res) {
    try {
      const { mes, anio } = obtenerMesAnio(req)
      const data = await ReportesService.dashboard(mes, anio)
      res.json({ success: true, data })
    } catch (error) {
      responderError(res, error, 'consultar dashboard de')
    }
  },

  /** GET /festivos/:anio — calendario festivo de Colombia del año */
  async festivos(req, res) {
    try {
      const { anio } = req.params
      const festivos = festivosDelAnio(anio)
      res.json({ success: true, data: { anio: Number(anio), total: festivos.length, festivos } })
    } catch (error) {
      responderError(res, error, 'consultar festivos de')
    }
  }
}
