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

// ── Utilidades internas de las secciones nuevas (evidencias, turnos, reportes, nómina) ──

// Construye la query string ("?a=1&b=2") descartando parámetros vacíos
const construirQuery = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') query.append(clave, valor)
  })
  const texto = query.toString()
  return texto ? `?${texto}` : ''
}

// Interpreta una respuesta JSON del estilo del repo { success, data|message }.
// Sesión expirada (401): cierra sesión y manda al login, igual que obtenerTodas.
const leerJsonOk = async (res, mensajeError) => {
  if (res.status === 401) {
    authService.logout()
    window.location.href = '/login'
    throw new Error('Sesión expirada. Inicie sesión nuevamente.')
  }
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    // Respuesta sin JSON (p. ej. HTML de un proxy caído): cae al error genérico
  }
  if (!res.ok || !data || !data.success) {
    throw new Error((data && data.message) || mensajeError || `El servidor respondió ${res.status}`)
  }
  return data
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
        } else if (res.status === 409 || res.status === 400) {
          // El servidor ya dictaminó/cerró ese registro por otra vía (ej: otra
          // pestaña llegó antes, o el periodo ya se envió a nómina): el
          // dictamen local queda descartado — prevalece el estado del servidor
          const lista = obtenerDbLocal()
          const idx = lista.findIndex((x) => String(x.id) === String(h.id))
          if (idx !== -1) {
            lista[idx] = { ...lista[idx], dictamenPendiente: undefined }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {}
          }
        } else if (res.status === 401) {
          break // Sin sesión no tiene sentido seguir
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en la próxima oportunidad
      }
    }
    return sincronizados
  },

  // ────────────────────────────────────────────────────────────────
  // EVIDENCIAS FOTOGRÁFICAS (app externa de campo → revisión interna)
  // ────────────────────────────────────────────────────────────────

  /**
   * Lista las evidencias con filtros opcionales
   * ({ estadoEvidencia, cedula, desde, hasta, cuadrillaArea, horaExtraId }).
   * La respuesta NUNCA incluye fotoBase64: las fotos se piden por separado.
   */
  async listarEvidencias(params = {}) {
    const res = await fetch(`${API_BASE}/evidencias${construirQuery(params)}`, {
      headers: authService.getAuthHeader()
    })
    const data = await leerJsonOk(res, 'No fue posible listar las evidencias.')
    const cuerpo = data.data
    if (Array.isArray(cuerpo)) return cuerpo
    if (cuerpo && Array.isArray(cuerpo.evidencias)) return cuerpo.evidencias
    return []
  },

  /**
   * Descarga la foto de una evidencia como URL de objeto (fetch blob con
   * Authorization, mismo patrón que radicadosService.obtenerArchivoRadicado).
   * Quien llama debe revocar la URL (URL.revokeObjectURL) al cerrar el visor.
   */
  async obtenerFotoEvidencia(id) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(`${API_BASE}/evidencias/${id}/foto`, {
        headers: authService.getAuthHeader(),
        signal: controller.signal
      })
      if (!res.ok) {
        const error = new Error(
          res.status === 404
            ? 'La evidencia no tiene foto disponible'
            : `No fue posible obtener la foto (servidor respondió ${res.status})`
        )
        error.status = res.status
        throw error
      }
      const blob = await res.blob()
      return { url: URL.createObjectURL(blob), mime: blob.type || '' }
    } catch (e) {
      if (e && e.status) throw e
      throw new Error(
        e && e.name === 'AbortError'
          ? 'Tiempo de espera agotado al descargar la foto.'
          : 'No hubo conexión con el servidor al solicitar la foto.'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  },

  /**
   * Registra el dictamen de revisión de las evidencias de un HoraExtra
   * ({ estadoEvidencia: 'REVISADA'|'OBSERVADA', observaciones }).
   */
  async revisarEvidencia(horaExtraId, { estadoEvidencia, observaciones }) {
    const res = await fetch(`${API_BASE}/evidencias/revisar/${horaExtraId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ estadoEvidencia, observaciones: observaciones || '' })
    })
    const data = await leerJsonOk(res, 'No fue posible registrar la revisión de la evidencia.')
    return data.data || null
  },

  // ────────────────────────────────────────────────────────────────
  // TURNOS Y FESTIVOS
  // ────────────────────────────────────────────────────────────────

  /** Lista turnos; con { inactivos: true } incluye los desactivados. */
  async listarTurnos(params = {}) {
    const res = await fetch(`${API_BASE}/turnos${construirQuery(params)}`, {
      headers: authService.getAuthHeader()
    })
    const data = await leerJsonOk(res, 'No fue posible listar los turnos.')
    if (Array.isArray(data.data)) return data.data
    if (data.data && Array.isArray(data.data.turnos)) return data.data.turnos
    return []
  },

  async crearTurno(datos) {
    const res = await fetch(`${API_BASE}/turnos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    })
    const data = await leerJsonOk(res, 'No fue posible crear el turno.')
    return data.data || null
  },

  async actualizarTurno(id, datos) {
    const res = await fetch(`${API_BASE}/turnos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    })
    const data = await leerJsonOk(res, 'No fue posible actualizar el turno.')
    return data.data || null
  },

  /** Desactivación lógica del turno (activo=false; el historial lo conserva). */
  async eliminarTurno(id) {
    const res = await fetch(`${API_BASE}/turnos/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    })
    const data = await leerJsonOk(res, 'No fue posible desactivar el turno.')
    return data.data || null
  },

  /** Festivos de un año: { anio, total, festivos: [{ fecha, descripcion }] }. */
  async festivos(anio) {
    const res = await fetch(`${API_BASE}/festivos/${anio}`, {
      headers: authService.getAuthHeader()
    })
    const data = await leerJsonOk(res, `No fue posible obtener los festivos del año ${anio}.`)
    return data.data || null
  },

  // ────────────────────────────────────────────────────────────────
  // REPORTES Y CIERRE DE NÓMINA
  // ────────────────────────────────────────────────────────────────

  /** Resumen mensual del periodo (objeto con totales según el backend). */
  async reporteMensual(mes, anio, cuadrillaArea) {
    const res = await fetch(
      `${API_BASE}/reportes/mensual${construirQuery({ mes, anio, cuadrillaArea })}`,
      { headers: authService.getAuthHeader() }
    )
    const data = await leerJsonOk(res, 'No fue posible obtener el reporte mensual.')
    return data.data || null
  },

  /**
   * Descarga el CSV del periodo (attachment con BOM y separador ";").
   * Dispara la descarga en el navegador como horas-extras-YYYY-MM.csv.
   */
  async descargarCsv(mes, anio) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(`${API_BASE}/reportes/csv${construirQuery({ mes, anio })}`, {
        headers: authService.getAuthHeader(),
        signal: controller.signal
      })
      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        throw new Error('Sesión expirada. Inicie sesión nuevamente.')
      }
      if (!res.ok) {
        let data = null
        try {
          data = await res.json()
        } catch (e) {
          // Sin cuerpo JSON legible
        }
        throw new Error(
          (data && data.message) ||
            `No fue posible generar el CSV (servidor respondió ${res.status})`
        )
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      const periodo = `${anio}-${String(mes).padStart(2, '0')}`
      enlace.href = url
      enlace.download = `horas-extras-${periodo}.csv`
      document.body.appendChild(enlace)
      enlace.click()
      document.body.removeChild(enlace)
      // Margen prudente antes de revocar: descargas lentas en móviles
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      return true
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado al generar el CSV.')
      }
      throw e
    } finally {
      clearTimeout(timeoutId)
    }
  },

  /** Agregados del dashboard mensual (la vista normaliza la forma). */
  async dashboard(mes, anio) {
    const res = await fetch(`${API_BASE}/dashboard${construirQuery({ mes, anio })}`, {
      headers: authService.getAuthHeader()
    })
    const data = await leerJsonOk(res, 'No fue posible obtener el dashboard del periodo.')
    return data.data || null
  }
}

export default horasExtrasService
