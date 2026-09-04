/**
 * whatsapp.worker.js — Worker asíncrono del webhook de WhatsApp Cloud API.
 *
 * Corre DESACOPLADO del request HTTP: whatsapp.controller.js ya respondió 200
 * a Meta cuando esto ejecuta, por lo que puede tardar lo que necesite (BD,
 * IA, notificaciones) sin que Meta reintente el envío.
 *
 * Fase 3 (actual): registra el mensaje y lo deja listo para la Fase 4.
 * El hueco de la lógica de IA está marcado abajo.
 */
import logger from '../../config/logger.js'

// ─── Deduplicación por wamid ──────────────────────────────────────────────────
// Meta reintenta el POST completo si el 200 se pierde en la red: el mismo
// mensaje (mismo wamid) puede llegar 2+ veces. Sin este guard se radicarían
// PQR duplicadas. Map en memoria: válido para 1 instancia (Railway/Render).
// Si algún día hay múltiples instancias → mover a Redis.
const TTL_DUPLICADOS_MS = 5 * 60 * 1000
const procesados = new Map() // wamid → fecha de proceso

function esDuplicado(waId) {
  if (!waId) return false
  const yaVisto = procesados.has(waId)
  procesados.set(waId, Date.now())
  if (procesados.size > 1000) depurarAntiguos()
  return yaVisto
}

function depurarAntiguos() {
  const ahora = Date.now()
  for (const [waId, ts] of procesados) {
    if (ahora - ts > TTL_DUPLICADOS_MS) procesados.delete(waId)
  }
}

/**
 * Punto único de entrada del flujo conversacional de PQR por WhatsApp.
 *
 * @param {string} telefono - Número WhatsApp del remitente (ej. '573001234567')
 * @param {string} mensaje  - Texto del mensaje (messages[].text.body)
 * @param {object} meta     - Contexto del webhook { waId, timestamp, perfil }
 */
export async function procesarMensajeEntrante(telefono, mensaje, meta = {}) {
  const vista = mensaje.length > 60 ? `${mensaje.slice(0, 60)}…` : mensaje

  // 1) Guard de duplicados (reintentos de Meta con el mismo wamid)
  if (esDuplicado(meta.waId)) {
    logger.warn('PQR', 'WHATSAPP DUP', `wamid ${meta.waId} ya procesado — ignorado`)
    return null
  }

  logger.create('PQR', 'WHATSAPP IN', `+${telefono}${meta.perfil ? ` (${meta.perfil})` : ''}: "${vista}"`)

  // 2) ─── FASE 4: lógica de IA (pendiente) ────────────────────────────────────
  //    a) Memoria conversacional por `telefono`
  //    b) Prompt engineering → JSON estructurado (motivo, descripción, matrícula…)
  //    c) JSON completo → PqrService.crear({ telefono, ... })  ← capa de Z.ai
  //    d) Handoff a operador humano vía Socket.io si el ciudadano lo pide

  return { telefono, estado: 'RECIBIDO', waId: meta.waId ?? null }
}
