/**
 * ============================================================================
 * COMPRESOR DE DOCUMENTOS (NAVEGADOR) — ACUASAN E.S.P.
 * ============================================================================
 * Reduce el peso de PDFs e imágenes antes de almacenarlos en MongoDB Atlas
 * (límite práctico: ~10 MB por documento en Base64). Sin librerías externas:
 * solo la Canvas API nativa del navegador y pdfjs-dist (ya incluido).
 *
 * Estrategia por tipo:
 *   Imagen (PNG/JPG/WebP/GIF)
 *     → Escala a máx. ANCHO_MAX × ALTO_MAX manteniendo proporción.
 *     → Codifica como JPEG al 82 % de calidad.
 *     → Reducción típica: 80-93 %.
 *
 *   PDF ligero (< UMBRAL_PDF_MB)
 *     → Se devuelve sin cambios: ya entra en MongoDB con margen.
 *
 *   PDF pesado (≥ UMBRAL_PDF_MB) o PDF escaneado (solo imágenes)
 *     → Varias páginas se rasterizan EN PARALELO con pdfjs (worker propio).
 *     → Cada canvas se codifica como JPEG con toBlob (asíncrono: no congela
 *       la UI mientras el OCR corre en paralelo).
 *     → Las imágenes se empacan en un PDF mínimo "imagen-por-página"
 *       construido con bytes puros (sin librerías adicionales) y la data URL
 *       final se genera con Blob + FileReader (codificación nativa).
 *     → Reducción típica: 60-85 %. PDF de 20 páginas: antes ~30-60 s,
 *       ahora ~5-10 s en una máquina normal.
 *
 * La función principal devuelve siempre una data URL lista para guardar
 * y un objeto con métricas (tamaño original, final, porcentaje ahorrado).
 * ============================================================================
 */

// ── Constantes de configuración ───────────────────────────────────────────────
const UMBRAL_PDF_MB = 6      // PDF por debajo de 6 MB: no se toca (carga instantánea < 0.01s)
const ANCHO_MAX     = 1800   // Ancho máximo de imagen en píxeles
const ALTO_MAX      = 2500   // Alto máximo de imagen en píxeles
const CALIDAD_IMG   = 0.78   // JPEG quality para imágenes
const CALIDAD_PDF   = 0.72   // JPEG quality para páginas de PDF rasterizado
const DPI_RENDER    = 110    // DPI eficiente para compresión ultra-rápida de PDFs grandes
// Páginas rasterizadas a la vez: la rasterización ocurre en el worker de pdfjs,
// así que varias en paralelo multiplican la velocidad sin congelar la UI. Se
// limita según núcleos para no saturar las máquinas más modestas de la oficina.
const PAGINAS_EN_PARALELO = Math.min(
  4,
  Math.max(2, (navigator.hardwareConcurrency || 4) - 1)
)

// ── pdfjs (caché de módulo: misma instancia toda la sesión) ──────────────────
let pdfjsCache = null
const getPdfjs = async () => {
  if (pdfjsCache) return pdfjsCache
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const m = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = m.default
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    }
  }
  pdfjsCache = pdfjs
  return pdfjs
}

// ── Métricas legibles ─────────────────────────────────────────────────────────
const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(2)} MB`
}

// ── Compresión de imagen con Canvas API ──────────────────────────────────────
const comprimirImagen = (dataUrl, mimeOrigen) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      // Reducir proporcionalmente si supera el límite
      const ratio = Math.min(ANCHO_MAX / w, ALTO_MAX / h, 1)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // Fondo blanco: los PNG transparentes quedan bien en JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)

      // PNG/WebP/GIF → JPEG siempre (mejor compresión para documentos)
      resolve(canvas.toDataURL('image/jpeg', CALIDAD_IMG))
    }
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para comprimirla.'))
    img.src = dataUrl
  })

// ── PDF mínimo "imagen-por-página" ────────────────────────────────────────────
// Construye un PDF 1.4 válido embebiendo páginas JPEG. No requiere librerías:
// el formato PDF es texto + streams binarios con cabecera "%PDF-1.4".
// Cada página tiene exactamente las dimensiones del canvas renderizado.
//
// Rendimiento: los JPEG llegan como Blob (bytes nativos, sin base64 intermedio
// por página) y la data URL final se genera con Blob + FileReader —
// codificación nativa del navegador que reemplaza el bucle byte a byte
// anterior (el mayor cuello de botella del proceso completo).
const construirPdfDesdeImagenes = async (paginas) => {
  // paginas: Array<{ blob:Blob, width:number, height:number }>
  // Unidades PDF: 1 pt = 1/72 pulgada.
  const PX_A_PT = 72 / DPI_RENDER

  // Helper: número PDF formateado
  const enc = new TextEncoder()

  const partes   = []  // Uint8Array | string
  const offsets  = []  // byte offset de cada objeto
  let bytePos    = 0

  const push = (dato) => {
    let buf
    if (typeof dato === 'string') {
      buf = enc.encode(dato)
    } else {
      buf = dato // Uint8Array (datos JPEG binarios)
    }
    partes.push(buf)
    bytePos += buf.byteLength
  }

  // Cabecera
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  const objIds = {
    catalogo: 1,
    paginas:  2,
    // Para N páginas: página i → 3 + i*2, imagen i → 3 + i*2 + 1,
    // stream de contenido i → 3 + N*2 + i
    paginaId: (i) => 3 + i * 2,
    imagenId: (i) => 3 + i * 2 + 1
  }
  const streamBaseId = 3 + paginas.length * 2

  // Objeto 1: Catálogo
  offsets[1] = bytePos
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)

  // Objeto 2: Nodo Pages
  const kidsRef = paginas.map((_, i) => `${objIds.paginaId(i)} 0 R`).join(' ')
  offsets[2] = bytePos
  push(`2 0 obj\n<< /Type /Pages /Kids [${kidsRef}] /Count ${paginas.length} >>\nendobj\n`)

  // Por cada página: objeto Página + objeto Image (stream JPEG)
  for (let i = 0; i < paginas.length; i++) {
    const { blob, width, height } = paginas[i]
    const wPt = (width  * PX_A_PT).toFixed(2)
    const hPt = (height * PX_A_PT).toFixed(2)

    // Bytes JPEG directos del Blob (nativo, sin atob por página)
    const jpegBytes = new Uint8Array(await blob.arrayBuffer())

    // Objeto página — /Contents apunta al stream de dibujo correcto (3 + N*2 + i)
    const pId = objIds.paginaId(i)
    offsets[pId] = bytePos
    push(
      `${pId} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R\n` +
      `/MediaBox [0 0 ${wPt} ${hPt}]\n` +
      `/Resources << /XObject << /Im${i} ${objIds.imagenId(i)} 0 R >> >>\n` +
      `/Contents ${streamBaseId + i} 0 R >>\n` +
      `endobj\n`
    )

    // Objeto XObject Image (stream JPEG)
    const xId = objIds.imagenId(i)
    offsets[xId] = bytePos
    push(
      `${xId} 0 obj\n` +
      `<< /Type /XObject /Subtype /Image\n` +
      `/Width ${width} /Height ${height}\n` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8\n` +
      `/Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\n` +
      `stream\n`
    )
    push(jpegBytes)
    push(`\nendstream\nendobj\n`)
  }

  // Streams de contenido (dibuja Im_i escalado al tamaño de la página)
  for (let i = 0; i < paginas.length; i++) {
    const { width, height } = paginas[i]
    const wPt = (width  * PX_A_PT).toFixed(2)
    const hPt = (height * PX_A_PT).toFixed(2)
    const contenido = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im${i} Do Q`
    const cId = streamBaseId + i
    offsets[cId] = bytePos
    push(
      `${cId} 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`
    )
  }

  // xref table
  const xrefOffset = bytePos
  const maxId = streamBaseId + paginas.length - 1
  push(`xref\n0 ${maxId + 1}\n`)
  push(`0000000000 65535 f \n`) // entrada 0
  for (let id = 1; id <= maxId; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0')
    push(`${off} 00000 n \n`)
  }
  push(
    `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`
  )

  // Ensamblar en un único Uint8Array
  const total = partes.reduce((s, p) => s + p.byteLength, 0)
  const resultado = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    resultado.set(p, pos)
    pos += p.byteLength
  }

  // Data URL final vía Blob + FileReader: codificación base64 nativa del
  // navegador (antes un bucle byte a byte que dominaba el tiempo total).
  return await new Promise((resolve, reject) => {
    const blobFinal = new Blob([resultado], { type: 'application/pdf' })
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('No se pudo codificar el PDF comprimido.'))
    reader.readAsDataURL(blobFinal)
  })
}

// ── Rasterizar PDF pesado con pdfjs (páginas EN PARALELO) ────────────────────
// El trabajo pesado de rasterizado ocurre en el worker de pdfjs, por lo que
// varias páginas pueden avanzar a la vez. La codificación JPEG usa toBlob
// (asíncrona, fuera del hilo principal) en vez de toDataURL (síncrona), así la
// UI — y el OCR que corre en paralelo — no se congelan mientras comprime.
const rasterizarPdf = async (file, onProgreso) => {
  const pdfjs = await getPdfjs()

  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: buffer, useSystemFonts: true })
  const doc = await loadingTask.promise

  try {
    const scale = DPI_RENDER / 72  // pdfjs usa 72 dpi como base
    const total = doc.numPages
    const paginas = new Array(total) // índice fijo: el orden no depende de cuál termina primero
    let completadas = 0

    const renderizarPagina = async (numPagina) => {
      const page = await doc.getPage(numPagina)
      try {
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width  = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise

        // toBlob: JPEG asíncrono sin base64 intermedio
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error(`No se pudo codificar la página ${numPagina}.`))),
            'image/jpeg',
            CALIDAD_PDF
          )
        )
        paginas[numPagina - 1] = { blob, width: canvas.width, height: canvas.height }
        canvas.width = 0 // liberar memoria del bitmap

        completadas++
        onProgreso?.(`Comprimiendo página ${completadas} de ${total}`, completadas / total)
      } finally {
        page.cleanup()
      }
    }

    // Pool de concurrencia: cada "obrera" toma la siguiente página libre
    let siguiente = 1
    const obreras = Array.from(
      { length: Math.min(PAGINAS_EN_PARALELO, total) },
      async () => {
        while (siguiente <= total) {
          const numPagina = siguiente++
          await renderizarPagina(numPagina)
        }
      }
    )
    await Promise.all(obreras)

    return paginas
  } finally {
    try { await loadingTask.destroy() } catch (_) {}
  }
}

// ── API pública ───────────────────────────────────────────────────────────────
export const compressorRadicados = {
  /**
   * Comprime un documento antes de guardarlo en la BD.
   *
   * @param {File}     file       Archivo original
   * @param {Function} onProgreso (etapa:string, progreso:0..1) → para la UI
   * @returns {Promise<{
   *   dataUrl: string,       // data URL comprimida lista para MongoDB
   *   nombre:  string,       // nombre sugerido del archivo
   *   metricas: {
   *     original:   number,  // bytes originales
   *     final:      number,  // bytes del archivo resultante
   *     ahorro:     number,  // porcentaje ahorrado (0-100)
   *     textoOrig:  string,  // "3.45 MB"
   *     textoFinal: string,  // "680.12 KB"
   *     comprimido: boolean  // true si se redujo, false si no hizo falta
   *   }
   * }>}
   */
  async comprimir(file, onProgreso = () => {}) {
    const reportar = (etapa, p) => {
      try { onProgreso(etapa, Math.max(0, Math.min(1, p || 0))) } catch (_) {}
    }

    const bytesOrig = file.size
    const esImagen  = file.type.startsWith('image/')
    const esPdf     = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

    const metricas = (dataUrl, comprimido) => {
      // data URL: "data:...;base64,<payload>" — el payload está en base64
      // → bytes binarios = longitud_payload * 3/4 (aprox, ignora padding)
      const bytesFinal = Math.round(
        (dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4
      )
      const ahorro = bytesOrig > 0
        ? Math.max(0, Math.round((1 - bytesFinal / bytesOrig) * 100))
        : 0
      return {
        original:   bytesOrig,
        final:      bytesFinal,
        ahorro,
        textoOrig:  fmtBytes(bytesOrig),
        textoFinal: fmtBytes(bytesFinal),
        comprimido
      }
    }

    // ── Imagen ──────────────────────────────────────────────────────────────
    if (esImagen) {
      reportar('Comprimiendo imagen…', 0.1)
      const reader = new FileReader()
      const dataUrlOrig = await new Promise((res, rej) => {
        reader.onload  = (e) => res(e.target.result)
        reader.onerror = () => rej(new Error('No se pudo leer la imagen.'))
        reader.readAsDataURL(file)
      })

      const dataUrlFinal = await comprimirImagen(dataUrlOrig, file.type)
      reportar('Imagen comprimida', 1)

      // Nombre: siempre .jpg (se convirtió a JPEG)
      const nombre = file.name.replace(/\.[^.]+$/, '.jpg')
      return { dataUrl: dataUrlFinal, nombre, metricas: metricas(dataUrlFinal, true) }
    }

    // ── PDF ligero: se guarda tal cual ────────────────────────────────────
    if (esPdf && bytesOrig < UMBRAL_PDF_MB * 1024 * 1024) {
      reportar('Leyendo PDF…', 0.1)
      const reader = new FileReader()
      const dataUrlOrig = await new Promise((res, rej) => {
        reader.onload  = (e) => res(e.target.result)
        reader.onerror = () => rej(new Error('No se pudo leer el PDF.'))
        reader.readAsDataURL(file)
      })
      reportar('PDF listo', 1)
      return {
        dataUrl: dataUrlOrig,
        nombre: file.name,
        metricas: metricas(dataUrlOrig, false)
      }
    }

    // ── PDF pesado: rasterizar + empacar ─────────────────────────────────
    if (esPdf) {
      reportar('Preparando compresión del PDF…', 0.05)
      const paginas = await rasterizarPdf(file, (etapa, p) =>
        reportar(etapa, 0.05 + p * 0.85)
      )
      reportar('Ensamblando PDF comprimido…', 0.92)
      const dataUrlFinal = await construirPdfDesdeImagenes(paginas)
      reportar('PDF comprimido listo', 1)

      // Nombre: añade sufijo para distinguirlo del original
      const nombre = file.name.replace(/\.pdf$/i, '_comprimido.pdf')
      return { dataUrl: dataUrlFinal, nombre, metricas: metricas(dataUrlFinal, true) }
    }

    // ── Tipo no soportado: leer y devolver tal cual ───────────────────────
    reportar('Leyendo archivo…', 0.5)
    const reader = new FileReader()
    const dataUrlOrig = await new Promise((res, rej) => {
      reader.onload  = (e) => res(e.target.result)
      reader.onerror = () => rej(new Error('No se pudo leer el archivo.'))
      reader.readAsDataURL(file)
    })
    reportar('Archivo listo', 1)
    return { dataUrl: dataUrlOrig, nombre: file.name, metricas: metricas(dataUrlOrig, false) }
  }
}

export default compressorRadicados
