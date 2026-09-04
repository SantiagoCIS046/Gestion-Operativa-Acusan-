/**
 * whatsapp.controller.js — Puerta de entrada del Webhook de WhatsApp Cloud API (Meta)
 *
 * Fase 3 del módulo PQR: enrutar, validar y extraer. SIN lógica de IA.
 *
 * Contrato con Meta (estricto):
 *  - GET  /api/pqr/whatsapp → verificación única al configurar el webhook:
 *    si hub.verify_token coincide, devolver hub.challenge TAL CUAL (texto plano).
 *  - POST /api/pqr/whatsapp → Meta exige HTTP 200 en <3 segundos o REINTENTA
 *    todo el envío. Este controlador NO espera nada: valida la firma, extrae
 *    los mensajes (sincrónico, microsegundos), responde 200 y recién ahí
 *    delega el trabajo pesado al worker asíncrono (whatsapp.worker.js).
 *
 * Filtro de status: Meta notifica "sent"/"delivered"/"read" en value.statuses.
 * Esos eventos NO son mensajes y se descartan; solo se procesa texto entrante
 * (messages[].text.body con type === 'text').
 */
import crypto from 'crypto'
import logger from '../../config/logger.js'
import { procesarMensajeEntrante } from './whatsapp.worker.js'

// ─── Configuración (lectura perezosa) ─────────────────────────────────────────
// Los imports estáticos se evalúan ANTES de que app.js ejecute dotenv.config(),
// así que process.env leído a nivel de módulo llega undefined. Mismo patrón
// perezoso que usa auth.middleware con JWT_SECRET: leer dentro de la función.
let advirtioVerify = false
let advirtioSecret = false

function verifyToken() {
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (!token && !advirtioVerify) {
    advirtioVerify = true
    logger.warn('PQR', 'WHATSAPP CFG', 'WHATSAPP_VERIFY_TOKEN no definido: Meta NO podrá verificar el webhook (GET responderá 403)')
  }
  return token
}

function appSecret() {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret && !advirtioSecret) {
    advirtioSecret = true
    logger.warn('PQR', 'WHATSAPP CFG', 'WHATSAPP_APP_SECRET no definido: los POST del webhook llegan SIN validación de firma')
  }
  return secret
}

// ─── Validación de firma X-Hub-Signature-256 ──────────────────────────────────
// Meta firma cada POST con HMAC-SHA256(APP_SECRET, cuerpo_raw). Fail-closed:
// si APP_SECRET está configurado y la firma no coincide → se rechaza el POST.
// Sin APP_SECRET (desarrollo) se omite la validación, advirtiendo una sola vez.
function firmaValida(req) {
  const secret = appSecret()
  if (!secret) return true

  const firmaRecibida = req.get('x-hub-signature-256')
  if (!firmaRecibida || !req.rawBody) return false

  const esperada = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')

  const a = Buffer.from(firmaRecibida)
  const b = Buffer.from(esperada)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ─── Extracción limpia del payload de Meta ────────────────────────────────────
/**
 * Recorre entry[].changes[].value{} y devuelve SOLO mensajes de texto entrantes.
 * Descarta:
 *  - value.statuses → acuses de Meta (delivered/read/sent): ruido esperado, sin log
 *  - messages con type !== 'text' (audio, imagen, botones…) → se registran para
 *    diagnosticar cuando un ciudadano envía algo que hoy no soportamos
 * @returns {Array<{telefono: string, texto: string, waId: string|null, timestamp: string|null, perfil: string|null}>}
 */
function extraerMensajesTexto(payload) {
  const extraidos = []

  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    return extraidos
  }

  for (const entry of payload.entry) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      if (!value) continue

      // Filtro de status: esta notificación es un acuse, no un mensaje
      if (Array.isArray(value.statuses) && value.statuses.length > 0) continue

      const perfil = value.contacts?.[0]?.profile?.name ?? null

      for (const msg of value.messages ?? []) {
        if (msg?.type === 'text' && msg.text?.body && msg.from) {
          extraidos.push({
            telefono:  msg.from,
            texto:     msg.text.body,
            waId:      msg.id ?? null,
            timestamp: msg.timestamp ?? null,
            perfil
          })
        } else if (msg?.type) {
          logger.info('PQR', 'WHATSAPP SKIP', `Mensaje tipo "${msg.type}" de +${msg.from ?? '?'} — solo se procesa texto`)
        }
      }
    }
  }

  return extraidos
}

// ─── Controlador ──────────────────────────────────────────────────────────────
export const WhatsappController = {
  /**
   * GET /api/pqr/whatsapp — Verificación del webhook (Meta la llama una sola vez
   * al guardar la URL del webhook en el panel de la app).
   */
  verificar(req, res) {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const esperado  = verifyToken()

    if (mode === 'subscribe' && token && esperado && token === esperado) {
      logger.success('PQR', 'WHATSAPP OK', 'Webhook verificado por Meta — challenge devuelto')
      // Texto plano, tal cual llegó: Meta compara byte a byte
      return res.status(200).send(challenge)
    }

    logger.warn('PQR', 'WHATSAPP 403', `Verificación rechazada (mode=${mode || '?'} · token=${token ? 'presente' : 'ausente'})`)
    return res.sendStatus(403)
  },

  /**
   * POST /api/pqr/whatsapp — Recepción de eventos (mensajes y acuses).
   *
   * REGLA DE ORO: cero awaits antes del res.sendStatus(200). Todo lo pesado
   * corre después, desacoplado, en el worker.
   */
  recibir(req, res) {
    // 1) Firma HMAC del POST (fail-closed si APP_SECRET está configurado)
    if (!firmaValida(req)) {
      logger.error('PQR', 'WHATSAPP FIRMA', 'X-Hub-Signature-256 inválida o ausente — POST rechazado')
      return res.sendStatus(401)
    }

    // 2) Extracción sincrónica del payload (solo texto entrante)
    const mensajes = extraerMensajesTexto(req.body)

    // 3) HTTP 200 INMEDIATO — a partir de acá Meta da el evento por recibido
    res.sendStatus(200)

    // 4) Delegación asíncrona: nada de lo que pase acá puede frenar la
    //    respuesta ni provocar un reintento de Meta
    for (const msg of mensajes) {
      setImmediate(() => {
        procesarMensajeEntrante(msg.telefono, msg.texto, msg).catch((err) => {
          logger.error('PQR', 'WHATSAPP WORKER', `+${msg.telefono} — ${err.message}`)
        })
      })
    }
  }
}
