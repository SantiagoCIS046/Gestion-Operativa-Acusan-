import authService from '../../auth/services/authService.js'

/**
 * ============================================================================
 * RADICADOS — CAPA DE DATOS — ACUASAN E.S.P.
 * ============================================================================
 * CRUD directo contra el backend + envío del texto extraído del documento
 * (el OCR lo hace ocrRadicados.js en el navegador) para que el servidor lo
 * traduzca a los campos institucionales. Sin caché local, sin cola offline.
 * ============================================================================
 */

const API_BASE = '/api/radicados'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// Tabla rasa del espejo local de la era offline (RAD-LOCAL, copia del
// servidor): ya nadie lo lee, se limpia una única vez al cargar el módulo.
try {
  localStorage.removeItem('acuusan_radicados_v2')
} catch (e) { /* navegador sin localStorage */ }

// Notificación simple dentro de la pestaña: quien crea/edita/elimina avisa y
// las vistas montadas se refrescan al instante (el sondeo cubre el resto).
const notificarCambio = (evento = 'ACTUALIZAR', payload = null) => {
  try {
    window.dispatchEvent(new CustomEvent('acuusan-radicados-cambio', { detail: { evento, payload } }))
  } catch (e) {}
}

// Traduce una respuesta HTTP fallida a Error con el mensaje real del servidor.
// El 401 (sesión muerta) expulsa al login como en el resto de la app.
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

export const radicadosService = {
  // Origen del último obtenerTodos(): 'servidor' | null. La vista de Gerencia
  // lo usa para el indicador En vivo / sin conexión.
  ultimoOrigen: null,

  /**
   * Suscribe una vista a los cambios de radicados (creación, edición,
   * eliminación) para refrescar el tablero al instante.
   */
  suscribirCambios(callback) {
    if (typeof window === 'undefined') return () => {}
    const onCustomEvent = (e) => callback(e?.detail || {})
    window.addEventListener('acuusan-radicados-cambio', onCustomEvent)
    return () => window.removeEventListener('acuusan-radicados-cambio', onCustomEvent)
  },

  /**
   * Lista completa desde el servidor. Sin caché: si el backend no responde
   * devuelve [] y ultimoOrigen queda en null (indicador de sin conexión).
   */
  async obtenerTodos() {
    try {
      const res = await fetch(API_BASE, {
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
      return [...data.data].sort((a, b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion))
    } catch (e) {
      this.ultimoOrigen = null
      return []
    }
  },

  /**
   * Crea un radicado. El backend es la fuente de verdad (numeración y fechas).
   */
  async crear(datos) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    })
    if (!res.ok) await exigirRespuestaOk(res, 'El servidor rechazó el radicado.')
    const data = await res.json()
    if (data && data.success && data.data) {
      notificarCambio('CREAR', data.data)
      return data.data
    }
    throw new Error((data && data.message) || 'Respuesta inesperada del servidor.')
  },

  /** Actualiza el estado de un radicado. */
  async actualizarEstado(id, estado) {
    const res = await fetch(`${API_BASE}/${id}/estado`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ estado })
    })
    if (!res.ok) await exigirRespuestaOk(res, 'No se pudo actualizar el estado.')
    const data = await res.json()
    if (data && data.success) {
      notificarCambio('ESTADO', data.data || { id, estado })
      return data.data || { id, estado }
    }
    throw new Error((data && data.message) || 'Respuesta inválida del servidor.')
  },

  /**
   * Descarga el documento original del radicado como URL de objeto (blob).
   * Devuelve { url, mime } — el mime real del blob sirve para que el visor
   * decida <object>/<iframe> PDF vs <img> sin depender del nombre del archivo.
   * El error lleva .status: 404 = el radicado no tiene documento adjunto.
   */
  async obtenerArchivoRadicado(id) {
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
            ? 'El radicado no tiene documento adjunto'
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
   * Adjunta (o reemplaza) el documento original de un radicado ya creado.
   */
  async adjuntarArchivo(id, file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'))
      reader.readAsDataURL(file)
    })

    const res = await fetch(`${API_BASE}/${id}/archivo`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ archivoBase64: dataUrl, archivoNombre: file.name })
    })
    if (!res.ok) await exigirRespuestaOk(res, 'No se pudo adjuntar el documento.')
    const data = await res.json()
    if (data && data.success && data.data) {
      notificarCambio('ADJUNTAR_ARCHIVO', data.data)
      return data.data
    }
    throw new Error('Respuesta inesperada del servidor al adjuntar el documento.')
  },

  /**
   * Traduce el texto leído del documento (OCR del navegador) en los campos
   * del radicado. Solo devuelve lo que realmente encontró en el texto.
   */
  async extraerCampos(texto) {
    const res = await fetch(`${API_BASE}/extraer-campos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ texto })
    })
    if (!res.ok) await exigirRespuestaOk(res, 'No fue posible interpretar el texto del documento.')
    const data = await res.json()
    if (data && data.success && data.data) return data.data
    throw new Error('Respuesta inesperada del servidor al interpretar el documento.')
  },

  /**
   * Descarga el reporte de radicados. Va por fetch (no por <a href>) porque
   * la ruta exige el token de sesión en el header de autorización.
   */
  async descargarExcel() {
    const res = await fetch(`${API_BASE}/descargar-excel`, {
      headers: authService.getAuthHeader()
    })
    if (!res.ok) await exigirRespuestaOk(res, 'No fue posible generar el reporte.')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = 'radicados-acuasan.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(url)
    }
    return true
  },

  /**
   * Elimina un radicado por su ID (acepta también el objeto completo).
   * Un 404 se trata como éxito: ya fue eliminado desde otro equipo.
   */
  async eliminar(rad) {
    const id = rad && typeof rad === 'object' ? rad.id : rad
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (res.ok || res.status === 404) {
      notificarCambio('ELIMINAR', { id })
      let mensaje = 'Radicado eliminado correctamente'
      try {
        const data = await res.json()
        if (data && data.message) mensaje = data.message
      } catch (e) { /* sin cuerpo: mensaje por defecto */ }
      return { success: true, message: mensaje }
    }
    await exigirRespuestaOk(res, 'No se pudo eliminar el radicado.')
  }
}

export default radicadosService
