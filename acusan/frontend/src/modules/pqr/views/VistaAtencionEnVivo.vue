<script setup>
/**
 * VistaAtencionEnVivo — Ruta hija del dashboard (/pqr/dashboard/atencion/:telefono).
 *
 * Muestra el contexto completo de la alerta de handoff que el backend envió
 * por Socket.io: perfil, teléfono y el volcado de la conversación que llevó
 * el asistente de IA hasta el momento en que el ciudadano pidió un humano.
 * El operario lee el hilo y NO vuelve a preguntar nombre ni problema.
 *
 * Al entrar, la alerta sale de la cola compartida (queda en manos de este
 * operario). Sus respuestas viajan por POST /api/pqr/whatsapp/responder
 * (Fase 6) y la burbuja del operario se renderiza al confirmar el 200.
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import { usePqrStore } from '../../../stores/pqrStore'
import whatsappService from '../services/whatsappService.js'

const route = useRoute()
const router = useRouter()
const pqrStore = usePqrStore()

const telefono = route.params.telefono

// Captura local ANTES de sacar la alerta de la cola: la vista queda
// auto-suficiente aunque el store cambie o se vacíe
const alerta = ref(null)
const respuesta = ref('')
const mensajes = ref([]) // historial vivo: el de la alerta + burbujas del operario
const enviando = ref(false)
const errorEnvio = ref(null)

onMounted(() => {
  alerta.value = pqrStore.alertasPendientes.find(a => a.telefono === telefono) || null
  if (alerta.value) {
    mensajes.value = [...(alerta.value.historial || [])]
    pqrStore.removerAlerta(telefono)
  }
})

const enviarRespuesta = async () => {
  const texto = respuesta.value.trim()
  if (!texto || enviando.value) return

  enviando.value = true
  errorEnvio.value = null

  try {
    await whatsappService.responderPorWhatsApp({ telefono, mensaje: texto })
    // El 200 del backend confirma la entrega a Graph API: renderizar la
    // burbuja del operario recién en este punto evita burbujas fantasma
    mensajes.value.push({ de: 'operador', texto })
    respuesta.value = ''
  } catch (e) {
    errorEnvio.value = e.message
  } finally {
    enviando.value = false
  }
}

const volver = () => router.push({ path: '/pqr/dashboard' })

const finalizarAtencion = () => {
  pqrStore.removerAlerta(telefono) // idempotente: ya pudo salir de la cola
  volver()
}
</script>

<template>
  <section class="card sombra-atencion" aria-label="Atención en vivo">
    <header class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div>
        <h2 class="h5 mb-0">🧑‍💼 Atención en vivo — {{ alerta?.perfil || 'Ciudadano' }}</h2>
        <p class="mb-0 small text-secondary">
          WhatsApp +{{ telefono }}
          <span v-if="alerta?.generadoEn">
            · alerta generada {{ moment(alerta.generadoEn).format('DD/MM/YYYY HH:mm') }}
          </span>
        </p>
      </div>
      <button class="btn btn-sm btn-outline-secondary" @click="volver">← Volver al dashboard</button>
    </header>

    <div v-if="!alerta" class="card-body">
      <div class="alert alert-info mb-0" role="alert">
        Esta alerta ya no está disponible (fue atendida, expiró o se entró por enlace directo
        tras recargar la página). Regrese al dashboard y atienda una alerta activa.
      </div>
    </div>

    <template v-else>
      <!-- Conversación viva: contexto de la alerta + respuestas del operario -->
      <div class="card-body chat-historial" aria-label="Conversación con el ciudadano">
        <p class="text-secondary small mb-3">
          Contexto previo del ciudadano con el asistente de IA — no vuelva a preguntar
          nombre ni problema:
        </p>
        <div
          v-for="(turno, i) in mensajes"
          :key="i"
          class="d-flex mb-2"
          :class="turno.de === 'ciudadano' ? 'justify-content-start' : 'justify-content-end'"
        >
          <article
            class="burbuja"
            :class="turno.de === 'ciudadano' ? 'burbuja-ciudadano' : turno.de === 'operador' ? 'burbuja-operador' : 'burbuja-asistente'"
          >
            <footer class="burbuja-autor">
              {{ turno.de === 'ciudadano' ? '👤 Ciudadano' : turno.de === 'operador' ? '🧑‍💼 Operador' : '🤖 Asistente' }}
            </footer>
            {{ turno.texto }}
          </article>
        </div>
        <p v-if="!mensajes.length" class="text-secondary small">
          El ciudadano pidió un operador apenas inició la conversación: no hay mensajes previos.
        </p>
      </div>

      <!-- Respuesta del operario: viaja al backend y retorna como burbuja al confirmar el 200 -->
      <footer class="card-footer">
        <div v-if="errorEnvio" class="alert alert-danger py-2 small mb-2" role="alert">
          {{ errorEnvio }}
        </div>
        <div class="d-flex gap-2">
          <textarea
            v-model="respuesta"
            class="form-control"
            rows="2"
            placeholder="Escriba la respuesta para el ciudadano…"
            aria-label="Respuesta al ciudadano"
            @keydown.enter.exact.prevent="enviarRespuesta"
          ></textarea>
          <button
            class="btn btn-success align-self-end"
            :disabled="enviando || !respuesta.trim()"
            @click="enviarRespuesta"
          >
            <span v-if="enviando" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            {{ enviando ? 'Enviando…' : 'Enviar por WhatsApp' }}
          </button>
        </div>
        <small class="text-secondary d-block mt-1">
          Enter envía · Shift+Enter salta línea
        </small>
        <hr>
        <button class="btn btn-outline-primary" @click="finalizarAtencion">
          ✓ Marcar atención como finalizada
        </button>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.sombra-atencion {
  box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.08);
}

.chat-historial {
  max-height: 52vh;
  overflow-y: auto;
  background: #f8f9fa;
}

.burbuja {
  max-width: 78%;
  padding: 0.5rem 0.85rem;
  border-radius: 1rem;
  font-size: 0.95rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.burbuja-ciudadano {
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-bottom-left-radius: 0.25rem;
}

.burbuja-asistente {
  background: #d1e7dd;
  border: 1px solid #badbcc;
  border-bottom-right-radius: 0.25rem;
}

.burbuja-operador {
  background: #cfe2ff;
  border: 1px solid #b6d4fe;
  border-bottom-right-radius: 0.25rem;
}

.burbuja-autor {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.6;
  margin-bottom: 0.15rem;
}
</style>
