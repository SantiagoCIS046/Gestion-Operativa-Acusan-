/**
 * whatsapp.worker.js — Orquestador asíncrono del flujo PQR por WhatsApp.
 *
 * Corre DESACOPLADO del request HTTP: whatsapp.controller.js ya respondió 200
 * a Meta cuando esto ejecuta. Su trabajo es evaluar la respuesta de la IA
 * (ai.service.js) y ejecutar la acción correspondiente:
 *
 *   TEXTO    → devolver la respuesta conversacional vía Graph API (sender)
 *   COMPLETO → PqrService.crear() (capa blindada de Z.ai) + enviar radicado
 *   HUMANO   → cerrar sesión y notificar (handoff Socket.io queda para Fase 5)
 *
 * Diseño anti-pérdida: si la IA o la BD fallan, la sesión NO se limpia —
 * el mensaje del ciudadano ya quedó en el historial y su siguiente mensaje
 * reintenta con todo el contexto intacto.
 */
import logger from '../../config/logger.js'
import { emitirEventoSeguro } from '../../config/socket.config.js'
import { AiService } from './ai.service.js'
import { PqrService } from './pqr.service.js'
import { enviarMensajeWhatsApp } from './whatsapp.sender.js'

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

// ─── Mensajes de salida (trato de usted, español de Colombia) ─────────────────
const MENSAJE_ERROR =
  '⚠️ Disculpe el inconveniente. Presentamos una falla técnica momentánea. ' +
  'Por favor reenvíenos su mensaje en unos instantes; su conversación no se pierde.'

const MENSAJE_HANDOFF =
  '🧑‍💼 Con mucho gusto. En breve un operador humano de Acuasan continuará ' +
  'atendiendo su caso. Gracias por su paciencia.'

function mensajeRadicacion(datos, pqr) {
  const primerNombre = String(datos.usuario || '').trim().split(/\s+/)[0] || 'ciudadano'
  return (
    `✅ ¡Gracias, ${primerNombre}! Su PQR quedó radicada correctamente.\n\n` +
    `📌 Radicado: *${pqr.radicado}*\n` +
    `📋 Estado: ${pqr.estado}\n` +
    `⏱️ Tendrá respuesta dentro de los 15 días hábiles siguientes a la radicación.\n\n` +
    'Conserve su número de radicado para consultas futuras.'
  )
}

// ─── Punto único de entrada ───────────────────────────────────────────────────
/**
 * @param {string} telefono - WhatsApp del remitente (ej. '573001234567')
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

  try {
    // 2) La IA decide: preguntar algo (TEXTO), radicar (COMPLETO) o handoff (HUMANO)
    const respuesta = await AiService.procesar(telefono, mensaje, meta)

    if (respuesta.tipo === 'COMPLETO') {
      // Transcripción del intercambio con el asistente: se captura ANTES de
      // crear (la sesión sigue viva) y viaja al radicado como registro de
      // cómo se obtuvo la información que la IA extrajo
      const conversacion = AiService.obtenerHistorial(telefono)

      // El teléfono del WhatsApp viaja con los datos: PqrService hace upsert
      // del ciudadano y crea PQR + historial en una transacción atómica
      const pqr = await PqrService.crear({
        ...respuesta.datos,
        telefono,
        ...(conversacion.length ? { conversacion } : {})
      })

      // La sesión se libera SOLO si el radicado se confirmó en BD: si crear()
      // falla, la memoria conserva los datos y el siguiente mensaje reintenta
      AiService.limpiarSesion(telefono)

      await enviarMensajeWhatsApp(telefono, mensajeRadicacion(respuesta.datos, pqr))
      logger.success('PQR', 'PQR RADICADA', `+${telefono} → ${pqr.radicado} (${respuesta.datos.motivo})`)
      return { radicado: pqr.radicado }
    }

    if (respuesta.tipo === 'HUMANO') {
      // El volcado debe capturarse ANTES de cerrar la sesión (limpiarSesion
      // borra el historial): el operario recibe el contexto completo y no
      // vuelve a preguntar el nombre ni el problema
      const historial = AiService.obtenerHistorial(telefono)
      const perfil    = meta.perfil ?? AiService.obtenerPerfil(telefono)
      AiService.limpiarSesion(telefono)

      // Alerta en tiempo real al panel de operadores (sala autenticada)
      emitirEventoSeguro('nueva_alerta_pqr', {
        telefono,
        alerta: true,
        perfil,
        historial,
        generadoEn: new Date().toISOString()
      })

      await enviarMensajeWhatsApp(telefono, MENSAJE_HANDOFF)
      logger.warn('PQR', 'HANDOFF', `+${telefono} pidió operador humano — alerta emitida a operadores (${historial.length} turnos)`)
      return { handoff: true }
    }

    // 3) Respuesta conversacional: devolverla al ciudadano tal cual salió de la IA
    await enviarMensajeWhatsApp(telefono, respuesta.texto)
    return { respondido: true }
  } catch (error) {
    logger.error('PQR', 'WHATSAPP WORKER', `+${telefono} — ${error.message}`)

    // El mensaje del ciudadano ya quedó en el historial de la sesión: con este
    // aviso, su siguiente mensaje reintenta con todo el contexto intacto.
    await enviarMensajeWhatsApp(telefono, MENSAJE_ERROR)
    return null
  }
}
