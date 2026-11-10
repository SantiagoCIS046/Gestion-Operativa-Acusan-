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

// POST a una ruta pública de /api/auth; devuelve { message, data }
async function llamarPublico(ruta, cuerpo, conMensaje = false) {
  let res
  try {
    res = await fetch(`${API_BASE}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.')
  }
  let json = null
  try {
    json = await res.json()
  } catch { /* sin cuerpo */ }
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'No se pudo completar la solicitud.')
  }
  return conMensaje ? { message: json.message, data: json.data } : json.data
}

export const authService = {
  /**
   * Inicia sesión contra la API y actualiza el estado reactivo.
   * Sin respaldo local: antes existía un "login de emergencia" con cuentas y
   * contraseñas escritas en este archivo (visibles para cualquiera en el
   * navegador). Si la API no responde, simplemente se informa.
   */
  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase()

    let res
    try {
      res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      })
    } catch {
      // fetch solo lanza cuando no pudo conectar (servidor caído o sin red)
      throw new Error('No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.')
    }

    let json = null
    try {
      json = await res.json()
    } catch { /* respuesta sin cuerpo legible */ }

    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'Credenciales inválidas. Verifique su correo institucional o contraseña.')
    }

    const data = json.data
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))

    state.token = data.token
    state.usuario = data.usuario

    return data
  },

  /**
   * Solicitud de cuenta (autorregistro): queda pendiente de aprobación por
   * gerencia; NO inicia sesión.
   */
  async registro(datos) {
    return llamarPublico('/registro', { nombre: datos.nombre, email: datos.email, password: datos.password })
  },

  /** { correoHabilitado } — decide cómo se ofrece la recuperación */
  async opciones() {
    try {
      const res = await fetch(`${API_BASE}/opciones`)
      const json = await res.json()
      return json?.data ?? { correoHabilitado: false }
    } catch {
      return { correoHabilitado: false }
    }
  },

  /** Pide el enlace de recuperación (misma respuesta exista o no la cuenta) */
  async solicitarRecuperacion(email) {
    return llamarPublico('/recuperar-password', { email }, true)
  },

  /** Completa la recuperación con el token del enlace del correo */
  async restablecer(token, password) {
    return llamarPublico('/restablecer', { token, password }, true)
  },

  /**
   * Cambia la contraseña propia (obligatorio tras una temporal). El backend
   * cierra las demás sesiones y devuelve un token nuevo para esta.
   */
  async cambiarPassword(actual, nueva) {
    const res = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeader() },
      body: JSON.stringify({ actual, nueva })
    })
    let json = null
    try {
      json = await res.json()
    } catch { /* sin cuerpo */ }
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'No se pudo cambiar la contraseña.')
    }
    localStorage.setItem(TOKEN_KEY, json.data.token)
    state.token = json.data.token
    this.actualizarUsuario({ ...(state.usuario || {}), ...json.data.usuario })
    return json.data
  },

  /** Marca la sesión como obligada a cambiar la contraseña (403 del backend) */
  marcarCambioObligatorio() {
    if (state.usuario && !state.usuario.debeCambiarPassword) {
      this.actualizarUsuario({ ...state.usuario, debeCambiarPassword: true })
    }
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
   * Actualiza los datos del usuario en sesión (p. ej. tras GET /api/me,
   * que trae el área poblada y el rol al día) sin tocar el token.
   */
  actualizarUsuario(usuario) {
    if (!usuario) return
    localStorage.setItem(USER_KEY, JSON.stringify(usuario))
    state.usuario = usuario
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
   * Retorna el header de autorización con el JWT
   */
  getAuthHeader() {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
}

export default authService
