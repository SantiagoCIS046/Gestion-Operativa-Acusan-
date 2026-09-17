// ocrWarmup.service.js — Precalentamiento del motor OCR Python (Render free).
// ─────────────────────────────────────────────────────────────────────────────
// El plan free de Render duerme tras 15 min sin tráfico y despertar toma
// ~1 min. Este ping fire-and-forget se dispara al ABRIR el selector de
// archivos para que el arranque corra mientras el usuario elige el
// documento, fuera del camino crítico del escaneo.
//
// El motor NO monta CORS (su único cliente legítimo es el backend): la
// petición GET simple llega igual aunque el navegador bloquee la lectura
// de la respuesta — despertar es justo lo que se busca. Nunca lanza:
// todo error se traga en silencio.
const URL_SALUD = import.meta.env.VITE_OCR_HEALTH_URL || 'https://acuusan-ocr.onrender.com/health'
const INTERVALO_MS = 55_000
let ultimoPing = 0

export const precalentarMotorOCR = () => {
  const ahora = Date.now()
  if (ahora - ultimoPing < INTERVALO_MS) return
  ultimoPing = ahora
  try {
    fetch(URL_SALUD, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
  } catch {
    /* best-effort: el ping jamás interrumpe la carga del documento */
  }
}

export default precalentarMotorOCR
