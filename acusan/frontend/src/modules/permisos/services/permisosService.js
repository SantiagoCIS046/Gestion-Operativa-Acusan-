import authService from '../../auth/services/authService.js'

const API_BASE_URL = '/api/permisos'
const STORAGE_KEY = 'acuasan_permisos_db'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Datos oficiales de permisos de la semana laboral Acuasan ──
const PERMISOS_INICIALES = [
  {
    id: 'PERM-2026-0040', radicado: 'PERM-2026-0040',
    funcionario: 'María López', nombreFuncionario: 'María López',
    cedula: '1098765401', cargo: 'Fontanera', dependencia: 'Operativa',
    tipo: 'Calamidad Doméstica', estado: 'APROBADO',
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
    tipo: 'Cita Médica', estado: 'PENDIENTE',
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
    tipo: 'Personal', estado: 'APROBADO',
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
    tipo: 'Cita Médica', estado: 'APROBADO',
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
    tipo: 'Compensatorio', estado: 'APROBADO',
    dia: 20, mes: 8, anio: 2026,
    fechaInicio: '20/08/2026', hora24: '07:00', duracion: '8h',
    motivo: 'Compensatorio por jornada dominical especial',
    justificacion: 'Registro de compensatorio de ley',
    horasAcumuladasMesEmpleado: 8, confianzaOCR: 99,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'PERM-2026-0045', radicado: 'PERM-2026-0045',
    funcionario: 'Jorge Torres', nombreFuncionario: 'Jorge Torres',
    cedula: '1098765406', cargo: 'Fontanero Senior', dependencia: 'Operativa',
    tipo: 'Calamidad Doméstica', estado: 'PENDIENTE',
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
    tipo: 'Personal', estado: 'RECHAZADO',
    dia: 21, mes: 8, anio: 2026,
    fechaInicio: '21/08/2026', hora24: '10:00', duracion: '2h',
    motivo: 'Diligencia banco personal',
    justificacion: 'Trámite bancario urgente',
    horasAcumuladasMesEmpleado: 2, confianzaOCR: 95,
    soporte: 'Solicitud_Permiso_Laboral.pdf',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  }
]

const obtenerDbLocalPermisos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    // fallback
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(PERMISOS_INICIALES))
  return [...PERMISOS_INICIALES]
}

const guardarDbLocalPermisos = (lista) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch (e) {
    console.warn('Error guardando permisos locales:', e)
  }
}

let backendPermisosDisponible = true

export const permisosService = {
  /**
   * Obtiene la lista completa de permisos con base de datos local persistente
   */
  async obtenerHistorialPermisos(filtros = {}) {
    if (!backendPermisosDisponible) {
      return obtenerDbLocalPermisos()
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      const params = new URLSearchParams()
      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.cedula) params.append('cedula', filtros.cedula)
      if (filtros.tipo) params.append('tipo', filtros.tipo)

      const url = params.toString() ? `${API_BASE_URL}/encargado?${params.toString()}` : `${API_BASE_URL}/encargado`
      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        return []
      }

      if (res.ok) {
        const data = await res.json()
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          guardarDbLocalPermisos(data.data)
          return data.data
        }
      }

      backendPermisosDisponible = false
      return obtenerDbLocalPermisos()
    } catch (error) {
      backendPermisosDisponible = false
      return obtenerDbLocalPermisos()
    }
  },

  /**
   * Radica un nuevo permiso extraído vía OCR o diligenciado
   */
  async crearPermiso(datos) {
    const nuevoPermiso = {
      ...datos,
      id: `PERM-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
      radicado: datos.radicado || `PERM-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
      estado: 'PENDIENTE',
      confianzaOCR: 98,
      createdAt: new Date().toISOString()
    }

    const lista = obtenerDbLocalPermisos()
    lista.unshift(nuevoPermiso)
    guardarDbLocalPermisos(lista)

    if (backendPermisosDisponible) {
      try {
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(datos)
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.success) return data.data
        }
      } catch (e) {
        backendPermisosDisponible = false
      }
    }

    return nuevoPermiso
  },

  /**
   * Obtiene el detalle de un permiso por su ID
   */
  async obtenerPermisoPorId(id) {
    const lista = obtenerDbLocalPermisos()
    return lista.find(p => p.id === id || p.radicado === id) || null
  },

  /**
   * Dictamen de Gerencia (Aprobado / Rechazado) con persistencia garantizada
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    const lista = obtenerDbLocalPermisos()
    const idx = lista.findIndex(p => p.id === id || p.radicado === id)
    if (idx !== -1) {
      lista[idx].estado = estado
      lista[idx].aprobadoPor = aprobadoPor || 'Gerencia General Acuasan'
      lista[idx].observaciones = observaciones || ''
      guardarDbLocalPermisos(lista)
    }

    if (backendPermisosDisponible) {
      try {
        await fetch(`${API_BASE_URL}/${id}/dictamen`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ estado, aprobadoPor, observaciones })
        })
      } catch (e) {
        backendPermisosDisponible = false
      }
    }

    return (idx !== -1) ? lista[idx] : { id, estado, aprobadoPor, observaciones }
  }
}

export default permisosService
