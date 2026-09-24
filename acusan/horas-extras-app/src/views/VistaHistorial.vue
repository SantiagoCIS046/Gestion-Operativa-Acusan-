<template>
  <LayoutApp activo="historial" :empleado="empleado">

    <!-- Selector de mes: cada mes acumula por separado y queda como historial -->
    <div class="mes-nav">
      <button
        class="mes-btn"
        type="button"
        @click="cambiarMes(-1)"
        aria-label="Mes anterior"
      >←</button>
      <div class="mes-etiqueta">
        <span class="mes-nombre">{{ etiquetaMes }}</span>
        <span class="mes-sub">Acumulado del mes</span>
      </div>
      <button
        class="mes-btn"
        type="button"
        :disabled="esMesActual"
        @click="cambiarMes(1)"
        aria-label="Mes siguiente"
      >→</button>
    </div>

    <!-- Resumen del mes -->
    <div class="card" v-if="registrosMes.length > 0">
      <div class="card__title">
        <span>📊</span> Resumen del Mes
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <span class="kpi-val kpi-val--cyan">{{ totalMes }}h</span>
          <span class="kpi-lbl">Horas del Mes</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-val" style="color:var(--acuusan-success-text);">{{ aprobadasMes }}</span>
          <span class="kpi-lbl">Aprobadas</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-val" style="color:var(--acuusan-warning-text);">{{ pendientesMes }}</span>
          <span class="kpi-lbl">Pendientes</span>
        </div>
      </div>

      <div class="desglose-fila" v-for="d in desgloseMes" :key="d.tipo">
        <span>{{ d.icono }} {{ d.label }}</span>
        <strong>{{ d.horas }} h</strong>
      </div>
      <div class="desglose-fila desglose-fila--total">
        <span>Total acumulado del mes</span>
        <strong>{{ totalMes }} h</strong>
      </div>

      <p class="mes-nota">
        Al terminar el mes este acumulado se congela como historial y el
        siguiente mes arranca en cero.
      </p>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="empty-state">
      <div class="spinner" style="margin: 0 auto 12px;"></div>
      <p>Cargando tus registros...</p>
    </div>

    <!-- Sin registros en absoluto -->
    <div v-else-if="registros.length === 0" class="empty-state">
      <div class="empty-state__icon">📋</div>
      <div class="empty-state__title">Sin registros aún</div>
      <div class="empty-state__sub">Tus horas reportadas aparecerán aquí.</div>
    </div>

    <!-- Mes sin registros -->
    <div v-else-if="registrosMes.length === 0" class="empty-state">
      <div class="empty-state__icon">🗓️</div>
      <div class="empty-state__title">Sin registros en {{ etiquetaMes }}</div>
      <div class="empty-state__sub">Usa las flechas para ver otro mes.</div>
    </div>

    <!-- Lista de registros del mes -->
    <div v-else>
      <div v-for="reg in registrosMes" :key="reg.id" class="registro-card">
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

        <!-- Mini-timeline entrada → salida (jornadas con hora inicio/fin) -->
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

        <!-- Desglose por tipo calculado por el sistema -->
        <div v-if="desgloseDe(reg).length" class="reg-desglose">
          <span
            v-for="d in desgloseDe(reg)"
            :key="d.tipo"
            class="reg-chip"
            :title="d.label"
          >{{ d.icono }} {{ d.horas }}h</span>
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

// ── Mes seleccionado (fecha local de Colombia, UTC−5 fijo) ──────────────────
const ahoraColombia = new Date(Date.now() - 300 * 60000)
const MES_ACTUAL = { anio: ahoraColombia.getUTCFullYear(), mes: ahoraColombia.getUTCMonth() + 1 }
const mesSel = ref({ ...MES_ACTUAL })

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const etiquetaMes = computed(() => `${MESES[mesSel.value.mes - 1]} ${mesSel.value.anio}`)
const esMesActual = computed(() =>
  mesSel.value.anio === MES_ACTUAL.anio && mesSel.value.mes === MES_ACTUAL.mes
)

const cambiarMes = (delta) => {
  let { anio, mes } = mesSel.value
  mes += delta
  if (mes < 1) { mes = 12; anio -= 1 }
  if (mes > 12) { mes = 1; anio += 1 }
  // No navegar hacia el futuro más allá del mes en curso
  if (anio * 12 + mes > MES_ACTUAL.anio * 12 + MES_ACTUAL.mes) return
  mesSel.value = { anio, mes }
}

// Clave 'YYYY-MM' de la fecha local colombiana de un registro. fechaOperacion
// se guarda en la medianoche local (UTC 05:00): restando el offset queda el
// día local legible directo como UTC.
const claveMes = (fechaISO) => {
  if (!fechaISO) return ''
  const t = new Date(fechaISO).getTime() - 300 * 60000
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : ''
}

const claveDeSel = computed(() =>
  `${mesSel.value.anio}-${String(mesSel.value.mes).padStart(2, '0')}`
)

const registrosMes = computed(() =>
  registros.value.filter((r) => claveMes(r.fechaOperacion) === claveDeSel.value)
)

// ── Acumulado del mes (excluye anulados y rechazados) ───────────────────────
const TIPOS_DESGLOSE = ['DIURNA', 'NOCTURNA', 'FESTIVA_DIURNA', 'FESTIVA_NOCTURNA']
const ETIQUETAS_TIPO = {
  DIURNA: { icono: '⬜', label: 'Extras diurnas' },
  NOCTURNA: { icono: '🌙', label: 'Extras nocturnas' },
  FESTIVA_DIURNA: { icono: '🟨', label: 'Dominicales y festivas diurnas' },
  FESTIVA_NOCTURNA: { icono: '🟥', label: 'Dominicales y festivas nocturnas' }
}

const horasPorTipoMes = computed(() => {
  const acc = { DIURNA: 0, NOCTURNA: 0, FESTIVA_DIURNA: 0, FESTIVA_NOCTURNA: 0 }
  for (const r of registrosMes.value) {
    if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') continue
    const d = r.recargoDesglose
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      for (const k of TIPOS_DESGLOSE) acc[k] += Number(d[k]) || 0
    } else if (acc[r.tipoRecargo] !== undefined) {
      // Registros legados sin desglose: aportan sus horas al tipo declarado
      acc[r.tipoRecargo] += Number(r.cantidadHoras) || 0
    }
  }
  return acc
})

const desgloseMes = computed(() =>
  TIPOS_DESGLOSE
    .map((t) => ({ tipo: t, ...ETIQUETAS_TIPO[t], horas: horasPorTipoMes.value[t] }))
    .filter((d) => d.horas > 0)
)

const totalMes = computed(() =>
  Math.round(Object.values(horasPorTipoMes.value).reduce((a, b) => a + b, 0) * 100) / 100
)

const aprobadasMes = computed(() =>
  registrosMes.value.filter((r) => r.estado === 'APROBADO' || r.estado === 'ENVIADO_NOMINA').length
)
const pendientesMes = computed(() =>
  registrosMes.value.filter((r) => r.estado === 'PENDIENTE').length
)

// Chips de desglose por jornada (solo tipos con horas)
const desgloseDe = (reg) => {
  const d = reg.recargoDesglose
  if (!d || typeof d !== 'object' || Array.isArray(d)) return []
  return TIPOS_DESGLOSE
    .filter((t) => Number(d[t]) > 0)
    .map((t) => ({ tipo: t, ...ETIQUETAS_TIPO[t], horas: Number(d[t]) }))
}

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
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

const formatHora = (fecha) => {
  if (!fecha) return ''
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
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
/* Navegador de mes: el acumulado se revisa mes por mes */
.mes-nav {
  background: var(--card-bg);
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--sombra-card);
  padding: 10px 12px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mes-btn {
  width: 38px;
  height: 34px;
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  color: var(--acuusan-blue);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.mes-btn:hover:not(:disabled) {
  background: var(--acuusan-blue-light);
  border-color: #bae6fd;
}

.mes-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.mes-etiqueta {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.25;
}

.mes-nombre {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--acuusan-text);
  text-transform: capitalize;
}

.mes-sub {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--acuusan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.kpi-card {
  background: var(--panel-bg);
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

.kpi-val--cyan { color: var(--acuusan-blue); }

.kpi-lbl {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--acuusan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.mes-nota {
  font-size: 0.72rem;
  color: var(--acuusan-muted);
  line-height: 1.45;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--acuusan-border);
}

.desglose-fila--total {
  border-top: 1px solid var(--acuusan-border);
  padding-top: 8px;
  margin-top: 4px;
  color: var(--acuusan-text);
}

.registro-card {
  background: var(--card-bg);
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--sombra-card);
  padding: 14px;
  margin-bottom: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.registro-card:hover {
  border-color: rgba(0, 72, 132, 0.35);
  box-shadow: 0 2px 6px rgba(0, 72, 132, 0.1), 0 6px 18px rgba(15, 23, 42, 0.06);
}

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

/* Chips compactos del desglose por jornada: ⬜ 2h · 🌙 1.5h */
.reg-desglose {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.reg-chip {
  background: var(--panel-bg);
  border: 1px solid var(--acuusan-border);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--acuusan-text);
  font-family: monospace;
  cursor: default;
}

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
