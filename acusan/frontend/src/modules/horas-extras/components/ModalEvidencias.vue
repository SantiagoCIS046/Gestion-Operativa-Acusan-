<template>
  <transition name="fade">
    <div
      v-if="visible && horaExtra"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(2, 20, 38, 0.55); backdrop-filter: blur(3px); z-index: 1080;"
      @click.self="cerrar"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg rounded-3 overflow-hidden bg-white">

          <!-- Encabezado con identidad del registro -->
          <div class="modal-header border-bottom py-2 px-3 bg-light d-flex align-items-center">
            <div>
              <h6 class="modal-title fw-bold text-dark m-0" style="font-size: 0.92rem;">
                📷 Evidencias Fotográficas
              </h6>
              <span class="text-muted" style="font-size: 0.74rem;">
                {{ horaExtra.funcionario }} — C.C. {{ horaExtra.cedula }} ·
                {{ horaExtra.cuadrillaArea || horaExtra.area || 'Sin área' }}
              </span>
            </div>
            <button type="button" class="btn-close btn-close-sm ms-auto" @click="cerrar"></button>
          </div>

          <!-- Cuerpo: par INICIAL / FINAL -->
          <div class="modal-body p-3">
            <div v-if="cargando" class="text-center text-muted py-5">
              <span class="spinner-border spinner-border-sm me-2"></span>
              Cargando evidencias del registro...
            </div>

            <div v-else-if="errorCarga" class="alert alert-danger mb-0" style="font-size: 0.82rem;">
              {{ errorCarga }}
            </div>

            <div v-else-if="evidenciasOrdenadas.length === 0" class="text-center text-muted py-5">
              <div style="font-size: 1.6rem;">📷</div>
              Este registro no tiene evidencias fotográficas asociadas.
            </div>

            <div v-else class="d-flex flex-column gap-3">
              <div v-for="ev in evidenciasOrdenadas" :key="ev.id" class="evidencia-card">
                <div class="evidencia-cabecera">
                  <span class="evidencia-tipo">
                    {{ ev.tipo === 'FINAL' ? '🏁 Marca final' : '🟢 Marca inicial' }}
                  </span>
                  <span
                    v-if="capturadaOffline(ev)"
                    class="badge-offline"
                    title="La foto llegó al servidor más de 5 minutos después de ser capturada en el dispositivo"
                  >
                    ⚠ Capturada offline
                  </span>
                </div>

                <div class="evidencia-cuerpo">
                  <!-- Foto: fetch blob con Authorization → objectURL -->
                  <div class="foto-box">
                    <img
                      v-if="fotos[ev.id] && fotos[ev.id].url"
                      :src="fotos[ev.id].url"
                      alt="Foto de la evidencia"
                    />
                    <div v-else-if="fotos[ev.id] && fotos[ev.id].error" class="foto-placeholder">
                      📷<br />{{ fotos[ev.id].error }}
                    </div>
                    <div v-else class="foto-placeholder">
                      <span class="spinner-border spinner-border-sm me-2"></span>
                      Cargando foto...
                    </div>
                  </div>

                  <!-- Metadatos de auditoría -->
                  <div class="meta-list">
                    <div class="meta-fila">
                      <span class="meta-label">Capturada (dispositivo)</span>
                      <span class="meta-valor font-mono">{{ formatearFecha(ev.capturadaEn) }}</span>
                    </div>
                    <div class="meta-fila">
                      <span class="meta-label">Registrada (servidor)</span>
                      <span class="meta-valor font-mono">{{ formatearFecha(ev.registradaEn) }}</span>
                    </div>
                    <div class="meta-fila">
                      <span class="meta-label">Ubicación GPS</span>
                      <a
                        v-if="ev.latitud != null && ev.longitud != null"
                        :href="enlaceMapa(ev)"
                        target="_blank"
                        rel="noopener"
                        class="meta-mapa"
                        title="Ver ubicación en OpenStreetMap"
                      >
                        📍 {{ Number(ev.latitud).toFixed(5) }}, {{ Number(ev.longitud).toFixed(5) }}
                      </a>
                      <span v-else class="meta-valor text-muted">Sin GPS</span>
                    </div>
                    <div v-if="ev.precisionGps != null" class="meta-fila">
                      <span class="meta-label">Precisión GPS</span>
                      <span class="meta-valor font-mono">± {{ Math.round(Number(ev.precisionGps)) }} m</span>
                    </div>
                    <div v-if="ev.descripcion" class="meta-fila">
                      <span class="meta-label">Descripción</span>
                      <span class="meta-valor">{{ ev.descripcion }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pie: dictamen de revisión (ENCARGADO / GERENCIA / ADMIN) -->
          <div
            v-if="puedeRevisar && !cargando && !errorCarga && evidenciasOrdenadas.length > 0"
            class="modal-footer border-0 bg-light py-2 px-3 d-block"
          >
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <span class="text-muted" style="font-size: 0.76rem;">
                Estado de revisión:
                <span
                  class="badge-revision"
                  :class="'rev-' + String(estadoEvidenciaLocal || 'PENDIENTE_REVISION').toLowerCase()"
                >
                  {{ textoEstadoRevision }}
                </span>
              </span>
            </div>
            <textarea
              v-model="observaciones"
              class="form-control form-control-sm mb-2"
              rows="2"
              placeholder="Observaciones para el empleado (obligatorias al marcar OBSERVADA)..."
            ></textarea>
            <div class="d-flex justify-content-end gap-2">
              <button
                type="button"
                class="btn btn-sm btn-success fw-bold px-3 rounded-2"
                :disabled="revisando || estadoEvidenciaLocal === 'REVISADA'"
                @click="revisar('REVISADA')"
              >
                <span v-if="revisando" class="spinner-border spinner-border-sm me-1"></span>
                ✔ Marcar Revisada
              </button>
              <button
                type="button"
                class="btn btn-sm btn-warning fw-bold px-3 rounded-2"
                :disabled="revisando || estadoEvidenciaLocal === 'OBSERVADA'"
                @click="revisar('OBSERVADA')"
              >
                ⚠ Marcar Observada
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import horasExtrasService from '../services/horasExtrasService.js'
import notificacionService from '../../../services/notificacionService.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  horaExtra: { type: Object, default: null },
  // La revisión corresponde a ENCARGADO/GERENCIA/ADMIN (roles de la vista contenedora)
  puedeRevisar: { type: Boolean, default: false }
})

const emit = defineEmits(['cerrar', 'revisada'])
const lanzarAlertaBootstrap = notificacionService.mostrar

const evidencias = ref([])
const fotos = ref({})
const cargando = ref(false)
const errorCarga = ref('')
const observaciones = ref('')
const revisando = ref(false)
const estadoEvidenciaLocal = ref('')

// Orden fijo del par: primero la marca INICIAL, luego la FINAL
const ORDEN_TIPOS = ['INICIAL', 'FINAL']
const evidenciasOrdenadas = computed(() =>
  [...evidencias.value].sort(
    (a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo)
  )
)

const textoEstadoRevision = computed(() => {
  switch (estadoEvidenciaLocal.value) {
    case 'REVISADA': return 'Revisada'
    case 'OBSERVADA': return 'Observada'
    default: return 'Pendiente de revisión'
  }
})

// Libera las objectURL de las fotos cargadas (evita fugas de memoria)
const liberarFotos = () => {
  Object.values(fotos.value).forEach((f) => {
    if (f && f.url) URL.revokeObjectURL(f.url)
  })
  fotos.value = {}
}

const cerrar = () => emit('cerrar')

const cargar = async () => {
  if (!props.horaExtra) return
  liberarFotos()
  evidencias.value = []
  errorCarga.value = ''
  observaciones.value = ''
  estadoEvidenciaLocal.value = props.horaExtra.estadoEvidencia || ''
  cargando.value = true
  try {
    // Se filtra por cédula en el servidor y por registro en el cliente:
    // el listado no expone fotoBase64, las fotos se piden una a una
    const lista = await horasExtrasService.listarEvidencias({
      cedula: props.horaExtra.cedula,
      horaExtraId: props.horaExtra.id
    })
    evidencias.value = (Array.isArray(lista) ? lista : []).filter(
      (ev) => String(ev.horaExtraId) === String(props.horaExtra.id)
    )
    cargando.value = false
    // Fotos en paralelo: cada una aparece cuando llegue (placeholder mientras)
    evidencias.value.forEach(async (ev) => {
      try {
        const { url } = await horasExtrasService.obtenerFotoEvidencia(ev.id)
        fotos.value = { ...fotos.value, [ev.id]: { url } }
      } catch (e) {
        fotos.value = { ...fotos.value, [ev.id]: { error: e.message } }
      }
    })
  } catch (e) {
    errorCarga.value = e.message
    cargando.value = false
  }
}

watch(
  () => props.visible,
  (nuevo) => {
    if (nuevo) cargar()
    else liberarFotos() // al cerrar el modal: revocar las objectURL restantes
  }
)

onUnmounted(liberarFotos)

// Bandera de auditoría: la foto se capturó en el dispositivo pero llegó al
// servidor con más de 5 minutos de diferencia (subida offline diferida)
const capturadaOffline = (ev) => {
  if (!ev.capturadaEn || !ev.registradaEn) return false
  const delta = Math.abs(new Date(ev.registradaEn) - new Date(ev.capturadaEn))
  return Number.isFinite(delta) && delta > 5 * 60 * 1000
}

const formatearFecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

const enlaceMapa = (ev) =>
  `https://www.openstreetmap.org/?mlat=${ev.latitud}&mlon=${ev.longitud}#map=18/${ev.latitud}/${ev.longitud}`

const revisar = async (nuevoEstado) => {
  if (!props.horaExtra) return
  if (nuevoEstado === 'OBSERVADA' && !observaciones.value.trim()) {
    lanzarAlertaBootstrap(
      'warning',
      'Observaciones requeridas',
      'Para marcar la evidencia como OBSERVADA escriba la observación que verá el empleado.'
    )
    return
  }
  revisando.value = true
  try {
    const actualizada = await horasExtrasService.revisarEvidencia(props.horaExtra.id, {
      estadoEvidencia: nuevoEstado,
      observaciones: observaciones.value.trim()
    })
    estadoEvidenciaLocal.value = nuevoEstado
    lanzarAlertaBootstrap(
      'success',
      'Evidencia revisada',
      `El registro de ${props.horaExtra.funcionario} quedó marcado como ${
        nuevoEstado === 'REVISADA' ? 'revisado' : 'observado'
      }.`
    )
    emit('revisada', actualizada || { id: props.horaExtra.id, estadoEvidencia: nuevoEstado })
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  } finally {
    revisando.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.font-mono {
  font-family: monospace, monospace;
}

.evidencia-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
}

.evidencia-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.evidencia-tipo {
  font-size: 0.74rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.3px;
}

.badge-offline {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.68rem;
  font-weight: 700;
}

.evidencia-cuerpo {
  display: flex;
  gap: 14px;
  padding: 12px;
  flex-wrap: wrap;
}

.foto-box {
  width: 220px;
  height: 170px;
  flex-shrink: 0;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.foto-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.foto-placeholder {
  text-align: center;
  font-size: 0.72rem;
  color: #94a3b8;
  padding: 8px;
  line-height: 1.4;
}

.meta-list {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-fila {
  display: flex;
  align-items: baseline;
  gap: 10px;
  border-bottom: 1px dotted #e2e8f0;
  padding-bottom: 4px;
}

.meta-label {
  width: 170px;
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.3px;
}

.meta-valor {
  font-size: 0.78rem;
  color: #0f172a;
  font-weight: 600;
}

.meta-mapa {
  font-size: 0.78rem;
  font-weight: 700;
  font-family: monospace, monospace;
  color: #004884;
  text-decoration: none;
}
.meta-mapa:hover {
  text-decoration: underline;
  color: #00a3e0;
}

.badge-revision {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.rev-pendiente_revision {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}
.rev-revisada {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.rev-observada {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

@media (max-width: 576px) {
  .foto-box {
    width: 100%;
  }
  .meta-label {
    width: 130px;
  }
}
</style>
