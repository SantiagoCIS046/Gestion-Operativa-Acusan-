import prisma from '../../config/prisma.js'
import { clasificar } from './clasificadorRecargos.js'
import { TurnosService } from './turnos.service.js'

// Campos públicos de un HoraExtra: select EXPLICITO en todos los listados.
// El registro no guarda fotos (viven en EvidenciaHoraExtra), pero el
// recargoDesglose Json sí viaja para que la UI muestre el desglose.
export const SELECT_PUBLICO = {
  id: true,
  cedula: true,
  funcionario: true,
  cuadrillaArea: true,
  fechaOperacion: true,
  tipoRecargo: true,
  cantidadHoras: true,
  montoEstimado: true,
  estado: true,
  justificacion: true,
  autorizadoPor: true,
  fechaAprobacion: true,
  fechaInicio: true,
  fechaFin: true,
  origen: true,
  numEvidencias: true,
  estadoEvidencia: true,
  turnoId: true,
  turnoNombre: true,
  recargoDesglose: true,
  createdAt: true,
  updatedAt: true
}

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
      orderBy: { fechaOperacion: 'desc' },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Obtener hora extra por ID
   */
  async obtenerPorId(id) {
    return prisma.horaExtra.findUnique({
      where: { id },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Registrar reporte de horas extras (manual: interno o autoreporte de la
   * app). Los campos de sesión/turno son opcionales y solo los fija el flujo
   * de evidencias o el recálculo — aquí se aceptan por extensibilidad.
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
        estado: 'PENDIENTE',
        origen: datos.origen || 'MANUAL',
        fechaInicio: datos.fechaInicio ? new Date(datos.fechaInicio) : undefined,
        fechaFin: datos.fechaFin ? new Date(datos.fechaFin) : undefined,
        numEvidencias: datos.numEvidencias ?? undefined
      },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Re-ejecuta el clasificador sobre fechaInicio/fechaFin de un registro
   * PENDIENTE usando el turno vigente del área (o el snapshot turnoId si el
   * registro ya tiene uno). Devuelve el registro corregido y un aviso que
   * describe la corrección.
   */
  async recalcular(id) {
    const registro = await prisma.horaExtra.findUnique({ where: { id } })
    if (!registro) {
      throw Object.assign(new Error('Registro de horas extras no encontrado.'), { status: 404 })
    }
    if (registro.estado !== 'PENDIENTE') {
      throw Object.assign(
        new Error(`Solo se puede recalcular un registro PENDIENTE (estado actual: ${registro.estado}).`),
        { status: 409 }
      )
    }
    if (!registro.fechaInicio || !registro.fechaFin) {
      throw Object.assign(
        new Error('El registro no tiene sesión de inicio/fin (fechaInicio/fechaFin) sobre la cual recalcular.'),
        { status: 400 }
      )
    }

    // Turno: el snapshot del registro si existe; si no, el vigente del área
    let turno = null
    if (registro.turnoId) {
      turno = await prisma.turno.findUnique({ where: { id: registro.turnoId } })
    }
    if (!turno) {
      turno = await TurnosService.buscarPorCuadrilla(registro.cuadrillaArea)
    }

    const calculo = clasificar(registro.fechaInicio, registro.fechaFin, turno)
    const corregido = await prisma.horaExtra.update({
      where: { id },
      data: {
        cantidadHoras: calculo.totalHoras,
        tipoRecargo: calculo.tipoDominante || registro.tipoRecargo,
        turnoId: turno ? turno.id : null,
        turnoNombre: turno ? turno.nombre : null,
        recargoDesglose: {
          DIURNA: calculo.DIURNA,
          NOCTURNA: calculo.NOCTURNA,
          FESTIVA_DIURNA: calculo.FESTIVA_DIURNA,
          FESTIVA_NOCTURNA: calculo.FESTIVA_NOCTURNA,
          totalHoras: calculo.totalHoras,
          horasOrdinariasDentroTurno: calculo.horasOrdinariasDentroTurno,
          festivosAplicados: calculo.festivosAplicados
        }
      },
      select: SELECT_PUBLICO
    })

    const aviso = `Recalculado: ${registro.cantidadHoras} h (${registro.tipoRecargo}) → ${corregido.cantidadHoras} h (${corregido.tipoRecargo})${calculo.sinTurnoConfigurado ? ' — sin turno configurado para el área' : ''}`
    return { horaExtra: corregido, aviso }
  },

  /**
   * Autorizar o rechazar horas extras por Gerencia. Solo se dictamina un
   * registro PENDIENTE: un ENVIADO_NOMINA/ANULADO/ya dictaminado no puede
   * mutar (rompería la conciliación con el snapshot de EnvioNomina).
   */
  async dictaminar(id, { estado, autorizadoPor, observaciones }) {
    const registro = await prisma.horaExtra.findUnique({ where: { id }, select: { estado: true, justificacion: true } })
    if (!registro) {
      throw Object.assign(new Error('Registro de horas extras no encontrado.'), { status: 404 })
    }
    if (registro.estado !== 'PENDIENTE') {
      throw Object.assign(
        new Error(`Solo se dictamina un registro PENDIENTE (estado actual: ${registro.estado}).`),
        { status: 409 }
      )
    }
    return prisma.horaExtra.update({
      where: { id },
      data: {
        estado,
        autorizadoPor,
        fechaAprobacion: new Date(),
        ...(observaciones && {
          justificacion: `${registro.justificacion ? registro.justificacion + ' | ' : ''}[DICTAMEN: ${observaciones}]`
        })
      },
      select: SELECT_PUBLICO
    })
  }
}
