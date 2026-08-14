/**
 * Auth Service — Acuasan E.S.P.
 * Gestión de sesión con JWT y estado reactivo de Vue 3
 */

import { reactive } from 'vue'

const API_BASE = '/api/auth'
const TOKEN_KEY = 'acuasan_token'
const USER_KEY = 'acuasan_usuario'

// Estado reactivo global de la sesión
const state = reactive({
  token: localStorage.getItem(TOKEN_KEY) || null,
  usuario: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()
})

export const authService = {
  /**
   * Realiza el login y actualiza el estado reactivo
   */
  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al iniciar sesión')
    }

    localStorage.setItem(TOKEN_KEY, data.data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.data.usuario))

    state.token = data.data.token
    state.usuario = data.data.usuario

    return data.data
  },

  /**
   * Registra un nuevo usuario en la base de datos de MongoDB Atlas
   */
  async registro(datos) {
    const res = await fetch(`${API_BASE}/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al registrar usuario')
    }

    return data.data
  },

  /**
   * Solicita el código de recuperación de contraseña vía correo
   */
  async solicitarRecuperacion(email) {
    const res = await fetch(`${API_BASE}/recuperar-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al procesar solicitud de recuperación')
    }

    return data.data
  },

  /**
   * Restablece la contraseña en la BD
   */
  async resetearPassword(email, nuevaPassword) {
    const res = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), nuevaPassword })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al actualizar la contraseña')
    }

    return data
  },

  /**
   * Cierra sesión de forma reactiva limpiando el estado y localStorage
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    state.token = null
    state.usuario = null
  },

  /**
   * Retorna el token JWT almacenado (reactivo)
   */
  getToken() {
    return state.token
  },

  /**
   * Retorna los datos del usuario autenticado (reactivo)
   */
  getUsuarioActual() {
    return state.usuario
  },

  /**
   * Verifica reactivamente si hay una sesión activa
   */
  estaAutenticado() {
    return !!state.token
  },

  /**
   * Retorna el rol del usuario actual
   */
  getRol() {
    return state.usuario?.rol || null
  },

  /**
   * Control del Destinatario (Auto-Redirección Inteligente por Área)
   * Redirige al usuario automáticamente a la sección oficial de su área sin requerir intervención.
   */
  getRutaInicioPorRol(rol) {
    if (!this.estaAutenticado()) return '/login'

    const rolNorm = (rol || this.getRol() || '').toUpperCase().trim()

    // Mapeo dinámico de áreas institucionales de Acuasan (actuales y futuras)
    const mapaDestinatarios = {
      GERENCIA: '/permisos/gerencia',         // Consulta Gerencial & Visión Global 360°
      ENCARGADO: '/permisos/encargado',       // Permisos OCR & Horas Extras Operativas (Román)
      OPERATIVO: '/pqr/gestion',              // Atención al Ciudadano PQR
      RADICADOS: '/radicados/gestion',        // Módulo exclusivo para Eliana
      ADMIN: '/permisos/encargado',           // Administración de TI
      TALENTO_HUMANO: '/permisos/encargado',
      CUADRILLAS_OBRA: '/horas-extras/gerencia',
      ATENCION_CIUDADANA: '/pqr/gestion'
    }

    return mapaDestinatarios[rolNorm] || '/radicados/gestion'

  },

  /**
   * Retorna el header de autorización con el JWT
   */
  getAuthHeader() {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
}

export default authService
