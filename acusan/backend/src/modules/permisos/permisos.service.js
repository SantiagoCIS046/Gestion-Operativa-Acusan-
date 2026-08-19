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
    // La base de datos inicia limpia y solo contiene los registros ingresados al sistema
  },

  /**
   * Obtener lista de permisos con filtros
   */
  async listarPermisos(filtros = {}) {
    try {
      const where = {}
      if (filtros.estado) where.estado = filtros.estado
      if (filtros.cedula) where.cedula = filtros.cedula
      if (filtros.tipo) where.tipo = normalizarTipoEnum(filtros.tipo)

      const resultados = await prisma.permiso.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      })

      return resultados.map(formatearParaFrontend)
    } catch (e) {
      return []
    }
  },

  /**
   * Obtener permiso por ID
   */
  async obtenerPorId(id) {
    try {
      const item = await prisma.permiso.findUnique({
        where: { id }
      })
      return item ? formatearParaFrontend(item) : null
    } catch (e) {
      return null
    }
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
