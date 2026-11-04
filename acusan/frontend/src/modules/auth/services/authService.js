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

const USUARIOS_FALLBACK = [
  {
    id: 'u-eliana-01',
    nombre: 'Eliana',
    email: 'eliana@acuasan.com',
    password: 'acuasan2026',
    rol: 'RADICADOS',
    cargo: 'Encargada de Radicaciones',
    cedula: '11009004'
  },
  {
    id: 'u-roman-02',
    nombre: 'Ramón',
    email: 'ramon@acuasan.com',
    password: 'acuasan2026',
    rol: 'ENCARGADO',
    cargo: 'Encargado de Permisos, Horas Extras y Radicados',
    cedula: '11009002'
  },
  {
    id: 'u-roman-alt',
    nombre: 'Ramón',
    email: 'roman@acuasan.com',
    password: 'acuasan2026',
    rol: 'ENCARGADO',
    cargo: 'Encargado de Permisos, Horas Extras y Radicados',
    cedula: '11009002'
  },
  {
    id: 'u-gerencia-03',
    nombre: 'Gerencia General Acuasan',
    email: 'gerencia@acuasan.com',
    password: 'acuasan2026',
    rol: 'GERENCIA',
    cargo: 'Gerente General',
    cedula: '11009001'
  },
  {
    id: 'u-operativo-04',
    nombre: 'Atención al Ciudadano PQR',
    email: 'operativo@acuasan.com',
    password: 'acuasan2026',
    rol: 'OPERATIVO',
    cargo: 'Agente de Atención al Usuario',
    cedula: '11009003'
  },
  {
    id: 'u-admin-05',
    nombre: 'Administrador de TI & Sistemas',
    email: 'admin@acuasan.com',
    password: 'acuasan2026',
    rol: 'ADMIN',
    cargo: 'Administrador del Sistema',
    cedula: '11009000'
  }
]

export const authService = {
  /**
   * Realiza el login y actualiza el estado reactivo (con fallback seguro en despliegue estático)
   */
  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase()
    let data = null
    let backendInalcanzable = false

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      })

      if (res.ok) {
        const json = await res.json()
        if (json && json.success) {
          data = json.data
        }
      } else {
        // El backend respondió y rechazó el acceso (401 y similares): sus
        // credenciales no valen y ningún fallback las puede "arreglar".
        let mensaje = 'Credenciales inválidas. Verifique su correo institucional o contraseña.'
        try {
          const json = await res.json()
          if (json?.message) mensaje = json.message
        } catch { /* respuesta sin cuerpo legible */ }
        throw new Error(mensaje)
      }
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch solo lanza TypeError cuando no pudo conectar (backend caído):
        // recién ahí tiene sentido el fallback de despliegue estático.
        backendInalcanzable = true
        console.warn('API backend no disponible en este host, cambiando a autenticación de respaldo.', err)
      } else {
        throw err
      }
    }

    // Fallback para cuentas oficiales SOLO si la API está inalcanzable
    if (!data) {
      if (!backendInalcanzable) {
        throw new Error('No se pudo iniciar sesión. Intente de nuevo en unos momentos.')
      }

      const usuarioEncontrado = USUARIOS_FALLBACK.find(
        u => u.email === cleanEmail && u.password === password
      )

      if (!usuarioEncontrado) {
        throw new Error('Credenciales inválidas. Verifique su correo institucional o contraseña.')
      }

      data = {
        token: `jwt_token_acuasan_${usuarioEncontrado.rol}_${Date.now()}`,
        usuario: {
          id: usuarioEncontrado.id,
          nombre: usuarioEncontrado.nombre,
          email: usuarioEncontrado.email,
          rol: usuarioEncontrado.rol,
          cargo: usuarioEncontrado.cargo,
          cedula: usuarioEncontrado.cedula,
          ultimoAcceso: new Date().toISOString()
        }
      }
    }

    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))

    state.token = data.token
    state.usuario = data.usuario

    return data
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

  // NOTA: solicitarRecuperacion/resetearPassword fueron ELIMINADOS junto con
  // los endpoints /recuperar-password y /reset-password del backend. El
  // restablecimiento de clave lo media el ADMIN desde Gestión de Usuarios.

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
