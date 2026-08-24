import authService from '../../auth/services/authService.js'

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

// Reemplaza/inserta un registro en la caché local sin duplicados ni Base64
const fusionarEnCache = (item) => {
  const lista = obtenerDbLocal()
  const filtrada = lista.filter(
    (r) => String(r.id) !== String(item.id) && String(r.numeroRadicado) !== String(item.numeroRadicado)
  )
  guardarDbLocal([sanitizarParaCache(item), ...filtrada])
}

export const radicadosService = {
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
          return [...delServidor, ...localesPendientes].sort(
            (a, b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion)
          )
        }
      }

      return obtenerDbLocal()
    } catch (error) {
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
            console.warn('Espejo local sin espacio; el radicado SÍ está en la BD:', eCuota.message)
          }
          return { ...data.data, origen: 'SERVIDOR' }
        }
        throw new Error((data && data.message) || 'El servidor rechazó el radicado.')
      }
      const error = new Error(`El servidor respondió ${res.status}`)
      error.status = res.status
      throw error
    }

    try {
      return await enviarAlServidor()
    } catch (ePrimer) {
      if (ePrimer.message && ePrimer.message.startsWith('Sesión expirada')) throw ePrimer

      // Fallo de red (sin status) o 5xx = transitorio → un reintento breve.
      // Un 4xx es un rechazo definitivo del servidor: reintentar no cambia nada.
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
   * Fallback offline: persiste el radicado como provisional local
   * (sincronizado: false, origen: 'LOCAL') y devuelve el registro guardado.
   */
  _guardarPendienteLocal(datos, idLocal, errorCausa) {
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
      registradoPor: datos.registradoPor || authService.getUsuarioActual()?.nombre || 'Encargada',
      sincronizado: false,
      origen: 'LOCAL'
    }
    const lista = obtenerDbLocal()
    const pesoAdjunto =
      (datos.archivoBase64 || '').length +
      (typeof datos.archivoUrl === 'string' ? datos.archivoUrl.length : 0)

    // 1) Adjunto que no cabe en la cuota: un PDF escaneado (~2MB) genera ~5.4MB
    //    en UTF-16 y desborda él solo los ~5MB de localStorage. Intentarlo está
    //    condenado: se omite desde el inicio y se informa UNA sola vez — NUNCA
    //    se finge un guardado completo.
    if (pesoAdjunto > 1500000) {
      const sinArchivo = sanitizarParaCache({ ...base, archivoOmitido: true })
      try {
        guardarDbLocal([sinArchivo, ...lista])
        console.warn('Documento adjunto omitido (excede la cuota del navegador): el radicado se publicará sin archivo.')
        return sinArchivo
      } catch (eCuota2) {
        throw new Error(
          'No hay espacio en el almacenamiento local del navegador y el servidor no responde. ' +
          'Libere espacio (cierre sesiones antiguas o borre el historial local) e intente de nuevo.'
        )
      }
    }

    // 2) Adjunto liviano: intentar con el documento (necesario para publicarlo después)
    try {
      guardarDbLocal([base, ...lista])
      return base
    } catch (eCuota) {
      // Sin espacio: persistir sin el Base64 (el radicado sobrevive; el
      // documento se pierde y se informa)
      const sinArchivo = sanitizarParaCache({ ...base, archivoOmitido: true })
      try {
        guardarDbLocal([sinArchivo, ...lista])
        console.warn('Documento adjunto omitido por cuota de almacenamiento local:', eCuota.message)
        return sinArchivo
      } catch (eCuota2) {
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
  async sincronizarPendientes() {
    const nombreLock = 'acuasan-sync-radicados'
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
    const pendientes = obtenerDbLocal().filter((r) => r.sincronizado === false)
    let sincronizados = 0
    for (const p of pendientes) {
      const { sincronizado, origen, id, numeroRadicado, archivoOmitido, ...payload } = p
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
              (r) => String(r.id) !== String(p.id) && String(r.numeroRadicado) !== String(p.numeroRadicado)
            )
            try {
              guardarDbLocal([sanitizarParaCache(data.data), ...lista])
            } catch (eCuota) {
              console.warn('Espejo local sin espacio tras sincronizar:', eCuota.message)
            }
            sincronizados++
          }
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en el próximo montaje
      }
    }
    return sincronizados
  },

  /**
   * Actualiza el estado de un radicado en el servidor.
   * Solo los provisionales locales pueden actualizarse sin conexión;
   * para registros del servidor se informa el error de conexión real.
   */
  async actualizarEstado(id, estado) {
    const lista = obtenerDbLocal()
    const idx = lista.findIndex((r) => String(r.id) === String(id) || String(r.numeroRadicado) === String(id))
    const esLocalPendiente = idx !== -1 && lista[idx].sincronizado === false

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ estado })
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          if (idx !== -1) {
            // Merge sin Base64: el PUT devuelve la fila completa y el caché es liviano
            lista[idx] = { ...lista[idx], ...sanitizarParaCache(data.data || { estado }) }
            try {
              guardarDbLocal(lista)
            } catch (eCuota) {
              console.warn('Espejo local sin espacio:', eCuota.message)
            }
          }
          return (data.data) || (idx !== -1 ? lista[idx] : { id, estado })
        }
        throw new Error((data && data.message) || 'Respuesta inválida del servidor')
      }
      throw new Error(`El servidor respondió ${res.status}`)
    } catch (e) {
      if (esLocalPendiente) {
        lista[idx].estado = estado
        try {
          guardarDbLocal(lista)
        } catch (eCuota) {
          // Cuota llena: el cambio vive en la sesión actual y se sincronizará igual
          console.warn('Espejo local sin espacio para el cambio de estado:', eCuota.message)
        }
        return lista[idx]
      }
      throw new Error('No se pudo actualizar el estado: sin conexión con el servidor.')
    }
  },

  /**
   * Descarga el documento original del radicado como URL de objeto.
   * El listado viaja sin Base64 (peso); el archivo se sirve bajo demanda.
   */
  async obtenerArchivoRadicado(id) {
    const res = await fetch(`${API_BASE}/${id}/archivo`, {
      headers: authService.getAuthHeader()
    })
    if (!res.ok) throw new Error('No fue posible obtener el documento del radicado')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  getDescargarExcelUrl() {
    return `${API_BASE}/descargar-excel`
  }
}

export default radicadosService
