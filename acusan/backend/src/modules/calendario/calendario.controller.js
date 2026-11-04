// Controller del CALENDARIO HÁBIL — lectura para todos los roles
// autenticados (la tira "Hoy" y el calendario mensual), administración
// de días no laborales SOLO para gerencia.

import prisma from '../../config/prisma.js'
import {
  festivosDelAnio,
  calendarioDelMes,
  diasHabilesDelMes,
  tipoDia,
  nombreFestivo,
  resumenHoy,
  cargarDiasNoLaborales,
} from '../../lib/calendarioCO.js'
import { medianocheBogotaDe, sumarDiasISO, aCalendarioBogota } from '../../utils/fechas.js'

const ES_OBJECTID = /^[a-f\d]{24}$/i
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

function responder(res, error, porDefecto = 500) {
  const status = error.status || porDefecto
  res.status(status).json({
    success: false,
    message: error.message || 'Error inesperado en el calendario.',
  })
}

function fechaValida(iso) {
  return ES_FECHA.test(iso) && new Date(`${iso}T00:00:00.000Z`).toISOString().slice(0, 10) === iso
}

function anioValido(anio) {
  return Number.isInteger(anio) && anio >= 1900 && anio <= 2200
}

// Área de lectura: gerencia puede pedir un área concreta (?area=, ObjectId
// válido; basura se ignora); cualquier otro rol siempre consulta la suya.
function areaDeConsulta(usuario, areaPedido) {
  const pedida = typeof areaPedido === 'string' && ES_OBJECTID.test(areaPedido) ? areaPedido : null
  if (usuario.rol === 'LIDER_GENERAL') return pedida
  return usuario.areaId
}

// Vencimientos de un rango de días agrupados por día calendario, con el
// scope del rol: gerencia ve todo; líder de área y usuario, su área.
// `areaId` (opcional) precorta el alcance — gerencia filtrando por área.
async function vencimientosPorDia(desdeISO, hastaISOExclusivo, usuario, areaId) {
  if (areaId === undefined) areaId = usuario.rol === 'LIDER_GENERAL' ? null : usuario.areaId
  const where = {
    estado: 'PENDIENTE',
    fechaLimite: { gte: medianocheBogotaDe(desdeISO), lt: medianocheBogotaDe(hastaISOExclusivo) },
  }
  if (areaId) where.areaId = areaId
  const filas = await prisma.radicado.findMany({ where, select: { fechaLimite: true } })
  const porDia = {}
  for (const f of filas) {
    const d = aCalendarioBogota(f.fechaLimite)
    porDia[d] = (porDia[d] || 0) + 1
  }
  return porDia
}

// Radicados ENVIADOS (por fecha de radicación) por día civil — todos los
// estados: un radicado respondido también fue enviado ese día. Mismo scope
// de área que los vencimientos.
async function enviadosPorDia(desdeISO, hastaISOExclusivo, usuario, areaId) {
  if (areaId === undefined) areaId = usuario.rol === 'LIDER_GENERAL' ? null : usuario.areaId
  const where = {
    fechaRadicacion: { gte: medianocheBogotaDe(desdeISO), lt: medianocheBogotaDe(hastaISOExclusivo) },
  }
  if (areaId) where.areaId = areaId
  const filas = await prisma.radicado.findMany({ where, select: { fechaRadicacion: true } })
  const porDia = {}
  for (const f of filas) {
    const d = aCalendarioBogota(f.fechaRadicacion)
    porDia[d] = (porDia[d] || 0) + 1
  }
  return porDia
}

export const CalendarioController = {
  /** GET /api/calendario/hoy — tira "Hoy" (todos los roles) */
  async hoy(req, res) {
    try {
      const hoy = await resumenHoy()
      const venceHoy = await vencimientosPorDia(hoy.fecha, sumarDiasISO(hoy.fecha, 1), req.usuario)
      res.json({ success: true, data: { ...hoy, venceHoy: venceHoy[hoy.fecha] || 0 } })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/calendario?anio=2026&mes=10&area=<id> — mes con radicados enviados por día (?area= solo gerencia) */
  async mes(req, res) {
    try {
      const anio = Number(req.query?.anio)
      const mes = Number(req.query?.mes)
      if (!anioValido(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        throw { status: 400, message: 'anio y mes son obligatorios (mes 1–12).' }
      }
      const prefix = `${anio}-${String(mes).padStart(2, '0')}`
      const desde = `${prefix}-01`
      const hastaExclusivo = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`
      const [dias, enviados, diasHabiles] = await Promise.all([
        calendarioDelMes(anio, mes),
        enviadosPorDia(desde, hastaExclusivo, req.usuario, areaDeConsulta(req.usuario, req.query?.area)),
        diasHabilesDelMes(anio, mes),
      ])
      res.json({ success: true, data: { anio, mes, diasHabiles, dias, enviados } })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/calendario/festivos?anio=2026 */
  async festivos(req, res) {
    try {
      const anio = Number(req.query?.anio)
      if (!anioValido(anio)) throw { status: 400, message: 'anio es obligatorio (1900–2200).' }
      res.json({ success: true, data: festivosDelAnio(anio) })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/calendario/dia?fecha=2026-10-20&area=<id> — radicados enviados ese día, todos los estados (?area= solo gerencia) */
  async dia(req, res) {
    try {
      const fecha = req.query?.fecha
      if (!fechaValida(fecha)) throw { status: 400, message: 'fecha debe ser válida (YYYY-MM-DD).' }
      const areaId = areaDeConsulta(req.usuario, req.query?.area)
      const where = {
        fechaRadicacion: { gte: medianocheBogotaDe(fecha), lt: medianocheBogotaDe(sumarDiasISO(fecha, 1)) },
      }
      if (areaId) where.areaId = areaId
      // El número va cifrado en la base: se trae por fecha de creación y se
      // ordena por número aquí, ya descifrado.
      const radicados = await prisma.radicado.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true, numeroRadicado: true, asunto: true, prioridad: true,
          fechaRadicacion: true, fechaLimite: true, encargadoId: true,
          area: { select: { codigo: true, nombre: true } },
        },
      })
      radicados.sort((a, b) => (a.numeroRadicado < b.numeroRadicado ? -1 : a.numeroRadicado > b.numeroRadicado ? 1 : 0))
      const ids = [...new Set(radicados.map((r) => r.encargadoId).filter(Boolean))]
      const encargados = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }) : []
      const nombres = Object.fromEntries(encargados.map((u) => [u.id, u.nombre]))
      res.json({
        success: true,
        data: {
          fecha,
          tipo: await tipoDia(fecha),
          nombreFestivo: await nombreFestivo(fecha),
          enviados: radicados.map((r) => ({ ...r, encargado: nombres[r.encargadoId] ?? r.encargadoId })),
        },
      })
    } catch (error) {
      responder(res, error)
    }
  },

  /** GET /api/calendario/no-laborales — solo gerencia */
  async listarNoLaborales(req, res) {
    try {
      const dias = await prisma.diaNoLaboral.findMany({ orderBy: { fecha: 'asc' } })
      res.json({ success: true, data: dias })
    } catch (error) {
      responder(res, error)
    }
  },

  /** POST /api/calendario/no-laborales { fecha, nombre, motivo? } */
  async crearNoLaboral(req, res) {
    try {
      const { fecha, nombre, motivo } = req.body ?? {}
      if (!fechaValida(fecha)) throw { status: 400, message: 'fecha debe ser válida (YYYY-MM-DD).' }
      if (!nombre?.trim()) throw { status: 400, message: 'nombre es obligatorio.' }
      const existente = await prisma.diaNoLaboral.findUnique({ where: { fecha: medianocheBogotaDe(fecha) } })
      if (existente) throw { status: 409, message: 'Ya existe un día no laboral registrado para esa fecha.' }
      const data = await prisma.diaNoLaboral.create({
        data: { fecha: medianocheBogotaDe(fecha), nombre: nombre.trim(), motivo: motivo?.trim() || null, creadoPorId: req.usuario.id },
      })
      await cargarDiasNoLaborales(true) // refresca la caché de calendarioCO
      res.status(201).json({ success: true, message: `Día no laboral registrado: ${nombre.trim()}.`, data })
    } catch (error) {
      responder(res, error, 400)
    }
  },

  /** DELETE /api/calendario/no-laborales/:id */
  async borrarNoLaboral(req, res) {
    try {
      if (!ES_OBJECTID.test(req.params.id)) throw { status: 404, message: 'El día no laboral no existe.' }
      const dia = await prisma.diaNoLaboral.findUnique({ where: { id: req.params.id } })
      if (!dia) throw { status: 404, message: 'El día no laboral no existe.' }
      await prisma.diaNoLaboral.delete({ where: { id: dia.id } })
      await cargarDiasNoLaborales(true)
      res.json({ success: true, message: `Día no laboral eliminado: ${dia.nombre}.` })
    } catch (error) {
      responder(res, error)
    }
  },
}
