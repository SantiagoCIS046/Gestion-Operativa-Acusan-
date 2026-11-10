// Motor de alertas de RADICADOS (unificado tras la fusión de módulos,
// 2026-10-19): revisa los radicados pendientes cuya fecha límite entra en la
// ventana de 30 días (o ya pasó) y crea/reabre una alerta por cada
// (radicado, nivel, fecha límite).
//
// - Niveles ACUMULATIVOS con guard de plazo total: un radicado que vence en
//   2 días dispara 1d (y 3d/7d/… si su plazo total alcanzó a cruzar esos
//   umbrales). Si el plazo total no cruza un umbral, ese nivel nunca salta
//   (un radicado de 5 días no genera '7d').
// - 'nuevo' NO nace aquí: salta al crear/reasignar (radicado.service).
// - Sin "forzar": una clave ya existente no se toca (el nivel no cambió).
// - Con "forzar": las existentes se reabren (atendida=false), suben reenvios
//   y se actualiza fecha y quién las envió — nunca se duplican.
// - Las VENCIDAS escalan a gerencia además del encargado y el líder.
// - Cada corrida queda registrada en EjecucionAlerta (quién, alcance, cuántas).

import prisma from '../../config/prisma.js'
import { esLiderGeneral, puedeGestionar } from '../auth/permisos.js'
import { enDias, diasHasta, diasRestantes } from '../../utils/fechas.js'
import { enviarResumenAlertas } from './notificaciones.js'

// Ventana de revisión: radicados con límite a ≤30 días (o ya vencidos)
const VENTANA_DIAS = 30

// Umbral (días restantes) → nivel. El guard de plazo total se aplica encima:
// solo salta el nivel si el radicado tuvo plazo para verlo venir.
const UMBRALES = [
  { dias: 1, nivel: 'D1' },
  { dias: 3, nivel: 'D3' },
  { dias: 7, nivel: 'D7' },
  { dias: 15, nivel: 'D15' },
  { dias: 30, nivel: 'D30' },
]

// Orden de gravedad para el listado (vencido es lo más urgente).
const GRAVEDAD = { VENCIDO: 0, NUEVO: 1, D1: 2, D3: 3, D7: 4, D15: 5, D30: 6 }

// Fecha corta 'YYYY-MM-DD' (las fechas se guardan a medianoche de Bogotá =
// 05:00Z, así el día UTC coincide con el día de calendario bogotano)
const fechaCorta = (fecha) => new Date(fecha).toISOString().slice(0, 10)

function mensajeDe(nivel, radicado, dias) {
  const fecha = fechaCorta(radicado.fechaLimite)
  return nivel === 'VENCIDO'
    ? `Vencido desde el ${fecha}: radicado ${radicado.numeroRadicado} (${radicado.area.codigo}).`
    : `Vence en ${dias} días (el ${fecha}): radicado ${radicado.numeroRadicado} (${radicado.area.codigo}).`
}

// Clave de unicidad de una alerta
const clave = (radicadoId, nivel, venceRef) =>
  `${radicadoId}|${nivel}|${new Date(venceRef).getTime()}`

export const AlertaService = {
  /**
   * POST /api/alertas/ejecutar { areaId?, forzar? } · también el cron y el
   * script alertas:diarias (ambos llegan con usuario=null, sin areaId).
   */
  async ejecutarRevision({ usuario = null, areaId = null, forzar = false } = {}) {
    let areaPedido = null
    if (areaId) {
      areaPedido = await prisma.area.findUnique({ where: { id: areaId } })
      if (!areaPedido) throw { status: 400, message: 'El área indicada no existe.' }
    }

    // Candidatos: pendientes (estado ALMACENADO, el filtro sí matchea) con
    // límite dentro de la ventana (o pasado). Los respondidos quedan fuera.
    const where = { estado: 'PENDIENTE', fechaLimite: { lte: enDias(VENTANA_DIAS) } }
    if (areaId) where.areaId = areaId
    const radicados = await prisma.radicado.findMany({
      where,
      include: { area: { select: { id: true, codigo: true, nombre: true, parentId: true } } },
    })

    // Las alertas ya existentes de estos radicados (una sola consulta)
    const existentes = radicados.length
      ? await prisma.alerta.findMany({
          where: { radicadoId: { in: radicados.map((r) => r.id) } },
          select: { id: true, radicadoId: true, nivel: true, venceRef: true, reenvios: true },
        })
      : []
    const vistas = new Set(existentes.map((a) => clave(a.radicadoId, a.nivel, a.venceRef)))

    // Estadísticas por área para el resumen de la ejecución
    const stats = new Map()
    const statsDe = (radicado) => {
      if (!stats.has(radicado.areaId)) {
        stats.set(radicado.areaId, {
          areaId: radicado.areaId,
          area: { id: radicado.area.id, codigo: radicado.area.codigo, nombre: radicado.area.nombre },
          parentId: radicado.area.parentId,
          revisados: 0,
          nuevas: 0,
          reenviadas: 0,
          vencidos: 0,
          porVencer: 0,
          encargados: new Set(),
        })
      }
      return stats.get(radicado.areaId)
    }

    let nuevas = 0
    let reenviadas = 0
    const notificables = [] // { alerta, radicado } → enviarNotificación tras el commit
    const alcance = areaPedido ? `radicados-area:${areaPedido.codigo}` : 'radicados'

    const ejecucion = await prisma.$transaction(
      async (tx) => {
        // La ejecución se registra ANTES (las alertas la referencian) y sus
        // totales se actualizan al final.
        const registro = await tx.ejecucionAlerta.create({
          data: { ejecutadaPor: usuario?.id ?? null, alcance, nuevas: 0, reenviadas: 0 },
        })

        for (const radicado of radicados) {
          const dias = diasHasta(radicado.fechaLimite)
          // Plazo total del radicado: si no cruza un umbral, ese nivel no
          // aplica (un radicado de 5 días nunca genera '7d')
          const plazoTotal = Math.round(
            (radicado.fechaLimite.getTime() - radicado.fechaRadicacion.getTime()) / 86400000,
          )
          const niveles = []
          if (dias < 0) niveles.push('VENCIDO')
          else {
            for (const { dias: umbral, nivel } of UMBRALES) {
              if (plazoTotal >= umbral && dias <= umbral) niveles.push(nivel)
            }
          }

          const s = statsDe(radicado)
          s.revisados++
          if (dias < 0) s.vencidos++
          else s.porVencer++
          s.encargados.add(radicado.encargadoId)

          for (const nivel of niveles) {
            const k = clave(radicado.id, nivel, radicado.fechaLimite)
            if (!vistas.has(k)) {
              // Nivel nuevo (o radicado nuevo): alerta nueva
              const alerta = await tx.alerta.create({
                data: {
                  ejecucionId: registro.id,
                  radicadoId: radicado.id,
                  areaId: radicado.areaId,
                  nivel,
                  venceRef: radicado.fechaLimite,
                  mensaje: mensajeDe(nivel, radicado, dias),
                  enviadaPor: usuario?.id ?? null,
                },
              })
              nuevas++
              s.nuevas++
              notificables.push({ alerta, radicado })
            } else if (forzar) {
              // Ya existe: no se duplica, se reabre y se reenvía
              const previa = existentes.find(
                (a) => clave(a.radicadoId, a.nivel, a.venceRef) === k,
              )
              await tx.alerta.update({
                where: { id: previa.id },
                data: {
                  atendida: false,
                  atendidaPor: null,
                  atendidaEn: null,
                  reenvios: { increment: 1 },
                  creadaEn: new Date(),
                  enviadaPor: usuario?.id ?? null,
                },
              })
              reenviadas++
              s.reenviadas++
              notificables.push({
                alerta: {
                  id: previa.id,
                  nivel,
                  mensaje: mensajeDe(nivel, radicado, dias),
                  reenvios: previa.reenvios + 1,
                },
                radicado,
              })
            }
          }
        }

        return tx.ejecucionAlerta.update({
          where: { id: registro.id },
          data: { nuevas, reenviadas },
        })
      },
      // La corrida completa contra Atlas puede tardar: margen amplio
      { timeout: 90_000, maxWait: 10_000 },
    )

    // Encargados de los radicados notificados (referencia débil → batch)
    const idsEncargados = [...new Set(notificables.map((n) => n.radicado.encargadoId))]
    const encargados = idsEncargados.length
      ? await prisma.usuario.findMany({
          where: { id: { in: idsEncargados } },
          select: { id: true, nombre: true, email: true, rol: true },
        })
      : []
    const encargadoPorId = new Map(encargados.map((u) => [u.id, u]))

    // Las vencidas escalan a gerencia
    const hayVencidas = notificables.some((n) => n.alerta.nivel === 'VENCIDO')
    const gerencia = hayVencidas
      ? await prisma.usuario.findMany({
          where: { rol: 'LIDER_GENERAL', activo: true },
          select: { id: true, nombre: true, email: true, rol: true },
        })
      : []

    // Líder de cada área con caché por corrida
    const cacheLideres = new Map()
    const liderDe = async (areaId) => {
      if (!cacheLideres.has(areaId)) {
        const lider = await prisma.usuario.findFirst({
          where: { areaId, rol: 'LIDER_AREA', activo: true },
          select: { id: true, nombre: true, email: true, rol: true },
        })
        cacheLideres.set(areaId, lider)
      }
      return cacheLideres.get(areaId)
    }

    const areas = []
    for (const s of [...stats.values()].sort((a, b) => {
      if (!a.parentId) return -1
      if (!b.parentId) return 1
      return a.area.codigo.localeCompare(b.area.codigo)
    })) {
      areas.push({
        areaId: s.areaId,
        area: s.area,
        revisados: s.revisados,
        alertas: s.nuevas + s.reenviadas,
        nuevas: s.nuevas,
        reenviadas: s.reenviadas,
        vencidos: s.vencidos,
        porVencer: s.porVencer,
        notificados: {
          lider: await liderDe(s.areaId),
          encargados: [...s.encargados]
            .map((id) => encargadoPorId.get(id))
            .filter(Boolean),
          ...(s.vencidos > 0 ? { gerencia } : {}),
        },
      })
    }

    // Notificación por correo: encargado + líder del área; las vencidas
    // escalan además a gerencia. Un solo correo-resumen por persona.
    const items = []
    for (const { alerta, radicado } of notificables) {
      items.push({
        alerta,
        destinatarios: [
          encargadoPorId.get(radicado.encargadoId) ?? null,
          await liderDe(radicado.areaId),
          ...(alerta.nivel === 'VENCIDO' ? gerencia : []),
        ].filter(Boolean),
      })
    }
    const correo = items.length ? await enviarResumenAlertas(items) : { personas: 0, enviados: 0 }

    return {
      ejecucion: {
        id: ejecucion.id,
        fecha: ejecucion.fecha,
        alcance: ejecucion.alcance,
        nuevas: ejecucion.nuevas,
        reenviadas: ejecucion.reenviadas,
      },
      nuevas,
      reenviadas,
      areas,
      correo,
    }
  },

  /**
   * GET /api/alertas?area= — alertas de radicados, visibles según el rol
   * (el área del token manda), pendientes primero y ordenadas por gravedad;
   * últimas 6 ejecuciones solo para lider_general. Cada alerta trae
   * radicadoId, número, asunto y días; las vencidas van marcadas como
   * escaladas a gerencia.
   */
  async listar(usuario, query = {}) {
    const filtroArea = esLiderGeneral(usuario)
      ? query.area
        ? { areaId: query.area }
        : {}
      : { areaId: usuario.areaId }

    const alertas = await prisma.alerta.findMany({
      where: { radicadoId: { not: null }, ...filtroArea },
      include: {
        radicado: {
          select: { id: true, numeroRadicado: true, asunto: true, fechaLimite: true, encargadoId: true },
        },
      },
    })

    // areaId es referencia débil (sin relación Prisma): áreas en batch
    const areaIds = [...new Set(alertas.map((a) => a.areaId))]
    const areas = areaIds.length
      ? await prisma.area.findMany({
          where: { id: { in: areaIds } },
          select: { id: true, codigo: true, nombre: true },
        })
      : []
    const areaPorId = new Map(areas.map((x) => [x.id, x]))

    // Pendientes primero, luego gravedad (vencido > 1d > 3d > 7d > …);
    // las atendidas van al final, las más recientes primero.
    alertas.sort((a, b) => {
      if (a.atendida !== b.atendida) return a.atendida ? 1 : -1
      if (!a.atendida) {
        const g = GRAVEDAD[a.nivel] - GRAVEDAD[b.nivel]
        if (g !== 0) return g
        return new Date(a.creadaEn) - new Date(b.creadaEn)
      }
      return new Date(b.atendidaEn ?? b.creadaEn) - new Date(a.atendidaEn ?? a.creadaEn)
    })

    // Nombres de quienes enviaron/atendieron en batch
    const ids = [
      ...new Set(
        alertas.flatMap((a) => [a.enviadaPor, a.atendidaPor]).filter(Boolean),
      ),
    ]
    const personas = ids.length
      ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
      : []
    const nombrePorId = new Map(personas.map((p) => [p.id, p.nombre]))
    const persona = (id) => (id ? { id, nombre: nombrePorId.get(id) } : null)

    const data = alertas.map((a) => ({
      id: a.id,
      nivel: a.nivel,
      mensaje: a.mensaje,
      venceRef: a.venceRef,
      creadaEn: a.creadaEn,
      reenvios: a.reenvios,
      enviadaPor: persona(a.enviadaPor),
      atendida: a.atendida,
      atendidaPor: persona(a.atendidaPor),
      atendidaEn: a.atendidaEn,
      area: areaPorId.get(a.areaId),
      puedeAtender: puedeGestionar(usuario, a.areaId),
      radicadoId: a.radicadoId,
      radicado: { ...a.radicado, dias: diasRestantes(a.radicado.fechaLimite) },
      escalada: a.nivel === 'VENCIDO', // las vencidas escalan a gerencia
    }))

    // Las últimas 6 ejecuciones son información de lider_general
    if (!esLiderGeneral(usuario)) return { alertas: data }

    const ejecuciones = await prisma.ejecucionAlerta.findMany({
      orderBy: { fecha: 'desc' },
      take: 6,
    })
    const idsEjecutores = [
      ...new Set(ejecuciones.map((e) => e.ejecutadaPor).filter(Boolean)),
    ]
    const ejecutores = idsEjecutores.length
      ? await prisma.usuario.findMany({
          where: { id: { in: idsEjecutores } },
          select: { id: true, nombre: true },
        })
      : []
    const ejecutorPorId = new Map(ejecutores.map((p) => [p.id, p.nombre]))

    return {
      alertas: data,
      ejecuciones: ejecuciones.map((e) => ({
        id: e.id,
        fecha: e.fecha,
        alcance: e.alcance,
        nuevas: e.nuevas,
        reenviadas: e.reenviadas,
        ejecutadaPor: e.ejecutadaPor
          ? { id: e.ejecutadaPor, nombre: ejecutorPorId.get(e.ejecutadaPor) }
          : null, // null = corrida automática (cron / script)
      })),
    }
  },

  /**
   * POST /api/alertas/:id/atender — solo lider_general y el lider_area del
   * área de la alerta. Guarda quién y cuándo.
   */
  async atender(usuario, id) {
    const alerta = await prisma.alerta.findUnique({ where: { id } })
    if (!alerta) throw { status: 404, message: 'La alerta no existe.' }
    if (!puedeGestionar(usuario, alerta.areaId)) {
      throw { status: 403, message: 'Tu rol no tiene permiso para esta acción.' }
    }
    if (alerta.atendida) throw { status: 400, message: 'La alerta ya está atendida.' }

    return prisma.alerta.update({
      where: { id },
      data: { atendida: true, atendidaPor: usuario.id, atendidaEn: new Date() },
    })
  },
}
