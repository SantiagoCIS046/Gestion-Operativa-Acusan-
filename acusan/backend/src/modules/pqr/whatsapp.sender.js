/**
 * whatsapp.sender.js — Envío de mensajes salientes por WhatsApp Cloud API.
 *
 * Usa la Graph API de Meta: POST /{version}/{PHONE_NUMBER_ID}/messages.
 * Resistente a fallos de red: timeout de 10s y un reintento. No lanza:
 * devuelve false y registra el error — el ciudadano nunca debe quedar a
 * ciegas por una falla transitoria, pero el worker tampoco debe caerse.
 */
import logger from '../../config/logger.js'

const TIMEOUT_ENVIO_MS = 10_000
const INTENTOS_ENVIO   = 2

function conTimeout(promesa, ms) {
  let timer
  const timeout = new Promise((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`Timeout de ${ms}ms enviando a Meta`)), ms)
  })
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer))
}

function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function enviarMensajeWhatsApp(telefono, texto) {
  // Lectura perezosa de credenciales (patrón del proyecto)
  const token    = process.env.WHATSAPP_TOKEN
  const phoneId  = process.env.WHATSAPP_PHONE_NUMBER_ID
  const version  = process.env.WHATSAPP_API_VERSION || 'v22.0'

  if (!token || !phoneId) {
    logger.error('PQR', 'WHATSAPP OUT CFG', 'WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no definidos — no se puede enviar')
    return false
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`

  for (let intento = 1; intento <= INTENTOS_ENVIO; intento++) {
    try {
      const resp = await conTimeout(
        fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: telefono,
            type: 'text',
            text: { preview_url: false, body: texto }
          })
        }),
        TIMEOUT_ENVIO_MS
      )

      if (!resp.ok) {
        const detalle = await resp.text().catch(() => '')
        throw new Error(`Graph API respondió ${resp.status}: ${detalle.slice(0, 300)}`)
      }

      return true
    } catch (error) {
      logger.warn('PQR', 'WHATSAPP OUT', `intento ${intento}/${INTENTOS_ENVIO} → +${telefono} — ${error.message}`)
      if (intento < INTENTOS_ENVIO) await dormir(600)
    }
  }

  logger.error('PQR', 'WHATSAPP OUT ERR', `No se pudo enviar el mensaje a +${telefono} tras ${INTENTOS_ENVIO} intentos`)
  return false
}
