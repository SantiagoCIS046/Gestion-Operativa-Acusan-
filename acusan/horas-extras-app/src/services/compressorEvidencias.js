/**
 * ============================================================================
 * COMPRESOR DE EVIDENCIAS FOTOGRÁFICAS — ACUASAN E.S.P. (App Horas Extras)
 * ============================================================================
 * Adaptación imagen-only del compresor de radicados del frontend principal.
 * Las fotos de evidencia viajan como data URL dentro del JSON del endpoint,
 * así que deben pesar poco: se escalan a máx. 1280 px por el lado mayor y se
 * recodifican como JPEG al 72 % de calidad. Sin librerías externas: solo la
 * Canvas API nativa del navegador.
 * ============================================================================
 */

const LADO_MAX = 1280  // Lado mayor máximo en píxeles
const CALIDAD  = 0.72  // Calidad JPEG para fotos de evidencia

// ── Métricas legibles ─────────────────────────────────────────────────────────
const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(2)} MB`
}

// ── Lectura del File como data URL ───────────────────────────────────────────
const leerComoDataUrl = (file) =>
  new Promise((resolver, rechazar) => {
    const reader = new FileReader()
    reader.onload = (e) => resolver(e.target.result)
    reader.onerror = () => rechazar(new Error('No se pudo leer la foto.'))
    reader.readAsDataURL(file)
  })

// ── Escala + recodificación con Canvas (patrón compressorRadicados) ──────────
const escalarYCodificar = (dataUrl) =>
  new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      // Reducir proporcionalmente si el lado mayor supera el límite
      const ratio = Math.min(LADO_MAX / w, LADO_MAX / h, 1)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // Fondo blanco: los PNG con transparencia quedan bien en JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)

      // Siempre JPEG: mejor compresión para fotos de cámara
      resolver(canvas.toDataURL('image/jpeg', CALIDAD))
    }
    img.onerror = () => rechazar(new Error('No se pudo cargar la foto para comprimirla.'))
    img.src = dataUrl
  })

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * Comprime una foto de evidencia lista para subir al endpoint.
 *
 * @param {File} file Foto original (cámara o galería)
 * @returns {Promise<{
 *   dataUrl: string,             // data URL JPEG lista para fotoBase64
 *   metricas: {
 *     original: number,          // bytes originales
 *     final: number,             // bytes del JPEG resultante
 *     ahorro: number,            // porcentaje ahorrado (0-100)
 *     textoOrig: string,         // "3.45 MB"
 *     textoFinal: string,        // "680.12 KB"
 *     comprimido: boolean
 *   }
 * }>}
 */
export const comprimirImagen = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.')
  }

  const bytesOrig = file.size
  const dataUrlOrig = await leerComoDataUrl(file)
  const dataUrl = await escalarYCodificar(dataUrlOrig)

  // data URL: "data:image/jpeg;base64,<payload>" → bytes ≈ longitud_payload * 3/4
  const bytesFinal = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4)
  const ahorro = bytesOrig > 0
    ? Math.max(0, Math.round((1 - bytesFinal / bytesOrig) * 100))
    : 0

  return {
    dataUrl,
    metricas: {
      original: bytesOrig,
      final: bytesFinal,
      ahorro,
      textoOrig: fmtBytes(bytesOrig),
      textoFinal: fmtBytes(bytesFinal),
      comprimido: ahorro > 0
    }
  }
}

export default { comprimirImagen }
