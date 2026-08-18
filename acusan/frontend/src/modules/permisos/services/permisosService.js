/**
 * Permisos API Service
 * Comunicación con el backend de Acuasan Express / Prisma / MongoDB
 * Fallback inteligente con datos semilla para despliegues estáticos (Vercel)
 */

import authService from '../../auth/services/authService.js'

const API_BASE_URL = '/api/permisos'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Datos de respaldo oficiales (semana 17-21 Agosto 2026) ──
const PERMISOS_FALLBACK = [
  {
    id: 'PERM-2026-0040', radicado: 'PERM-2026-0040',
    funcionario: 'María López', nombreFuncionario: 'María López',
    cedula: '1098765401', cargo: 'Fontanera', dependencia: 'Operativa',
    tipo: 'CALAMIDAD_DOMESTICA', estado: 'APROBADO',
    dia: 17, mes: 8, anio: 2026,
    fechaInicio: '17/08/2026', hora24: '07:00', duracion: '4h',
    motivo: 'Atención de emergencia familiar',
    justificacion: 'Urgencia doméstica comprobada',
    horasAcumuladasMesEmpleado: 4, confianzaOCR: 99,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0041', radicado: 'PERM-2026-0041',
    funcionario: 'Carlos Ruiz', nombreFuncionario: 'Carlos Ruiz',
    cedula: '1098765402', cargo: 'Técnico Acueducto', dependencia: 'Redes',
    tipo: 'CITA_MEDICA', estado: 'PENDIENTE',
    dia: 18, mes: 8, anio: 2026,
    fechaInicio: '18/08/2026', hora24: '09:00', duracion: '2h',
    motivo: 'Cita médica programada EPS Sanitas',
    justificacion: 'Consulta médica general',
    horasAcumuladasMesEmpleado: 2, confianzaOCR: 97,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0042', radicado: 'PERM-2026-0042',
    funcionario: 'Ana Gómez', nombreFuncionario: 'Ana Gómez',
    cedula: '1098765403', cargo: 'Operadora Alcantarillado', dependencia: 'Alcantarillado',
    tipo: 'DILIGENCIA_PERSONAL', estado: 'APROBADO',
    dia: 18, mes: 8, anio: 2026,
    fechaInicio: '18/08/2026', hora24: '14:00', duracion: '3h',
    motivo: 'Trámite en Registraduría Nacional',
    justificacion: 'Formulario E-18 Registraduría del Estado Civil',
    horasAcumuladasMesEmpleado: 3, confianzaOCR: 99,
    soporte: 'Evidencia_E18_Registraduria.pdf',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  },
  {
    id: 'PERM-2026-0043', radicado: 'PERM-2026-0043',
    funcionario: 'Pedro Martínez', nombreFuncionario: 'Pedro Martínez',
    cedula: '1098765404', cargo: 'Auxiliar Administrativo', dependencia: 'Administrativa',
    tipo: 'CITA_MEDICA', estado: 'APROBADO',
    dia: 19, mes: 8, anio: 2026,
    fechaInicio: '19/08/2026', hora24: '08:00', duracion: '4h',
    motivo: 'Cita especialista traumatología',
    justificacion: 'Urgencia médica certificada',
    horasAcumuladasMesEmpleado: 4, confianzaOCR: 98,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0044', radicado: 'PERM-2026-0044',
    funcionario: 'Luisa Hernández', nombreFuncionario: 'Luisa Hernández',
    cedula: '1098765405', cargo: 'Laboratorista Agua', dependencia: 'Calidad',
    tipo: 'LICENCIA_LUTO', estado: 'APROBADO',
    dia: 20, mes: 8, anio: 2026,
    fechaInicio: '20/08/2026', hora24: '07:00', duracion: '8h',
    motivo: 'Fallecimiento de familiar de primer grado',
    justificacion: 'Registro civil de defunción',
    horasAcumuladasMesEmpleado: 8, confianzaOCR: 99,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0045', radicado: 'PERM-2026-0045',
    funcionario: 'Jorge Torres', nombreFuncionario: 'Jorge Torres',
    cedula: '1098765406', cargo: 'Fontanero Senior', dependencia: 'Operativa',
    tipo: 'CALAMIDAD_DOMESTICA', estado: 'PENDIENTE',
    dia: 21, mes: 8, anio: 2026,
    fechaInicio: '21/08/2026', hora24: '06:00', duracion: '4h',
    motivo: 'Emergencia en vivienda por inundación',
    justificacion: 'Reporte de emergencia municipal',
    horasAcumuladasMesEmpleado: 4, confianzaOCR: 96,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0046', radicado: 'PERM-2026-0046',
    funcionario: 'Sandra Vargas', nombreFuncionario: 'Sandra Vargas',
    cedula: '1098765407', cargo: 'Auxiliar Acueducto', dependencia: 'Redes',
    tipo: 'DILIGENCIA_PERSONAL', estado: 'RECHAZADO',
    dia: 21, mes: 8, anio: 2026,
    fechaInicio: '21/08/2026', hora24: '10:00', duracion: '2h',
    motivo: 'Diligencia banco personal',
    justificacion: 'Trámite bancario urgente',
    horasAcumuladasMesEmpleado: 2, confianzaOCR: 95,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  }
]

export const permisosService = {
  /**
   * Obtiene la lista completa de permisos para el encargado (con fallback a datos semilla)
   */
  async obtenerHistorialPermisos(filtros = {}) {
    try {
      const params = new URLSearchParams()
      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.cedula) params.append('cedula', filtros.cedula)
      if (filtros.tipo) params.append('tipo', filtros.tipo)

      const url = params.toString() ? `${API_BASE_URL}/encargado?${params.toString()}` : `${API_BASE_URL}/encargado`
      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      })

      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        return []
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data.data) return data.data
      }

      // Fallback: API no disponible o error 500 → retornar datos semilla
      console.warn('API permisos no disponible, usando datos de demostración.')
      return PERMISOS_FALLBACK
    } catch (error) {
      console.warn('Error de red en permisos, usando datos de demostración:', error.message)
      return PERMISOS_FALLBACK
    }
  },

  /**
   * Radica un nuevo permiso extraído vía OCR o diligenciado por el encargado
   */
  async crearPermiso(datos) {
    try {
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(datos)
      })

      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.')
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      // Fallback: simular radicación exitosa en modo demo
      console.warn('API no disponible, simulando radicación de permiso en modo demo.')
      const nuevoPermiso = {
        ...datos,
        id: `PERM-2026-DEMO-${Date.now()}`,
        radicado: `PERM-2026-DEMO-${Date.now()}`,
        estado: 'PENDIENTE',
        confianzaOCR: 98,
        createdAt: new Date().toISOString()
      }
      PERMISOS_FALLBACK.push(nuevoPermiso)
      return nuevoPermiso
    } catch (error) {
      console.error('Error al crear permiso en el backend:', error)
      throw error
    }
  },

  /**
   * Obtiene el detalle de un permiso por su ID (con fallback)
   */
  async obtenerPermisoPorId(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'GET',
        headers: getHeaders()
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      return PERMISOS_FALLBACK.find(p => p.id === id) || null
    } catch (error) {
      console.warn('Error al obtener permiso por ID, buscando en datos locales:', error.message)
      return PERMISOS_FALLBACK.find(p => p.id === id) || null
    }
  },

  /**
   * Dictamen de Gerencia (Aprobado / Rechazado) — con fallback
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}/dictamen`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ estado, aprobadoPor, observaciones })
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      // Fallback: actualizar localmente
      const idx = PERMISOS_FALLBACK.findIndex(p => p.id === id)
      if (idx !== -1) {
        PERMISOS_FALLBACK[idx].estado = estado
        PERMISOS_FALLBACK[idx].aprobadoPor = aprobadoPor
        PERMISOS_FALLBACK[idx].observaciones = observaciones
        return PERMISOS_FALLBACK[idx]
      }
      return { id, estado, aprobadoPor, observaciones }
    } catch (error) {
      console.error('Error al dictaminar permiso:', error)
      throw error
    }
  }
}

export default permisosService
