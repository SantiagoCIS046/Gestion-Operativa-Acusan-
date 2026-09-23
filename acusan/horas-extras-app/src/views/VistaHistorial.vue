<template>
  <LayoutApp activo="historial" :empleado="empleado">

    <!-- Resumen KPI -->
    <div class="kpi-row" v-if="registros.length > 0">
      <div class="kpi-card">
        <span class="kpi-val kpi-val--cyan">{{ totalHoras }}h</span>
        <span class="kpi-lbl">Total Reportadas</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val" style="color:var(--acuusan-success);">{{ aprobadas }}</span>
        <span class="kpi-lbl">Aprobadas</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val" style="color:var(--acuusan-warning);">{{ pendientes }}</span>
        <span class="kpi-lbl">Pendientes</span>
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="empty-state">
      <div class="spinner" style="margin: 0 auto 12px;"></div>
      <p>Cargando tus registros...</p>
    </div>

    <!-- Sin registros -->
    <div v-else-if="registros.length === 0" class="empty-state">
      <div class="empty-state__icon">📋</div>
      <div class="empty-state__title">Sin registros aún</div>
      <div class="empty-state__sub">Tus horas reportadas aparecerán aquí.</div>
    </div>

    <!-- Lista de registros -->
    <div v-else>
      <div v-for="reg in registros" :key="reg.id" class="registro-card">
        <div class="reg-header">
          <div class="reg-area">{{ reg.cuadrillaArea }}</div>
          <div class="reg-badges">
            <span
              v-if="reg.numEvidencias"
              class="badge badge--camara"
              :title="`${reg.numEvidencias} fotos de evidencia`"
            >📷 {{ reg.numEvidencias }}</span>
            <span :class="['badge', `badge--${(reg.estado || '').toLowerCase()}`]">
              {{ estadoLabel(reg.estado) }}
            </span>
          </div>
        </div>

        <div v-if="reg.estadoEvidencia" class="reg-evidencia">
          <span :class="['badge', 'badge--ev', claseEvidencia(reg.estadoEvidencia)]">
            {{ evidenciaLabel(reg.estadoEvidencia) }}
          </span>
        </div>

        <div class="reg-meta">
          <span class="reg-meta-item">
            <span class="meta-icon">📅</span>
            {{ formatFecha(reg.fechaOperacion) }}
          </span>
          <span class="reg-meta-item">
            <span class="meta-icon">⏱️</span>
            {{ reg.cantidadHoras }}h — {{ tipoLabel(reg.tipoRecargo) }}
          </span>
        </div>

        <!-- Mini-timeline inicio → fin (sesiones con evidencia) -->
        <div v-if="reg.fechaInicio && reg.fechaFin" class="mini-timeline">
          <div class="mt-nodo">
            <span class="mt-punto"></span>
            <span class="mt-hora">{{ formatHora(reg.fechaInicio) }}</span>
          </div>
          <div class="mt-linea"></div>
          <div class="mt-nodo">
            <span class="mt-punto mt-punto--fin"></span>
            <span class="mt-hora">{{ formatHora(reg.fechaFin) }}</span>
          </div>
        </div>

        <div v-if="reg.justificacion" class="reg-just">
          "{{ reg.justificacion }}"
        </div>
        <div v-if="reg.autorizadoPor" class="reg-autorizado">
          ✅ Autorizado por: {{ reg.autorizadoPor }}
        </div>
      </div>
    </div>

    <!-- Botón de actualizar -->
    <button class="btn btn--ghost" style="margin-top: 8px;" @click="cargar" :disabled="cargando">
      🔄 Actualizar
    </button>
  </LayoutApp>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { authService, horasExtrasService } from '@/services/api.js'
import LayoutApp from '@/components/LayoutApp.vue'

const empleado = authService.getEmpleado()
const registros = ref([])
const cargando = ref(false)

const totalHoras = computed(() =>
  registros.value.reduce((a, r) => a + (Number(r.cantidadHoras) || 0), 0)
)
const aprobadas = computed(() => registros.value.filter(r => r.estado === 'APROBADO').length)
const pendientes = computed(() => registros.value.filter(r => r.estado === 'PENDIENTE').length)

const cargar = async () => {
  cargando.value = true
  try {
    registros.value = await horasExtrasService.misRegistros()
  } catch (e) {
    console.error(e)
  } finally {
    cargando.value = false
  }
}

const formatFecha = (fecha) => {
  if (!fecha) return ''
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatHora = (fecha) => {
  if (!fecha) return ''
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const estadoLabel = (e) => ({
  PENDIENTE: '⏳ Pendiente',
  APROBADO: '✅ Aprobado',
  RECHAZADO: '❌ Rechazado',
  EN_CURSO: '🔵 En curso',
  ANULADO: '🚫 Anulado',
  ENVIADO_NOMINA: '📤 Enviada a Nómina'
}[e] || e)

const evidenciaLabel = (e) => ({
  PENDIENTE_REVISION: '📷 Por revisar',
  REVISADA: '📷 Revisada',
  OBSERVADA: '📷 Observada'
}[e] || e)

const claseEvidencia = (e) => ({
  PENDIENTE_REVISION: 'badge--ev-pendiente_revision',
  REVISADA: 'badge--ev-revisada',
  OBSERVADA: 'badge--ev-observada'
}[e] || '')

const tipoLabel = (t) => ({ DIURNA: 'HED', NOCTURNA: 'HEN', FESTIVA_DIURNA: 'HEFD', FESTIVA_NOCTURNA: 'HEFN' }[t] || t)

onMounted(cargar)
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.kpi-card {
  background: var(--acuusan-slate);
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.kpi-val {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--acuusan-text);
  font-family: monospace;
}

.kpi-val--cyan { color: var(--acuusan-cyan); }

.kpi-lbl {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--acuusan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.registro-card {
  background: var(--acuusan-slate);
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  padding: 14px;
  margin-bottom: 10px;
  transition: border-color 0.2s;
}

.registro-card:hover { border-color: rgba(14,165,233,0.35); }

.reg-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.reg-area {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--acuusan-text);
  line-height: 1.3;
}

.reg-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.reg-evidencia {
  margin-bottom: 8px;
}

.reg-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.reg-meta-item {
  font-size: 0.78rem;
  color: var(--acuusan-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-icon { font-size: 0.85rem; }

.reg-just {
  font-size: 0.78rem;
  color: var(--acuusan-muted);
  font-style: italic;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--acuusan-border);
}

.reg-autorizado {
  font-size: 0.72rem;
  color: var(--acuusan-success);
  margin-top: 6px;
}
</style>
