import { randomUUID } from 'crypto'
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
   * Genera el siguiente radicado secuencial real de la BD: PQR-<anio>-000X
   * (máximo consecutivo + reintentos, sin colisiones por registros borrados)
   */
  async generarRadicadoUnico() {
    const anio = new Date().getFullYear()
    const prefijo = `PQR-${anio}-`

    const existentes = await prisma.pQR.findMany({
      where: { radicado: { startsWith: prefijo } },
      select: { radicado: true }
    })

    let maxSeq = 0
    for (const p of existentes) {
      const m = p.radicado.match(new RegExp(`^${prefijo}(\\d+)$`))
      if (m) {
        const seq = parseInt(m[1], 10)
        if (seq > maxSeq) maxSeq = seq
      }
    }

    for (let intento = 1; intento <= 5; intento++) {
      const candidato = `${prefijo}${String(maxSeq + intento).padStart(4, '0')}`
      const yaExiste = await prisma.pQR.findFirst({ where: { radicado: candidato } })
      if (!yaExiste) return candidato
    }

    // Último recurso: timestamp
    return `${prefijo}${Date.now()}`
  },

  /**
   * Radicar nueva PQR
   */
  async crear(datos) {
    // IDEMPOTENCIA: si la sincronización offline ya creó este registro (la respuesta
    // se perdió y el cliente reintentó), se devuelve el registro existente sin duplicar.
    if (datos.idLocal) {
      const existente = await prisma.pQR.findFirst({ where: { idLocal: String(datos.idLocal) } })
      if (existente) {
        console.warn(`PQR idempotente: idLocal=${datos.idLocal} ya existe como ${existente.radicado}`)
        return existente
      }
    }

    // Cálculo legal de término de respuesta (15 días hábiles aprox / 15 días calendario)
    const fechaVencimiento = new Date()
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 15)

    const itemData = {
      usuario: datos.usuario,
      cedulaNit: datos.cedulaNit,
      matricula: datos.matricula,
      telefono: datos.telefono,
      email: datos.email,
      direccion: datos.direccion,
      motivo: datos.motivo,
      descripcion: datos.descripcion,
      prioridad: datos.prioridad || 'MEDIA',
      estado: datos.estado || 'ABIERTO',
      respuestaOficial: datos.respuestaOficial || null,
      fechaRespuesta: datos.respuestaOficial ? new Date() : null,
      respondidoPor: datos.respondidoPor || null,
      fechaVencimiento,
      // NUNCA null: el índice único de MongoDB indexaría null como valor y solo
      // cabría un documento sin idLocal en toda la colección (P2002 masivo).
      idLocal: String(datos.idLocal || randomUUID())
    }

    // Radicado secuencial PQR-AAAA-0001 generado por el backend (fuente de verdad).
    // Reintento real ante colisión concurrente (P2002): si fue por idLocal es
    // idempotencia (se devuelve el existente); si fue por radicado se regenera.
    let ultimoError = null
    for (let intento = 1; intento <= 4; intento++) {
      let radicado
      try {
        radicado = await this.generarRadicadoUnico()
      } catch (eCount) {
        throw new Error(`No se pudo generar la numeración de la PQR: ${eCount.message}`)
      }

      try {
        return await prisma.pQR.create({
          data: { ...itemData, radicado }
        })
      } catch (e) {
        ultimoError = e
        if (e.code !== 'P2002') break

        // Colisión por idLocal = creación concurrente del mismo registro offline
        const porIdLocal = await prisma.pQR.findFirst({ where: { idLocal: itemData.idLocal } })
        if (porIdLocal) {
          console.warn(`PQR idempotente (colisión): idLocal=${itemData.idLocal} ya existe como ${porIdLocal.radicado}`)
          return porIdLocal
        }

        console.warn(
          `Colisión de numeración (intento ${intento}/4), regenerando consecutivo: ${e.message}`
        )
      }
    }

    throw new Error(
      `No se pudo persistir la PQR en la base de datos: ${ultimoError?.message || 'error desconocido'}`
    )
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
