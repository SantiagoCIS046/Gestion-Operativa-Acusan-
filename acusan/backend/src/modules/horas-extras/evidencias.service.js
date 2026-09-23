/**
 * evidencias.service.js — Sesiones de evidencias de horas extras (app de campo).
 *
 * Ciclo de vida de una sesión:
 *   POST /evidencias/iniciar  → HoraExtra EN_CURSO (origen EVIDENCIA) + foto INICIAL
 *   POST /evidencias/:id/finalizar → foto FINAL + clasificador + PENDIENTE_REVISION
 *   POST /evidencias/:id/anular    → EN_CURSO o PENDIENTE sin dictamen → ANULADO
 *
 * La identidad (cédula/nombre) sale SIEMPRE del JWT del empleado, jamás del
 * body. Las fotos viajan como data URL base64 y JAMÁS se seleccionan en los
 * listados: se sirven por /evidencias/:id/foto (patrón radicados.controller).
 */

import prisma from '../../config/prisma.js'
import { clasificar, fechaOperacionDe } from './clasificadorRecargos.js'
import { TurnosService } from './turnos.service.js'
import { SELECT_PUBLICO } from './horas-extras.service.js'

// Foto de evidencia: solo imágenes (PNG/JPG/WebP), data URL base64, tope de
// ~6 MB de string (≈4,5 MB de binario) — margen holgado bajo el límite BSON.
const MAX_FOTO_BASE64 = 6000000
const PATRON_FOTO = /^data:image\/(png|jpe?g|webp);base64,/i

const validarFotoBase64 = (fotoBase64) => {
  if (fotoBase64 == null || typeof fotoBase64 !== 'string' || !PATRON_FOTO.test(fotoBase64)) {
    throw Object.assign(
      new Error('La foto debe ser una imagen PNG, JPG o WebP codificada en base64 (data URL).'),
      { status: 400 }
    )
  }
  if (fotoBase64.length > MAX_FOTO_BASE64) {
    throw Object.assign(
      new Error('La foto supera el tamaño máximo de 6 MB. Reduzca la resolución e intente de nuevo.'),
      { status: 413 }
    )
  }
  return fotoBase64
}

// Campos de ubicación opcionales: llegan como número o string numérico
const numeroOpcional = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Extensión del archivo según el MIME de la data URL (para fotoNombre)
const extensionDe = (fotoBase64) => {
  const m = /^data:image\/(png|jpe?g|webp);/i.exec(fotoBase64 || '')
  if (!m) return 'jpg'
  return m[1].toLowerCase() === 'png' ? 'png' : m[1].toLowerCase() === 'webp' ? 'webp' : 'jpg'
}

const parsearFecha = (v, etiqueta) => {
  if (v == null || v === '') return new Date()
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(new Error(`${etiqueta} inválida (ISO esperado).`), { status: 400 })
  }
  return d
}

export const EvidenciasService = {
  /**
   * Abre una sesión: crea el HoraExtra EN_CURSO (origen EVIDENCIA) y la
   * evidencia INICIAL. 409 si la cédula ya tiene sesión abierta.
   */
  async iniciarSesion({ cedula, funcionario, cuadrillaArea, descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps }) {
    if (!cuadrillaArea || !cuadrillaArea.trim()) {
      throw Object.assign(new Error('La cuadrilla/área es obligatoria para iniciar la sesión.'), { status: 400 })
    }
    validarFotoBase64(fotoBase64)
    const capturada = parsearFecha(capturadaEn, 'capturadaEn')

    const abierta = await prisma.horaExtra.findFirst({
      where: { cedula, estado: 'EN_CURSO' },
      select: { id: true }
    })
    if (abierta) {
      throw Object.assign(
        new Error('Ya tiene una sesión de horas extras abierta. Finalícela antes de iniciar otra.'),
        { status: 409 }
      )
    }

    // tipoRecargo/cantidadHoras son obligatorios en el schema: la sesión
    // nace provisional y el clasificador los fija al FINALIZAR.
    const horaExtra = await prisma.horaExtra.create({
      data: {
        cedula,
        funcionario,
        cuadrillaArea: cuadrillaArea.trim(),
        fechaOperacion: fechaOperacionDe(capturada),
        tipoRecargo: 'DIURNA', // provisional hasta la foto final
        cantidadHoras: 0,
        montoEstimado: 0,
        estado: 'EN_CURSO',
        origen: 'EVIDENCIA',
        fechaInicio: capturada,
        numEvidencias: 1
      },
      select: SELECT_PUBLICO
    })

    const evidencia = await prisma.evidenciaHoraExtra.create({
      data: {
        horaExtraId: horaExtra.id,
        tipo: 'INICIAL',
        cedula,
        funcionario,
        descripcion: descripcion || null,
        fotoBase64,
        fotoNombre: `evidencia-inicial-${cedula}-${capturada.toISOString().replace(/[:.]/g, '-')}.${extensionDe(fotoBase64)}`,
        latitud: numeroOpcional(latitud),
        longitud: numeroOpcional(longitud),
        precisionGps: numeroOpcional(precisionGps),
        capturadaEn: capturada
      },
      select: { id: true, horaExtraId: true, tipo: true, cedula: true, descripcion: true, fotoNombre: true, latitud: true, longitud: true, precisionGps: true, capturadaEn: true, registradaEn: true }
    })

    return { horaExtra, evidencia }
  },

  /**
   * Cierra la sesión: foto FINAL + clasificador de recargos con el turno
   * vigente del área. Devuelve el registro actualizado (sin fotos) y un
   * aviso informativo cuando aplica (sin turno, ordinarias descontadas...).
   */
  async finalizarSesion(horaExtraId, { cedula, descripcion, fotoBase64, capturadaEn, latitud, longitud, precisionGps }) {
    const sesion = await prisma.horaExtra.findUnique({ where: { id: horaExtraId } })
    if (!sesion) {
      throw Object.assign(new Error('Sesión de horas extras no encontrada.'), { status: 404 })
    }
    if (sesion.cedula !== cedula) {
      throw Object.assign(new Error('Solo el dueño de la sesión puede finalizarla.'), { status: 403 })
    }
    if (sesion.estado !== 'EN_CURSO') {
      throw Object.assign(new Error(`La sesión ya fue cerrada (estado: ${sesion.estado}).`), { status: 409 })
    }

    validarFotoBase64(fotoBase64)
    const capturada = parsearFecha(capturadaEn, 'capturadaEn')
    const fechaInicio = sesion.fechaInicio || sesion.createdAt
    if (capturada.getTime() <= fechaInicio.getTime()) {
      throw Object.assign(
        new Error('La foto final debe ser posterior a la foto inicial de la sesión.'),
        { status: 400 }
      )
    }

    // Turno vigente del área (match textual) → clasificar la ventana
    const turno = await TurnosService.buscarPorCuadrilla(sesion.cuadrillaArea)
    const calculo = clasificar(fechaInicio, capturada, turno)

    const descripciones = []
    const inicial = await prisma.evidenciaHoraExtra.findFirst({
      where: { horaExtraId, tipo: 'INICIAL' },
      select: { descripcion: true }
    })
    if (inicial?.descripcion) descripciones.push(inicial.descripcion)
    if (descripcion) descripciones.push(descripcion)

    const avisos = []
    if (calculo.sinTurnoConfigurado) {
      avisos.push(`Sin turno configurado para "${sesion.cuadrillaArea}": todas las horas se cuentan como extras.`)
    }
    if (calculo.horasOrdinariasDentroTurno > 0) {
      avisos.push(`Se descuentan ${calculo.horasOrdinariasDentroTurno} h ordinarias dentro del turno; las extras inician a la salida del turno.`)
    }
    if (calculo.totalHoras === 0) {
      avisos.push('La sesión quedó dentro del turno: 0 horas extras registradas.')
    }

    await prisma.evidenciaHoraExtra.create({
      data: {
        horaExtraId,
        tipo: 'FINAL',
        cedula,
        funcionario: sesion.funcionario,
        descripcion: descripcion || null,
        fotoBase64,
        fotoNombre: `evidencia-final-${cedula}-${capturada.toISOString().replace(/[:.]/g, '-')}.${extensionDe(fotoBase64)}`,
        latitud: numeroOpcional(latitud),
        longitud: numeroOpcional(longitud),
        precisionGps: numeroOpcional(precisionGps),
        capturadaEn: capturada
      }
    })

    const horaExtra = await prisma.horaExtra.update({
      where: { id: horaExtraId },
      data: {
        fechaFin: capturada,
        estado: 'PENDIENTE',
        estadoEvidencia: 'PENDIENTE_REVISION',
        numEvidencias: 2,
        cantidadHoras: calculo.totalHoras,
        tipoRecargo: calculo.tipoDominante || 'DIURNA', // 0 extras → provisional
        justificacion: descripciones.length ? descripciones.join(' | ') : sesion.justificacion,
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

    return { horaExtra, aviso: avisos.length ? avisos.join(' ') : null }
  },

  /**
   * Anula una sesión: el dueño o ENCARGADO/ADMIN. Solo EN_CURSO o PENDIENTE
   * sin dictamen (un registro ya aprobado no se anula por esta vía).
   */
  async anularSesion(id, { cedula, rol, motivo }) {
    const sesion = await prisma.horaExtra.findUnique({ where: { id } })
    if (!sesion) {
      throw Object.assign(new Error('Sesión de horas extras no encontrada.'), { status: 404 })
    }
    const esDueño = sesion.cedula === cedula
    const esInterno = rol === 'ENCARGADO' || rol === 'ADMIN'
    if (!esDueño && !esInterno) {
      throw Object.assign(new Error('Solo el dueño de la sesión o un Encargado/Admin puede anularla.'), { status: 403 })
    }
    const conDictamen = sesion.autorizadoPor != null || sesion.estado === 'APROBADO' || sesion.estado === 'RECHAZADO'
    if (sesion.estado !== 'EN_CURSO' && (sesion.estado !== 'PENDIENTE' || conDictamen)) {
      throw Object.assign(
        new Error(`Solo se puede anular una sesión EN_CURSO o PENDIENTE sin dictamen (estado actual: ${sesion.estado}).`),
        { status: 409 }
      )
    }

    return prisma.horaExtra.update({
      where: { id },
      data: {
        estado: 'ANULADO',
        justificacion: motivo
          ? `${sesion.justificacion ? sesion.justificacion + ' | ' : ''}[ANULADA: ${motivo}]`
          : sesion.justificacion
      },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Sesión EN_CURSO de la cédula + su evidencia inicial (sin foto), para que
   * la app de campo restaure el estado al reabrir (null/null si no hay).
   */
  async miSesionActiva(cedula) {
    const sesion = await prisma.horaExtra.findFirst({
      where: { cedula, estado: 'EN_CURSO' },
      select: SELECT_PUBLICO
    })
    if (!sesion) return { sesion: null, evidenciaInicial: null }

    const evidenciaInicial = await prisma.evidenciaHoraExtra.findFirst({
      where: { horaExtraId: sesion.id, tipo: 'INICIAL' },
      select: { id: true, horaExtraId: true, tipo: true, cedula: true, descripcion: true, fotoNombre: true, latitud: true, longitud: true, precisionGps: true, capturadaEn: true, registradaEn: true },
      orderBy: { capturadaEn: 'asc' }
    })
    return { sesion, evidenciaInicial }
  },

  /**
   * Lista evidencias con filtros (estadoEvidencia y cuadrillaArea viven en
   * el registro padre; cedula/desde/hasta en la evidencia). El resumen del
   * padre va embebido en cada fila y la foto JAMÁS viaja aquí.
   */
  async listarEvidencias({ estadoEvidencia, cedula, desde, hasta, cuadrillaArea, horaExtraId } = {}) {
    const wherePadre = {}
    // Cola de revisión: las sesiones ANULADAS no siguen esperando revisión
    // (la consulta por registro concreto —modal de un registro dado— sí las trae)
    if (!horaExtraId) wherePadre.estado = { not: 'ANULADO' }
    if (estadoEvidencia) wherePadre.estadoEvidencia = estadoEvidencia
    if (cuadrillaArea) wherePadre.cuadrillaArea = { contains: cuadrillaArea, mode: 'insensitive' }
    // Filtro por registro padre (lo usa el modal de evidencias de la web)
    if (horaExtraId) wherePadre.id = horaExtraId

    const padres = await prisma.horaExtra.findMany({
      where: wherePadre,
      select: {
        id: true, cedula: true, funcionario: true, cuadrillaArea: true, estado: true,
        estadoEvidencia: true, fechaInicio: true, fechaFin: true, tipoRecargo: true,
        cantidadHoras: true, origen: true, turnoNombre: true
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    })
    if (!padres.length) return []

    const ids = padres.map((p) => p.id)
    const whereEvidencia = { horaExtraId: { in: ids } }
    if (cedula) whereEvidencia.cedula = cedula
    if (desde || hasta) {
      whereEvidencia.capturadaEn = {}
      if (desde) {
        const d = new Date(desde)
        if (Number.isNaN(d.getTime())) throw Object.assign(new Error('Parámetro "desde" inválido (fecha ISO esperada).'), { status: 400 })
        whereEvidencia.capturadaEn.gte = d
      }
      if (hasta) {
        const h = new Date(hasta)
        if (Number.isNaN(h.getTime())) throw Object.assign(new Error('Parámetro "hasta" inválido (fecha ISO esperada).'), { status: 400 })
        whereEvidencia.capturadaEn.lte = h
      }
    }

    const evidencias = await prisma.evidenciaHoraExtra.findMany({
      where: whereEvidencia,
      select: { id: true, horaExtraId: true, tipo: true, cedula: true, funcionario: true, descripcion: true, fotoNombre: true, latitud: true, longitud: true, precisionGps: true, capturadaEn: true, registradaEn: true },
      orderBy: { capturadaEn: 'desc' },
      take: 1000
    })

    const padresPorId = new Map(padres.map((p) => [p.id, p]))
    return evidencias.map((e) => ({ ...e, padre: padresPorId.get(e.horaExtraId) || null }))
  },

  /**
   * Foto de una evidencia como {buffer, mime, nombre} para servirla inline
   * (patrón RadicadosService.obtenerArchivo).
   */
  async obtenerFoto(id) {
    const evidencia = await prisma.evidenciaHoraExtra.findUnique({
      where: { id },
      select: { fotoBase64: true, fotoNombre: true, cedula: true }
    })
    if (!evidencia || !evidencia.fotoBase64) return null

    let mime = 'image/jpeg'
    let base64 = evidencia.fotoBase64
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(base64)
    if (m) {
      mime = m[1].toLowerCase()
      base64 = m[2]
    }
    return {
      buffer: Buffer.from(base64, 'base64'),
      mime,
      nombre: evidencia.fotoNombre || `evidencia-${id}.jpg`
    }
  },

  /** Metadatos livianos de una evidencia (control de acceso por dueño). */
  async obtenerEvidencia(id) {
    return prisma.evidenciaHoraExtra.findUnique({
      where: { id },
      select: { id: true, horaExtraId: true, tipo: true, cedula: true }
    })
  },

  /**
   * Revisión de evidencias: marca el estado de revisión del registro padre
   * (REVISADA / OBSERVADA) y deja las observaciones en la justificación.
   */
  async revisar(horaExtraId, { estadoEvidencia, observaciones }) {
    if (!['REVISADA', 'OBSERVADA'].includes(estadoEvidencia)) {
      throw Object.assign(new Error('estadoEvidencia inválido: debe ser REVISADA u OBSERVADA.'), { status: 400 })
    }
    const registro = await prisma.horaExtra.findUnique({ where: { id: horaExtraId } })
    if (!registro) {
      throw Object.assign(new Error('Registro de horas extras no encontrado.'), { status: 404 })
    }

    return prisma.horaExtra.update({
      where: { id: horaExtraId },
      data: {
        estadoEvidencia,
        justificacion: observaciones
          ? `${registro.justificacion ? registro.justificacion + ' | ' : ''}[REVISIÓN: ${observaciones}]`
          : registro.justificacion
      },
      select: SELECT_PUBLICO
    })
  }
}
