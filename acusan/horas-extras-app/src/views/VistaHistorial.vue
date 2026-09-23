<template>
  <div class="page">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="top-bar__logo">
        <span style="font-size:1.3rem;">💧</span>
        <span>Mis Registros</span>
      </div>
      <div class="top-bar__user">
        <div class="top-bar__avatar">{{ iniciales }}</div>
        <span>{{ empleado?.nombre?.split(' ')[0] }}</span>
      </div>
    </header>

    <!-- Contenido -->
    <main class="content">

      <!-- Resumen KPI -->
      <div class="kpi-row" v-if="registros.length > 0">
        <div class="kpi-card">
          <span class="kpi-val kpi-val--cyan">{{ totalHoras }}h</span>
          <span class="kpi-lbl">Total Reportadas</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-val" style="color:var(--acuasan-success);">{{ aprobadas }}</span>
          <span class="kpi-lbl">Aprobadas</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-val" style="color:var(--acuasan-warning);">{{ pendientes }}</span>
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
            <span :class="['badge', `badge--${(reg.estado || '').toLowerCase()}`]">
              {{ estadoLabel(reg.estado) }}
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
    </main>

    <!-- Bottom Nav -->
    <nav class="bottom-nav">
      <RouterLink to="/registrar" class="bottom-nav__item">
        <span class="nav-icon">➕</span>
        <span>Reportar</span>
      </RouterLink>
      <RouterLink to="/historial" class="bottom-nav__item active">
        <span class="nav-icon">📋</span>
        <span>Mis Registros</span>
      </RouterLink>
      <button class="bottom-nav__item" @click="cerrarSesion">
        <span class="nav-icon">🚪</span>
        <span>Salir</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { authService, horasExtrasService } from '@/services/api.js'

const router = useRouter()
const empleado = authService.getEmpleado()
const registros = ref([])
const cargando = ref(false)

const iniciales = computed(() => {
  return (empleado?.nombre || 'E').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
})

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

const estadoLabel = (e) => ({ PENDIENTE: '⏳ Pendiente', APROBADO: '✅ Aprobado', RECHAZADO: '❌ Rechazado' }[e] || e)
const tipoLabel = (t) => ({ DIURNA: 'HED', NOCTURNA: 'HEN', FESTIVA_DIURNA: 'HEFD', FESTIVA_NOCTURNA: 'HEFN' }[t] || t)

const cerrarSesion = () => {
  authService.cerrarSesion()
  router.push({ name: 'identificacion' })
}

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
  background: var(--acuasan-slate);
  border: 1px solid var(--acuasan-border);
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
  color: var(--acuasan-text);
  font-family: monospace;
}

.kpi-val--cyan { color: var(--acuasan-cyan); }

.kpi-lbl {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--acuasan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.registro-card {
  background: var(--acuasan-slate);
  border: 1px solid var(--acuasan-border);
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
  color: var(--acuasan-text);
  line-height: 1.3;
}

.reg-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.reg-meta-item {
  font-size: 0.78rem;
  color: var(--acuasan-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-icon { font-size: 0.85rem; }

.reg-just {
  font-size: 0.78rem;
  color: var(--acuasan-muted);
  font-style: italic;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--acuasan-border);
}

.reg-autorizado {
  font-size: 0.72rem;
  color: var(--acuasan-success);
  margin-top: 6px;
}
</style>