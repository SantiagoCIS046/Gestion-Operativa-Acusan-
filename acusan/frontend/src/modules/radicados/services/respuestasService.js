import authService from '../../auth/services/authService.js'

/**
 * ============================================================================
 * RADICADOS — OFICIOS DE RESPUESTA — CAPA DE DATOS — ACUASAN E.S.P.
 * ============================================================================
 * Archivo histórico de las respuestas de los radicados: cada oficio de
 * salida escaneado (comprimido y leído por OCR en el navegador, igual que
 * los radicados) se archiva en la base de datos enlazado a su radicado
 * padre. Sin caché local, sin cola offline: el servidor es la fuente de
 * verdad. Mismos contratos y convenciones que radicadosService.js.
 * ============================================================================
 */

const API_BASE = '/api/radicados/respuestas'
const API_EXTRAER = '/api/radicados/extraer-campos-respuesta'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// Notificación dentro de la pestaña: quien archiva/elimina una respuesta
// avisa y las vistas montadas (Radicados y Gerencia) se refrescan al
// instante (el sondeo cubre el resto). Prefijo técnico con dos U, como
// todos los CustomEvent del proyecto.
const notificarCambio = (evento = 'ACTUALIZAR', payload = null) => {
  try {
    window.dispatchEvent(new CustomEvent('acuusan-respuestas-cambio', { detail: { evento, payload } }))
    // Archivar una respuesta cambia al radicado padre (queda Resuelto): las
    // vistas de radicados también se enteran al instante con su evento propio.
    if (evento === 'CREAR' || evento === 'ELIMINAR') {
      window.dispatchEvent(new CustomEvent('acuusan-radicados-cambio', { detail: { evento: 'RESPUESTA', payload } }))
    }
  } catch (e) {}
}

// Traduce una respuesta HTTP fallida a Error con el mensaje real del
// servidor. El 401 (sesión muerta) expulsa al login como en el resto de la app.
const exigirRespuestaOk = async (res, porDefecto) => {
  if (res.status === 401) {
    authService.logout()
    window.location.href = '/login'
    throw new Error('Sesión expirada. Inicie sesión nuevamente.')
  }
  let msg = porDefecto || `El servidor respondió ${res.status}`
  try {
    const data = await res.json()
    if (data && data.message) msg = data.message
  } catch (e) { /* cuerpo no-JSON: queda el mensaje por defecto */ }
  const error = new Error(msg)
  error.status = res.status
  throw error
}

export const respuestasService = {
  // Origen del último obtenerTodas(): 'servidor' | null. Sirve para distinguir
  // "sin respuestas" de "sin conexión" (obtenerTodas devuelve [] en ambas).
  ultimoOrigen: null,

  /**
   * Suscribe una vista a los cambios de respuestas (archivada, eliminada)
   * para refrescar al instante. Devuelve la función de desuscripción.
   */
  suscribirCambios(callback) {
    if (typeof window === 'undefined') return () => {}
    const onCustomEvent = (e) => callback(e?.detail || {})
    window.addEventListener('acuusan-respuestas-cambio', onCustomEvent)
    return () => window.removeEventListener('acuusan-respuestas-cambio', onCustomEvent)
  },

  /**
   * Lista las respuestas archivadas. Con radicadoId, las de ese radicado;
   * sin él, todas (archivo general). Sin caché: si el backend no responde
   * devuelve [] y ultimoOrigen queda en null (indicador de sin conexión).
   */
  async obtenerTodas(radicadoId = null) {
    const url = radicadoId ? `${API_BASE}?radicadoId=${encodeURIComponent(radicadoId)}` : API_BASE
    try {
      const res = await fetch(url, {
        headers: authService.getAuthHeader(),
        cache: 'no-store'
      })
      if (res.status === 401) {
        authService.logout()
        window.location.href = '/login'
        return []
      }
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
      const data = await res.json()
      if (!(data && data.success && Array.isArray(data.data))) {
        throw new Error('Respuesta inesperada del servidor.')
      }
      this.ultimoOrigen = 'servidor'
      return data.data
    } catch (e) {
      this.ultimoOrigen = null
      return []
    }
  },

  /**
   * Archiva la respuesta de un radicado. El backend es la fuente de verdad:
   * valida el radicado padre, toma su numeroRadicado y lo marca Resuelto.
   */
  async crear(datos) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    })
    if (!res.ok) await exigirRespuestaOk(res, 'El servidor rechazó la respuesta.')
    const data = await res.json()
    if (data && data.success && data.data) {
      notificarCambio('CREAR', data.data)
      return data.data
    }
    throw new Error((data && data.message) || 'Respuesta inesperada del servidor.')
  },

  /**
   * Descarga el documento de una respuesta como URL de objeto (blob).
   * Devuelve { url, mime } — el mime real del blob sirve para que el visor
   * decida <object>/<iframe> PDF vs <img>. El error lleva .status:
   * 404 = la respuesta no tiene documento adjunto.
   */
  async obtenerArchivoRespuesta(id) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`${API_BASE}/${id}/archivo`, {
        headers: authService.getAuthHeader(),
        signal: controller.signal
      })
      if (!res.ok) {
        const error = new Error(
          res.status === 404
            ? 'La respuesta no tiene documento adjunto'
            : `No fue posible obtener el documento (servidor respondió ${res.status})`
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
          ? 'Tiempo de espera agotado al descargar el documento.'
          : 'No hubo conexión con el servidor al solicitar el documento.'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  },

  /**
   * Traduce el texto leído del oficio de respuesta (OCR del navegador) en
   * los campos de la respuesta. Solo devuelve lo que encontró en el texto.
   */
  async extraerCampos(texto) {
    const res = await fetch(API_EXTRAER, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ texto })
    })
    if (!res.ok) await exigirRespuestaOk(res, 'No fue posible interpretar el texto del oficio.')
    const data = await res.json()
    if (data && data.success && data.data) return data.data
    throw new Error('Respuesta inesperada del servidor al interpretar el oficio.')
  },

  /**
   * Elimina una respuesta archivada por su ID (acepta también el objeto).
   * Un 404 se trata como éxito: ya fue eliminada desde otro equipo.
   */
  async eliminar(respuesta) {
    const id = respuesta && typeof respuesta === 'object' ? respuesta.id : respuesta
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (res.ok || res.status === 404) {
      notificarCambio('ELIMINAR', { id })
      let mensaje = 'Respuesta eliminada correctamente'
      try {
        const data = await res.json()
        if (data && data.message) mensaje = data.message
      } catch (e) { /* sin cuerpo: mensaje por defecto */ }
      return { success: true, message: mensaje }
    }
    await exigirRespuestaOk(res, 'No se pudo eliminar la respuesta.')
  }
}

export default respuestasService
