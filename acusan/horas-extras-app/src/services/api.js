// Servicio de comunicacion con el backend de Horas Extras (App Externa)
// Todas las peticiones usan el JWT almacenado en localStorage.

const API_BASE = '/api/horas-extras'
const AUTH_BASE = '/api/auth'
const TOKEN_KEY = 'acuasan_empleado_token'
const EMPLEADO_KEY = 'acuasan_empleado_info'

// ── Token de empleado ────────────────────────────────────────────────────────

export const authService = {
  /** Solicita token JWT al backend usando cedula + nombre */
  async identificar({ cedula, nombre }) {
    const res = await fetch(`${AUTH_BASE}/token-empleado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula, nombre })
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