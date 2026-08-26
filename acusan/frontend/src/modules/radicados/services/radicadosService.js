import authService from '../../auth/services/authService.js'
import adjuntosOffline from '../../../services/adjuntosOffline.js'

const API_BASE = '/api/radicados'
const STORAGE_KEY = 'acuasan_radicados_v2'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Caché local (espejo del servidor + registros provisionales sin conexión) ──
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
  // La cuota de localStorage (~5MB) puede agotarse: el fallo NO se traga,
  // se propaga para que el llamador informe honestamente al usuario.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
}

// Nunca persistir el documento Base64 en localStorage (un PDF escaneado de 2MB
// genera ~5.4MB en UTF-16 y desborda la cuota él solo). El archivo vive en la BD;
// el caché local guarda metadatos + hasArchivo, y el documento se sirve por endpoint.
const sanitizarParaCache = (item) => {
  if (!item || typeof item !== 'object') return item
  const { archivoBase64, archivoUrl, ...resto } = item
  return {
    ...resto,
    hasArchivo: resto.hasArchivo || Boolean(archivoBase64) || (typeof archivoUrl === 'string' && archivoUrl.startsWith('data:'))
  }
}

// Identificador de cliente para idempotencia de la sincronización (dedupe server-side)
const generarIdLocal = () =>
  (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

// ── OCR en el navegador: pdfjs-dist (texto embebido + render de páginas) y tesseract.js ──
// Mismo motor que usa el módulo de Permisos. Sin datos simulados: si no hay
// texto legible se lanza error y el usuario completa los campos manualmente.
let _pdfjsCache = null
const getPdfjs = async () => {
  if (_pdfjsCache) return _pdfjsCache
  const pdfjsLib = await import('pdfjs-dist')
  const v = pdfjsLib.version || '4.10.38'
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`
  }
  _pdfjsCache = pdfjsLib
  return pdfjsLib
}

const ejecutarOcrCanvas = async (canvas) => {
  const Tesseract = await import('tesseract.js')
  const res = await Tesseract.recognize(canvas.toDataURL('image/png'), 'spa', {
    logger: () => {},
    tessedit_pageseg_mode: '6',
    tessedit_ocr_engine_mode: '1',
    preserve_interword_spaces: '1'
  })
  return (res && res.data && res.data.text) ? res.data.text : ''
}

const extraerTextoEnNavegador = async (file, onProgress) => {
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  const esImagen = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '')

  if (esImagen) {
    onProgress?.('🔍 Reconociendo imagen con OCR...')
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const img = new Image()
    img.src = dataUrl
    await new Promise((r) => { img.onload = r; img.onerror = r })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth * 2
    canvas.height = img.naturalHeight * 2
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return ejecutarOcrCanvas(canvas)
  }

  if (esPdf) {
    const pdfjsLib = await getPdfjs()
    onProgress?.('📄 Abriendo documento PDF...')
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

    // 1) Texto embebido (PDFs vectoriales)
    let textoCompleto = ''
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      try {
        const textContent = await page.getTextContent()
        const str = textContent.items.map((item) => item.str).join(' ').trim()
        if (str.length > 15) textoCompleto += str + '\n'
      } catch (e) {}
    }
    if (textoCompleto.replace(/\s/g, '').length > 40) return textoCompleto

    // 2) PDF escaneado: renderizar páginas y aplicar OCR
    textoCompleto = ''
    const paginas = Math.min(pdfDoc.numPages, 3)
    for (let n = 1; n <= paginas; n++) {
      onProgress?.(`🖼️ Digitalizando página ${n} de ${paginas} con OCR...`)
      const page = await pdfDoc.getPage(n)
      const viewport = page.getViewport({ scale: 2.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      textoCompleto += (await ejecutarOcrCanvas(canvas)) + '\n'
    }
    return textoCompleto
  }

  // Archivos de texto plano
  if ((file.type || '').startsWith('text/') || /\.(txt|csv|md)$/i.test(file.name || '')) {
    return file.text()
  }

  return ''
}

// Canal BroadcastChannel (para comunicar pestañas/ventanas del navegador en tiempo real)
const canalBroadcast = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('acuasan_radicados_sync')
  : null

export const notificarCambioRadicados = (evento = 'ACTUALIZAR', payload = null) => {
  // 1) Notificar a otras pestañas/ventanas
  if (canalBroadcast) {
    try {
      canalBroadcast.postMessage({ evento, payload, timestamp: Date.now() })
    } catch (e) {}
  }
  // 2) Notificar en la misma pestaña/ventana (para vistas montadas en el mismo SPA)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('acuasan-radicados-cambio', { detail: { evento, payload } }))
    } catch (e) {}
  }
}

// Reemplaza/inserta un registro en la caché local sin duplicados ni Base64
const fusionarEnCache = (item) => {
  const lista = obtenerDbLocal()
  const filtrada = lista.filter(
    (r) => String(r.id) !== String(item.id) && String(r.numeroRadicado) !== String(item.numeroRadicado)
  )
  guardarDbLocal([sanitizarParaCache(item), ...filtrada])
}

export const radicadosService = {
  // Origen del último obtenerTodos(): 'servidor' | 'cache' | null. Como ese
  // método NUNCA rechaza (falla al espejo local), esta bandera es la única
  // forma de que la vista sepa si está viendo datos vivos o guardados.
  ultimoOrigen: null,

  /**
   * Suscribe una vista a los cambios de radicados en tiempo real (creación, edición, sincronización)
   * para actualizar el tablero de Gerencia y de Encargada al instante sin demora de 5s.
   */
  suscribirCambios(callback) {
    if (typeof window === 'undefined') return () => {}

    const onCustomEvent = (e) => callback(e?.detail || {})
    const onBroadcast = (e) => callback(e?.data || {})
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || !e.key) {
        callback({ evento: 'STORAGE', payload: null })
      }
    }

    window.addEventListener('acuasan-radicados-cambio', onCustomEvent)
    if (canalBroadcast) canalBroadcast.addEventListener('message', onBroadcast)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('acuasan-radicados-cambio', onCustomEvent)
      if (canalBroadcast) canalBroadcast.removeEventListener('message', onBroadcast)
      window.removeEventListener('storage', onStorage)
    }
  },

  /**
   * Obtiene todos los radicados desde la base de datos central (fuente de verdad).
   * La caché local NUNCA se pisa con una lista vacía del servidor y los
   * registros provisionales (sin conexión) se conservan y se muestran al final.
   */
  async obtenerTodos() {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)

      const res = await fetch(API_BASE, {
        headers: authService.getAuthHeader(),
        signal: controller.signal,
        // El listado debe reflejar EN VIVO lo que la encargada guarda: si el
        // navegador lo sirviera de su caché HTTP, Gerencia vería una lista
        // vieja aunque el sondeo de 5s se ejecute.
        cache: 'no-store'
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
          const delServidor = data.data.map(sanitizarParaCache)
          const localesPendientes = obtenerDbLocal().filter((r) => r.sincronizado === false)
          if (delServidor.length > 0 || localesPendientes.length === 0) {
            try {
              guardarDbLocal([...localesPendientes, ...delServidor])
            } catch (eCuota) {
              // Cuota llena (caché vieja con Base64): el espejo no se actualiza,
              // pero la respuesta al usuario siempre prioriza los datos del servidor
              console.warn('No se pudo actualizar el espejo local:', eCuota.message)
            }
          }
          this.ultimoOrigen = 'servidor'
          return [...delServidor, ...localesPendientes].sort(
            (a, b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion)
          )
        }
      }

      this.ultimoOrigen = 'cache'
      return obtenerDbLocal()
    } catch (error) {
      this.ultimoOrigen = 'cache'
      return obtenerDbLocal()
    }
  },

  /**
   * Extrae el texto REAL del documento en el navegador (pdfjs/tesseract) y
   * envía ese texto al backend para el parsing de campos institucionales.
   * Sin datos simulados: cualquier fallo se propaga como error.
   */
  async extraerPdf(file, onProgress) {
    const texto = await extraerTextoEnNavegador(file, onProgress)

    if (!texto || !texto.replace(/\s/g, '')) {
      throw new Error('No se pudo extraer texto del documento. Complete los campos manualmente.')
    }

    const res = await fetch(`${API_BASE}/extraer-campos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ texto, nombreArchivo: file.name })
    })

    if (!res.ok) {
      let msg = 'El servidor no pudo analizar el documento.'
      try {
        const data = await res.json()
        if (data && data.message) msg = data.message
      } catch (e) {}
      throw new Error(msg)
    }

    const data = await res.json()
    if (data && data.success && data.data) return data.data
    throw new Error('Respuesta inesperada del servidor al analizar el documento.')
  },

  /**
   * Crea un radicado. El backend es la fuente de verdad (numeración y fechas).
   * Ante un fallo TRANSITORIO (5xx / caída de red) se reintenta una vez antes de
   * caer al local: una intermitencia de segundos de la BD no debe dejar el
   * radicado colgando como pendiente. Si el backend sigue sin responder, se
   * guarda un provisional local marcado como pendiente de sincronización
   * (origen: 'LOCAL') — nunca se informa como guardado en la nube.
   */
  async crear(datos) {
    // Identificador de idempotencia: si la respuesta del POST se pierde y se
    // reintenta, el backend deduplica por idLocal en lugar de crear otro registro.
    const idLocal = datos.idLocal || generarIdLocal()
    const payload = { ...datos, idLocal }

    // Un adjunto cuyo body excede el limit '50mb' de express (~39M caracteres
    // de data URL) recibe 413 SIEMPRE: ni reintentos ni la cola offline lo van
    // a subir jamás. Esos casos van directo a la vía degradada (ver abajo).
    const ADJUNTO_EXCEDE_BODY =
      payload.archivoBase64 && payload.archivoBase64.length > 39_000_000

    const enviarAlServidor = async (sinAdjunto = false) => {
      const cuerpo = sinAdjunto ? { ...payload, archivoBase64: null } : payload
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(cuerpo)
      })

      if (res.status === 401) {
        // Sin logout aquí: crear() encola el radicado PRIMERO y la sesión
        // se limpia después — si no, la redirección mata el guardado.
        throw new Error('Sesión expirada. Inicie sesión nuevamente.')
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data.success && data.data) {
          try {
            fusionarEnCache(data.data)
          } catch (eCuota) {
            console.warn('Espejo local sin espacio; el radicado SÍ está en la BD:', eCuota.message)
          }
          const resultado = { ...data.data, origen: 'SERVIDOR' }
          notificarCambioRadicados('CREAR', resultado)
          return resultado
        }
        throw new Error((data && data.message) || 'El servidor rechazó el radicado.')
      }
      const error = new Error(`El servidor respondió ${res.status}`)
      error.status = res.status
      throw error
    }

    // Degradación honesta por adjunto demasiado grande: el radicado (metadatos)
    // SÍ llega a la BD y Gerencia lo ve al instante; el documento se intenta
    // adjuntar aparte (PUT /:id/archivo) y si tampoco cabe, queda visible sin
    // documento para repararlo después con un archivo más ligero.
    const enviarDegradado = async (causa) => {
      console.warn(
        'Radicado con documento demasiado grande para la plataforma; se guarda sin documento:',
        causa.message
      )
      const creado = await enviarAlServidor(true)
      creado.advertenciaArchivo =
        'El documento excede el límite de la plataforma: el radicado se guardó SIN documento. Adjunte uno más ligero desde el detalle.'
      if (creado && creado.id && payload.archivoBase64) {
        try {
          const res = await fetch(`${API_BASE}/${creado.id}/archivo`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
              archivoBase64: payload.archivoBase64,
              archivoNombre: payload.archivoNombre
            })
          })
          if (res.ok) {
            try {
              fusionarEnCache({ ...creado, hasArchivo: true })
            } catch (eCuota) {}
            delete creado.advertenciaArchivo
          }
        } catch (e) { /* el radicado ya está creado: la advertencia queda */ }
      }
      if (creado.advertenciaArchivo) console.warn(creado.advertenciaArchivo)
      notificarCambioRadicados('CREAR', creado)
      return creado
    }

    // 401: la sesión murió, pero el trabajo del usuario NO se pierde — se
    // encola como pendiente y se publica solo tras re-iniciar sesión (el
    // idLocal evita duplicados server-side). El logout/redirección van AFTER.
    const preservarYExpulsar = async (errorSesion) => {
      try {
        return await this._guardarPendienteLocal(datos, idLocal, errorSesion)
      } catch (eCuota) {
        throw errorSesion
      } finally {
        authService.logout()
        window.location.href = '/login'
      }
    }

    try {
      if (ADJUNTO_EXCEDE_BODY) return await enviarDegradado(new Error('el adjunto excede el límite del body'))
      return await enviarAlServidor()
    } catch (ePrimer) {
      if (ePrimer.message && ePrimer.message.startsWith('Sesión expirada')) {
        return preservarYExpulsar(ePrimer)
      }

      // 413: el body excede el límite de la plataforma (adjunto grande) —
      // rechazo DEFINITIVO: reintentar con el mismo cuerpo solo lo repite.
      if (ePrimer.status === 413) {
        try {
          return await enviarDegradado(ePrimer)
        } catch (eDeg) {
          if (eDeg.message && eDeg.message.startsWith('Sesión expirada')) {
            return preservarYExpulsar(eDeg)
          }
          return this._guardarPendienteLocal(datos, idLocal, eDeg)
        }
      }

      // Fallo de red (sin status) o 5xx = transitorio → un reintento breve.
      const esTransitorio = ePrimer.status === undefined || ePrimer.status >= 500
      if (esTransitorio) {
        try {
          await new Promise((resolver) => setTimeout(resolver, 1500))
          return await enviarAlServidor()
        } catch (eSegundo) {
          if (eSegundo.message && eSegundo.message.startsWith('Sesión expirada')) {
            return preservarYExpulsar(eSegundo)
          }
          return this._guardarPendienteLocal(datos, idLocal, eSegundo)
        }
      }

      // Otros 4xx (400/422…): rechazo definitivo del payload — NO encolar:
      // la cola offline lo reintentaría para siempre sin éxito. El formulario
      // sigue en pantalla para que el usuario corrija lo que se rechazó.
      throw ePrimer
    }
  },

  /**
   * Fallback offline: persiste el radicado como provisional local
   * (sincronizado: false, origen: 'LOCAL') y devuelve el registro guardado.
   */
  async _guardarPendienteLocal(datos, idLocal, errorCausa) {
    console.warn(
      'Backend no disponible (reintentos agotados), radicado guardado localmente (pendiente de sincronización):',
      errorCausa.message
    )
    const ahora = new Date()
    const fVenc = new Date(ahora.getTime() + (parseInt(datos.diasParaVencer) || 10) * 24 * 60 * 60 * 1000)
    const base = {
      ...datos,
      idLocal,
      id: `RAD-LOCAL-${Date.now()}`,
      numeroRadicado: `RAD-LOCAL-${Date.now()}`,
      estado: 'Pendiente',
      fechaRadicacion: ahora.toISOString(),
      fechaVencimiento: fVenc.toISOString(),
      registradoPor: datos.registradoPor || authService.getUsuarioActual()?.nombre || 'Eliana',
      sincronizado: false,
      origen: 'LOCAL'
    }
    const lista = obtenerDbLocal()
    const adjunto = datos.archivoBase64 || (typeof datos.archivoUrl === 'string' ? datos.archivoUrl : '')
    const pesoAdjunto = adjunto.length

    // 1) Adjunto que no cabe en la cuota de localStorage (~5MB): un PDF
    //    escaneado (~2MB) genera ~5.4MB en UTF-16. Se resguarda en IndexedDB
    //    (cuota de cientos de MB) para NO perder el documento; solo si eso
    //    también falla se omite — NUNCA se finge un guardado completo.
    if (pesoAdjunto > 1500000) {
      const guardadoEnIdb = adjunto
        ? await adjuntosOffline.guardarAdjunto(idLocal, {
            dataUrl: adjunto,
            nombre: datos.archivoNombre || ''
          })
        : false
      const registro = guardadoEnIdb
        ? sanitizarParaCache({ ...base, archivoEnIndexedDB: true })
        : sanitizarParaCache({ ...base, archivoOmitido: true })
      try {
        guardarDbLocal([registro, ...lista])
        if (guardadoEnIdb) {
          console.warn('Documento adjunto grande resguardado en IndexedDB: se publicará con el radicado al sincronizar.')
        } else {
          console.warn('Documento adjunto omitido (excede la cuota del navegador): el radicado se publicará sin archivo.')
        }
        notificarCambioRadicados('CREAR_LOCAL', registro)
        return registro
      } catch (eCuota2) {
        if (guardadoEnIdb) adjuntosOffline.eliminarAdjunto(idLocal)
        throw new Error(
          'No hay espacio en el almacenamiento local del navegador y el servidor no responde. ' +
          'Libere espacio (cierre sesiones antiguas o borre el historial local) e intente de nuevo.'
        )
      }
    }

    // 2) Adjunto liviano: intentar con el documento (necesario para publicarlo después)
    try {
      guardarDbLocal([base, ...lista])
      notificarCambioRadicados('CREAR_LOCAL', base)
      return base
    } catch (eCuota) {
      // Sin espacio en localStorage: resguardar el documento en IndexedDB
      // antes de persistir el registro sin Base64 (el documento sobrevive)
      const guardadoEnIdb = adjunto
        ? await adjuntosOffline.guardarAdjunto(idLocal, {
            dataUrl: adjunto,
            nombre: datos.archivoNombre || ''
          })
        : false
      const registro = guardadoEnIdb
        ? sanitizarParaCache({ ...base, archivoEnIndexedDB: true })
        : sanitizarParaCache({ ...base, archivoOmitido: true })
      try {
        guardarDbLocal([registro, ...lista])
        console.warn(
          guardadoEnIdb
            ? 'Cuota de localStorage llena: documento resguardado en IndexedDB para su publicación posterior.'
            : 'Documento adjunto omitido por cuota de almacenamiento local: ' + eCuota.message
        )
        notificarCambioRadicados('CREAR_LOCAL', registro)
        return registro
      } catch (eCuota2) {
        if (guardadoEnIdb) adjuntosOffline.eliminarAdjunto(idLocal)
        throw new Error(
          'No hay espacio en el almacenamiento local del navegador y el servidor no responde. ' +
          'Libere espacio (cierre sesiones antiguas o borre el historial local) e intente de nuevo.'
        )
      }
    }
  },

  /**
   * Reintenta enviar a la nube los radicados guardados localmente sin conexión.
   * Devuelve la cantidad sincronizados. Se llama al montar la vista.
   * Lock (Web Locks / flag módulo): dos pestañas abiertas a la vez no duplican
   * envíos; idLocal deduplica en el servidor si una respuesta se pierde.
   */
  async sincronizarPendientes(opciones = {}) {
    const nombreLock = 'acuasan-sync-radicados'
    if (navigator.locks && typeof navigator.locks.request === 'function') {
      try {
        return await navigator.locks.request(nombreLock, { ifAvailable: true }, async (lock) => {
          if (!lock) return 0 // Otra pestaña ya está sincronizando
          return await this._ejecutarSincronizacion(opciones)
        })
      } catch (e) {
        return 0
      }
    }
    if (this._sincronizando) return 0
    this._sincronizando = true
    try {
      return await this._ejecutarSincronizacion(opciones)
    } finally {
      this._sincronizando = false
    }
  },

  async _ejecutarSincronizacion({ incluirErrorSync = false } = {}) {
    // Las filas con errorSync (rechazo definitivo del servidor o 503 determinista
    // reiterado) se excluyen: re-enviarlas sube megas en vano y nunca prospera.
    // Siguen visibles como pendientes para repararlas o eliminarlas a mano.
    // `incluirErrorSync` (rescate manual) las reincorpora UN ciclo sin tocar
    // el espejo: limpiar la marca por escrito puede fallar por cuota llena.
    const pendientes = obtenerDbLocal().filter(
      (r) => r.sincronizado === false && (!r.errorSync || incluirErrorSync)
    )
    let sincronizados = 0
    for (const p of pendientes) {
      const {
        sincronizado, origen, id, numeroRadicado, archivoOmitido, archivoEnIndexedDB,
        errorSync, intentosSync, ultimoErrorSync, ...payload
      } = p
      try {
        // Adjunto resguardado en IndexedDB (no cupo en localStorage): re-adjuntar
        const conAdjunto = { ...payload }
        if (!conAdjunto.archivoBase64 && archivoEnIndexedDB) {
          const adj = await adjuntosOffline.obtenerAdjunto(p.idLocal)
          if (adj) conAdjunto.archivoBase64 = adj.dataUrl
        }

        // Mismo criterio que crear(): un adjunto que excede el body recibe 413
        // SIEMPRE. Tratarlo como "definitivo" dejaba radicados atrapados como
        // RAD-LOCAL para siempre (Gerencia jamás los veía). Se publica el
        // radicado SIN documento y el adjunto se repara aparte vía PUT.
        const adjuntoExcedeBody =
          conAdjunto.archivoBase64 && conAdjunto.archivoBase64.length > 39_000_000
        const enviar = (sinAdjunto = false) => {
          // Tope de 45s: un POST colgado dejaría el botón de reintento en
          // "Sincronizando…" para siempre. Al abortar cae al catch de red y
          // el ciclo termina con fallo visible, no con la UI congelada.
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 45_000)
          return fetch(API_BASE, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(sinAdjunto ? { ...conAdjunto, archivoBase64: null } : conAdjunto),
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId))
        }

        let degradado = Boolean(adjuntoExcedeBody)
        let res = degradado ? await enviar(true) : await enviar()
        if (res.status === 413 && !degradado) {
          degradado = true
          res = await enviar(true)
        }

        if (res.ok) {
          const data = await res.json()
          if (data && data.success && data.data) {
            // Dedup completo: quitar la fila RAD-LOCAL Y cualquier copia previa
            // del registro del servidor (un POST cuya respuesta se perdió deja
            // ambas en el espejo → radicado duplicado en la lista).
            const lista = obtenerDbLocal().filter(
              (r) =>
                String(r.id) !== String(p.id) &&
                String(r.numeroRadicado) !== String(p.numeroRadicado) &&
                String(r.id) !== String(data.data.id) &&
                String(r.numeroRadicado) !== String(data.data.numeroRadicado)
            )
            let espejoOk = false
            try {
              guardarDbLocal([sanitizarParaCache(data.data), ...lista])
              espejoOk = true
            } catch (eCuota) {
              console.warn('Espejo local sin espacio tras sincronizar:', eCuota.message)
            }
            // El adjunto de IndexedDB solo se borra si el espejo local se actualizó:
            // si la fila RAD-LOCAL sobrevive por cuota llena, sigue apuntando a él
            // y el visor la resuelve desde ahí.
            if (archivoEnIndexedDB && espejoOk) adjuntosOffline.eliminarAdjunto(p.idLocal)
            // Publicación degradada: intentar colgar el documento ahora que el
            // radicado ya existe. Si tampoco cabe, queda visible sin documento
            // y se repara desde el detalle con uno más ligero.
            if (degradado && data.data.id && conAdjunto.archivoBase64) {
              try {
                await fetch(`${API_BASE}/${data.data.id}/archivo`, {
                  method: 'PUT',
                  headers: getHeaders(),
                  body: JSON.stringify({
                    archivoBase64: conAdjunto.archivoBase64,
                    archivoNombre: conAdjunto.archivoNombre
                  })
                })
              } catch (e) { /* el radicado YA está publicado; el documento se repara aparte */ }
            }
            sincronizados++
          } else {
            this._marcarFalloSync(p, `el servidor rechazó el radicado (${(data && data.message) || 'respuesta inválida'})`, true)
          }
        } else if (res.status === 401) {
          // Token inválido/expirado: mismo criterio que crear(). Sin esto el
          // pendiente reintentaba en silencio para siempre y nunca subía.
          authService.logout()
          window.location.href = '/login'
          return sincronizados
        } else if (res.status === 408 || res.status === 429 || res.status >= 500) {
          // Transitorio (BD caída, proxy): visible en consola y con tope de
          // intentos — un 503 determinista también debe dejar de martillarse.
          console.warn(`Sincronización radicados: ${numeroRadicado || id} → HTTP ${res.status} (transitorio)`)
          this._marcarFalloSync(p, `HTTP ${res.status}`, false)
        } else {
          // 4xx definitivo: el servidor SIEMPRE lo va a rechazar (400
          // validación…). No reintentar a ciegas: se guarda el MOTIVO REAL
          // del servidor para mostrarlo al usuario en la fila pendiente.
          let motivo = `HTTP ${res.status}`
          try {
            const d = await res.json()
            if (d && d.message) motivo = d.message
          } catch (e) { /* cuerpo no-JSON: queda el HTTP */ }
          console.warn(`Sincronización radicados: ${numeroRadicado || id} → ${motivo} (definitivo)`)
          this._marcarFalloSync(p, motivo, true)
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en el próximo montaje
        console.warn('Sincronización radicados: sin conexión, se reintentará más tarde.', e.message)
      }
    }
    if (sincronizados > 0) {
      notificarCambioRadicados('SYNC', { count: sincronizados })
    }
    return sincronizados
  },

  /**
   * Registra un fallo de sincronización en la fila del espejo. Si el fallo es
   * definitivo (o el transitorio acumuló MAX_INTENTOS_SYNC consecutivos) marca
   * errorSync para excluirlo de los próximos ciclos SIN perder el dato: la
   * fila sigue visible como pendiente para repararla o eliminarla a mano.
   */
  _marcarFalloSync(p, mensaje, definitivo) {
    const MAX_INTENTOS_SYNC = 5
    const lista = obtenerDbLocal()
    const idx = lista.findIndex((r) => String(r.id) === String(p.id))
    if (idx === -1) return
    const intentos = (lista[idx].intentosSync || 0) + 1
    lista[idx] = {
      ...lista[idx],
      intentosSync: intentos,
      ultimoErrorSync: `${mensaje} — ${new Date().toLocaleString()}`
    }
    if (definitivo || intentos >= MAX_INTENTOS_SYNC) {
      lista[idx].errorSync = true
    }
    try {
      guardarDbLocal(lista)
    } catch (eCuota) {
      // Sin espacio: la marca vive solo en esta sesión; el reintento continúa
    }
  },

  /**
   * Rescate manual de las filas excluidas por errorSync (rechazo definitivo o
   * reintentos agotados): corre un ciclo que las reincorpora SIN necesidad de
   * reescribir el espejo para limpiar la marca (esa escritura puede fallar por
   * cuota llena y dejaba el rescate sin efecto). Devuelve cuántos se
   * publicaron, cuántos quedan atrapados y el motivo de cada fallo.
   */
  async reintentarFallidos() {
    const publicados = await this.sincronizarPendientes({ incluirErrorSync: true })
    let quedan = 0
    const fallados = []
    try {
      for (const r of obtenerDbLocal()) {
        if (r && r.sincronizado === false) {
          quedan++
          fallados.push({
            numeroRadicado: r.numeroRadicado || r.id,
            error: r.ultimoErrorSync || 'sin detalle del error'
          })
        }
      }
    } catch (e) { /* espejo ilegible: reportar lo que se sabe */ }
    return { publicados, quedan, fallados }
  },

  /**
   * Actualiza el estado de un radicado en el servidor.
   * Solo los provisionales locales pueden actualizarse sin conexión;
   * para registros del servidor se informa el error de conexión real.
   */
  async actualizarEstado(id, estado) {
    const buscarIdx = (lista) =>
      lista.findIndex((r) => String(r.id) === String(id) || String(r.numeroRadicado) === String(id))
    const listaInicial = obtenerDbLocal()
    const idxInicial = buscarIdx(listaInicial)
    const esLocalPendiente = idxInicial !== -1 && listaInicial[idxInicial].sincronizado === false
    const idLocalOriginal = idxInicial !== -1 ? listaInicial[idxInicial].idLocal : null

    // Persiste el cambio re-leyendo el espejo JUSTO antes de escribir: un
    // snapshot previo al roundtrip puede resucitar pendientes que la sync de
    // fondo ya publicó (rollback silencioso del espejo completo).
    const persistirFilaLocal = (campos) => {
      const lista = obtenerDbLocal()
      const idx = buscarIdx(lista)
      if (idx === -1) return null // la fila ya no existe: no pisar el espejo con uno viejo
      lista[idx] = { ...lista[idx], ...campos }
      try {
        guardarDbLocal(lista)
      } catch (eCuota) {
        // Cuota llena: el cambio vive en la sesión actual y se sincronizará igual
        console.warn('Espejo local sin espacio para el cambio de estado:', eCuota.message)
      }
      return lista[idx]
    }

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ estado })
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          // Merge sin Base64: el PUT devuelve la fila completa y el caché es liviano
          const fila = persistirFilaLocal(sanitizarParaCache(data.data || { estado }))
          const ret = (data.data) || fila || { id, estado }
          notificarCambioRadicados('ESTADO', ret)
          return ret
        }
        throw new Error((data && data.message) || 'Respuesta inválida del servidor')
      }
      const error = new Error(`El servidor respondió ${res.status}`)
      error.status = res.status
      throw error
    } catch (e) {
      if (esLocalPendiente) {
        const fila = persistirFilaLocal({ estado })
        if (fila) {
          notificarCambioRadicados('ESTADO', fila)
          return fila
        }
        // La fila local desapareció a mitad del PUT (la sync de fondo la
        // publicó): aplicar el cambio al registro real del servidor usando
        // el idLocal compartido en lugar de perderlo en silencio.
        const publicada = idLocalOriginal
          ? obtenerDbLocal().find((r) => r.idLocal === idLocalOriginal && r.sincronizado !== false)
          : null
        if (publicada && String(publicada.id) !== String(id)) {
          return this.actualizarEstado(publicada.id, estado)
        }
      }
      if (e && e.status === 401) {
        authService.logout()
        window.location.href = '/login'
        throw new Error('Sesión expirada. Inicie sesión nuevamente.')
      }
      throw new Error('No se pudo actualizar el estado: sin conexión con el servidor.')
    }
  },

  /**
   * Descarga el documento original del radicado como URL de objeto (blob).
   * El listado viaja sin Base64 (peso); el archivo se sirve bajo demanda.
   * Devuelve { url, mime } — el mime real del blob sirve para que el visor
   * decida <object>/<iframe> PDF vs <img> sin depender del nombre del archivo.
   * El error lleva .status: 404 = el radicado no tiene documento (estado
   * honesto); otros códigos = fallo de transporte reintentable.
   */
  async obtenerArchivoRadicado(id) {
    const controller = new AbortController()
    // El plazo cubre fetch + lectura del cuerpo: una descarga estancada aborta
    // en vez de dejar el visor en "Cargando documento..." para siempre.
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
   * Repara registros que llegaron a la BD sin archivo — p. ej. subidos sin
   * conexión cuyo adjunto no cupo en el almacenamiento local del navegador.
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

    if (res.status === 401) {
      authService.logout()
      window.location.href = '/login'
      throw new Error('Sesión expirada. Inicie sesión nuevamente.')
    }

    if (!res.ok) {
      let msg = `El servidor respondió ${res.status}`
      try {
        const data = await res.json()
        if (data && data.message) msg = data.message
      } catch (e) {}
      throw new Error(msg)
    }

    const data = await res.json()
    if (data && data.success && data.data) {
      try {
        fusionarEnCache(data.data)
      } catch (eCuota) {
        console.warn('Espejo local sin espacio; el documento SÍ está en la BD:', eCuota.message)
      }
      notificarCambioRadicados('ADJUNTAR_ARCHIVO', data.data)
      return data.data
    }
    throw new Error('Respuesta inesperada del servidor al adjuntar el documento.')
  },

  getDescargarExcelUrl() {
    return `${API_BASE}/descargar-excel`
  },

  /**
   * Elimina un radicado por su ID (acepta también el objeto completo).
   * Provisional local (nunca sincronizado): se quita del caché del navegador.
   * Radicado del servidor: DELETE al backend + limpieza del caché local.
   * Un 404 se trata como éxito (ya fue eliminado desde otro equipo): lo que
   * no existe en la BD no debe revivir en pantalla desde el espejo local.
   */
  async eliminar(rad) {
    const id = rad && typeof rad === 'object' ? rad.id : rad
    const numero = rad && typeof rad === 'object' ? rad.numeroRadicado : null

    const quitarDelCacheLocal = () => {
      const lista = obtenerDbLocal().filter(
        (r) => String(r.id) !== String(id) && (!numero || String(r.numeroRadicado) !== String(numero))
      )
      try {
        guardarDbLocal(lista)
      } catch (eCuota) {
        // Espejo sin espacio: obtenerTodos lo corrige en el próximo refresco
      }
    }

    const esLocalPendiente = String(id).startsWith('RAD-LOCAL') ||
      obtenerDbLocal().some((r) => String(r.id) === String(id) && r.sincronizado === false)

    if (esLocalPendiente) {
      // El adjunto resguardado en IndexedDB (si lo hay) quedaría huérfano al
      // quitar la fila: capturar el registro antes para poder borrarlo.
      const registro = obtenerDbLocal().find(
        (r) => String(r.id) === String(id) || (numero && String(r.numeroRadicado) === String(numero))
      )
      quitarDelCacheLocal()
      if (registro && registro.archivoEnIndexedDB && registro.idLocal) {
        adjuntosOffline.eliminarAdjunto(registro.idLocal)
      }
      notificarCambioRadicados('ELIMINAR', { id, numeroRadicado: numero })
      return { success: true, origen: 'LOCAL', message: 'Radicado local eliminado' }
    }

    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    })

    if (res.status === 401) {
      authService.logout()
      window.location.href = '/login'
      throw new Error('Sesión expirada. Inicie sesión nuevamente.')
    }

    if (res.ok || res.status === 404) {
      quitarDelCacheLocal()
      let mensaje = 'Radicado eliminado correctamente'
      try {
        const data = await res.json()
        if (data && data.message) mensaje = data.message
      } catch (e) {}
      notificarCambioRadicados('ELIMINAR', { id, numeroRadicado: numero })
      return { success: true, origen: 'SERVIDOR', message: mensaje }
    }

    let msg = `El servidor respondió ${res.status}`
    try {
      const data = await res.json()
      if (data && data.message) msg = data.message
    } catch (e) {}
    throw new Error(msg)
  }
}

export default radicadosService
