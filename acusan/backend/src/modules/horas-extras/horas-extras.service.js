import prisma from '../../config/prisma.js'

export const HorasExtrasService = {
  /**
   * Listar todas las horas extras con filtros
   */
  async listar(filtros = {}) {
    const where = {}
    if (filtros.estado) where.estado = filtros.estado
    if (filtros.cedula) where.cedula = filtros.cedula
    if (filtros.cuadrillaArea) where.cuadrillaArea = { contains: filtros.cuadrillaArea, mode: 'insensitive' }

    return prisma.horaExtra.findMany({
      where,
      orderBy: { fechaOperacion: 'desc' }
    })
  },

  /**
   * Obtener hora extra por ID
   */
  async obtenerPorId(id) {
    return prisma.horaExtra.findUnique({
      where: { id }
    })
  },

  /**
   * Registrar reporte de horas extras
   */
  async crear(datos) {
    return prisma.horaExtra.create({
      data: {
        cedula: datos.cedula,
        funcionario: datos.funcionario,
        cuadrillaArea: datos.cuadrillaArea,
        fechaOperacion: new Date(datos.fechaOperacion),
        tipoRecargo: datos.tipoRecargo,
        cantidadHoras: Number(datos.cantidadHoras),
        montoEstimado: datos.montoEstimado || 0,
        justificacion: datos.justificacion,
        estado: 'PENDIENTE'
      }
    })
  },

  /**
   * Autorizar o rechazar horas extras por Gerencia
   */
  async dictaminar(id, { estado, autorizadoPor }) {
    return prisma.horaExtra.update({
      where: { id },
      data: {
        estado,
        autorizadoPor,
        fechaAprobacion: new Date()
      }
    })
  }
}
