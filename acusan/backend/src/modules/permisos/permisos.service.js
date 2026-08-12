import prisma from '../../config/prisma.js'

export const PermisosService = {
  /**
   * Obtener lista de permisos con filtros
   */
  async listarPermisos(filtros = {}) {
    const where = {}
    if (filtros.estado) where.estado = filtros.estado
    if (filtros.cedula) where.cedula = filtros.cedula
    if (filtros.tipo) where.tipo = filtros.tipo

    return prisma.permiso.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })
  },

  /**
   * Obtener permiso por ID o Radicado
   */
  async obtenerPorId(id) {
    return prisma.permiso.findUnique({
      where: { id }
    })
  },

  /**
   * Crear nueva solicitud de permiso (extraída vía OCR o manual)
   */
  async crearPermiso(datos) {
    const conteo = await prisma.permiso.count()
    const año = new Date().getFullYear()
    const radicado = `PERM-${año}-${String(conteo + 1).padStart(4, '0')}`

    return prisma.permiso.create({
      data: {
        radicado,
        cedula: datos.cedula,
        nombreFuncionario: datos.nombreFuncionario,
        cargo: datos.cargo,
        dependencia: datos.dependencia,
        tipo: datos.tipo,
        fechaInicio: new Date(datos.fechaInicio),
        fechaFin: new Date(datos.fechaFin),
        justificacion: datos.justificacion,
        soporteUrl: datos.soporteUrl,
        ocrConfidence: datos.ocrConfidence || 0,
        ocrRawPayload: datos.ocrRawPayload || {},
        estado: 'PENDIENTE'
      }
    })
  },

  /**
   * Dictamen de Gerencia: Aprobación o Rechazo
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    return prisma.permiso.update({
      where: { id },
      data: {
        estado,
        aprobadoPor,
        observaciones,
        fechaAprobacion: new Date()
      }
    })
  }
}
