import prisma from '../../config/prisma.js'

export const PqrService = {
  /**
   * Listar PQRs con filtros
   */
  async listar(filtros = {}) {
    const where = {}
    if (filtros.estado) where.estado = filtros.estado
    if (filtros.matricula) where.matricula = filtros.matricula
    if (filtros.prioridad) where.prioridad = filtros.prioridad

    return prisma.pQR.findMany({
      where,
      orderBy: { fechaRadicado: 'desc' }
    })
  },

  /**
   * Obtener detalle de PQR
   */
  async obtenerPorId(id) {
    return prisma.pQR.findUnique({
      where: { id }
    })
  },

  /**
   * Radicar nueva PQR
   */
  async crear(datos) {
    const conteo = await prisma.pQR.count()
    const año = new Date().getFullYear()
    const radicado = `PQR-${año}-${String(conteo + 1).padStart(4, '0')}`

    // Cálculo legal de término de respuesta (15 días hábiles aprox / 15 días calendario)
    const fechaVencimiento = new Date()
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 15)

    return prisma.pQR.create({
      data: {
        radicado,
        usuario: datos.usuario,
        cedulaNit: datos.cedulaNit,
        matricula: datos.matricula,
        telefono: datos.telefono,
        email: datos.email,
        direccion: datos.direccion,
        motivo: datos.motivo,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad || 'MEDIA',
        estado: 'ABIERTO',
        fechaVencimiento
      }
    })
  },

  /**
   * Responder y resolver PQR
   */
  async responder(id, { respuestaOficial, respondidoPor, nuevoEstado }) {
    return prisma.pQR.update({
      where: { id },
      data: {
        respuestaOficial,
        respondidoPor: respondidoPor || 'Atención al Usuario Acuasan',
        fechaRespuesta: new Date(),
        estado: nuevoEstado || 'RESUELTO'
      }
    })
  }
}
