/**
 * ai.service.js — Motor de IA conversacional de las PQR (Gemini).
 *
 * Responsabilidades:
 *  1. Memoria de sesión aislada por teléfono (Map en memoria + TTL 30 min):
 *     HTTP no tiene estado; aquí se simula para que la IA no pierda el hilo.
 *  2. Prompt Engineering defensivo: el Asistente de Operaciones de Acuasan
 *     solo recopila los datos de la PQR, una pregunta a la vez.
 *  3. Modo JSON: al completar los datos obligatorios devuelve
 *     {"estado":"COMPLETO","datos":{...}} — o {"estado":"HUMANO"} para handoff.
 *  4. Resistencia a fallos de red: timeout + reintentos con backoff.
 *
 * Desacoplado de Express: solo lo consume whatsapp.worker.js.
 */
import { GoogleGenAI } from '@google/genai'
import logger from '../../config/logger.js'

// ─── Configuración (lectura perezosa: dotenv corre tras evaluarse los imports) ─
const MODELO_DEFECTO = 'gemini-2.5-flash'
const INTENTOS_IA    = 3
const TIMEOUT_IA_MS  = 25_000

let cliente = null

function clienteGemini() {
  if (!cliente) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no definida: el asistente de IA no puede operar')
    }
    cliente = new GoogleGenAI({ apiKey })
  }
  return cliente
}

// ─── Memoria de sesión (TTL 30 minutos) ───────────────────────────────────────
// telefono → { historial: [{role, parts}], expira: epoch_ms }
// Map en memoria: válido para 1 instancia (Railway/Render). Multi-instancia → Redis.
const TTL_SESION_MS  = 30 * 60 * 1000
const MAX_TURNOS_HISTORIAL = 24 // tope de mensajes enviados al modelo (costo/tokens)
const SESIONES = new Map()

function obtenerSesion(telefono) {
  const ahora = Date.now()

  // Purga oportunista: limpiar expiradas al acceder mantiene el Map acotado
  for (const [tel, s] of SESIONES) {
    if (s.expira < ahora) SESIONES.delete(tel)
  }

  let sesion = SESIONES.get(telefono)
  if (!sesion || sesion.expira < ahora) {
    sesion = { historial: [], expira: ahora + TTL_SESION_MS }
    SESIONES.set(telefono, sesion)
    logger.info('PQR', 'SESION NUEVA', `+${telefono} (activas: ${SESIONES.size})`)
  }

  // Cada mensaje del ciudadano renueva el TTL: 30 min de INactividad cierran la sesión
  sesion.expira = ahora + TTL_SESION_MS
  return sesion
}

// ─── System Prompt defensivo ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el Asistente de Operaciones de Acuasan, la empresa de acueducto, alcantarillado y aseo. Atiendes por WhatsApp el registro de PQR (Peticiones, Quejas y Reclamos) de los ciudadanos.

IDENTIDAD Y LÍMITES (INNEGOCIABLES):
- Tu ÚNICA función es recopilar los datos para radicar una PQR. No eres un chatbot general.
- Si el ciudadano pregunta por temas ajenos (facturación, cortes de servicio, información técnica, legal o charla general), respónde con amabilidad que solo puedes registrar PQR, y ofrece continuar el registro o pasar a un operador humano.
- NUNCA inventes ni supongas datos que el ciudadano no haya dicho: prefieres preguntar de nuevo antes que adivinar.
- NUNCA prometas tiempos de solución ni des información operativa de Acuasan.

DATOS OBLIGATORIOS A RECOLECTAR (en orden, UNA pregunta a la vez):
1. usuario: nombre completo de quien reporta.
2. direccion: dirección del inmueble afectado INCLUYENDO el barrio (ej.: "Calle 5 #3-21, barrio Centro").
3. motivo: exactamente uno de estos tres valores: ACUEDUCTO, ALCANTARILLADO o ASEO. Si el ciudadano lo expresa de otra forma ("no llega agua", "alcantarilla desbordada", "no recogen basuras"), infiere el motivo y CONFÍRMALO en tu siguiente pregunta.
4. descripcion: descripción breve del daño o situación reportada.

ESTILO:
- Español de Colombia, trato de usted, cordial y breve (máximo 3 líneas por mensaje).
- Saluda y preséntate solo al inicio de una conversación nueva.
- Una sola pregunta por mensaje. Si el ciudadano da varios datos de golpe, agradécele y pregunta solo por el que falte.

FORMATO DE RESPUESTA (ESTRICTO, tu salida se verifica por máquina):
- Mientras falte algún dato obligatorio: responde ÚNICAMENTE texto natural con la siguiente pregunta. NUNCA incluyas JSON en esta fase.
- Cuando tengas los CUATRO datos completos: responde ÚNICAMENTE este JSON en una sola línea, sin markdown, sin saludos y sin ningún texto adicional:
{"estado":"COMPLETO","datos":{"usuario":"","direccion":"","motivo":"ACUEDUCTO","descripcion":""}}
- Si el ciudadano pide explícitamente hablar con una persona, se frustra, te insulta o quiere abandonar el registro: responde ÚNICAMENTE:
{"estado":"HUMANO"}
- COMPLETO y HUMANO son terminales: jamás los mezcles con texto natural ni agregues campos.`

// ─── Llamada al modelo con timeout + reintentos ───────────────────────────────
function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function conTimeout(promesa, ms) {
  let timer
  const timeout = new Promise((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`Timeout de ${ms}ms esperando a Gemini`)), ms)
  })
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer))
}

function extraerTexto(respuesta) {
  return (
    respuesta?.text ??
    respuesta?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') ??
    ''
  )
}

async function llamarModelo(historial) {
  let ultimoError = null

  for (let intento = 1; intento <= INTENTOS_IA; intento++) {
    try {
      const respuesta = await conTimeout(
        clienteGemini().models.generateContent({
          model: process.env.GEMINI_MODEL || MODELO_DEFECTO,
          contents: historial,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.3 // determinista: extracción de datos, no creatividad
          }
        }),
        TIMEOUT_IA_MS
      )

      const texto = extraerTexto(respuesta)
      if (!texto) throw new Error('Gemini devolvió una respuesta vacía')

      return texto
    } catch (error) {
      ultimoError = error
      logger.warn('PQR', 'IA REINTENTO', `intento ${intento}/${INTENTOS_IA} — ${error.message}`)
      if (intento < INTENTOS_IA) await dormir(400 * 2 ** (intento - 1)) // 400ms, 800ms
    }
  }

  throw ultimoError
}

// ─── Interpretación de la salida del modelo ───────────────────────────────────
const MOTIVOS_VALIDOS = ['ACUEDUCTO', 'ALCANTARILLADO', 'ASEO']

function normalizarMotivo(motivo) {
  const limpio = String(motivo || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // quita marcas combinantes (tildes): "ASEÓ" -> "ASEO"
  return MOTIVOS_VALIDOS.find((m) => limpio === m) || null
}

function validarDatos(datos) {
  const usuario     = String(datos?.usuario     ?? '').trim()
  const direccion   = String(datos?.direccion   ?? '').trim()
  const descripcion = String(datos?.descripcion ?? '').trim()
  const motivo      = normalizarMotivo(datos?.motivo)

  if (!usuario || !direccion || !descripcion || !motivo) return null

  // Límites defensivos antes de tocar la BD
  return {
    usuario:     usuario.slice(0, 120),
    direccion:   direccion.slice(0, 200),
    motivo,
    descripcion: descripcion.slice(0, 1000)
  }
}

/**
 * Clasifica la salida del modelo en una de las tres acciones del worker.
 * Tolerante a fences de markdown y JSON rodeado de prosa accidental.
 */
function interpretarSalida(textoModelo) {
  const bruto = String(textoModelo || '').trim()

  // 1. Quitar fences de markdown si el modelo los agregó pese a la prohibición
  const limpio = bruto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // 2. Intentar parse directo; si falla, aislar el objeto entre la primera { y la última }
  let objeto = null
  try {
    objeto = JSON.parse(limpio)
  } catch {
    const ini = limpio.indexOf('{')
    const fin = limpio.lastIndexOf('}')
    if (ini !== -1 && fin > ini) {
      try { objeto = JSON.parse(limpio.slice(ini, fin + 1)) } catch { objeto = null }
    }
  }

  if (objeto && typeof objeto === 'object') {
    if (objeto.estado === 'HUMANO') {
      return { tipo: 'HUMANO' }
    }

    if (objeto.estado === 'COMPLETO') {
      const datos = validarDatos(objeto.datos)
      if (datos) return { tipo: 'COMPLETO', datos }

      // JSON COMPLETO pero inválido: jamás enviar JSON crudo al ciudadano.
      // Se pide confirmación para que el modelo re-emita el JSON correcto.
      logger.warn('PQR', 'IA JSON INVALIDO', 'estado COMPLETO con datos incompletos — se pide confirmación')
      return { tipo: 'TEXTO', texto: 'Casi listo. ¿Me confirma que los datos de su reporte están completos y correctos para radicar su PQR?' }
    }
  }

  return { tipo: 'TEXTO', texto: bruto }
}

// ─── API pública ──────────────────────────────────────────────────────────────
export const AiService = {
  /**
   * Procesa un mensaje del ciudadano con todo su contexto previo.
   * @param {string} telefono - WhatsApp del ciudadano (clave de la sesión)
   * @param {string} mensaje  - Texto entrante
   * @param {object} [meta]   - Contexto del webhook { perfil } — recuerda el
   *                            último nombre de perfil conocido de WhatsApp
   * @returns {Promise<{tipo:'TEXTO',texto:string}|{tipo:'COMPLETO',datos:object}|{tipo:'HUMANO'}>}
   */
  async procesar(telefono, mensaje, meta = {}) {
    const sesion = obtenerSesion(telefono)

    // Meta envía el perfil con cada mensaje; se conserva el último conocido
    // para que la alerta de handoff lo tenga aunque ese POST no lo trajera
    if (meta.perfil) sesion.perfil = meta.perfil

    // El mensaje del ciudadano queda en historial ANTES de llamar al modelo:
    // si la IA falla, el contexto no se pierde y el reintento lo trae todo.
    sesion.historial.push({ role: 'user', parts: [{ text: mensaje }] })
    sesion.historial = sesion.historial.slice(-MAX_TURNOS_HISTORIAL)

    const textoModelo = await llamarModelo(sesion.historial)
    const resultado   = interpretarSalida(textoModelo)

    // Solo las respuestas conversacionales alimentan el hilo: COMPLETO y
    // HUMANO son terminales (el worker cierra la sesión o reintenta el radicado)
    if (resultado.tipo === 'TEXTO') {
      sesion.historial.push({ role: 'model', parts: [{ text: textoModelo }] })
    }

    return resultado
  },

  /**
   * Volcado del historial conversacional de un teléfono en formato legible
   * para el operador humano. Se lee ANTES de limpiarSesion() en un handoff:
   * el operario recibe el contexto completo y no vuelve a preguntar nombre
   * ni problema.
   */
  obtenerHistorial(telefono) {
    const sesion = SESIONES.get(telefono)
    if (!sesion) return []

    return sesion.historial.map((turno) => ({
      de:    turno.role === 'user' ? 'ciudadano' : 'asistente',
      texto: turno.parts.map((p) => p.text).filter(Boolean).join('')
    }))
  },

  /**
   * Último perfil de WhatsApp conocido del teléfono (o null). Se lee ANTES de
   * limpiarSesion() en un handoff, igual que obtenerHistorial().
   */
  obtenerPerfil(telefono) {
    return SESIONES.get(telefono)?.perfil ?? null
  },

  /**
   * Cierra la sesión de un teléfono. El worker la invoca cuando la PQR quedó
   * radicada (o el handoff se aceptó). Si PqrService.crear falla, NO se llama:
   * la memoria conserva los datos y el siguiente mensaje reintenta el radicado.
   */
  limpiarSesion(telefono) {
    if (SESIONES.delete(telefono)) {
      logger.info('PQR', 'SESION CERRADA', `+${telefono}`)
    }
  }
}
