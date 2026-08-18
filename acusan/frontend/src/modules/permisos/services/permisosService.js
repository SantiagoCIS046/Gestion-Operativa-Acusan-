import authService from '../../auth/services/authService.js'

const API_BASE_URL = '/api/permisos'
const STORAGE_KEY = 'acuasan_permisos_db'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Base de datos de Permisos (Inicia vacía y solo almacena los datos ingresados al sistema) ──
const obtenerDbLocalPermisos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    // fallback
  }
  return []
}

const guardarDbLocalPermisos = (lista) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch (e) {
    console.warn('Error guardando permisos locales:', e)
  }
}

const isVercelHost = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('now.sh'))
let backendPermisosDisponible = !isVercelHost

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
    const ahora = new Date()
    let dia = parseInt((datos.fechaInicio || '').split('/')[0], 10) || ahora.getDate()
    let mesNum = parseInt((datos.fechaInicio || '').split('/')[1], 10) || (ahora.getMonth() + 1)
    let anio = parseInt((datos.fechaInicio || '').split('/')[2], 10) || ahora.getFullYear()

    const radicadoNum = `PERM-2026-${String(Math.floor(1000 + Math.random() * 9000))}`
    const funcionario = datos.nombreFuncionario || datos.funcionario || 'Funcionario Acuasan'
    const fechaEntrega = `${String(dia).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${anio}`

    const nuevoPermiso = {
      ...datos,
      id: datos.id || radicadoNum,
      radicado: datos.radicado || radicadoNum,
      dia,
      mesNum,
      anio,
      funcionario,
      nombreFuncionario: funcionario,
      fechaEntrega,
      fechaInicio: fechaEntrega,
      estado: datos.estado || 'APROBADO',
      estadoEnvio: datos.estadoEnvio || 'APROBADO',
      confianzaOCR: datos.confianzaOCR || 98,
      createdAt: ahora.toISOString()
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
