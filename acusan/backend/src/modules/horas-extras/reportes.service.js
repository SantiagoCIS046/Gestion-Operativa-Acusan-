/**
 * reportes.service.js — Reportes mensuales, export CSV y cierre de nómina.
 *
 * Decisión del usuario: aquí SOLO se agregan horas y conteos — CERO cálculo
 * de dinero (montoEstimado se exporta tal cual, no se calcula).
 *
 * enviarNomina es una transacción LÓGICA: marca los APROBADO del periodo
 * como ENVIADO_NOMINA y archiva un EnvioNomina con snapshot de ids. El email
 * es best-effort: si falta la configuración SMTP queda registrado
 * (emailError) pero el cierre del periodo NO se revierte.
 */

import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'

// nodemailer se carga DIFERIDAMENTE: un import estático de un paquete ausente
// tumba el proceso en el arranque (ERR_MODULE_NOT_FOUND en link-time, que no
// se puede atrapar). Con await import() el servidor siempre arranca y el
// email de nómina queda como best-effort.
let nodemailerCache = null
async function obtenerNodemailer() {
  if (nodemailerCache !== null) return nodemailerCache
  try {
    nodemailerCache = (await import('nodemailer')).default
  } catch {
    nodemailerCache = false // ausente: el cierre sigue sin email
  }
  return nodemailerCache
}

const TIPOS_RECARGO = ['DIURNA', 'NOCTURNA', 'FESTIVA_DIURNA', 'FESTIVA_NOCTURNA']

// Estados que cuentan para reportes/nómina (se excluyen ANULADO, RECHAZADO
// y EN_CURSO — sesiones aún abiertas sin horas)
const ESTADOS_ACTIVOS = ['PENDIENTE', 'APROBADO', 'ENVIADO_NOMINA']

const validarPeriodo = (mes, anio) => {
  const m = Number(mes)
  const a = Number(anio)
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw Object.assign(new Error('Parámetro "mes" inválido (1-12).'), { status: 400 })
  }
  if (!Number.isInteger(a) || a < 2000 || a > 2100) {
    throw Object.assign(new Error('Parámetro "anio" inválido.'), { status: 400 })
  }
  return { mes: m, anio: a }
}

/**
 * Rango [inicio, fin) del mes en hora local de Colombia (UTC-5 fijo):
 * fechaOperacion se guarda a medianoche local (UTC 05:00), así que el rango
 * usa esos mismos bordes y no depende del huso del servidor.
 */
const rangoMes = (mes, anio) => ({
  inicio: new Date(Date.UTC(anio, mes - 1, 1, 5, 0, 0)),
  fin: new Date(Date.UTC(anio, mes, 1, 5, 0, 0))
})

/** Horas por tipo de un registro: recargoDesglose (nuevo) con fallback al
 *  tipoRecargo+cantidadHoras para registros legacy sin desglose. */
const horasPorTipo = (r) => {
  const desglose = r.recargoDesglose
  if (desglose && typeof desglose === 'object' && TIPOS_RECARGO.some((t) => Number(desglose[t]) > 0)) {
    return {
      DIURNA: Number(desglose.DIURNA) || 0,
      NOCTURNA: Number(desglose.NOCTURNA) || 0,
      FESTIVA_DIURNA: Number(desglose.FESTIVA_DIURNA) || 0,
      FESTIVA_NOCTURNA: Number(desglose.FESTIVA_NOCTURNA) || 0
    }
  }
  const porTipo = { DIURNA: 0, NOCTURNA: 0, FESTIVA_DIURNA: 0, FESTIVA_NOCTURNA: 0 }
  if (TIPOS_RECARGO.includes(r.tipoRecargo)) porTipo[r.tipoRecargo] += Number(r.cantidadHoras) || 0
  return porTipo
}

const vacioPorTipo = () => ({ DIURNA: 0, NOCTURNA: 0, FESTIVA_DIURNA: 0, FESTIVA_NOCTURNA: 0 })

const sumarTipos = (acum, tipos) => {
  for (const t of TIPOS_RECARGO) acum[t] = Math.round((acum[t] + tipos[t]) * 100) / 100
}

const redondear2 = (n) => Math.round(n * 100) / 100

/** Registros del periodo (estados activos, opcionalmente filtrados por área). */
async function registrosDelPeriodo(mes, anio, { cuadrillaArea, estados } = {}) {
  const { inicio, fin } = rangoMes(mes, anio)
  const where = {
    fechaOperacion: { gte: inicio, lt: fin },
    estado: estados ? { in: estados } : { in: ESTADOS_ACTIVOS }
  }
  if (cuadrillaArea) where.cuadrillaArea = { contains: cuadrillaArea, mode: 'insensitive' }
  return prisma.horaExtra.findMany({ where, orderBy: [{ cedula: 'asc' }, { fechaOperacion: 'asc' }] })
}

export const ReportesService = {
  /**
   * Reporte mensual: agregaciones por empleado, área, tipo, top trabajadores
   * y evidencias pendientes de revisión. Solo horas/conteos, sin dinero.
   */
  async reporteMensual(mes, anio, cuadrillaArea) {
    ;({ mes, anio } = validarPeriodo(mes, anio))
    const registros = await registrosDelPeriodo(mes, anio, { cuadrillaArea })

    const porEmpleado = new Map()
    const porArea = new Map()
    const porTipo = vacioPorTipo()
    const porEstado = {}
    let totalHoras = 0
    let pendientesRevision = 0

    for (const r of registros) {
      const tipos = horasPorTipo(r)
      const total = TIPOS_RECARGO.reduce((a, t) => a + tipos[t], 0)
      totalHoras += total
      sumarTipos(porTipo, tipos)
      porEstado[r.estado] = (porEstado[r.estado] || 0) + 1
      if (r.estadoEvidencia === 'PENDIENTE_REVISION') pendientesRevision += 1

      const claveEmp = `${r.cedula}`
      if (!porEmpleado.has(claveEmp)) {
        porEmpleado.set(claveEmp, {
          cedula: r.cedula,
          funcionario: r.funcionario,
          areas: new Set(),
          registros: 0,
          horas: vacioPorTipo(),
          totalHoras: 0
        })
      }
      const emp = porEmpleado.get(claveEmp)
      emp.registros += 1
      emp.areas.add(r.cuadrillaArea)
      sumarTipos(emp.horas, tipos)
      emp.totalHoras = redondear2(emp.totalHoras + total)

      if (!porArea.has(r.cuadrillaArea)) {
        porArea.set(r.cuadrillaArea, { cuadrillaArea: r.cuadrillaArea, registros: 0, horas: vacioPorTipo(), totalHoras: 0 })
      }
      const area = porArea.get(r.cuadrillaArea)
      area.registros += 1
      sumarTipos(area.horas, tipos)
      area.totalHoras = redondear2(area.totalHoras + total)
    }

    const empleados = [...porEmpleado.values()].map((e) => ({
      cedula: e.cedula,
      funcionario: e.funcionario,
      areas: [...e.areas],
      registros: e.registros,
      horas: e.horas,
      totalHoras: redondear2(e.totalHoras)
    })).sort((a, b) => b.totalHoras - a.totalHoras)

    const areas = [...porArea.values()].map((a) => ({ ...a, totalHoras: redondear2(a.totalHoras) }))
      .sort((a, b) => b.totalHoras - a.totalHoras)

    return {
      periodo: `${anio}-${String(mes).padStart(2, '0')}`,
      totalRegistros: registros.length,
      totalHoras: redondear2(totalHoras),
      porTipo,
      porEstado,
      porEmpleado: empleados,
      porArea: areas,
      topTrabajadores: empleados.slice(0, 5).map((e) => ({
        cedula: e.cedula, funcionario: e.funcionario, totalHoras: e.totalHoras
      })),
      evidenciasPendientes: pendientesRevision
    }
  },

  /**
   * CSV del periodo a mano (estilo radicados): BOM para Excel, separador ;,
   * escape de comillas y neutralización de fórmulas (=, +, -, @, tab).
   */
  async generarCsv(mes, anio, { cuadrillaArea, estados } = {}) {
    ;({ mes, anio } = validarPeriodo(mes, anio))
    const registros = await registrosDelPeriodo(mes, anio, { cuadrillaArea, estados })

    const fechaCsv = (v) => {
      if (!v) return ''
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return ''
      // Fecha local de Colombia del instante (UTC-5 fijo)
      const local = new Date(d.getTime() - 300 * 60000)
      const dd = String(local.getUTCDate()).padStart(2, '0')
      const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}/${local.getUTCFullYear()}`
    }
    const numero = (n) => (n == null ? '' : String(n).replace('.', ','))

    const celda = (v) => {
      let s = String(v ?? '')
      // Neutraliza celdas que Excel interpretaría como fórmula (=, +, -, @, tab)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }

    const columnas = [
      ['cedula', 'Cédula'],
      ['funcionario', 'Funcionario'],
      ['cuadrillaArea', 'Cuadrilla/Área'],
      ['fechaOperacionCsv', 'Fecha Operación'],
      ['tipoRecargo', 'Tipo Recargo'],
      ['cantidadHorasCsv', 'Horas Totales'],
      ['horasDIURNA', 'H. Diurnas'],
      ['horasNOCTURNA', 'H. Nocturnas'],
      ['horasFESTIVA_DIURNA', 'H. Festivas Diurnas'],
      ['horasFESTIVA_NOCTURNA', 'H. Festivas Nocturnas'],
      ['horasOrdinarias', 'H. Ordinarias en Turno'],
      ['turnoNombre', 'Turno'],
      ['origen', 'Origen'],
      ['estado', 'Estado'],
      ['estadoEvidencia', 'Estado Evidencia']
    ]

    const filas = [
      columnas.map(([, titulo]) => celda(titulo)).join(';'),
      ...registros.map((r) => {
        const tipos = horasPorTipo(r)
        const fila = {
          cedula: r.cedula,
          funcionario: r.funcionario,
          cuadrillaArea: r.cuadrillaArea,
          fechaOperacionCsv: fechaCsv(r.fechaOperacion),
          tipoRecargo: r.tipoRecargo,
          cantidadHorasCsv: numero(r.cantidadHoras),
          horasDIURNA: numero(tipos.DIURNA),
          horasNOCTURNA: numero(tipos.NOCTURNA),
          horasFESTIVA_DIURNA: numero(tipos.FESTIVA_DIURNA),
          horasFESTIVA_NOCTURNA: numero(tipos.FESTIVA_NOCTURNA),
          horasOrdinarias: numero(r.recargoDesglose?.horasOrdinariasDentroTurno ?? 0),
          turnoNombre: r.turnoNombre || '',
          origen: r.origen || 'MANUAL',
          estado: r.estado,
          estadoEvidencia: r.estadoEvidencia || ''
        }
        return columnas.map(([campo]) => celda(fila[campo])).join(';')
      })
    ]
    return `﻿${filas.join('\r\n')}`
  },

  /**
   * Cierre de nómina del periodo: APROBADO → ENVIADO_NOMINA + EnvioNomina
   * con snapshot de ids + email best-effort con el CSV adjunto. 409 si el
   * periodo ya fue enviado. El email fallido NO revierte el cierre.
   */
  async enviarNomina(mes, anio, usuario) {
    ({ mes, anio } = validarPeriodo(mes, anio))
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`

    const existente = await prisma.envioNomina.findUnique({ where: { periodo } })
    if (existente) {
      throw Object.assign(
        new Error(`El periodo ${periodo} ya fue enviado a nómina (${existente.totalRegistros} registros).`),
        { status: 409 }
      )
    }

    const aprobados = await registrosDelPeriodo(mes, anio, { estados: ['APROBADO'] })
    if (!aprobados.length) {
      throw Object.assign(
        new Error(`No hay registros APROBADO en ${periodo} para enviar a nómina.`),
        { status: 400 }
      )
    }

    // ── Transacción lógica: marcar y archivar el snapshot ──────────────────
    // El where revalida APROBADO: si un dictamen concurrente cambió el estado
    // entre la lectura y esta escritura, ese registro NO se marca (el snapshot
    // queda como fuente de verdad de lo enviado).
    const ids = aprobados.map((r) => r.id)
    await prisma.horaExtra.updateMany({
      where: { id: { in: ids }, estado: 'APROBADO' },
      data: { estado: 'ENVIADO_NOMINA' }
    })

    const totalHoras = redondear2(aprobados.reduce((a, r) => a + (Number(r.cantidadHoras) || 0), 0))
    const desglose = vacioPorTipo()
    for (const r of aprobados) sumarTipos(desglose, horasPorTipo(r))

    // CSV del envío: snapshot de los registros recién marcados ENVIADO_NOMINA
    const csv = await this.generarCsv(mes, anio, { estados: ['ENVIADO_NOMINA'] })

    let emailEnviadoA = null
    let emailError = null

    // ── Email best-effort (la falta de config NO es error del cierre) ──────
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOMINA_EMAIL } = process.env
    const smtpCompleto = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && NOMINA_EMAIL
    if (!smtpCompleto) {
      emailError = 'SMTP no configurado'
    } else {
      try {
        const nodemailer = await obtenerNodemailer()
        if (!nodemailer) {
          throw new Error('nodemailer no está instalado en el servidor')
        }
        const transporte = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS }
        })
        await transporte.sendMail({
          from: `"Acuusan E.S.P. — Gestión Operativa" <${SMTP_USER}>`,
          to: NOMINA_EMAIL,
          subject: `Nómina Horas Extras — ${periodo}`,
          text: [
            `Cierre de nómina de horas extras del periodo ${periodo}.`,
            ``,
            `Registros enviados: ${aprobados.length}`,
            `Total horas: ${totalHoras}`,
            `Desglose: DIURNA ${desglose.DIURNA} h · NOCTURNA ${desglose.NOCTURNA} h · FESTIVA_DIURNA ${desglose.FESTIVA_DIURNA} h · FESTIVA_NOCTURNA ${desglose.FESTIVA_NOCTURNA} h`,
            ``,
            `Generado por: ${usuario}`,
            `El detalle completo va en el CSV adjunto.`
          ].join('\r\n'),
          attachments: [
            {
              filename: `nomina-horas-extras-${periodo}.csv`,
              content: csv,
              contentType: 'text/csv; charset=utf-8'
            }
          ]
        })
        emailEnviadoA = NOMINA_EMAIL
      } catch (error) {
        // El cierre YA quedó hecho: se registra el fallo y no se revierte.
        emailError = error.message
        logger.error('H-EXTRAS', 'NOMINA-MAIL ERR', `${periodo} — ${error.message}`)
      }
    }

    const envio = await prisma.envioNomina.create({
      data: {
        periodo,
        mes,
        anio,
        totalRegistros: aprobados.length,
        totalHoras,
        desgloseHoras: desglose,
        idsRegistros: ids,
        emailEnviadoA,
        emailError,
        generadoPor: usuario
      }
    })

    logger.success(
      'H-EXTRAS',
      'NOMINA-ENVIAR',
      `${periodo} | ${aprobados.length} registros | ${totalHoras} h | Email: ${emailEnviadoA || `NO (${emailError})`} | Por: ${usuario}`
    )

    return { ...envio, csvGenerado: true, emailEnviado: emailEnviadoA != null }
  },

  /** Envíos de nómina archivados (más reciente primero). */
  listarEnvios() {
    return prisma.envioNomina.findMany({ orderBy: { generadoEn: 'desc' } })
  },

  /** KPIs del mes para el tablero interno (reusa el reporte mensual). */
  async dashboard(mes, anio) {
    const reporte = await this.reporteMensual(mes, anio)
    const periodo = reporte.periodo
    const [nomina, sesionesAbiertas] = await Promise.all([
      prisma.envioNomina.findUnique({ where: { periodo } }),
      prisma.horaExtra.count({ where: { estado: 'EN_CURSO' } })
    ])
    return {
      periodo,
      totalRegistros: reporte.totalRegistros,
      totalHoras: reporte.totalHoras,
      porEstado: reporte.porEstado,
      porTipo: reporte.porTipo,
      porArea: reporte.porArea.slice(0, 10),
      topTrabajadores: reporte.topTrabajadores,
      evidenciasPendientes: reporte.evidenciasPendientes,
      sesionesAbiertas,
      nominaEnviada: nomina
        ? { periodo: nomina.periodo, totalRegistros: nomina.totalRegistros, totalHoras: nomina.totalHoras, generadoPor: nomina.generadoPor, generadoEn: nomina.generadoEn, emailEnviadoA: nomina.emailEnviadoA, emailError: nomina.emailError }
        : null
    }
  }
}
