// Servicio de comunicacion con el backend de Horas Extras (App Externa)
// Todas las peticiones usan el JWT almacenado en localStorage.

// URL base del backend: vacia en desarrollo (el proxy de Vite redirige /api)
// y completa en produccion via VITE_API_URL (ver .env.example)
const BASE = import.meta.env.VITE_API_URL || ''
const API_BASE = `${BASE}/api/horas-extras`
const AUTH_BASE = `${BASE}/api/auth`
const TOKEN_KEY = 'acuasan_empleado_token'
const EMPLEADO_KEY = 'acuasan_empleado_info'

// ── Token de empleado ────────────────────────────────────────────────────────

export const authService = {
  /** Verifica si la cédula está registrada en la base de datos */
  async verificarCedula(cedula) {
    if (!cedula || String(cedula).trim().length < 5) return { registrada: false }
    try {
      const res = await fetch(`${AUTH_BASE}/verificar-cedula/${encodeURIComponent(String(cedula).trim())}`)
      if (!res.ok) return { registrada: false }
      const data = await res.json()
      return data.data || { registrada: false }
    } catch {
      return { registrada: false }
    }
  },

  /** Solicita token JWT al backend usando cedula + nombre */
  async identificar({ cedula, nombre }) {
    const res = await fetch(`${AUTH_BASE}/token-empleado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula, nombre: nombre ? nombre.trim() : undefined })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'No se pudo identificar al empleado')
    localStorage.setItem(TOKEN_KEY, data.data.token)
    localStorage.setItem(EMPLEADO_KEY, JSON.stringify({ nombre: data.data.nombre, cedula: data.data.cedula }))
    return data.data
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  getEmpleado() {
    try {
      return JSON.parse(localStorage.getItem(EMPLEADO_KEY)) || null
    } catch {
      return null
    }
  },

  cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMPLEADO_KEY)
  },

  estaIdentificado() {
    return !!this.getToken()
  }
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${authService.getToken()}`
})

// Respuesta JSON estandar {success, data|message}: devuelve data o lanza con
// .status adjunto para que el llamador pueda distinguir errores definitivos
// (409, 403...) de los de red.
const manejarRespuesta = async (res) => {
  if (res.status === 401) {
    authService.cerrarSesion()
    window.location.href = '/'
    throw new Error('Sesion expirada')
  }
  const data = await res.json()
  if (!data.success) {
    const error = new Error(data.message || 'Error en la solicitud')
    error.status = res.status
    throw error
  }
  // El "aviso" del clasificador (horas descontadas por turno, etc.) viaja a
  // nivel superior de la respuesta: se adosa al data para que la vista lo muestre
  if (data.aviso != null && data.data && typeof data.data === 'object') {
    data.data.aviso = data.aviso
  }
  return data.data
}

// ── Horas Extras ─────────────────────────────────────────────────────────────

export const horasExtrasService = {
  /** Obtiene los registros propios del empleado autenticado */
  async misRegistros() {
    const res = await fetch(`${API_BASE}/mis-registros`, {
      headers: getHeaders()
    })
    if (res.status === 401) {
      authService.cerrarSesion()
      window.location.href = '/'
      return []
    }
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    return data.data
  },

  /** Envia un nuevo reporte de horas extras desde el portal del empleado */
  async reportar({ cuadrillaArea, fechaOperacion, tipoRecargo, cantidadHoras, justificacion }) {
    const res = await fetch(`${API_BASE}/autoreporte`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ cuadrillaArea, fechaOperacion, tipoRecargo, cantidadHoras, justificacion })
    })
    if (res.status === 401) {
      authService.cerrarSesion()
      window.location.href = '/'
      throw new Error('Sesion expirada')
    }
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    return data.data
  }
}

// ── Evidencias (sesion con foto inicial y final) ─────────────────────────────

export const evidenciasService = {
  /** Inicia una sesion de evidencia con foto inicial → {horaExtra, evidencia} */
  async iniciar(payload) {
    const res = await fetch(`${API_BASE}/evidencias/iniciar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })
    return manejarRespuesta(res)
  },

  /** Finaliza la sesion con foto final → HoraExtra actualizada (sin fotos) */
  async finalizar(horaExtraId, payload) {
    const res = await fetch(`${API_BASE}/evidencias/${horaExtraId}/finalizar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })
    return manejarRespuesta(res)
  },

  /** Anula una sesion EN_CURSO o PENDIENTE sin dictamen */
  async anular(horaExtraId, motivo) {
    const res = await fetch(`${API_BASE}/evidencias/${horaExtraId}/anular`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ motivo })
    })
    return manejarRespuesta(res)
  },

  /** Sesion EN_CURSO del empleado + evidencia inicial (sin fotoBase64) */
  async miSesionActiva() {
    const res = await fetch(`${API_BASE}/evidencias/mi-sesion-activa`, {
      headers: getHeaders()
    })
    return manejarRespuesta(res) // {sesion, evidenciaInicial}
  },

  /** Descarga la foto de una evidencia como blob URL (requiere Authorization) */
  async obtenerFotoBlob(evidenciaId) {
    const res = await fetch(`${API_BASE}/evidencias/${evidenciaId}/foto`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` }
    })
    if (res.status === 401) {
      authService.cerrarSesion()
      window.location.href = '/'
      throw new Error('Sesion expirada')
    }
    if (!res.ok) throw new Error('No se pudo cargar la foto de la evidencia.')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }
}

// ── Turnos ───────────────────────────────────────────────────────────────────

export const turnosService = {
  /** Turnos activos (el empleado de campo siempre ve solo activos) */
  async listarActivos() {
    const res = await fetch(`${API_BASE}/turnos`, {
      headers: getHeaders()
    })
    return manejarRespuesta(res)
  }
}
