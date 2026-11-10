// Resumen del panel (unificado tras la fusión): KPIs de radicados + ventanas
// de vencimiento + conteos por área + próximos a vencer + categorías.
//
// TODO con count() de Prisma en paralelo — nunca groupBy: sobre el modelo
// Radicado el groupBy paniquea el query engine de MongoDB. Los conteos por
// categoría se hacen en JS (select ligero de una sola columna).

import prisma from '../../config/prisma.js'
import { esLiderGeneral, esLiderArea } from '../auth/permisos.js'
import { enDias, diasHasta } from '../../utils/fechas.js'

/**
 * Rendimiento del equipo del área (solo lider_area): una fila por encargado
 * con sus conteos de radicados. Van el líder y los miembros activos, más
 * cualquier usuario con radicados asignados aunque ya esté inactivo (marcado).
 * count() por encargado en paralelo — nunca groupBy (vetado sobre Radicado).
 */
async function rendimientoPorEncargado(areaId) {
  const [equipo, radicadosArea] = await Promise.all([
    prisma.usuario.findMany({
      where: { areaId, activo: true },
      select: { id: true, nombre: true, rol: true, activo: true },
    }),
    prisma.radicado.findMany({ where: { areaId }, select: { encargadoId: true } }),
  ])

  const conocido = new Map(equipo.map((u) => [u.id, u]))
  const ids = new Set([...conocido.keys(), ...radicadosArea.map((r) => r.encargadoId)])

  // Encargados inactivos (o desaparecidos) que siguen con radicados asignados
  const faltantes = [...ids].filter((id) => !conocido.has(id))
  if (faltantes.length) {
    const extra = await prisma.usuario.findMany({
      where: { id: { in: faltantes } },
      select: { id: true, nombre: true, rol: true, activo: true },
    })
    for (const u of extra) conocido.set(u.id, u)
  }

  const hoy = enDias(0)
  const d7 = enDias(7)
  const filas = await Promise.all(
    [...ids].map(async (id) => {
      const alcance = { areaId, encargadoId: id }
      const [total, pendientes, vencidos, porVencer, aTiempo, conRetraso] = await Promise.all([
        prisma.radicado.count({ where: alcance }),
        prisma.radicado.count({ where: { ...alcance, estado: 'PENDIENTE' } }),
        prisma.radicado.count({
          where: { ...alcance, estado: 'PENDIENTE', fechaLimite: { lt: hoy } },
        }),
        prisma.radicado.count({
          where: { ...alcance, estado: 'PENDIENTE', fechaLimite: { gte: hoy, lte: d7 } },
        }),
        prisma.radicado.count({
          where: { ...alcance, estado: 'RESPONDIDO', resultadoRespuesta: 'A_TIEMPO' },
        }),
        prisma.radicado.count({
          where: { ...alcance, estado: 'RESPONDIDO', resultadoRespuesta: 'CON_RETRASO' },
        }),
      ])
      const u = conocido.get(id)
      return {
        id,
        nombre: u?.nombre ?? 'Usuario eliminado',
        rol: u?.rol ?? null,
        activo: u ? u.activo !== false : false,
        total,
        pendientes,
        vencidos,
        porVencer,
        entregadosATiempo: aTiempo,
        entregadosConRetraso: conRetraso,
      }
    }),
  )

  // El líder del área primero, luego por carga de trabajo
  return filas.sort((a, b) => {
    if ((a.rol === 'LIDER_AREA') !== (b.rol === 'LIDER_AREA')) return a.rol === 'LIDER_AREA' ? -1 : 1
    if (b.total !== a.total) return b.total - a.total
    return a.nombre.localeCompare(b.nombre)
  })
}

export const ResumenService = {
  /**
   * GET /api/resumen
   * lider_general ve todas las áreas; el resto solo la suya.
   */
  async obtener(usuario) {
    const todasLasAreas = esLiderGeneral(usuario)
    const base = todasLasAreas ? {} : { areaId: usuario.areaId }

    // Cotas de calendario (medianoche de Bogotá)
    const hoy = enDias(0)
    const d1 = enDias(1)
    const d3 = enDias(3)
    const d7 = enDias(7)

    // Un paquete de counts por alcance (total o un área), en paralelo: sobre
    // índices (areaId+estado / fechaLimite), el servidor resuelve con conteos.
    const conteos = async (alcance = {}) => {
      const [total, pendientes, porVencer, vencidos, aTiempo, conRetraso, alertasPendientes] =
        await Promise.all([
          prisma.radicado.count({ where: alcance }),
          prisma.radicado.count({ where: { ...alcance, estado: 'PENDIENTE' } }),
          prisma.radicado.count({
            where: { ...alcance, estado: 'PENDIENTE', fechaLimite: { gte: hoy, lte: d7 } },
          }),
          prisma.radicado.count({
            where: { ...alcance, estado: 'PENDIENTE', fechaLimite: { lt: hoy } },
          }),
          prisma.radicado.count({
            where: { ...alcance, estado: 'RESPONDIDO', resultadoRespuesta: 'A_TIEMPO' },
          }),
          prisma.radicado.count({
            where: { ...alcance, estado: 'RESPONDIDO', resultadoRespuesta: 'CON_RETRASO' },
          }),
          prisma.alerta.count({ where: { ...alcance, atendida: false } }),
        ])
      return {
        total,
        pendientes,
        porVencer,
        vencidos,
        respondidosATiempo: aTiempo,
        respondidosConRetraso: conRetraso,
        alertasPendientes,
      }
    }

    const [kpis, areasInfo, ventanas, proximos, categoriasCrudas] = await Promise.all([
      conteos(base),
      prisma.area.findMany({
        where: todasLasAreas ? {} : { id: usuario.areaId },
        select: { id: true, nombre: true, codigo: true, parentId: true },
      }),
      Promise.all([
        prisma.radicado.count({
          where: { ...base, estado: 'PENDIENTE', fechaLimite: { gte: hoy, lte: d1 } },
        }),
        prisma.radicado.count({
          where: { ...base, estado: 'PENDIENTE', fechaLimite: { gte: enDias(2), lte: d3 } },
        }),
        prisma.radicado.count({
          where: { ...base, estado: 'PENDIENTE', fechaLimite: { gte: enDias(4), lte: d7 } },
        }),
      ]),
      prisma.radicado.findMany({
        where: { ...base, estado: 'PENDIENTE', fechaLimite: { gte: hoy } },
        orderBy: { fechaLimite: 'asc' },
        take: 8,
        select: {
          id: true,
          numeroRadicado: true,
          asunto: true,
          categoria: true,
          fechaLimite: true,
          areaId: true,
          area: { select: { codigo: true, nombre: true } },
        },
      }),
      prisma.radicado.findMany({ where: base, select: { categoria: true } }),
    ])

    // Área líder primero, resto por código (consistente con /api/areas)
    const areas = (
      await Promise.all(
        areasInfo
          .sort((a, b) => {
            if (!a.parentId) return -1
            if (!b.parentId) return 1
            return a.codigo.localeCompare(b.codigo)
          })
          .map(async (area) => ({
            id: area.id,
            nombre: area.nombre,
            codigo: area.codigo,
            ...(await conteos({ areaId: area.id })),
          })),
      )
    ).filter((fila) => fila.total > 0 || fila.alertasPendientes > 0)

    // Conteo por categoría en JS (groupBy está vetado sobre Radicado)
    const porCategoria = new Map()
    for (const r of categoriasCrudas) {
      porCategoria.set(r.categoria, (porCategoria.get(r.categoria) || 0) + 1)
    }

    return {
      areas,
      kpis,
      // Rendimiento por encargado: la herramienta del líder de área (gerencia
      // tiene el ranking por áreas; usuario no llega a esta vista)
      ...(esLiderArea(usuario) ? { porEncargado: await rendimientoPorEncargado(usuario.areaId) } : {}),
      ventanas: { hasta1Dia: ventanas[0], dias2a3: ventanas[1], dias4a7: ventanas[2] },
      proximosAVencer: proximos.map((r) => ({
        id: r.id,
        numeroRadicado: r.numeroRadicado,
        asunto: r.asunto,
        categoria: r.categoria,
        fechaLimite: r.fechaLimite,
        dias: diasHasta(r.fechaLimite),
        areaId: r.areaId,
        area: r.area,
      })),
      categorias: [...porCategoria.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total),
    }
  },
}

export default ResumenService
