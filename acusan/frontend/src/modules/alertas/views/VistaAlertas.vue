<template>
  <section class="vista-alertas">
    <header class="cabecera-vista">
      <div>
        <h2>Alertas</h2>
        <p class="vista-sub">Vencimientos por atender ({{ alcance }}).</p>
      </div>
      <button
        v-if="esLiderGeneral"
        type="button"
        class="btn-primario"
        :disabled="ejecutando"
        @click="abrirRevision"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {{ ejecutando ? 'Revisando…' : 'Revisar alertas' }}
      </button>
    </header>

    <!-- Últimas revisiones (solo lider_general) -->
    <section v-if="esLiderGeneral" class="panel-revisiones" aria-label="Últimas revisiones">
      <div class="panel-revisiones-cabecera">
        <h3 class="panel-titulo">Últimas revisiones</h3>
        <span class="panel-subtitulo">Historial ordenado de ejecuciones del motor</span>
      </div>
      <div class="cuadrilla-wrap">
        <table class="tabla-revisiones">
          <thead>
            <tr>
              <th scope="col" class="th-num">#</th>
              <th scope="col" class="th-fecha">Cuándo</th>
              <th scope="col" class="th-alcance">Alcance</th>
              <th scope="col" class="th-nuevas">Nuevas</th>
              <th scope="col" class="th-reenviadas">Reenviadas</th>
              <th scope="col" class="th-ejecutor">Ejecutada por</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargando && !ejecuciones.length">
              <td colspan="6" class="c-vacia">Cargando revisiones…</td>
            </tr>
            <tr v-else-if="!ejecuciones.length">
              <td colspan="6" class="c-vacia">Aún no se ha ejecutado ninguna revisión.</td>
            </tr>
            <tr v-for="(e, index) in ejecuciones" v-else :key="e.id">
              <td class="td-num">
                <span class="num-orden">{{ index + 1 }}</span>
              </td>
              <td class="td-fecha">
                <span class="fecha-dia">{{ formatearFecha(e.fecha) }}</span>
                <span class="fecha-hora">{{ formatearHora(e.fecha) }}</span>
              </td>
              <td class="td-alcance">
                <span class="chip-alcance">{{ alcanceLegible(e.alcance) }}</span>
              </td>
              <td class="td-nuevas">
                <span class="conteo-badge conteo-nuevas" :class="{ 'conteo-cero': e.nuevas === 0 }">
                  {{ e.nuevas }}
                </span>
              </td>
              <td class="td-reenviadas">
                <span class="conteo-badge conteo-reenviadas" :class="{ 'conteo-cero': e.reenviadas === 0 }">
                  {{ e.reenviadas }}
                </span>
              </td>
              <td class="td-ejecutor">
                <span class="ejecutor-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {{ e.ejecutadaPor?.nombre || 'Automática (cron)' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Filtro por área (LG) + pestañas -->
    <div ref="barraRef" class="barra-alertas">
      <select v-if="esLiderGeneral" v-model="filtroArea" aria-label="Filtrar por área" @change="cargar">
        <option value="">Todas las áreas</option>
        <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
      </select>

      <div class="pestanas" role="tablist" aria-label="Estado de las alertas">
        <button
          type="button"
          role="tab"
          :class="{ activa: pestana === 'pendientes' }"
          :aria-selected="pestana === 'pendientes'"
          @click="pestana = 'pendientes'"
        >
          Pendientes <span class="tab-num">{{ conteos.pendientes }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :class="{ activa: pestana === 'atendidas' }"
          :aria-selected="pestana === 'atendidas'"
          @click="pestana = 'atendidas'"
        >
          Atendidas <span class="tab-num">{{ conteos.atendidas }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :class="{ activa: pestana === 'todas' }"
          :aria-selected="pestana === 'todas'"
          @click="pestana = 'todas'"
        >
          Todas <span class="tab-num">{{ conteos.todas }}</span>
        </button>
      </div>
    </div>

    <div v-if="error" class="vista-error">
      <p>{{ error }}</p>
    </div>

    <!-- Tabla de alertas -->
    <div v-else class="hoja-calculo">
      <div class="tabla-scroll">
        <table class="tabla-alertas" :style="{ '--top-sticky': `${alturaBarra}px` }">
          <thead>
            <tr>
              <th scope="col" class="th-centro c-num">#</th>
              <th scope="col" class="th-centro c-nivel">Nivel</th>
              <th scope="col" class="c-archivo">Radicado</th>
              <th scope="col" class="th-centro c-area">Área</th>
              <th scope="col" class="th-centro c-vence">Vence</th>
              <th scope="col" class="th-centro c-enviada">Enviada</th>
              <th scope="col" class="th-centro c-estado">Estado</th>
              <th v-if="hayGestores" scope="col" class="th-centro c-accion">Acción</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="cargando">
              <td :colspan="columnas" class="c-vacia">Cargando alertas…</td>
            </tr>
            <tr v-else-if="!filas.length">
              <td :colspan="columnas" class="c-vacia">{{ textoVacia }}</td>
            </tr>
            <tr v-for="(a, i) in filas" v-else :key="a.id" :class="{ 'fila-atendida': a.atendida }">
              <td class="c-num">{{ i + 1 }}</td>
              <td class="c-nivel">
                <div class="nivel-celda">
                  <NivelAlertaChip :nivel="a.nivel" :atendida="a.atendida" />
                  <span v-if="a.escalada && !a.atendida" class="chip-escalada" title="Las vencidas también se notifican a gerencia">
                    Escalada
                  </span>
                </div>
              </td>
              <td class="c-archivo">
                <RouterLink
                  v-if="a.radicado"
                  class="archivo-enlace"
                  :to="`/radicados?q=${a.radicado.numeroRadicado}`"
                  :title="a.radicado.asunto"
                >
                  <span class="archivo-codigo">{{ a.radicado.numeroRadicado }}</span>
                  <span class="archivo-nombre">{{ a.radicado.asunto }}</span>
                </RouterLink>
                <span v-else class="c-muted">—</span>
              </td>
              <td class="c-area" :title="a.area?.nombre">
                <span class="chip-area" :class="`chip-area--${(a.area?.codigo || '').toLowerCase().replace(/\s+/g, '-')}`">
                  {{ a.area?.codigo || '—' }}
                </span>
              </td>
              <td class="c-vence">
                <span class="vence-fecha">{{ fechaLarga(plazoDe(a).fecha) }}</span>
                <span
                  v-if="plazoDe(a).dias !== null"
                  class="c-vence-nota"
                  :class="{
                    'c-vence-nota--roja': plazoDe(a).dias < 0,
                    'c-vence-nota--ambar': plazoDe(a).dias >= 0 && plazoDe(a).dias <= 7,
                    'c-vence-nota--verde': plazoDe(a).dias > 7
                  }"
                >{{ textoVence(plazoDe(a).dias) }}</span>
              </td>
              <td class="c-enviada">
                <span class="enviada-fecha">{{ fechaLarga(a.creadaEn) }}</span>
                <span class="enviada-autor">{{ a.enviadaPor?.nombre || 'Automática' }}</span>
                <span v-if="a.reenvios > 0" class="c-reenvios">{{ a.reenvios }} reenvío(s)</span>
              </td>
              <td class="c-estado">
                <span v-if="!a.atendida" class="estado-pendiente">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Sin atender
                </span>
                <span v-else class="estado-atendida" :title="`Atendida por ${a.atendidaPor?.nombre || '—'} el ${fechaLarga(a.atendidaEn)}`">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Atendida
                </span>
              </td>
              <td v-if="hayGestores" class="c-accion">
                <button
                  v-if="a.puedeAtender && !a.atendida"
                  type="button"
                  class="btn-atender"
                  :disabled="atendiendoId !== null"
                  @click="marcarAtendida(a)"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {{ atendiendoId === a.id ? 'Marcando…' : 'Marcar atendida' }}
                </button>
                <span v-else class="c-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: revisión del motor único de alertas (solo LG) -->
    <Modal
      :model-value="modalRevision"
      titulo="Revisar alertas"
      ancho="lg"
      @update:model-value="modalRevision = $event"
    >
      <template v-if="!resultadoRevision">
        <p class="revision-intro">
          Se revisan los <strong>radicados pendientes</strong> de <strong>todas las áreas</strong>
          que vencen en ≤ 30 días (incluidos los ya vencidos). Se crea una alerta nueva por cada
          nivel alcanzado (D30, D15, D7, D3, D1 y VENCIDO) que aún no la tenga; las existentes no
          se duplican. Las vencidas escalan a gerencia. Cada área queda notificada en el
          resultado de abajo.
        </p>
      </template>

      <template v-else>
        <p class="revision-total">
          Revisión completa: <strong>{{ totalesRevision.nuevas }}</strong> alerta(s) nueva(s) y
          <strong>{{ totalesRevision.reenviadas }}</strong> reenviada(s) en
          {{ areasRevision.length }} área(s).
        </p>

        <div class="lista-areas">
          <article v-for="ar in areasRevision" :key="ar.areaId" class="area-revision">
            <header>
              <span class="area-codigo">{{ ar.area.codigo }}</span>
              <span class="area-nombre">{{ ar.area.nombre }}</span>
              <span class="area-cifras">{{ ar.nuevas }} nueva(s) · {{ ar.reenviadas }} reenviada(s)</span>
            </header>
            <p class="area-notificados">
              Notificados: {{ nombresNotificados(ar.notificados) }}
              <template v-if="ar.notificados?.gerencia">
                · <strong>escalada a gerencia</strong>
              </template>
            </p>
          </article>
          <p v-if="!areasRevision.length" class="c-muted">
            Nada está en ventana de vencimiento: no hubo alertas que enviar.
          </p>
        </div>
      </template>

      <template #acciones>
        <button type="button" class="btn-secundario" @click="modalRevision = false">Cerrar</button>
        <button
          v-if="!resultadoRevision"
          type="button"
          class="btn-primario"
          :disabled="ejecutando"
          @click="ejecutarRevision"
        >
          {{ ejecutando ? 'Revisando…' : 'Ejecutar revisión' }}
        </button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

import { AlertasAPI } from '@/api/alertas.js'
import { AreasAPI } from '@/api/areas.js'
import { useSesion } from '@/composables/useSesion.js'
import { useConteoAlertas } from '@/composables/useConteoAlertas.js'
import { useToast } from '@/composables/useToast.js'
import Modal from '@/components/Modal.vue'
import NivelAlertaChip from '@/components/NivelAlertaChip.vue'
import { fechaLarga } from '@/utils/fechas.js'

const sesion = useSesion()
const toast = useToast()
const conteo = useConteoAlertas()

const esLiderGeneral = computed(() => sesion.esLiderGeneral.value)
const alcance = computed(() => (esLiderGeneral.value ? 'todas las áreas' : 'tu área'))

// ===== Datos =====
const barraRef = ref(null)
const alturaBarra = ref(48)
const alertas = ref([])
const ejecuciones = ref([])
const areas = ref([])
const filtroArea = ref('')
const pestana = ref('pendientes')
const cargando = ref(false)
const error = ref('')
const atendiendoId = ref(null)

const conteos = computed(() => ({
  pendientes: alertas.value.filter((a) => !a.atendida).length,
  atendidas: alertas.value.filter((a) => a.atendida).length,
  todas: alertas.value.length,
}))

const filas = computed(() => {
  if (pestana.value === 'pendientes') return alertas.value.filter((a) => !a.atendida)
  if (pestana.value === 'atendidas') return alertas.value.filter((a) => a.atendida)
  return alertas.value
})

// La columna de acción solo importa si este rol puede atender alguna (más la columna #)
const hayGestores = computed(() => alertas.value.some((a) => a.puedeAtender))
const columnas = computed(() => 7 + (hayGestores.value ? 1 : 0))

const textoVacia = computed(() => {
  if (pestana.value === 'pendientes') return 'No hay alertas sin atender. Todo bajo control.'
  if (pestana.value === 'atendidas') return 'Aún no hay alertas atendidas.'
  return 'No hay alertas registradas para tu alcance.'
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const data = await AlertasAPI.listar(filtroArea.value ? { area: filtroArea.value } : {})
    alertas.value = data.alertas || []
    ejecuciones.value = data.ejecuciones || []
  } catch (e) {
    error.value = e.message
    alertas.value = []
    ejecuciones.value = []
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  cargar()
  conteo.cargar()
  if (esLiderGeneral.value) {
    AreasAPI.listar()
      .then((data) => { areas.value = data })
      .catch(() => {}) // sin áreas el filtro queda vacío; la vista sigue operativa
  }

  if (barraRef.value) {
    const medir = () => {
      if (barraRef.value) {
        alturaBarra.value = Math.round(barraRef.value.getBoundingClientRect().height) || 48
      }
    }
    medir()
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(medir)
      ro.observe(barraRef.value)
    }
  }
})

// 'radicados' | 'radicados-area:CODIGO' → texto legible
function alcanceLegible(alcance) {
  if (alcance === 'radicados') return 'Todos los radicados'
  if (typeof alcance === 'string' && alcance.startsWith('radicados-area:')) {
    return `Área ${alcance.slice('radicados-area:'.length)}`
  }
  return alcance || '—'
}

function formatearFecha(fecha) {
  return fechaLarga(fecha)
}

function formatearHora(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function textoVence(dias) {
  if (dias === 0) return 'Hoy'
  if (dias < 0) return `Vencido hace ${-dias} d`
  return `En ${dias} d`
}

// El plazo de la alerta es la fecha límite del radicado; sin radicado
// conocido → solo la fecha de referencia de la alerta.
function plazoDe(a) {
  if (a.radicado) return { fecha: a.radicado.fechaLimite, dias: a.radicado.dias }
  return { fecha: a.venceRef, dias: null }
}

async function marcarAtendida(a) {
  atendiendoId.value = a.id
  try {
    await AlertasAPI.atender(a.id)
    const origen = a.radicado?.numeroRadicado ?? '—'
    toast.exito(`Alerta de ${origen} marcada como atendida.`)
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    atendiendoId.value = null
  }
}

// ===== Modal de revisión (solo LG) =====
const modalRevision = ref(false)
const ejecutando = ref(false)
const resultadoRevision = ref(null)

function abrirRevision() {
  resultadoRevision.value = null
  modalRevision.value = true
}

async function ejecutarRevision() {
  ejecutando.value = true
  try {
    resultadoRevision.value = await AlertasAPI.ejecutar({})
    toast.exito(
      `Revisión lista: ${totalesRevision.value.nuevas} nueva(s), ${totalesRevision.value.reenviadas} reenviada(s).`,
    )
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    ejecutando.value = false
  }
}

// Motor único: el resultado trae areas[] con nuevas/reenviadas por área
const areasRevision = computed(() => resultadoRevision.value?.areas || [])
const totalesRevision = computed(() => ({
  nuevas: resultadoRevision.value?.nuevas ?? 0,
  reenviadas: resultadoRevision.value?.reenviadas ?? 0,
}))

// Notifica a líder + encargados del área (y gerencia cuando hay vencidas,
// que el modal marca aparte)
function nombresNotificados(notificados) {
  const nombres = [
    notificados?.lider?.nombre,
    ...(notificados?.encargados || []).map((u) => u.nombre),
  ].filter(Boolean)
  return nombres.length ? nombres.join(', ') : 'sin destinatarios activos en el área'
}
</script>

<style scoped>
.cabecera-vista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.cabecera-vista h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 2px;
}

.vista-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

.btn-primario,
.btn-secundario {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
}

.btn-secundario:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.btn-primario {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #ffffff;
}

.btn-primario:hover:not(:disabled) {
  background: var(--acuasan-blue-dark);
  border-color: var(--acuasan-blue-dark);
}

.btn-primario:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.vista-error {
  background: var(--acuasan-red-light, #fef2f2);
  border: 1px solid #fca5a5;
  border-left: 4px solid var(--acuasan-red, #dc2626);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 12px;
}

/* ===== Últimas revisiones ===== */
.panel-revisiones {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(2, 31, 58, 0.04);
}

.panel-revisiones-cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.panel-titulo {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
}

.panel-subtitulo {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.cuadrilla-wrap {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: auto;
  background: var(--card-bg);
}

.tabla-revisiones {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
  min-width: 620px;
}

/* Cuadrículas en encabezados */
.tabla-revisiones thead th {
  background: #f1f5f9;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 8px 10px;
  border-right: 1px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.tabla-revisiones thead th:last-child {
  border-right: none;
}

/* Cuadrículas en celdas de datos */
.tabla-revisiones tbody td {
  padding: 8px 10px;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-main);
  white-space: nowrap;
  vertical-align: middle;
}

.tabla-revisiones tbody tr:last-child td {
  border-bottom: none;
}

.tabla-revisiones tbody td:last-child {
  border-right: none;
}

.tabla-revisiones tbody tr:nth-child(even) {
  background: #f8fafc;
}

.tabla-revisiones tbody tr:hover {
  background: #f0f7ff;
}

/* Alineaciones y anchos */
.th-num,
.td-num {
  width: 44px;
  text-align: center;
}

.num-orden {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #e2e8f0;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.th-fecha,
.td-fecha {
  width: 170px;
  text-align: left;
}

.td-fecha {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fecha-dia {
  font-weight: 700;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}

.fecha-hora {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.th-alcance,
.td-alcance {
  text-align: left;
}

.chip-alcance {
  font-weight: 600;
  color: var(--text-main);
}

.th-nuevas,
.td-nuevas {
  width: 95px;
  text-align: center;
}

.th-reenviadas,
.td-reenviadas {
  width: 105px;
  text-align: center;
}

.conteo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.conteo-nuevas {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.conteo-reenviadas {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.conteo-cero {
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

.th-ejecutor,
.td-ejecutor {
  text-align: left;
}

.ejecutor-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-main);
  font-weight: 600;
  font-size: 0.72rem;
}

.c-vacia {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.78rem;
  padding: 18px 8px !important;
}

.vista-alertas {
  --offset-top: -22px;
}

/* ===== Barra filtro + pestañas estática / pegajosa ===== */
.barra-alertas {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  padding: 8px 12px;
  margin-bottom: 0;
  position: sticky;
  top: var(--offset-top, -22px);
  z-index: 25;
  box-shadow: 0 2px 8px rgba(2, 31, 58, 0.06);
}

.barra-alertas select {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 6px 8px;
  cursor: pointer;
  max-width: 240px;
}

.barra-alertas select:focus {
  outline: none;
  border-color: var(--acuasan-blue);
}

.pestanas {
  display: inline-flex;
  gap: 4px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  padding: 3px;
}

.pestanas button {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 7px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.pestanas button:hover {
  color: var(--acuasan-blue);
}

.pestanas button.activa {
  background: var(--card-bg);
  color: var(--acuasan-blue);
  box-shadow: 0 1px 4px rgba(2, 31, 58, 0.12);
}

.tab-num {
  background: var(--acuasan-blue-light);
  color: var(--acuasan-blue);
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  padding: 1px 7px;
  font-variant-numeric: tabular-nums;
}

/* ===== Tabla de alertas estática / pegajosa ===== */
.hoja-calculo {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  overflow: visible;
}

.tabla-scroll {
  overflow: visible;
}

.tabla-alertas {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.72rem;
}

.th-centro {
  text-align: center !important;
}

.c-num {
  width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.68rem;
}

.tabla-alertas thead th.c-num {
  text-align: center;
  color: #ffffff;
}

.tabla-alertas thead th {
  position: sticky;
  top: calc(var(--top-sticky, 48px) + var(--offset-top, -22px));
  z-index: 20;
  background: var(--acuasan-blue);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.66rem;
  text-align: center;
  padding: 8px 6px;
  white-space: nowrap;
  border-bottom: 2px solid var(--acuasan-blue-dark);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.tabla-alertas thead th.c-archivo {
  text-align: left;
  padding-left: 10px;
}

.tabla-alertas thead th:last-child {
  border-right: none;
}

.tabla-alertas tbody td {
  padding: 6px 6px;
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  vertical-align: middle;
  color: var(--text-main);
}

.tabla-alertas tbody td:last-child {
  border-right: none;
}

.tabla-alertas tbody tr:nth-child(even) {
  background: #f8fafc;
}

.tabla-alertas tbody tr:hover {
  background: var(--acuasan-blue-light);
}

tr.fila-atendida {
  color: var(--text-muted);
  background: #fafafa;
}

/* Columna Nivel */
.c-nivel {
  text-align: center;
  white-space: nowrap;
  width: 135px;
}

.nivel-celda {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.c-nivel :deep(.nivel-chip) {
  padding: 2px 7px;
  font-size: 0.64rem;
  gap: 3px;
  border-radius: 4px;
}

.c-nivel :deep(.nivel-chip svg) {
  width: 10px;
  height: 10px;
}

.chip-escalada {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 800;
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border: 1px solid #fca5a5;
  white-space: nowrap;
}

/* Columna Archivo / Radicado */
.c-archivo {
  max-width: 280px;
  text-align: left;
}

.archivo-enlace {
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-decoration: none;
  min-width: 0;
}

.archivo-codigo {
  font-weight: 800;
  font-size: 0.73rem;
  color: var(--acuasan-blue);
  white-space: nowrap;
}

.archivo-nombre {
  font-size: 0.66rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.archivo-enlace:hover .archivo-codigo {
  text-decoration: underline;
}

/* Columna Área con Chips Institucionales */
.c-area {
  text-align: center;
  white-space: nowrap;
  width: 78px;
}

.chip-area {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.63rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #1e293b;
}

.chip-area--adm {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

.chip-area--com {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.chip-area--jur {
  background: #faf5ff;
  border-color: #e9d5ff;
  color: #7e22ce;
}

.chip-area--ope,
.chip-area--aire-libre {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.chip-area--ger {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #c2410c;
}

/* Columna Vence */
.c-vence {
  text-align: center;
  white-space: nowrap;
  width: 105px;
}

.vence-fecha {
  display: block;
  font-variant-numeric: tabular-nums;
  font-size: 0.69rem;
  font-weight: 600;
  color: var(--text-main);
}

.c-vence-nota {
  display: inline-block;
  margin-top: 2px;
  font-size: 0.61rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: var(--text-muted);
}

.c-vence-nota--roja {
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border: 1px solid #fca5a5;
}

.c-vence-nota--ambar {
  background: var(--acuasan-yellow-light, #fef9c3);
  color: var(--acuasan-amber-text, #b45309);
  border: 1px solid #fde68a;
}

.c-vence-nota--verde {
  background: var(--acuasan-green-light, #f0fdf4);
  color: var(--acuasan-green-text, #166534);
  border: 1px solid #bbf7d0;
}

/* Columna Enviada */
.c-enviada {
  text-align: center;
  white-space: nowrap;
  width: 145px;
}

.enviada-fecha {
  display: block;
  font-variant-numeric: tabular-nums;
  font-size: 0.69rem;
  font-weight: 600;
  color: var(--text-main);
}

.enviada-autor {
  display: block;
  font-size: 0.63rem;
  color: var(--text-muted);
  margin-top: 1px;
}

.c-reenvios {
  display: inline-block;
  margin-top: 2px;
  background: var(--acuasan-yellow-light);
  color: var(--acuasan-amber-text, #b45309);
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 800;
  padding: 0 5px;
}

/* Columna Estado */
.c-estado {
  text-align: center;
  white-space: nowrap;
  width: 95px;
}

.estado-pendiente,
.estado-atendida {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.3;
}

.estado-pendiente {
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border: 1px solid #fca5a5;
}

.estado-atendida {
  background: var(--acuasan-green-light, #f0fdf4);
  color: var(--acuasan-green-text, #166534);
  border: 1px solid #bbf7d0;
}

/* Columna Acción */
.c-accion {
  text-align: center;
  white-space: nowrap;
  width: 110px;
}

.btn-atender {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid #86efac;
  background: #f0fdf4;
  color: var(--acuasan-green-text, #166534);
  border-radius: 4px;
  font-size: 0.64rem;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-atender:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #4ade80;
  color: #166534;
  transform: translateY(-1px);
}

.btn-atender:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== Modal revisión ===== */
.revision-intro {
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--text-muted);
  margin: 0;
}

.revision-total {
  font-size: 0.8rem;
  margin: 0 0 10px;
  padding: 9px 11px;
  background: var(--acuasan-blue-light);
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.lista-areas {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.area-revision {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 11px;
}

.area-revision header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.area-codigo {
  font-weight: 800;
  color: var(--acuasan-blue);
  font-size: 0.74rem;
}

.area-nombre {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-main);
}

.area-cifras {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
}

.area-notificados {
  margin: 4px 0 0;
  font-size: 0.7rem;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .vista-alertas {
    --offset-top: -16px;
  }
}

@media (max-width: 700px) {
  .barra-alertas {
    flex-direction: column;
    align-items: stretch;
  }

  .pestanas {
    justify-content: stretch;
  }

  .pestanas button {
    flex: 1;
    justify-content: center;
  }
}
</style>
