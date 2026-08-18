import prisma from '../../config/prisma.js'

// Diccionario bidireccional de mapeo de tipos de permisos
const MAPA_TIPOS = {
  COMPENSATORIO: 'Compensatorio',
  MEDICO: 'Cita Médica',
  PERSONAL: 'Personal',
  CALAMIDAD: 'Calamidad Doméstica',
  ESTUDIO: 'Estudio / Capacitación'
}

const normalizarTipoEnum = (tipoStr) => {
  if (!tipoStr) return 'COMPENSATORIO'
  const t = tipoStr.toUpperCase().trim()
  if (t.includes('MEDIC') || t.includes('CITA')) return 'MEDICO'
  if (t.includes('COMPENS')) return 'COMPENSATORIO'
  if (t.includes('CALAMID')) return 'CALAMIDAD'
  if (t.includes('ESTUD') || t.includes('CAPACIT')) return 'ESTUDIO'
  if (t.includes('PERSON')) return 'PERSONAL'
  return ['CALAMIDAD', 'MEDICO', 'PERSONAL', 'COMPENSATORIO', 'ESTUDIO'].includes(t) ? t : 'COMPENSATORIO'
}

const parsearFecha = (val) => {
  if (!val) return new Date()
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const partes = val.split('/')
      if (partes.length === 3) {
        const d = parseInt(partes[0], 10)
        const m = parseInt(partes[1], 10) - 1
        const y = parseInt(partes[2], 10)
        return new Date(y, m, d)
      }
    }
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

const formatearParaFrontend = (p) => {
  const fInicio = new Date(p.fechaInicio)
  const dia = fInicio.getDate()
  const mesNum = fInicio.getMonth() + 1
  const anio = fInicio.getFullYear()
  const fechaEntrega = `${String(dia).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${anio}`
  
  const tipoAmigable = MAPA_TIPOS[p.tipo] || p.tipo

  return {
    id: p.id,
    radicado: p.radicado,
    cedula: p.cedula,
    funcionario: p.nombreFuncionario,
    nombreFuncionario: p.nombreFuncionario,
    cargo: p.cargo || 'Funcionario Acuasan',
    dependencia: p.dependencia || 'Operativa',
    tipo: tipoAmigable,
    tipoEnum: p.tipo,
    fechaInicio: fechaEntrega,
    fechaFin: p.fechaFin ? `${String(new Date(p.fechaFin).getDate()).padStart(2, '0')}/${String(new Date(p.fechaFin).getMonth() + 1).padStart(2, '0')}/${new Date(p.fechaFin).getFullYear()}` : fechaEntrega,
    fechaEntrega,
    hora24: p.hora24 || '08:00',
    duracion: p.duracion || '07:00 a 15:00 (8 horas)',
    motivo: p.justificacion || p.motivoManuscrito || '',
    motivoManuscrito: p.motivoManuscrito || '',
    observaciones: p.observaciones || '',
    soporte: p.soporte || 'Permiso_Escaneado.pdf',
    soporteUrl: p.soporteUrl || '',
    archivoUrl: p.archivoUrl || '',
    isPdf: p.soporte ? p.soporte.toLowerCase().endsWith('.pdf') : false,
    estado: p.estado,
    estadoEnvio: p.estado === 'PENDIENTE' ? 'APROBADO' : p.estado,
    aprobadoPor: p.aprobadoPor || 'Registro Directo',
    fechaAprobacion: p.fechaAprobacion,
    ocrConfidence: p.ocrConfidence,
    anio,
    mesNum,
    dia,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }
}

export const PermisosService = {
  /**
   * Asegura que existan registros base en la BD MongoDB
   */
  async asegurarSemillaInicial() {
    const conteo = await prisma.permiso.count()

    const semillas = [
      {
        radicado: 'PERM-2026-0040',
        cedula: '1098345672',
        nombreFuncionario: 'Carlos Andrés Mendoza Ruiz',
        cargo: 'Técnico Operario - Acueducto',
        dependencia: 'Mantenimiento de Acueducto',
        tipo: 'MEDICO',
        fechaInicio: new Date(2026, 7, 17, 8, 15),
        fechaFin: new Date(2026, 7, 17, 12, 0),
        hora24: '08:15',
        duracion: '08:00 a 12:00 (4 horas)',
        justificacion: 'Cita médica especialista.',
        soporte: 'Certificado_EPS_Sanitas.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0041',
        cedula: '63456789',
        nombreFuncionario: 'Sandra Milena Villamizar',
        cargo: 'Auxiliar Administrativa',
        dependencia: 'Recursos Humanos',
        tipo: 'PERSONAL',
        fechaInicio: new Date(2026, 7, 18, 10, 0),
        fechaFin: new Date(2026, 7, 18, 12, 0),
        hora24: '10:00',
        duracion: '10:00 a 12:00 (2 horas)',
        justificacion: 'Diligencia bancaria.',
        soporte: 'Permiso_Sandra_V.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0042',
        cedula: '1098345672',
        nombreFuncionario: 'Carlos Andrés Mendoza Ruiz',
        cargo: 'Técnico Operario - Acueducto',
        dependencia: 'Mantenimiento de Acueducto',
        tipo: 'MEDICO',
        fechaInicio: new Date(2026, 7, 18, 9, 30),
        fechaFin: new Date(2026, 7, 18, 12, 0),
        hora24: '09:30',
        duracion: '08:00 a 12:00 (4 horas)',
        justificacion: 'Cita médica especialista - Urología.',
        soporte: 'Certificado_EPS_Sanitas.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0043',
        cedula: '13888999',
        nombreFuncionario: 'Jorge Eliécer Prada Santos',
        cargo: 'Conductor Operativo Cuadrilla',
        dependencia: 'Aseo y Rutas Urbanas',
        tipo: 'COMPENSATORIO',
        fechaInicio: new Date(2026, 7, 19, 11, 15),
        fechaFin: new Date(2026, 7, 19, 15, 0),
        hora24: '11:15',
        duracion: '07:00 a 15:00 (8 horas)',
        justificacion: 'Día compensatorio por labor dominical en jornada de recolección especial.',
        soporte: 'Compensatorio_JPrada.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0044',
        cedula: '1098765432',
        nombreFuncionario: 'María Fernanda Ruiz Ortiz',
        cargo: 'Analista de Facturación y Cartera',
        dependencia: 'Comercial y Facturación',
        tipo: 'PERSONAL',
        fechaInicio: new Date(2026, 7, 20, 14, 0),
        fechaFin: new Date(2026, 7, 20, 16, 0),
        hora24: '14:00',
        duracion: '14:00 a 16:00 (2 horas)',
        justificacion: 'Diligencia notarial y bancaria personal impostergable.',
        soporte: 'Solicitud_Permiso_Laboral.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0045',
        cedula: '91234567',
        nombreFuncionario: 'Héctor Fabio Ramírez',
        cargo: 'Operario de Redes de Alcantarillado',
        dependencia: 'Alcantarillado Principal',
        tipo: 'CALAMIDAD',
        fechaInicio: new Date(2026, 7, 21, 8, 45),
        fechaFin: new Date(2026, 7, 21, 16, 0),
        hora24: '08:45',
        duracion: '08:00 a 16:00 (16 horas)',
        justificacion: 'Emergencia por filtración e inundación en vivienda familiar.',
        soporte: 'Acta_Calamidad_HF.pdf',
        estado: 'APROBADO'
      },
      {
        radicado: 'PERM-2026-0046',
        cedula: '1098444555',
        nombreFuncionario: 'Mauricio Gómez Santos',
        cargo: 'Operador Planta de Tratamiento',
        dependencia: 'Planta de Tratamiento de Agua',
        tipo: 'ESTUDIO',
        fechaInicio: new Date(2026, 7, 21, 16, 20),
        fechaFin: new Date(2026, 7, 21, 18, 0),
        hora24: '16:20',
        duracion: '10:00 a 16:00 (6 horas)',
        justificacion: 'Examen de certificación en sustancias químicas.',
        soporte: 'Certificado_Examen_MG.pdf',
        estado: 'APROBADO'
      }
    ]

    if (conteo === 0) {
      for (const item of semillas) {
        await prisma.permiso.create({ data: item })
      }
    } else {
      for (const item of semillas) {
        const existente = await prisma.permiso.findUnique({ where: { radicado: item.radicado } })
        if (existente) {
          await prisma.permiso.update({
            where: { radicado: item.radicado },
            data: { fechaInicio: item.fechaInicio, fechaFin: item.fechaFin }
          })
        }
      }
    }
  },

  /**
   * Obtener lista de permisos con filtros
   */
  async listarPermisos(filtros = {}) {
    await this.asegurarSemillaInicial()

    const where = {}
    if (filtros.estado) where.estado = filtros.estado
    if (filtros.cedula) where.cedula = filtros.cedula
    if (filtros.tipo) where.tipo = normalizarTipoEnum(filtros.tipo)

    const resultados = await prisma.permiso.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return resultados.map(formatearParaFrontend)
  },

  /**
   * Obtener permiso por ID
   */
  async obtenerPorId(id) {
    const item = await prisma.permiso.findUnique({
      where: { id }
    })
    return item ? formatearParaFrontend(item) : null
  },

  /**
   * Crear nueva solicitud de permiso
   */
  async crearPermiso(datos) {
    const conteo = await prisma.permiso.count()
    const anio = new Date().getFullYear()
    
    // Generar radicado único PERM-2026-00XX
    const numeroSecuencial = conteo + 40
    const radicado = datos.radicado || `PERM-${anio}-${String(numeroSecuencial).padStart(4, '0')}`

    const tipoEnum = normalizarTipoEnum(datos.tipo || datos.tipoPermiso)
    const fechaInicioParsed = parsearFecha(datos.fechaInicio)
    const fechaFinParsed = parsearFecha(datos.fechaFin || datos.fechaInicio)

    const ahora = new Date()
    const hora24Actual = datos.hora24 || ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

    const creado = await prisma.permiso.create({
      data: {
        radicado,
        cedula: String(datos.cedula || '').trim(),
        nombreFuncionario: datos.nombreFuncionario || datos.funcionario || '',
        cargo: datos.cargo || 'Funcionario Acuasan',
        dependencia: datos.dependencia || 'Operativa',
        tipo: tipoEnum,
        fechaInicio: fechaInicioParsed,
        fechaFin: fechaFinParsed,
        duracion: datos.duracion || datos.horasCalculadas || '07:00 a 15:00 (8 horas)',
        hora24: hora24Actual,
        justificacion: datos.justificacion || datos.motivo || '',
        motivoManuscrito: datos.motivoManuscrito || '',
        soporte: datos.soporte || datos.documentFileName || 'Permiso_Escaneado.pdf',
        soporteUrl: datos.soporteUrl || '',
        archivoUrl: datos.archivoUrl || datos.customFileUrl || '',
        ocrConfidence: datos.ocrConfidence || 0.98,
        ocrRawPayload: datos.ocrRawPayload || {},
        observaciones: datos.observaciones || '',
        estado: 'APROBADO',
        aprobadoPor: datos.aprobadoPor || 'Registro Directo'
      }
    })

    return formatearParaFrontend(creado)
  },

  /**
   * Dictamen de Gerencia: Aprobación o Rechazo
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    const actualizado = await prisma.permiso.update({
      where: { id },
      data: {
        estado,
        aprobadoPor: aprobadoPor || 'Gerencia General Acuasan',
        observaciones: observaciones || undefined,
        fechaAprobacion: new Date()
      }
    })

    return formatearParaFrontend(actualizado)
  }
}
