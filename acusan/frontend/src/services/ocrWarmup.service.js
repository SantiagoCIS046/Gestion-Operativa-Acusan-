// ocrWarmup.service.js — Precalentamiento del OCR del NAVEGADOR (producción).
// ─────────────────────────────────────────────────────────────────────────────
// Se dispara al ABRIR el selector de archivos: crea el worker de tesseract y
// descarga el idioma spa (~10-15 MB la primera vez; luego queda en IndexedDB)
// mientras el usuario elige el documento — fuera del camino crítico del
// escaneo. El worker sobrevive entre escaneos y se libera solo tras 3 min
// de inactividad.
//
// Si VITE_OCR_HEALTH_URL está definida explícitamente (desarrollo con motor
// Python local/remoto), también lanza el ping de despertado a ese motor.
// Nunca lanza: todo error se traga en silencio.

const URL_SALUD = import.meta.env.VITE_OCR_HEALTH_URL || ''
const INTERVALO_MS = 55_000
let ultimo = 0

export const precalentarOCR = () => {
  const ahora = Date.now()
  if (ahora - ultimo < INTERVALO_MS) return
  ultimo = ahora

  // Ruta de producción: worker de tesseract + idioma spa listos antes de
  // que el usuario elija el archivo.
  import('./ocrNavegador.service.js')
    .then(({ ocrNavegador }) => ocrNavegador.prepararWorker())
    .catch(() => {})

  // Desarrollo con motor Python: ping de despertado (sin CORS de lectura,
  // con que la petición llegue basta).
  if (URL_SALUD) {
    try {
      fetch(URL_SALUD, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
    } catch {
      /* best-effort: el ping jamás interrumpe la carga del documento */
    }
  }
}

export default precalentarOCR
