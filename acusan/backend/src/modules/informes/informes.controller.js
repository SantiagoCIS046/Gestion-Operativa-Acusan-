// Controller de INFORMES.
//   Fotos guardadas (cierres): generar/sincronizar/listar/detalle/excel/
//   revisar — generar, sincronizar y revisar son SOLO de gerencia.
//   Control mensual VIVO (/mes/...): métricas calculadas al momento con
//   agregaciones nativas (services/metricasInformes.js), no fotos.
// Alcance por rol (regla de informes): gerencia ve el global o el área que
// elija (?areaId=); el líder de área SIEMPRE su propia área, aunque la URL
// traiga otra — resolverAlcance lo fuerza; USUARIO se queda en 403 (ruta).

import ExcelJS from 'exceljs'

import prisma from '../../config/prisma.js'
import { guardarInforme, sincronizarInformes, compararConAnterior, serieRespondidos } from '../../services/informes.js'
import { kpis, porGrupo, destacados, porDia, pendientes, gerencia } from '../../services/metricasInformes.js'
import {
  TIPO_SEMANAL, TIPO_MENSUAL, periodoDe, periodosCerradosPendientes, etiquetaDesdeCampos,
  etiquetaPeriodo, semanasDelMesHabil, tipoDia, nombreFestivo,
} from '../../lib/calendarioCO.js'
import { hoyBogota, medianocheBogotaDe, sumarDiasISO, isoDe } from '../../utils/fechas.js'

const ES_OBJECTID = /^[a-f\d]{24}$/i
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

const TIPO_PRISMA = { [TIPO_SEMANAL]: 'SEMANAL', [TIPO_MENSUAL]: 'MENSUAL' }

// La etiqueta que sale al cliente SIEMPRE es la canónica, derivada de las
// fechas guardadas: filas creadas por formateadores anteriores no vuelven
// a mostrar un formato viejo (la gráfica y la tabla quedan uniformes).
const conEtiquetaCanonica = (i) => ({
  ...i,
  etiqueta: etiquetaDesdeCampos(
    i.tipo === 'MENSUAL' ? TIPO_MENSUAL : TIPO_SEMANAL,
    i.periodoInicio.toISOString(),
    i.periodoFin.toISOString(),
    i.diasHabiles,
  ),
})

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en el módulo de informes.',
  })
}

const PORCENTAJE = (v) => (v == null ? '—' : `${Math.round(v * 1000) / 10} %`)

// ── Alcance por rol ── gerencia elige (null = global, valida que el área
// exista); líder de área SIEMPRE el suyo. USUARIO no llega hasta aquí.
async function resolverAlcance(usuario, areaIdConsulta) {
  if (usuario.rol !== 'LIDER_GENERAL') return usuario.areaId
  const bruto = String(areaIdConsulta ?? '').trim()
  if (!bruto) return null
  if (!ES_OBJECTID.test(bruto)) throw { status: 400, message: 'El área indicada no es válida.' }
  const area = await prisma.area.findUnique({ where: { id: bruto }, select: { id: true } })
  if (!area) throw { status: 400, message: 'El área indicada no existe.' }
  return bruto
}

// /mes/<año>/<mes> — enteros, mes 1..12, nunca futuro
function validarMes(req) {
  const anio = Number(req.params.anio)
  const mes = Number(req.params.mes)
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw { status: 400, message: 'El mes debe indicarse como /mes/<año>/<mes>, con el mes entre 1 y 12.' }
  }
  const [hoyAnio, hoyMes] = hoyBogota().split('-').map(Number)
  if (anio * 12 + mes > hoyAnio * 12 + hoyMes) {
    throw { status: 400, message: 'Ese mes todavía no ha comenzado.' }
  }
  return { anio, mes }
}

// Periodo MENSUAL según la regla de informes (día siguiente al último hábil
// del mes anterior → último hábil del mes; el 31 de octubre cuenta para
// noviembre) + corte de la foto: último hábil si el mes cerró, hoy si va.
async function periodoMensual(anio, mes) {
  const p = await periodoDe(TIPO_MENSUAL, `${anio}-${String(mes).padStart(2, '0')}-15`)
  const cerrado = p.hastaInstante.getTime() <= Date.now()
  const hastaISO = isoDe(p.hastaDia)
  const corteISO = cerrado ? hastaISO : hoyBogota()
  return { p, desdeISO: isoDe(p.desdeDia), hastaISO, corteISO, cerrado }
}

const DOW_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const diaCorto = (iso) => `${DOW_CORTO[new Date(`${iso}T00:00:00.000Z`).getUTCDay()]} ${Number(iso.slice(8, 10))}`
// 'Mar 13 – Vie 16' (etiqueta corta de la semana; un solo día: 'Lun 31')
const rangoCorto = (desde, hasta) => (desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} – ${diaCorto(hasta)}`)
const minISO = (a, b) => (a < b ? a : b)

// El BLOQUE hábil rotula la semana (S#, rango, días hábiles); su PERIODO de
// medición es contiguo: desde su primer hábil (o el arranque del mes, si el
// mes empieza a mitad de semana) hasta el día anterior al bloque siguiente
// (el último, hasta el cierre del mes). Así un radicado del sábado, el
// domingo o el festivo intermedio pertenece a la semana cuyo bloque hábil
// lo sigue y LAS SEMANAS SUMAN EXACTAMENTE EL MES.
function periodosDeSemana(semanas, mesDesdeISO, mesHastaISO) {
  return semanas.map((s, i) => ({
    ...s,
    pDesde: i === 0 ? minISO(s.inicioISO, mesDesdeISO) : s.inicioISO,
    pHasta: i + 1 < semanas.length ? sumarDiasISO(semanas[i + 1].inicioISO, -1) : mesHastaISO,
  }))
}

// Nombres de área/encargado para las filas de pendientes (los ids vienen
// crudos del aggregate)
async function enriquecerPendientes({ filas, total, cursor }) {
  const areas = await prisma.area.findMany({ select: { id: true, codigo: true, nombre: true } })
  const mapaAreas = new Map(areas.map((a) => [a.id, a]))
  const idsUsuarios = [...new Set(filas.map((f) => f.encargadoId).filter(Boolean))]
  const usuarios = idsUsuarios.length
    ? await prisma.usuario.findMany({ where: { id: { in: idsUsuarios } }, select: { id: true, nombre: true } })
    : []
  const mapaUsuarios = new Map(usuarios.map((u) => [u.id, u.nombre]))
  return {
    total,
    cursor,
    filas: filas.map((f) => {
      const a = mapaAreas.get(f.areaId)
      return {
        ...f,
        area: a ? `${a.codigo} — ${a.nombre}` : f.areaId,
        encargado: f.encargadoId ? (mapaUsuarios.get(f.encargadoId) ?? f.encargadoId) : null,
      }
    }),
  }
}

export const InformesController = {
  /** POST /api/informes/generar { tipo, periodoInicio? } — origen manual */
  async generar(req, res) {
    try {
      const tipo = req.body?.tipo
      const tipoPrisma = TIPO_PRISMA[tipo]
      if (!tipoPrisma) throw { status: 400, message: 'El tipo debe ser "semanal" o "mensual".' }

      let clave
      if (!req.body?.periodoInicio) {
        // Sin periodo: el último CERRADO
        const primero = await prisma.radicado.findFirst({ orderBy: { fechaRadicacion: 'asc' }, select: { fechaRadicacion: true } })
        if (!primero) throw { status: 400, message: 'Todavía no hay radicados: no hay periodos que cerrar.' }
        const cerradas = await periodosCerradosPendientes(tipo, primero.fechaRadicacion)
        if (!cerradas.length) throw { status: 400, message: 'Todavía no hay periodos cerrados de este tipo.' }
        clave = cerradas.at(-1)
      } else {
        const inicio = req.body.periodoInicio
        if (!ES_FECHA.test(inicio) || Number.isNaN(Date.parse(`${inicio}T00:00:00.000Z`))) {
          throw { status: 400, message: 'periodoInicio debe ser una fecha válida (YYYY-MM-DD).' }
        }
        clave = (await periodoDe(tipo, inicio)).clave
        // El periodo en curso se puede generar como PARCIAL; futuros no
        const claveActual = (await periodoDe(tipo, new Date())).clave
        if (clave.getTime() > claveActual.getTime()) {
          throw { status: 400, message: 'No se puede generar el informe de un periodo futuro.' }
        }
      }

      // Gerencia puede generar la foto global o la de un área concreta
      const areaId = await resolverAlcance(req.usuario, req.body?.areaId)
      const informe = await guardarInforme(req.usuario, tipo, clave, 'MANUAL', { areaId })
      res.status(informe.regeneradoEn ? 200 : 201).json({
        success: true,
        message: informe.regeneradoEn
          ? `Informe regenerado: ${informe.etiqueta}.`
          : `Informe generado: ${informe.etiqueta}${informe.parcial ? ' (en curso, parcial).' : '.'}`,
        data: informe,
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/informes/sincronizar — cierre automático bajo demanda */
  async sincronizar(req, res) {
    try {
      const data = await sincronizarInformes()
      res.json({
        success: true,
        message: `Sincronización lista: ${data.informesCreados} informe(s) nuevo(s), ${data.informesActualizados} actualizado(s), ${data.avisosCreados} aviso(s).`,
        data,
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes?tipo=semanal&limite=12 — gerencia ve el global (o ?areaId=), líder su área */
  async listar(req, res) {
    try {
      // Acepta "semanal"/"SEMANAL" (el frontend viaja con mayúsculas); un valor
      // desconocido no filtra en silencio: devuelve todo mezclado.
      const tipoConsulta = String(req.query?.tipo ?? '').trim().toLowerCase()
      const tipo = TIPO_PRISMA[tipoConsulta] ?? null
      let limite = Number(req.query?.limite ?? 12)
      if (!Number.isInteger(limite) || limite < 1 || limite > 60) limite = 12
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const informes = await prisma.informe.findMany({
        where: { alcance: areaId ?? 'global', ...(tipo ? { tipo } : {}) },
        orderBy: { periodoInicio: 'desc' },
        take: limite,
        // La lista no necesita los Json pesados (porArea/criticos/porDia)
        select: {
          id: true, tipo: true, periodoInicio: true, periodoFin: true, etiqueta: true,
          alcance: true,
          parcial: true, origen: true, generadoEn: true, regeneradoEn: true,
          revisadoEn: true, diasHabiles: true, ingresados: true, respondidos: true,
          aTiempo: true, conRetraso: true, cumplimiento: true, pendientesAlCierre: true,
          porVencerAlCierre: true, vencidosAlCierre: true, respondidosNoHabil: true,
        },
      })
      res.json({ success: true, data: informes.map(conEtiquetaCanonica) })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/serie?granularidad=semanal|mensual — serie viva para la gráfica */
  async serie(req, res) {
    try {
      const granularidad = String(req.query?.granularidad ?? '').trim().toLowerCase() === 'mensual' ? 'mensual' : 'semanal'
      // Líder de área: la serie de su área (forzada); gerencia: global
      const areaId = req.usuario.rol !== 'LIDER_GENERAL' ? req.usuario.areaId : null
      res.json({ success: true, data: await serieRespondidos(granularidad, new Date(), { areaId }) })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/:id — detalle + comparación con el anterior */
  async detalle(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El informe no existe.' }
      const informe = await prisma.informe.findUnique({ where: { id: req.params.id } })
      if (!informe) throw { status: 404, message: 'El informe no existe.' }
      if (req.usuario.rol !== 'LIDER_GENERAL' && informe.alcance !== req.usuario.areaId) {
        throw { status: 403, message: 'Tu área no tiene acceso a este informe.' }
      }
      const comparacion = await compararConAnterior(informe)
      res.json({ success: true, data: { ...conEtiquetaCanonica(informe), comparacion } })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/informes/:id/revisar — marca revisado y atiende su aviso */
  async revisar(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El informe no existe.' }
      const informe = await prisma.informe.findUnique({ where: { id: req.params.id } })
      if (!informe) throw { status: 404, message: 'El informe no existe.' }
      if (informe.revisadoEn) {
        return res.json({ success: true, message: 'El informe ya estaba revisado.', data: informe })
      }
      const ahora = new Date()
      const [revisado] = await prisma.$transaction([
        prisma.informe.update({
          where: { id: informe.id },
          data: { revisadoEn: ahora, revisadoPorId: req.usuario.id },
        }),
        // Revisar el informe atiende automáticamente su aviso de fin de periodo
        prisma.avisoInterno.updateMany({
          where: { informeId: informe.id, atendido: false },
          data: { atendido: true, atendidoEn: ahora, atendidoPorId: req.usuario.id },
        }),
      ])
      res.json({ success: true, message: `Informe revisado: ${conEtiquetaCanonica(informe).etiqueta}.`, data: conEtiquetaCanonica(revisado) })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/:id/excel — Resumen / Por área / Críticos */
  async excel(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El informe no existe.' }
      const informeGuardado = await prisma.informe.findUnique({ where: { id: req.params.id } })
      if (!informeGuardado) throw { status: 404, message: 'El informe no existe.' }
      if (req.usuario.rol !== 'LIDER_GENERAL' && informeGuardado.alcance !== req.usuario.areaId) {
        throw { status: 403, message: 'Tu área no tiene acceso a este informe.' }
      }
      const informe = conEtiquetaCanonica(informeGuardado)

      const libro = new ExcelJS.Workbook()
      libro.creator = 'Acuusan'
      libro.created = new Date()

      // Hoja 1 — Resumen
      const resumen = libro.addWorksheet('Resumen')
      resumen.columns = [
        { header: 'Indicador', key: 'k', width: 34 },
        { header: 'Valor', key: 'v', width: 30 },
      ]
      resumen.getRow(1).font = { bold: true }
      const filas = [
        ['Periodo', informe.etiqueta],
        ['Tipo', informe.tipo === 'SEMANAL' ? 'Semanal' : 'Mensual'],
        ['Parcial', informe.parcial ? 'Sí (en curso)' : 'No'],
        ['Días hábiles', informe.diasHabiles],
        ['Ingresados', informe.ingresados],
        ['Respondidos', informe.respondidos],
        ['— A tiempo', informe.aTiempo],
        ['— Con retraso', informe.conRetraso],
        ['Cumplimiento', PORCENTAJE(informe.cumplimiento)],
        ['Promedio de respuesta (días)', informe.diasPromedioRespuesta ?? '—'],
        ['Pendientes al cierre', informe.pendientesAlCierre],
        ['Por vencer al cierre (7 días)', informe.porVencerAlCierre],
        ['Vencidos al cierre', informe.vencidosAlCierre],
        ['Vencidos en el periodo', informe.vencidosEnElPeriodo],
        ['Respondidos en día no hábil', informe.respondidosNoHabil],
        ['Alertas generadas', informe.alertasGeneradas],
        ['Alertas atendidas', informe.alertasAtendidas],
        ['Calculado', informe.generadoEn.toISOString()],
        ['Regenerado', informe.regeneradoEn ? informe.regeneradoEn.toISOString() : '—'],
        ['Revisado', informe.revisadoEn ? informe.revisadoEn.toISOString() : 'Pendiente'],
      ]
      for (const [k, v] of filas) resumen.addRow({ k, v })

      // Hoja 2 — Por área
      const areas = libro.addWorksheet('Por área')
      areas.columns = [
        { header: 'Código', key: 'codigo', width: 10 },
        { header: 'Área', key: 'nombre', width: 38 },
        { header: 'Ingresados', key: 'ingresados', width: 12 },
        { header: 'Respondidos', key: 'respondidos', width: 13 },
        { header: 'A tiempo', key: 'aTiempo', width: 10 },
        { header: 'Con retraso', key: 'conRetraso', width: 12 },
        { header: 'Cumplimiento', key: 'cumplimiento', width: 13 },
        { header: 'Vencidos al cierre', key: 'vencidos', width: 18 },
      ]
      areas.getRow(1).font = { bold: true }
      for (const a of informe.porArea ?? []) {
        areas.addRow({ ...a, cumplimiento: PORCENTAJE(a.cumplimiento), vencidos: a.vencidosAlCierre })
      }

      // Hoja 3 — Críticos
      const criticos = libro.addWorksheet('Críticos')
      criticos.columns = [
        { header: 'Número', key: 'numeroRadicado', width: 16 },
        { header: 'Asunto', key: 'asunto', width: 46 },
        { header: 'Área', key: 'area', width: 30 },
        { header: 'Encargado', key: 'encargado', width: 26 },
        { header: 'Días de atraso', key: 'diasAtraso', width: 14 },
      ]
      criticos.getRow(1).font = { bold: true }
      for (const c of informe.criticos ?? []) criticos.addRow(c)
      if (!informe.criticos?.length) criticos.addRow({ numeroRadicado: '—', asunto: 'Sin radicados vencidos al cierre' })

      const nombre = `informe-${informe.tipo.toLowerCase()}-${informe.periodoInicio.toISOString().slice(0, 10)}.xlsx`
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
      await libro.xlsx.write(res)
      res.end()
    } catch (error) {
      responder(res, error)
    }
  },

  // ─────────────────────────────────────────────────────────────
  // CONTROL MENSUAL VIVO — métricas al momento (no fotos guardadas)
  // ─────────────────────────────────────────────────────────────

  /** GET /api/informes/mes/:anio/:mes — semanas del mes + KPIs por semana y del mes */
  async mes(req, res) {
    try {
      const { anio, mes: mesNum } = validarMes(req)
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const { p, desdeISO, hastaISO, corteISO, cerrado } = await periodoMensual(anio, mesNum)
      const hoyISO = hoyBogota()

      const semanas = await semanasDelMesHabil(anio, mesNum)
      const conPeriodo = periodosDeSemana(semanas, desdeISO, hastaISO)
      const estadoDe = (s) => (s.inicioISO > hoyISO ? 'futura' : s.hastaInstante.getTime() <= Date.now() ? 'cerrada' : 'en_curso')
      // Un aggregate por semana (las no empezadas no se calculan) + mes + destacados
      const semanasKpis = await Promise.all(
        conPeriodo.map((s) => (estadoDe(s) === 'futura' ? null : kpis(s.pDesde, s.pHasta, estadoDe(s) === 'cerrada' ? s.pHasta : hoyISO, { areaId }))),
      )
      const [kpisMes, dest, grupos] = await Promise.all([
        kpis(desdeISO, hastaISO, corteISO, { areaId }),
        destacados(desdeISO, hastaISO, corteISO, { areaId, porEncargado: Boolean(areaId) }),
        porGrupo(desdeISO, hastaISO, corteISO, { areaId, porEncargado: Boolean(areaId) }),
      ])
      const area = areaId
        ? await prisma.area.findUnique({ where: { id: areaId }, select: { id: true, codigo: true, nombre: true } })
        : null

      res.json({
        success: true,
        data: {
          anio,
          mes: mesNum,
          etiqueta: (await etiquetaPeriodo(TIPO_MENSUAL, p.clave)).split(' · ')[0],
          alcance: areaId ?? 'global',
          area,
          desde: desdeISO,
          hasta: hastaISO,
          corte: corteISO,
          cerrado,
          diasHabiles: p.diasHabiles,
          kpis: kpisMes,
          destacados: dest,
          // Ranking del mes (áreas — o encargados si el alcance es un área)
          porGrupo: grupos,
          semanas: conPeriodo.map((s, i) => ({
            numero: s.numero,
            desde: s.inicioISO,
            hasta: s.finISO,
            rango: rangoCorto(s.inicioISO, s.finISO),
            // Periodo contiguo que mide los kpis (incluye los no hábiles
            // que caen entre este bloque y el siguiente)
            periodoDesde: s.pDesde,
            periodoHasta: s.pHasta,
            diasHabiles: s.diasHabiles,
            estado: estadoDe(s),
            kpis: semanasKpis[i],
          })),
        },
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/mes/:anio/:mes/semana/:numero — día por día, grupos y pendientes al corte de la semana */
  async semana(req, res) {
    try {
      const { anio, mes: mesNum } = validarMes(req)
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const numero = Number(req.params.numero)
      const { desdeISO: mesDesde, hastaISO: mesHasta } = await periodoMensual(anio, mesNum)
      const semanas = periodosDeSemana(await semanasDelMesHabil(anio, mesNum), mesDesde, mesHasta)
      const idx = semanas.findIndex((x) => x.numero === numero)
      const s = semanas[idx]
      if (!s) throw { status: 404, message: `Ese mes no tiene semana ${req.params.numero}.` }
      const hoyISO = hoyBogota()
      if (s.inicioISO > hoyISO) throw { status: 400, message: 'Esa semana todavía no comienza.' }
      const cerrada = s.hastaInstante.getTime() <= Date.now()
      const corteISO = cerrada ? s.pHasta : hoyISO

      // El día por día recorre el PERIODO contiguo de la semana: los días no
      // hábiles que mide (el festivo que recortó el bloque anterior, el fin
      // de semana posterior) viajan con su tipo — cada día del mes aparece
      // en una sola semana y las cifras cuadran con los kpis.
      const [kp, grupos, dias, pend] = await Promise.all([
        kpis(s.pDesde, s.pHasta, corteISO, { areaId }),
        porGrupo(s.pDesde, s.pHasta, corteISO, { areaId, porEncargado: Boolean(areaId) }),
        porDia(s.pDesde, s.pHasta, { areaId }),
        pendientes(corteISO, { areaId, limite: 20 }),
      ])
      const porDiaSemana = await Promise.all(
        dias.map(async (d) => ({ ...d, tipo: await tipoDia(d.fecha), nombreFestivo: await nombreFestivo(d.fecha) })),
      )

      res.json({
        success: true,
        data: {
          anio,
          mes: mesNum,
          numero: s.numero,
          desde: s.inicioISO,
          hasta: s.finISO,
          rango: rangoCorto(s.inicioISO, s.finISO),
          periodoDesde: s.pDesde,
          periodoHasta: s.pHasta,
          diasHabiles: s.diasHabiles,
          cerrada,
          corte: corteISO,
          alcance: areaId ?? 'global',
          kpis: kp,
          porGrupo: grupos,
          porDia: porDiaSemana,
          pendientes: await enriquecerPendientes(pend),
        },
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/mes/:anio/:mes/pendientes?cursor= — por contestar al corte del mes, más atrasados primero */
  async pendientesMes(req, res) {
    try {
      const { anio, mes: mesNum } = validarMes(req)
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const { corteISO } = await periodoMensual(anio, mesNum)
      let limite = Number(req.query?.limite ?? 20)
      if (!Number.isInteger(limite) || limite < 1 || limite > 100) limite = 20
      const data = await pendientes(corteISO, {
        areaId,
        limite,
        cursor: req.query?.cursor,
        busqueda: req.query?.busqueda,
      })
      res.json({ success: true, data: await enriquecerPendientes(data) })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/gerencia/:anio/:mes — movimientos del periodo (solo gerencia) */
  async gerenciaMes(req, res) {
    try {
      const { anio, mes: mesNum } = validarMes(req)
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const { p, desdeISO, hastaISO, corteISO, cerrado } = await periodoMensual(anio, mesNum)
      const hastaInstante = cerrado ? p.hastaInstante : medianocheBogotaDe(sumarDiasISO(corteISO, 1))
      const [data, grupos] = await Promise.all([
        gerencia(medianocheBogotaDe(desdeISO), hastaInstante, { areaId }),
        // "Por área" de la pestaña Gerencia (encargados si el alcance es un área)
        porGrupo(desdeISO, hastaISO, corteISO, { areaId, porEncargado: Boolean(areaId) }),
      ])
      res.json({
        success: true,
        data: { anio, mes: mesNum, desde: desdeISO, hasta: corteISO, cerrado, porGrupo: grupos, ...data },
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/informes/mes/:anio/:mes/excel — mensual.xlsx: Resumen / Semanas / Por área / Por contestar */
  async excelMes(req, res) {
    try {
      const { anio, mes: mesNum } = validarMes(req)
      const areaId = await resolverAlcance(req.usuario, req.query?.areaId)
      const { p, desdeISO, hastaISO, corteISO, cerrado } = await periodoMensual(anio, mesNum)
      const hoyISO = hoyBogota()
      const semanas = await semanasDelMesHabil(anio, mesNum)
      const area = areaId
        ? await prisma.area.findUnique({ where: { id: areaId }, select: { codigo: true, nombre: true } })
        : null

      const [kpisMes, dest, grupos, primera] = await Promise.all([
        kpis(desdeISO, hastaISO, corteISO, { areaId }),
        destacados(desdeISO, hastaISO, corteISO, { areaId, porEncargado: Boolean(areaId) }),
        porGrupo(desdeISO, hastaISO, corteISO, { areaId, porEncargado: Boolean(areaId) }),
        pendientes(corteISO, { areaId, limite: 500 }),
      ])
      const conPeriodo = periodosDeSemana(semanas, desdeISO, hastaISO)
      const semanasKpis = await Promise.all(
        conPeriodo.map((s) => {
          if (s.inicioISO > hoyISO) return null
          const corte = s.hastaInstante.getTime() <= Date.now() ? s.pHasta : hoyISO
          return kpis(s.pDesde, s.pHasta, corte, { areaId })
        }),
      )
      // "Por contestar" completa: se pagina por cursor hasta agotar (tope 500)
      const filasPend = [...primera.filas]
      let cursor = primera.cursor
      while (cursor && filasPend.length < 500) {
        const pagina = await pendientes(corteISO, { areaId, limite: 500, cursor })
        filasPend.push(...pagina.filas)
        cursor = pagina.cursor
      }
      const porContestar = await enriquecerPendientes({ filas: filasPend, total: primera.total, cursor: null })

      const libro = new ExcelJS.Workbook()
      libro.creator = 'Acuusan'
      libro.created = new Date()
      const etiqueta = (await etiquetaPeriodo(TIPO_MENSUAL, p.clave)).split(' · ')[0]

      // Hoja 1 — Resumen
      const hojaResumen = libro.addWorksheet('Resumen')
      hojaResumen.columns = [
        { header: 'Indicador', key: 'k', width: 34 },
        { header: 'Valor', key: 'v', width: 36 },
      ]
      hojaResumen.getRow(1).font = { bold: true }
      const filasResumen = [
        ['Periodo', etiqueta],
        ['Alcance', area ? `${area.codigo} — ${area.nombre}` : 'Global'],
        ['Estado', cerrado ? `Cerrado (corte ${corteISO})` : `En curso (corte ${corteISO})`],
        ['Días hábiles', p.diasHabiles],
        ['Radicados enviados', kpisMes.enviados],
        ['Contestados', kpisMes.contestados],
        ['— A tiempo', kpisMes.aTiempo],
        ['— Con retraso', kpisMes.conRetraso],
        ['Cumplimiento', PORCENTAJE(kpisMes.cumplimiento)],
        ['Tiempo promedio de respuesta (días)', kpisMes.diasPromedioRespuesta ?? '—'],
        ['En proceso al corte', kpisMes.enProceso],
        ['Vencidos al corte', kpisMes.vencidos],
        ['Por vencer al corte (7 días)', kpisMes.porVencer],
        [area ? 'Encargado más activo' : 'Área más activa', dest.masActiva ? `${dest.masActiva.nombre} (${dest.masActiva.contestados} contestados)` : '—'],
        [area ? 'Encargado más afectado' : 'Área más afectada', dest.masAfectada ? `${dest.masAfectada.nombre} (${dest.masAfectada.enProceso} en proceso)` : '—'],
        ['Calculado', new Date().toISOString()],
      ]
      for (const [k, v] of filasResumen) hojaResumen.addRow({ k, v })

      // Hoja 2 — Semanas
      const hojaSemanas = libro.addWorksheet('Semanas')
      hojaSemanas.columns = [
        { header: 'Semana', key: 'semana', width: 10 },
        { header: 'Rango', key: 'rango', width: 22 },
        { header: 'Días hábiles', key: 'diasHabiles', width: 12 },
        { header: 'Enviados', key: 'enviados', width: 10 },
        { header: 'Contestados', key: 'contestados', width: 12 },
        { header: 'A tiempo', key: 'aTiempo', width: 10 },
        { header: 'Cumplimiento', key: 'cumplimiento', width: 13 },
        { header: 'En proceso', key: 'enProceso', width: 11 },
        { header: 'Vencidos', key: 'vencidos', width: 10 },
      ]
      hojaSemanas.getRow(1).font = { bold: true }
      semanas.forEach((s, i) => {
        const k = semanasKpis[i]
        hojaSemanas.addRow({
          semana: `S${s.numero}`,
          rango: rangoCorto(s.inicioISO, s.finISO),
          diasHabiles: s.diasHabiles,
          enviados: k?.enviados ?? '—',
          contestados: k?.contestados ?? '—',
          aTiempo: k?.aTiempo ?? '—',
          cumplimiento: k ? PORCENTAJE(k.cumplimiento) : '—',
          enProceso: k?.enProceso ?? '—',
          vencidos: k?.vencidos ?? '—',
        })
      })

      // Hoja 3 — Por área (global) o Por encargado (alcance de área)
      const hojaGrupos = libro.addWorksheet(area ? 'Por encargado' : 'Por área')
      hojaGrupos.columns = [
        ...(area ? [] : [{ header: 'Código', key: 'codigo', width: 10 }]),
        { header: area ? 'Encargado' : 'Área', key: 'nombre', width: 38 },
        { header: 'Enviados', key: 'enviados', width: 10 },
        { header: 'Contestados', key: 'contestados', width: 12 },
        { header: 'A tiempo', key: 'aTiempo', width: 10 },
        { header: 'Con retraso', key: 'conRetraso', width: 12 },
        { header: 'Cumplimiento', key: 'cumplimiento', width: 13 },
        { header: 'En proceso', key: 'enProceso', width: 11 },
        { header: 'Vencidos', key: 'vencidos', width: 10 },
      ]
      hojaGrupos.getRow(1).font = { bold: true }
      const areasLista = area ? [] : await prisma.area.findMany({ select: { id: true, codigo: true } })
      const codigoDe = new Map(areasLista.map((a) => [a.id, a.codigo]))
      for (const g of grupos) {
        hojaGrupos.addRow({
          ...(area ? {} : { codigo: codigoDe.get(g.id) ?? '' }),
          nombre: g.nombre,
          enviados: g.enviados,
          contestados: g.contestados,
          aTiempo: g.aTiempo,
          conRetraso: g.conRetraso,
          cumplimiento: PORCENTAJE(g.cumplimiento),
          enProceso: g.enProceso,
          vencidos: g.vencidos,
        })
      }

      // Hoja 4 — Por contestar
      const hojaPend = libro.addWorksheet('Por contestar')
      hojaPend.columns = [
        { header: 'Número', key: 'numeroRadicado', width: 16 },
        { header: 'Asunto', key: 'asunto', width: 46 },
        { header: 'Área', key: 'area', width: 30 },
        { header: 'Encargado', key: 'encargado', width: 26 },
        { header: 'Radicado', key: 'diaRadicacion', width: 12 },
        { header: 'Vence', key: 'diaVencimiento', width: 12 },
        { header: 'Días de atraso', key: 'atrasoDias', width: 14 },
        { header: 'Prioridad', key: 'prioridad', width: 12 },
      ]
      hojaPend.getRow(1).font = { bold: true }
      for (const f of porContestar.filas) {
        hojaPend.addRow({ ...f, encargado: f.encargado ?? '—' })
      }
      if (!porContestar.filas.length) hojaPend.addRow({ numeroRadicado: '—', asunto: 'Sin radicados por contestar al corte' })

      const nombre = `informe-mensual-${anio}-${String(mesNum).padStart(2, '0')}${area ? `-${area.codigo}` : ''}.xlsx`
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
      await libro.xlsx.write(res)
      res.end()
    } catch (error) {
      responder(res, error)
    }
  },
}
