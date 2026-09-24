import prisma from '../../config/prisma.js'
import { clasificar, fechaOperacionDe, parsearHHmm } from './clasificadorRecargos.js'
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
    // fechaOperacion 'YYYY-MM-DD' → medianoche local de Colombia (UTC 05:00),
    // convención de todo el sistema (fechaOperacionDe). new Date(string) da
    // medianoche UTC y los reports del día 1 caían en el mes anterior.
    let fechaOperacion = datos.fechaOperacion
    if (typeof fechaOperacion === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion.trim())) {
      const [a, m, d] = fechaOperacion.trim().split('-').map(Number)
      fechaOperacion = new Date(Date.UTC(a, m - 1, d, 5, 0, 0))
    }

    return prisma.horaExtra.create({
      data: {
        cedula: datos.cedula,
        funcionario: datos.funcionario,
        cuadrillaArea: datos.cuadrillaArea,
        fechaOperacion: fechaOperacion instanceof Date ? fechaOperacion : new Date(fechaOperacion),
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
   * Autoreporte tipo "plantilla de papel": el empleado registra fecha +
   * hora de entrada y hora de salida (hora local de Colombia), y el
   * clasificador determina TODO — diurna/nocturna, dominical/festiva y el
   * descuento de ordinarias dentro del turno — igual que al finalizar una
   * sesión de evidencias. Si la salida es ≤ a la entrada, la jornada cruza
   * la medianoche y termina al día siguiente (ej: 20:00 → 02:00).
   */
  async crearDesdeHorario({ cedula, funcionario, cuadrillaArea, fechaOperacion, horaInicio, horaFin, justificacion }) {
    // 'YYYY-MM-DD' estricto y fecha real (rechaza 2026-02-30)
    if (typeof fechaOperacion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion.trim())) {
      throw Object.assign(new Error('La fecha de la operación es inválida (formato esperado: YYYY-MM-DD).'), { status: 400 })
    }
    const [anio, mes, dia] = fechaOperacion.trim().split('-').map(Number)
    const diaUTC = new Date(Date.UTC(anio, mes - 1, dia))
    if (
      diaUTC.getUTCFullYear() !== anio ||
      diaUTC.getUTCMonth() !== mes - 1 ||
      diaUTC.getUTCDate() !== dia
    ) {
      throw Object.assign(new Error('La fecha de la operación es inválida (formato esperado: YYYY-MM-DD).'), { status: 400 })
    }

    const minInicio = parsearHHmm(horaInicio)
    const minFin = parsearHHmm(horaFin)
    if (minInicio === null || minFin === null) {
      throw Object.assign(new Error('Las horas de entrada y salida son inválidas (formato esperado: HH:MM, 00:00–23:59).'), { status: 400 })
    }
    if (minFin === minInicio) {
      throw Object.assign(
        new Error('La hora de salida debe ser distinta de la hora de entrada. Si la jornada cruza la medianoche, registra la hora en que terminaste (ej: entró 20:00, salió 02:00).'),
        { status: 400 }
      )
    }

    // Ventana en epoch local de Colombia (mismo convenio del clasificador):
    // diaUTC (medianoche UTC del día pedido) + minutos locales + offset −5 h.
    // La entrada no puede fecharse en el futuro.
    const OFFSET_MS = 300 * 60000
    const inicioLocalMs = diaUTC.getTime() + minInicio * 60000
    if (inicioLocalMs > Date.now() - OFFSET_MS) {
      throw Object.assign(new Error('La fecha y hora de entrada no pueden ser futuras.'), { status: 400 })
    }

    // Salida < entrada → cruza la medianoche (termina al día siguiente)
    const duracionMin = minFin < minInicio ? 1440 - minInicio + minFin : minFin - minInicio
    if (duracionMin > 20 * 60) {
      throw Object.assign(
        new Error(`La jornada dura ${duracionMin / 60} h: revise las horas de entrada y salida.`),
        { status: 400 }
      )
    }

    const fechaInicio = new Date(inicioLocalMs + OFFSET_MS)
    const fechaFin = new Date(inicioLocalMs + duracionMin * 60000 + OFFSET_MS)

    // Turno vigente del área (match textual) → clasificar la ventana
    const turno = await TurnosService.buscarPorCuadrilla(cuadrillaArea.trim())
    const calculo = clasificar(fechaInicio, fechaFin, turno)

    const horaExtra = await prisma.horaExtra.create({
      data: {
        cedula,
        funcionario,
        cuadrillaArea: cuadrillaArea.trim(),
        fechaOperacion: fechaOperacionDe(fechaInicio),
        tipoRecargo: calculo.tipoDominante || 'DIURNA',
        cantidadHoras: calculo.totalHoras,
        montoEstimado: 0,
        justificacion: justificacion || null,
        estado: 'PENDIENTE',
        origen: 'MANUAL',
        fechaInicio,
        fechaFin,
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

    const avisos = []
    if (calculo.sinTurnoConfigurado) {
      avisos.push(`Sin turno configurado para "${cuadrillaArea.trim()}": todas las horas se cuentan como extras.`)
    }
    if (calculo.horasOrdinariasDentroTurno > 0) {
      avisos.push(`Se descuentan ${calculo.horasOrdinariasDentroTurno} h ordinarias dentro del turno; las extras inician a la salida del turno.`)
    }
    if (calculo.totalHoras === 0) {
      avisos.push('La jornada quedó dentro del turno: 0 horas extras registradas.')
    }

    return { horaExtra, aviso: avisos.length ? avisos.join(' ') : null }
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
