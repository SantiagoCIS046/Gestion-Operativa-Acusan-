import authService from '../../auth/services/authService.js'

const API_BASE = '/api/horas-extras'
const STORAGE_KEY = 'acuasan_horas_v2'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Caché local (espejo del servidor + dictámenes pendientes sin conexión) ──
const obtenerDbLocal = () => {
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

const guardarDbLocal = (lista) => {
  // El fallo de cuota NO se traga: se propaga para informar honestamente.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
}

export const horasExtrasService = {
  /**
   * Obtiene todas las horas extras desde la base de datos (fuente de verdad).
   * Los dictámenes hechos sin conexión (dictamenPendiente) prevalecen sobre
   * el estado del servidor para que el usuario vea su propia decisión, y la
   * caché NUNCA se pisa con una lista vacía si hay pendientes.
   */
  async obtenerTodas() {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)

      const res = await fetch(API_BASE, {
        headers: authService.getAuthHeader(),
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
        if (data && data.success && Array.isArray(data.data)) {
          const pendientes = obtenerDbLocal().filter((h) => h.dictamenPendiente)
          if (data.data.length > 0 || pendientes.length === 0) {
            // Mezclar: estado oficial del servidor + overrides locales pendientes
            const porId = new Map(pendientes.map((h) => [String(h.id), h]))
            const mezclada = data.data.map(
              (h) => (porId.has(String(h.id)) ? { ...h, ...porId.get(String(h.id)) } : h)
            )
            try {
              guardarDbLocal(mezclada)
            } catch (eCuota) {
              console.warn('No se pudo actualizar el espejo local de horas extras:', eCuota.message)
            }
            return mezclada
          }
          return [...obtenerDbLocal()]
        }
      }

      return obtenerDbLocal()
    } catch (error) {
      return obtenerDbLocal()
    }
  },

  /**
   * Dictamina (aprueba/rechaza) un registro de horas extras.
   * Ante fallo de red el dictamen queda pendiente en el caché (estado
   * optimista + dictamenPendiente) y se publica en la próxima sincronización.
   */
  async dictaminar(item, { estado, autorizadoPor, observaciones }) {
    const lista = obtenerDbLocal()
    const idx = lista.findIndex((h) => String(h.id) === String(item.id))

    try {
      const res = await fetch(`${API_BASE}/${item.id}/dictamen`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ estado, autorizadoPor, observaciones: observaciones || '' })
      })

      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        throw new Error('Sesión expirada. Inicie sesión nuevamente.')
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          if (idx !== -1) {
            lista[idx] = { ...lista[idx], ...(data.data || { estado }), dictamenPendiente: undefined }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {
              console.warn('Espejo local sin espacio:', eCuota.message)
            }
          }
          return { origen: 'SERVIDOR', data: (idx !== -1 ? lista[idx] : data.data) }
        }
        throw new Error((data && data.message) || 'Respuesta inválida del servidor')
      }
      if (res.status === 404) {
        // Fue eliminada desde otro equipo: no debe revivir desde el espejo
        if (idx !== -1) {
          try {
            guardarDbLocal(lista.filter((h) => String(h.id) !== String(item.id)))
          } catch (eCuota) {}
        }
        return { origen: 'NO_ENCONTRADA' }
      }
      throw new Error(`El servidor respondió ${res.status}`)
    } catch (e) {
      if (e.message && e.message.startsWith('Sesión expirada')) throw e

      // Fallo de red/5xx: el dictamen queda pendiente en el caché y se
      // reintenta en la próxima sincronización (nunca se pierde ni se finge).
      if (idx !== -1) {
        lista[idx] = {
          ...lista[idx],
          estado,
          autorizadoPor,
          dictamenPendiente: { estado, autorizadoPor, observaciones: observaciones || '' }
        }
        try {
          guardarDbLocal(lista)
        } catch (eCuota) {
          console.warn('Espejo local sin espacio para el dictamen pendiente:', eCuota.message)
        }
        return { origen: 'LOCAL', data: lista[idx] }
      }
      throw new Error('No se pudo dictaminar: sin conexión con el servidor.')
    }
  },

  /**
   * Reintenta publicar los dictámenes guardados localmente sin conexión.
   * Devuelve la cantidad sincronizados. Lock (Web Locks / flag módulo): dos
   * pestañas abiertas a la vez no duplican envíos.
   */
  async sincronizarPendientes() {
    const nombreLock = 'acuasan-sync-horas'
    if (navigator.locks && typeof navigator.locks.request === 'function') {
      try {
        return await navigator.locks.request(nombreLock, { ifAvailable: true }, async (lock) => {
          if (!lock) return 0 // Otra pestaña ya está sincronizando
          return await this._ejecutarSincronizacion()
        })
      } catch (e) {
        return 0
      }
    }
    if (this._sincronizando) return 0
    this._sincronizando = true
    try {
      return await this._ejecutarSincronizacion()
    } finally {
      this._sincronizando = false
    }
  },

  async _ejecutarSincronizacion() {
    const pendientes = obtenerDbLocal().filter((h) => h.dictamenPendiente)
    let sincronizados = 0
    for (const h of pendientes) {
      try {
        const res = await fetch(`${API_BASE}/${h.id}/dictamen`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(h.dictamenPendiente)
        })
        if (res.ok) {
          const data = await res.json()
          const lista = obtenerDbLocal()
          const idx = lista.findIndex((x) => String(x.id) === String(h.id))
          if (idx !== -1) {
            lista[idx] = { ...lista[idx], ...(data?.data || {}), dictamenPendiente: undefined }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {
              console.warn('Espejo local sin espacio:', eCuota.message)
            }
          }
          sincronizados++
        } else if (res.status === 404) {
          // Eliminada desde otro equipo: no debe revivir desde el espejo
          const lista = obtenerDbLocal().filter((x) => String(x.id) !== String(h.id))
          try {
            guardarDbLocal(lista)
          } catch (eCuota) {}
        } else if (res.status === 401) {
          break // Sin sesión no tiene sentido seguir
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en la próxima oportunidad
      }
    }
    return sincronizados
  }
}

export default horasExtrasService
