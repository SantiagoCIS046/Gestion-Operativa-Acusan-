import authService from '../../auth/services/authService.js'

const API_BASE = '/api/pqr'
const STORAGE_KEY = 'acuasan_pqr_v2'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Caché local (espejo del servidor + registros provisionales sin conexión) ──
// Las PQR no llevan adjuntos: el espejo es liviano y no necesita sanitización.
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

// Identificador de cliente para idempotencia de la sincronización (dedupe server-side)
const generarIdLocal = () =>
  (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

// Registro provisional local: id "PQR-LOCAL-<ts>" o numérico (Date.now() del
// esquema antiguo). Los ids de MongoDB son ObjectId de 24 caracteres.
const esIdLocalPQR = (id) => {
  const s = String(id || '')
  return s.includes('-LOCAL-') || /^\d{12,14}$/.test(s)
}

const esPendienteLocal = (p) => p.sincronizado === false || esIdLocalPQR(p.id)

// Reemplaza/inserta un registro en la caché local sin duplicados
const fusionarEnCache = (item) => {
  const lista = obtenerDbLocal()
  const filtrada = lista.filter(
    (p) => String(p.id) !== String(item.id) && String(p.radicado) !== String(item.radicado)
  )
  guardarDbLocal([item, ...filtrada])
}

export const pqrService = {
  /**
   * Obtiene todas las PQR desde la base de datos central (fuente de verdad).
   * La caché local NUNCA se pisa con una lista vacía del servidor y los
   * registros provisionales (sin conexión) se conservan y se muestran al final.
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
          const delServidor = data.data
          const localesPendientes = obtenerDbLocal().filter(esPendienteLocal)
          if (delServidor.length > 0 || localesPendientes.length === 0) {
            try {
              guardarDbLocal([...localesPendientes, ...delServidor])
            } catch (eCuota) {
              console.warn('No se pudo actualizar el espejo local de PQR:', eCuota.message)
            }
          }
          return [...delServidor, ...localesPendientes].sort(
            (a, b) => new Date(b.fechaRadicado) - new Date(a.fechaRadicado)
          )
        }
      }

      return obtenerDbLocal()
    } catch (error) {
      return obtenerDbLocal()
    }
  },

  /**
   * Radica una PQR. El backend es la fuente de verdad (numeración y fechas).
   * Ante un fallo TRANSITORIO (5xx / caída de red) se reintenta una vez; si el
   * backend sigue sin responder, se guarda un provisional local marcado como
   * pendiente de sincronización (origen: 'LOCAL') — nunca se informa como
   * guardado en la nube.
   */
  async crear(datos) {
    const idLocal = datos.idLocal || generarIdLocal()
    const payload = { ...datos, idLocal }

    const enviarAlServidor = async () => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      })

      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        throw new Error('Sesión expirada. Inicie sesión nuevamente.')
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data.success && data.data) {
          try {
            fusionarEnCache(data.data)
          } catch (eCuota) {
            console.warn('Espejo local sin espacio; la PQR SÍ está en la BD:', eCuota.message)
          }
          return { ...data.data, origen: 'SERVIDOR' }
        }
        throw new Error((data && data.message) || 'El servidor rechazó la PQR.')
      }
      const error = new Error(`El servidor respondió ${res.status}`)
      error.status = res.status
      throw error
    }

    try {
      return await enviarAlServidor()
    } catch (ePrimer) {
      if (ePrimer.message && ePrimer.message.startsWith('Sesión expirada')) throw ePrimer

      const esTransitorio = ePrimer.status === undefined || ePrimer.status >= 500
      if (esTransitorio) {
        try {
          await new Promise((resolver) => setTimeout(resolver, 1500))
          return await enviarAlServidor()
        } catch (eSegundo) {
          if (eSegundo.message && eSegundo.message.startsWith('Sesión expirada')) throw eSegundo
          return this._guardarPendienteLocal(datos, idLocal, eSegundo)
        }
      }
      return this._guardarPendienteLocal(datos, idLocal, ePrimer)
    }
  },

  /**
   * Fallback offline: persiste la PQR como provisional local
   * (sincronizado: false, origen: 'LOCAL') y devuelve el registro guardado.
   */
  _guardarPendienteLocal(datos, idLocal, errorCausa) {
    console.warn(
      'Backend no disponible (reintentos agotados), PQR guardada localmente (pendiente de sincronización):',
      errorCausa.message
    )
    const ahora = new Date()
    const fVenc = new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000)
    const registro = {
      ...datos,
      idLocal,
      id: `PQR-LOCAL-${Date.now()}`,
      radicado: `PQR-LOCAL-${Date.now()}`,
      fechaRadicado: ahora.toISOString(),
      fechaVencimiento: fVenc.toISOString(),
      estado: datos.estado || 'ABIERTO',
      prioridad: datos.prioridad || 'MEDIA',
      sincronizado: false,
      origen: 'LOCAL'
    }
    try {
      guardarDbLocal([registro, ...obtenerDbLocal()])
    } catch (eCuota) {
      throw new Error(
        'No hay espacio en el almacenamiento local del navegador y el servidor no responde. ' +
        'Libere espacio e intente de nuevo.'
      )
    }
    return { ...registro, origen: 'LOCAL' }
  },

  /**
   * Registra la respuesta oficial (y el nuevo estado) de una PQR.
   * Provisional local: se actualiza en el caché y se publicará completa en la
   * próxima sincronización. PQR del servidor: PUT directo; ante fallo de red se
   * marca pendienteRespuesta en el caché (estado optimista) y se reintenta luego.
   */
  async responder(pqr, { respuestaOficial, respondidoPor, nuevoEstado }) {
    const lista = obtenerDbLocal()
    const idx = lista.findIndex(
      (p) => String(p.id) === String(pqr.id) || String(p.radicado) === String(pqr.radicado)
    )
    const esLocal = esIdLocalPQR(pqr.id) || (idx !== -1 && lista[idx].sincronizado === false)

    if (esLocal) {
      if (idx === -1) {
        lista.unshift({ ...pqr })
      }
      const i = idx === -1 ? 0 : idx
      lista[i] = {
        ...lista[i],
        estado: nuevoEstado,
        respuestaOficial,
        respondidoPor,
        fechaRespuesta: new Date().toISOString()
      }
      try {
        guardarDbLocal(lista)
      } catch (eCuota) {
        console.warn('Espejo local sin espacio para la respuesta:', eCuota.message)
      }
      return { origen: 'LOCAL', data: lista[i] }
    }

    try {
      const res = await fetch(`${API_BASE}/${pqr.id}/responder`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ respuestaOficial, respondidoPor, nuevoEstado })
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
            lista[idx] = { ...lista[idx], ...(data.data || {}), pendienteRespuesta: undefined }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {
              console.warn('Espejo local sin espacio:', eCuota.message)
            }
          }
          return { origen: 'SERVIDOR', data: data.data }
        }
        throw new Error((data && data.message) || 'Respuesta inválida del servidor')
      }
      throw new Error(`El servidor respondió ${res.status}`)
    } catch (e) {
      if (e.message && e.message.startsWith('Sesión expirada')) throw e

      // Fallo de red/5xx: el cambio queda pendiente en el caché y se reintenta
      // en la próxima sincronización (nunca se pierde ni se finge publicado).
      if (idx !== -1) {
        lista[idx] = {
          ...lista[idx],
          estado: nuevoEstado,
          respuestaOficial,
          respondidoPor,
          pendienteRespuesta: { respuestaOficial, respondidoPor, nuevoEstado }
        }
        try {
          guardarDbLocal(lista)
        } catch (eCuota) {
          console.warn('Espejo local sin espacio para la respuesta pendiente:', eCuota.message)
        }
        return { origen: 'LOCAL', data: lista[idx] }
      }
      throw new Error('No se pudo registrar la respuesta: sin conexión con el servidor.')
    }
  },

  /**
   * Escala la PQR a cuadrilla técnica (estado EN_TRAMITE).
   */
  async escalar(pqr) {
    return this.responder(pqr, {
      respuestaOficial:
        pqr.respuestaOficial || 'Asignada a cuadrilla técnica operativa para visita en campo.',
      respondidoPor: authService.getUsuarioActual()?.nombre || 'Atención al Usuario Acuasan',
      nuevoEstado: 'EN_TRAMITE'
    })
  },

  /**
   * Reintenta enviar a la nube las PQR guardadas localmente sin conexión.
   * Devuelve la cantidad sincronizadas. Lock (Web Locks / flag módulo): dos
   * pestañas abiertas a la vez no duplican envíos; idLocal deduplica en el
   * servidor si una respuesta se pierde.
   */
  async sincronizarPendientes() {
    const nombreLock = 'acuosan-sync-pqr'
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
    let sincronizados = 0

    // 1) Altas pendientes: POST idempotente por idLocal. Si la PQR local ya
    //    traía respuesta/estado (respondida offline), viajan en el mismo POST.
    const pendientes = obtenerDbLocal().filter((p) => p.sincronizado === false || esIdLocalPQR(p.id))
    for (const p of pendientes) {
      const { sincronizado, origen, id, radicado, pendienteRespuesta, ...payload } = p
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.success && data.data) {
            const lista = obtenerDbLocal().filter(
              (x) => String(x.id) !== String(p.id) && String(x.radicado) !== String(p.radicado)
            )
            try {
              guardarDbLocal([data.data, ...lista])
            } catch (eCuota) {
              console.warn('Espejo local sin espacio tras sincronizar PQR:', eCuota.message)
            }
            sincronizados++
          }
        } else if (res.status === 401) {
          break // Sin sesión no tiene sentido seguir; obtenerTodas redirige
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en la próxima oportunidad
      }
    }

    // 2) Respuestas pendientes sobre PQR ya publicadas en el servidor
    const conRespuestaPendiente = obtenerDbLocal().filter(
      (p) => p.pendienteRespuesta && !esPendienteLocal(p)
    )
    for (const p of conRespuestaPendiente) {
      try {
        const res = await fetch(`${API_BASE}/${p.id}/responder`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(p.pendienteRespuesta)
        })
        if (res.ok) {
          const data = await res.json()
          const lista = obtenerDbLocal()
          const idx = lista.findIndex((x) => String(x.id) === String(p.id))
          if (idx !== -1) {
            lista[idx] = { ...lista[idx], ...(data?.data || {}), pendienteRespuesta: undefined }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {
              console.warn('Espejo local sin espacio:', eCuota.message)
            }
          }
          sincronizados++
        } else if (res.status === 404) {
          // Fue eliminada desde otro equipo: no debe revivir desde el espejo
          const lista = obtenerDbLocal().filter((x) => String(x.id) !== String(p.id))
          try {
            guardarDbLocal(lista)
          } catch (eCuota) {}
        } else if (res.status === 401) {
          break
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en la próxima oportunidad
      }
    }

    return sincronizados
  }
}

export default pqrService
