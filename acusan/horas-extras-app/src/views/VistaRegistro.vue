<template>
  <div class="page">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="top-bar__logo">
        <span style="font-size:1.3rem;">💧</span>
        <span>Horas Extras</span>
      </div>
      <div class="top-bar__user">
        <div class="top-bar__avatar">{{ iniciales }}</div>
        <span>{{ empleado?.nombre?.split(' ')[0] }}</span>
      </div>
    </header>

    <!-- Contenido -->
    <main class="content">

      <!-- Alerta de resultado -->
      <div v-if="alerta.msg" :class="['alert', `alert--${alerta.tipo}`]">
        <span>{{ alerta.icono }}</span>
        <span>{{ alerta.msg }}</span>
      </div>

      <!-- KPI rápido -->
      <div class="kpi-row">
        <div class="kpi-card">
          <span class="kpi-val">{{ empleado?.cedula }}</span>
          <span class="kpi-lbl">Cédula</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-val kpi-val--cyan">{{ hoy }}</span>
          <span class="kpi-lbl">Fecha Hoy</span>
        </div>
      </div>

      <!-- Formulario de reporte -->
      <div class="card">
        <div class="card__title">
          <span>⏱️</span> Reportar Horas Extras
        </div>

        <form @submit.prevent="enviar">
          <div class="field">
            <label for="cuadrilla">Cuadrilla / Área de Trabajo</label>
            <input
              id="cuadrilla"
              v-model="form.cuadrillaArea"
              type="text"
              placeholder="Ej: Cuadrilla Norte, Planta de Tratamiento..."
              required
            />
          </div>

          <div class="field">
            <label for="fecha">Fecha de la Operación</label>
            <input
              id="fecha"
              v-model="form.fechaOperacion"
              type="date"
              :max="hoyISO"
              required
            />
          </div>

          <div class="field">
            <label for="tipo">Tipo de Recargo</label>
            <select id="tipo" v-model="form.tipoRecargo" required>
              <option value="" disabled>Seleccione el tipo...</option>
              <option value="DIURNA">⬜ Extra Diurna (HED)</option>
              <option value="NOCTURNA">🌙 Extra Nocturna (HEN)</option>
              <option value="FESTIVA_DIURNA">🟨 Festiva Diurna (HEFD)</option>
              <option value="FESTIVA_NOCTURNA">🟥 Festiva Nocturna (HEFN)</option>
            </select>
          </div>

          <div class="field">
            <label for="horas">Cantidad de Horas</label>
            <input
              id="horas"
              v-model.number="form.cantidadHoras"
              type="number"
              inputmode="decimal"
              min="0.5"
              max="24"
              step="0.5"
              placeholder="Ej: 4"
              required
            />
          </div>

          <div class="field">
            <label for="justificacion">Justificación <span style="opacity:0.5;font-size:0.72rem;">(opcional)</span></label>
            <textarea
              id="justificacion"
              v-model="form.justificacion"
              placeholder="Describe brevemente la actividad realizada..."
              rows="3"
            ></textarea>
          </div>

          <button type="submit" class="btn btn--primary" :disabled="enviando">
            <span v-if="enviando" class="spinner"></span>
            <span v-else>📤 Enviar Reporte</span>
          </button>
        </form>
      </div>
    </main>

    <!-- Bottom Nav -->
    <nav class="bottom-nav">
      <RouterLink to="/registrar" class="bottom-nav__item active">
        <span class="nav-icon">➕</span>
        <span>Reportar</span>
      </RouterLink>
      <RouterLink to="/historial" class="bottom-nav__item">
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
import { ref, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { authService, horasExtrasService } from '@/services/api.js'

const router = useRouter()
const empleado = authService.getEmpleado()
const enviando = ref(false)
const alerta = ref({ msg: '', tipo: 'success', icono: '✅' })

const hoyISO = new Date().toISOString().split('T')[0]
const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

const iniciales = computed(() => {
  return (empleado?.nombre || 'E')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const form = ref({
  cuadrillaArea: '',
  fechaOperacion: hoyISO,
  tipoRecargo: '',
  cantidadHoras: '',
  justificacion: ''
})

const mostrarAlerta = (tipo, msg) => {
  const iconos = { success: '✅', error: '⚠️', info: 'ℹ️' }
  alerta.value = { msg, tipo, icono: iconos[tipo] }
  setTimeout(() => { alerta.value.msg = '' }, 5000)
}

const enviar = async () => {
  enviando.value = true
  try {
    await horasExtrasService.reportar(form.value)
    mostrarAlerta('success', '¡Horas reportadas correctamente! Quedan pendientes de aprobación por el Encargado.')
    form.value = { cuadrillaArea: '', fechaOperacion: hoyISO, tipoRecargo: '', cantidadHoras: '', justificacion: '' }
  } catch (e) {
    mostrarAlerta('error', e.message || 'No se pudo enviar el reporte. Intenta de nuevo.')
  } finally {
    enviando.value = false
  }
}

const cerrarSesion = () => {
  authService.cerrarSesion()
  router.push({ name: 'identificacion' })
}
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.kpi-card {
  background: var(--acuasan-slate);
  border: 1px solid var(--acuasan-border);
  border-radius: var(--radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-val {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--acuasan-text);
  font-family: monospace;
}

.kpi-val--cyan { color: var(--acuasan-cyan); }

.kpi-lbl {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--acuasan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>