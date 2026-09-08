<template>
  <div class="panel-atencion-card">
    <div v-if="!pqr" class="empty-state">
      <div class="empty-icon">📂</div>
      <p class="empty-text">Seleccione un registro PQR del listado para ver el detalle y gestionar la respuesta.</p>
    </div>

    <div v-else class="pqr-detail">
      <div class="detail-header">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="radicado-pill">Registro PQR</span>
            <span
              :class="['badge-remitente', esRemitenteIA ? 'remitente-ia' : 'remitente-operador']"
              :title="esRemitenteIA ? 'Reporte recibido y procesado por la IA de WhatsApp' : 'Registrado por funcionario en ventanilla'"
            >
              {{ esRemitenteIA ? '🤖 Generado por IA (WhatsApp)' : '👤 Ingresado por Operador' }}
            </span>
          </div>
          <h3 class="subject-title">{{ pqr.motivo }}</h3>
        </div>
        <span class="status-badge" :class="'status-' + (pqr.estado || '').toLowerCase()">
          {{ pqr.estado }}
        </span>
      </div>

      <!-- Tarjeta informativa del Ciudadano y Ubicación -->
      <div class="citizen-card">
        <div class="citizen-item">
          <span class="label">👤 Usuario / Solicitante:</span>
          <span class="value fw-bold text-dark">{{ pqr.usuario || 'No especificado' }}</span>
        </div>
        <div class="citizen-item">
          <span class="label">📱 Teléfono WhatsApp:</span>
          <div class="d-flex align-items-center gap-2">
            <span class="value fw-bold text-success">{{ pqr.telefono || 'Sin celular' }}</span>
            <a
              v-if="pqr.telefono"
              :href="linkWhatsApp"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-wa-link"
              title="Abrir chat de WhatsApp Web con el usuario"
            >
              <span>💬 Abrir WhatsApp</span>
            </a>
          </div>
        </div>
        <div class="citizen-item">
          <span class="label">📍 Dirección del Problema:</span>
          <span class="value text-primary fw-semibold">{{ pqr.direccion || 'Sector San Gil' }}</span>
        </div>
        <div class="citizen-item">
          <span class="label">📅 Fecha de Registro:</span>
          <span class="value">{{ pqr.fechaRadicado }}</span>
        </div>
        <div class="citizen-item">
          <span class="label">🕒 Horario de Atención:</span>
          <span class="value font-mono text-dark fw-bold">
            Desde {{ horario.inicio }} hasta {{ horario.fin }}
            <span class="text-success small ms-1">({{ horario.duracion }})</span>
          </span>
        </div>
        <div class="citizen-item" v-if="pqr.matricula">
          <span class="label">🚰 Matrícula / Cuenta:</span>
          <span class="value font-mono">{{ pqr.matricula }}</span>
        </div>
      </div>

      <!-- Problema que se solicita -->
      <div class="pqr-description">
        <h4 class="section-subtitle">🚨 Detalle del Problema Solicitado</h4>
        <p class="desc-text">{{ pqr.descripcion }}</p>
      </div>

      <!-- ==================== CHAT DE WHATSAPP: CONVERSACIÓN CON EL USUARIO ==================== -->
      <div class="wa-chat-card mb-4">
        <div class="wa-chat-header" @click="mostrarChat = !mostrarChat">
          <div class="d-flex align-items-center gap-2">
            <div class="wa-avatar-header">🤖</div>
            <div>
              <div class="wa-header-title">Conversación que se tuvo con el usuario (Chat WhatsApp)</div>
              <div class="wa-header-sub">
                Interacción entre <strong>{{ pqr.usuario || 'Ciudadano' }}</strong> y el <strong>Asistente IA de Acuasan</strong>
              </div>
            </div>
          </div>
          <button type="button" class="btn-toggle-chat" @click.stop="mostrarChat = !mostrarChat">
            {{ mostrarChat ? '▲ Ocultar Chat' : '▼ Ver Conversación' }}
          </button>
        </div>

        <div v-show="mostrarChat" class="wa-chat-body">
          <!-- Fecha central en el chat -->
          <div class="wa-date-divider">
            <span>{{ pqr.fechaRadicado || 'Hoy' }} &bull; Sesión de Atención Virtual</span>
          </div>

          <!-- Burbujas de mensajes -->
          <div
            v-for="(msg, i) in listaMensajes"
            :key="i"
            :class="['wa-bubble-row', msg.de === 'ia' ? 'row-ia' : 'row-user']"
          >
            <div :class="['wa-bubble', msg.de === 'ia' ? 'bubble-ia' : 'bubble-user']">
              <div class="bubble-author">
                <span v-if="msg.de === 'ia'" class="author-ia">🤖 Asistente Virtual Acuasan (IA)</span>
                <span v-else class="author-user">👤 {{ pqr.usuario || 'Usuario' }}</span>
              </div>
              <div class="bubble-text">{{ msg.texto }}</div>
              <div class="bubble-meta">
                <span class="msg-time">{{ msg.hora }}</span>
                <span class="msg-ticks" v-if="msg.de === 'ia'">✓✓</span>
              </div>
            </div>
          </div>

          <div class="wa-chat-footer-note">
            🔒 Esta conversación fue procesada y estructurada automáticamente por la IA de Acuasan.
          </div>
        </div>
      </div>

      <!-- Respuesta oficial -->
      <div class="response-section">
        <h4 class="section-subtitle">✍ Redactar Respuesta Oficial Acuasan</h4>
        <textarea
          v-model="respuestaTexto"
          rows="4"
          class="response-textarea"
          placeholder="Escriba la respuesta técnica o administrativa que se notificará al usuario..."
        ></textarea>

        <div class="action-bar">
          <button class="btn btn-secondary" type="button" @click="$emit('escalar', pqr)">
            ⚙ Escalar a Cuadrilla Técnica
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!respuestaTexto.trim()"
            @click="enviarRespuesta"
          >
            ✉ Notificar y Guardar Respuesta
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  pqr: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['responder', 'escalar'])

const respuestaTexto = ref('')
const mostrarChat = ref(true)

const esRemitenteIA = computed(() => {
  if (!props.pqr) return false
  const r = (props.pqr.remitente || '').toUpperCase()
  if (r === 'IA') return true
  if (r === 'OPERADOR') return false
  const actor = (props.pqr.actor || props.pqr.respondidoPor || '').toLowerCase()
  return actor.includes('whatsapp') || actor.includes('bot') || actor.includes('ia') || !props.pqr.matricula
})

const linkWhatsApp = computed(() => {
  if (!props.pqr?.telefono) return '#'
  const limpio = String(props.pqr.telefono).replace(/\D/g, '')
  const conPrefijo = limpio.startsWith('57') ? limpio : `57${limpio}`
  const texto = encodeURIComponent(`Hola ${props.pqr.usuario || ''}, te contactamos de Acuasan respecto a tu solicitud de PQR: ${props.pqr.motivo}.`)
  return `https://wa.me/${conPrefijo}?text=${texto}`
})

const horario = computed(() => {
  if (!props.pqr) return { inicio: 'N/D', fin: 'N/D', duracion: '0 min' }
  if (props.pqr.horaInicio && props.pqr.horaFin) {
    return {
      inicio: props.pqr.horaInicio,
      fin: props.pqr.horaFin,
      duracion: props.pqr.duracionMinutos ? `${props.pqr.duracionMinutos} min` : '5 min'
    }
  }
  if (props.pqr.fechaRadicado) {
    const d = new Date(props.pqr.fechaRadicado)
    if (!isNaN(d.getTime())) {
      const hInicio = new Date(d.getTime() - 6 * 60 * 1000)
      return {
        inicio: hInicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        fin: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        duracion: '6 min'
      }
    }
  }
  return {
    inicio: '08:15 a. m.',
    fin: '08:21 a. m.',
    duracion: '6 min'
  }
})

const listaMensajes = computed(() => {
  if (!props.pqr) return []

  // 1. Si ya viene un array conversacion estructurado (del webhook de WhatsApp o base de datos)
  let conv = props.pqr.conversacion
  if (typeof conv === 'string') {
    try { conv = JSON.parse(conv) } catch (e) {}
  }

  if (Array.isArray(conv) && conv.length > 0) {
    return conv.map(m => ({
      de: m.de === 'ia' || m.de === 'asistente' || m.de === 'bot' ? 'ia' : 'user',
      texto: m.texto || m.mensaje || m.body || '',
      hora: m.hora || horario.value.inicio
    }))
  }

  // 2. Si en el historial hay transcripción almacenada
  if (Array.isArray(props.pqr.historial)) {
    const eventoChat = props.pqr.historial.find(h =>
      h.observaciones && h.observaciones.includes('Conversación con el asistente')
    )
    if (eventoChat) {
      const lineas = eventoChat.observaciones
        .replace('💬 Conversación con el asistente (transcripción):\n', '')
        .split('\n')
        .filter(Boolean)

      if (lineas.length > 0) {
        return lineas.map((l, idx) => {
          const esDeIa = l.startsWith('[IA]') || l.startsWith('[BOT]') || l.startsWith('[ASISTENTE]')
          const textoLimpio = l.replace(/^\[(USUARIO|CIUDADANO|IA|BOT|ASISTENTE|\?)\]\s*/i, '')
          return {
            de: esDeIa ? 'ia' : 'user',
            texto: textoLimpio,
            hora: idx === 0 ? horario.value.inicio : horario.value.fin
          }
        })
      }
    }
  }

  // 3. Mensaje exacto del usuario y respuesta de la IA (sin frases artificiales intermedias)
  const u = props.pqr.usuario || 'Usuario'
  const desc = props.pqr.descripcion || props.pqr.motivo || 'Solicitud de atención'
  const dir = props.pqr.direccion ? ` en ${props.pqr.direccion}` : ''
  const mot = props.pqr.motivo ? ` respecto a ${props.pqr.motivo}` : ''
  const hIni = horario.value.inicio
  const hFin = horario.value.fin

  return [
    {
      de: 'user',
      texto: desc,
      hora: hIni
    },
    {
      de: 'ia',
      texto: `Hola, señor(a) ${u}. Hemos recibido y registrado su solicitud${mot}${dir}. La información ha sido transferida al equipo operativo de Acuasan para su trámite y atención oportuna.`,
      hora: hFin
    }
  ]
})

watch(() => props.pqr, () => {
  respuestaTexto.value = ''
})

const enviarRespuesta = () => {
  emit('responder', {
    pqrId: props.pqr.id,
    respuesta: respuestaTexto.value
  })
  respuestaTexto.value = ''
}
</script>

<style scoped>
.panel-atencion-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  min-height: 500px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #94a3b8;
  text-align: center;
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.radicado-pill {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0284c7;
  background: #e0f2fe;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-block;
}

.badge-remitente {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-block;
}

.remitente-ia {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.remitente-operador {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.btn-wa-link {
  font-size: 0.72rem;
  background: #25d366;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  transition: background 0.2s;
}

.btn-wa-link:hover {
  background: #1eb956;
  color: #ffffff;
}

.subject-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin: 6px 0 0 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-abierto {
  background: #fee2e2;
  color: #b91c1c;
}

.status-en_tramite {
  background: #fef3c7;
  color: #b45309;
}

.status-resuelto {
  background: #dcfce7;
  color: #15803d;
}

.citizen-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;
}

.citizen-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e293b;
}

.section-subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: #334155;
  margin: 0 0 8px 0;
}

.desc-text {
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.5;
  background: #ffffff;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  white-space: pre-wrap;
}

/* ==================== ESTILO CHAT WHATSAPP ==================== */
.wa-chat-card {
  background: #efeae2;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.wa-chat-header {
  background: #075e54;
  color: #ffffff;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.wa-avatar-header {
  font-size: 1.4rem;
  background: rgba(255, 255, 255, 0.2);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wa-header-title {
  font-weight: 700;
  font-size: 0.88rem;
  line-height: 1.2;
}

.wa-header-sub {
  font-size: 0.72rem;
  opacity: 0.85;
}

.btn-toggle-chat {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-toggle-chat:hover {
  background: rgba(255, 255, 255, 0.25);
}

.wa-chat-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
  background-color: #efeae2;
  background-image: radial-gradient(#d1d7db 1px, transparent 1px);
  background-size: 20px 20px;
}

.wa-date-divider {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.wa-date-divider span {
  background: #ffffff;
  color: #54656f;
  font-size: 0.7rem;
  padding: 3px 12px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-weight: 600;
}

.wa-bubble-row {
  display: flex;
  width: 100%;
}

.row-user {
  justify-content: flex-start;
}

.row-ia {
  justify-content: flex-end;
}

.wa-bubble {
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.13);
  position: relative;
  font-size: 0.85rem;
  line-height: 1.4;
}

.bubble-user {
  background: #ffffff;
  color: #111b21;
  border-top-left-radius: 0;
}

.bubble-ia {
  background: #d9fdd3;
  color: #111b21;
  border-top-right-radius: 0;
}

.bubble-author {
  font-size: 0.72rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.author-user {
  color: #128c7e;
}

.author-ia {
  color: #075e54;
}

.bubble-text {
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.65rem;
  color: #667781;
}

.msg-ticks {
  color: #53bdeb;
  font-weight: 700;
}

.wa-chat-footer-note {
  text-align: center;
  font-size: 0.7rem;
  color: #667781;
  padding-top: 8px;
  border-top: 1px dashed #cbd5e1;
}

/* Redacción de respuesta */
.response-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  outline: none;
  resize: vertical;
  margin-bottom: 16px;
}

.response-textarea:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: #0284c7;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #0369a1;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
