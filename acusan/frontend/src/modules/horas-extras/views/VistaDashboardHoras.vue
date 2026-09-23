<template>
  <div class="dashboard-horas-view">

    <PageHeader
      titulo="Dashboard de Horas Extras"
      subtitulo="Consolidado del periodo: horas por área, recargos, estados y evidencias pendientes de revisión"
      icono="📊"
    />

    <!-- Selector de periodo -->
    <div class="selector-periodo">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="texto-selector">Periodo:</span>
        <select v-model.number="mes" class="form-select form-select-sm selector">
          <option v-for="(nombre, i) in MESES" :key="nombre" :value="i + 1">{{ nombre }}</option>
        </select>
        <select v-model.number="anio" class="form-select form-select-sm selector selector-anio">
          <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
        </select>
        <button type="button" class="btn-actualizar" :disabled="cargando" @click="cargar">
          <span v-if="cargando" class="spinner-border spinner-border-sm me-1"></span>
          ↻ Actualizar
        </button>
      </div>
      <div v-if="avisoLocal" class="aviso-local">
        ⚠ No fue posible consultar el dashboard del servidor; las cifras se calcularon
        localmente y pueden no incluir registros de otros equipos.
      </div>
    </div>

    <!-- KPI cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Horas del Periodo</span>
        <span class="kpi-value">{{ formatoHoras(datos?.totalHoras) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Registros</span>
        <span class="kpi-value">{{ datos?.totalRegistros ?? 0 }}</span>
      </div>
      <div class="kpi-card" :class="{ 'kpi-alerta': (datos?.evidenciasPorRevisar || 0) > 0 }">
        <span class="kpi-label">📷 Evidencias por Revisar</span>
        <span class="kpi-value">{{ datos?.evidenciasPorRevisar ?? 0 }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">👷 Empleados con Actividad</span>
        <span class="kpi-value">{{ datos?.empleadosActivos ?? 0 }}</span>
      </div>
    </div>

    <!-- Registros por estado -->
    <div class="card-grafica">
      <h3 class="titulo-grafica">Registros por estado</h3>
      <div v-if="listaEstados.length === 0" class="grafica-vacia">Sin registros en el periodo.</div>
      <div v-else class="chips-estados">
        <span
          v-for="e in listaEstados"
          :key="e.estado"
          class="chip-estado"
          :class="'chip-' + e.estado.toLowerCase()"
        >
          {{ e.etiqueta }}: <strong>{{ e.total }}</strong>
        </span>
      </div>
    </div>

    <!-- Gráficas (CSS puro, sin dependencias) -->
    <div class="chart-grid">
      <!-- 1: barras horizontales por área -->
      <div class="card-grafica">
        <h3 class="titulo-grafica">Horas por cuadrilla / área</h3>
        <div v-if="listaAreas.length === 0" class="grafica-vacia">Sin horas registradas por área.</div>
        <div v-else class="d-flex flex-column gap-2">
          <div v-for="a in listaAreas" :key="a.clave" class="hbar-row">
            <span class="hbar-label" :title="a.clave">{{ a.clave }}</span>
            <div class="hbar-track">
              <div class="hbar-fill" :style="{ width: porcentaje(a.horas, maxHorasArea) + '%' }"></div>
            </div>
            <span class="hbar-value">{{ formatoHoras(a.horas) }}</span>
          </div>
        </div>
      </div>

      <!-- 2: barra apilada por tipo de recargo -->
      <div class="card-grafica">
        <h3 class="titulo-grafica">Distribución por tipo de recargo</h3>
        <div v-if="segmentosTipo.length === 0" class="grafica-vacia">Sin recargos en el periodo.</div>
        <template v-else>
          <div class="stack-track">
            <div
              v-for="s in segmentosTipo"
              :key="s.tipo"
              class="stack-seg"
              :class="'seg-' + s.tipo.toLowerCase()"
              :style="{ width: s.pct + '%' }"
              :title="`${s.etiqueta}: ${formatoHoras(s.horas)} (${s.pct}%)`"
            ></div>
          </div>
          <div class="stack-leyenda">
            <div v-for="s in segmentosTipo" :key="s.tipo" class="leyenda-fila">
              <span class="leyenda-dot" :class="'seg-' + s.tipo.toLowerCase()"></span>
              <span class="leyenda-nombre">{{ s.etiqueta }}</span>
              <span class="leyenda-valor font-mono">{{ formatoHoras(s.horas) }}</span>
              <span class="leyenda-pct font-mono">{{ s.pct }}%</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 3: top 5 empleados -->
      <div class="card-grafica">
        <h3 class="titulo-grafica">Top 5 empleados con más horas</h3>
        <div v-if="topEmpleados.length === 0" class="grafica-vacia">Sin actividad de empleados en el periodo.</div>
        <div v-else class="d-flex flex-column gap-2">
          <div v-for="(e, i) in topEmpleados" :key="i" class="hbar-row">
            <span class="hbar-label hbar-pos" :title="e.nombre">{{ i + 1 }}. {{ e.nombre }}</span>
            <div class="hbar-track">
              <div
                class="hbar-fill hbar-fill-verde"
                :style="{ width: porcentaje(e.horas, maxHorasEmpleado) + '%' }"
              ></div>
            </div>
            <span class="hbar-value">{{ formatoHoras(e.horas) }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import horasExtrasService from '../services/horasExtrasService.js'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const ETIQUETAS_TIPO = {
  DIURNA: 'Extra Diurna (HED)',
  NOCTURNA: 'Extra Nocturna (HEN)',
  FESTIVA_DIURNA: 'Festiva Diurna (HEFD)',
  FESTIVA_NOCTURNA: 'Festiva Nocturna (HEFN)'
}
const ORDEN_TIPOS = ['DIURNA', 'NOCTURNA', 'FESTIVA_DIURNA', 'FESTIVA_NOCTURNA']

const ETIQUETAS_ESTADO = {
  PENDIENTE: 'Pendientes',
  APROBADO: 'Aprobados',
  RECHAZADO: 'Rechazados',
  EN_CURSO: 'En curso',
  ANULADO: 'Anulados',
  ENVIADO_NOMINA: 'Enviados a nómina'
}

// Mes y año actuales en horario de Colombia ("en-CA" produce YYYY-MM-DD)
const hoyColombia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const [anioHoy, mesHoy] = hoyColombia.split('-').map(Number)

const mes = ref(mesHoy)
const anio = ref(anioHoy)
const aniosDisponibles = [anioHoy - 1, anioHoy, anioHoy + 1]

const datos = ref(null)
const cargando = ref(false)
// True cuando el endpoint de dashboard no respondió y las cifras salieron del
// espejo local (despliegue por fases del backend o servidor caído)
const avisoLocal = ref(false)

// ── Cálculo local a partir de registros (respaldo y forma "registros") ──
const perteneceAlPeriodo = (h) => {
  const iso = h.fechaOperacion || h.fecha
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d)) return false
  const local = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [a, m] = local.split('-').map(Number)
  return m === Number(mes.value) && a === Number(anio.value)
}

const computarLocal = (registros) => {
  const porEstado = {}
  const horasPorArea = new Map()
  const horasPorEmpleado = new Map()
  const cedulas = new Set()
  let totalHoras = 0
  let totalRegistros = 0
  let evidenciasPorRevisar = 0

  registros.forEach((h) => {
    const horas = Number(h.cantidadHoras) || 0
    totalHoras += horas
    totalRegistros++
    if (h.estado) porEstado[h.estado] = (porEstado[h.estado] || 0) + 1
    const area = h.cuadrillaArea || h.area || 'Sin área'
    horasPorArea.set(area, (horasPorArea.get(area) || 0) + horas)
    const nombre = h.funcionario || h.cedula || '—'
    horasPorEmpleado.set(nombre, (horasPorEmpleado.get(nombre) || 0) + horas)
    if (h.cedula) cedulas.add(String(h.cedula))
    if (h.estadoEvidencia === 'PENDIENTE_REVISION') evidenciasPorRevisar++
  })

  return {
    totalHoras,
    totalRegistros,
    evidenciasPorRevisar,
    empleadosActivos: cedulas.size,
    porEstado,
    porTipo: computarTipos(registros),
    porArea: Object.fromEntries(horasPorArea),
    topEmpleados: [...horasPorEmpleado.entries()]
      .map(([nombre, horas]) => ({ nombre, horas }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 5)
  }
}

const computarTipos = (registros) => {
  const porTipo = {}
  registros.forEach((h) => {
    const tipo = h.tipoRecargo || h.tipo
    if (!tipo) return
    porTipo[tipo] = (porTipo[tipo] || 0) + (Number(h.cantidadHoras) || 0)
  })
  return porTipo
}

// ── Normalización defensiva de la respuesta del endpoint /dashboard ──
// Acepta mapas { clave: horas } o listas [{ area|nombre|clave, horas|total }]
const aMapa = (valor) => {
  if (!valor) return {}
  if (Array.isArray(valor)) {
    const m = {}
    valor.forEach((x) => {
      const clave =
        x.area || x.cuadrillaArea || x.nombre || x.clave || x.tipo || x.estado || x.funcionario || '—'
      // totalHoras primero: "horas" puede ser un objeto {DIURNA, NOCTURNA...}
      const numero = Number(x.totalHoras ?? x.horas ?? x.total ?? x.valor ?? x.cantidad) || 0
      m[clave] = (m[clave] || 0) + numero
    })
    return m
  }
  if (typeof valor === 'object') {
    const m = {}
    Object.entries(valor).forEach(([k, v]) => {
      const numero = Number(typeof v === 'object' && v !== null ? (v.horas ?? v.total ?? v.valor) : v) || 0
      m[k] = numero
    })
    return m
  }
  return {}
}

const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v) || 0)

const mapearTop = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map((x) => ({
      nombre: x.funcionario || x.nombre || x.cedula || '—',
      horas: Number(x.totalHoras ?? x.horas ?? x.total ?? x.valor ?? 0) || 0
    }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 5)

const usarRespuestaRemota = (d) => {
  const totalHoras = numero(d?.totalHoras ?? d?.totales?.horas)
  const totalRegistros = numero(d?.totalRegistros ?? d?.totales?.registros)
  return {
    totalHoras: totalHoras ?? 0,
    totalRegistros: totalRegistros ?? 0,
    // El backend envía evidenciasPendientes / porEmpleado / topTrabajadores
    evidenciasPorRevisar: numero(d?.evidenciasPendientes ?? d?.evidenciasPorRevisar ?? d?.pendientesRevision) ?? 0,
    empleadosActivos: numero(d?.empleadosActivos ?? d?.totalEmpleados)
      ?? (Array.isArray(d?.porEmpleado) ? d.porEmpleado.length : 0),
    porEstado: aMapa(d?.porEstado ?? d?.estados),
    porArea: aMapa(d?.porArea ?? d?.areas),
    porTipo: aMapa(d?.porTipo ?? d?.tipos ?? d?.desgloseTipos),
    topEmpleados: mapearTop(d?.topTrabajadores ?? d?.topEmpleados ?? d?.empleados)
  }
}

const cargar = async () => {
  cargando.value = true
  avisoLocal.value = false
  try {
    const d = await horasExtrasService.dashboard(mes.value, anio.value)
    const tieneTotales =
      numero(d?.totalHoras ?? d?.totales?.horas) !== null ||
      numero(d?.totalRegistros ?? d?.totales?.registros) !== null
    if (tieneTotales) {
      datos.value = usarRespuestaRemota(d)
    } else if (Array.isArray(d?.registros)) {
      datos.value = computarLocal(d.registros)
    } else {
      datos.value = computarLocal([])
    }
  } catch (e) {
    // Endpoint aún no disponible (despliegue por fases) o servidor caído:
    // calcular desde el espejo local filtrando el periodo en Colombia
    try {
      const todas = await horasExtrasService.obtenerTodas()
      datos.value = computarLocal(todas.filter(perteneceAlPeriodo))
      avisoLocal.value = true
    } catch (e2) {
      datos.value = computarLocal([])
      avisoLocal.value = true
    }
  } finally {
    cargando.value = false
  }
}

watch([mes, anio], () => cargar())
onMounted(cargar)

// ── Computados de presentación ──
const listaAreas = computed(() =>
  Object.entries(datos.value?.porArea || {})
    .map(([clave, horas]) => ({ clave, horas }))
    .sort((a, b) => b.horas - a.horas)
)
const maxHorasArea = computed(() => Math.max(...listaAreas.value.map((a) => a.horas), 1))

const segmentosTipo = computed(() => {
  const mapa = datos.value?.porTipo || {}
  const total = Object.values(mapa).reduce((acc, v) => acc + (Number(v) || 0), 0)
  const claves = [
    ...ORDEN_TIPOS.filter((t) => mapa[t] !== undefined),
    ...Object.keys(mapa).filter((t) => !ORDEN_TIPOS.includes(t))
  ]
  return claves.map((tipo) => {
    const horas = Number(mapa[tipo]) || 0
    return {
      tipo,
      horas,
      etiqueta: ETIQUETAS_TIPO[tipo] || tipo,
      pct: total > 0 ? Math.round((horas / total) * 1000) / 10 : 0
    }
  })
})

const topEmpleados = computed(() => datos.value?.topEmpleados || [])
const maxHorasEmpleado = computed(() => Math.max(...topEmpleados.value.map((e) => e.horas), 1))

const listaEstados = computed(() => {
  const mapa = datos.value?.porEstado || {}
  const claves = [
    ...Object.keys(ETIQUETAS_ESTADO).filter((k) => mapa[k] !== undefined),
    ...Object.keys(mapa).filter((k) => !(k in ETIQUETAS_ESTADO))
  ]
  return claves.map((estado) => ({
    estado,
    etiqueta: ETIQUETAS_ESTADO[estado] || estado,
    total: Number(mapa[estado]) || 0
  }))
})

// ── Formatos ──
const formatoHoras = (valor) => {
  const n = Number(valor) || 0
  // Sin decimales ruidosos: 8h o 7.5h
  return `${Math.round(n * 10) / 10}h`
}

const porcentaje = (valor, max) => Math.max(2, Math.round((valor / max) * 100))
</script>

<style scoped>
.dashboard-horas-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.font-mono {
  font-family: monospace, monospace;
}

.selector-periodo {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.texto-selector {
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
}

.selector {
  width: 150px;
}
.selector-anio {
  width: 100px;
}

.btn-actualizar {
  background: #ffffff;
  border: 1px solid #004884;
  color: #004884;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-actualizar:hover {
  background: #004884;
  color: #ffffff;
}

.aviso-local {
  background: #fef9c3;
  border: 1px solid #fde68a;
  color: #b45309;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 6px 10px;
}

/* KPI cards (mismo lenguaje visual del módulo) */
.kpi-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.kpi-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 18px;
  display: flex;
  flex-direction: column;
  min-width: 170px;
  flex: 1;
}

.kpi-alerta {
  background: #fffdf5;
  border-color: #fde68a;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #64748b;
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

/* Tarjetas de gráficas */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.card-grafica {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
}

.titulo-grafica {
  font-size: 0.82rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 12px 0;
}

.grafica-vacia {
  color: #94a3b8;
  font-size: 0.76rem;
  text-align: center;
  padding: 18px 0;
}

/* Barras horizontales */
.hbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hbar-label {
  width: 140px;
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.hbar-pos {
  text-align: right;
}

.hbar-track {
  flex: 1;
  background: #f1f5f9;
  border-radius: 5px;
  height: 16px;
  overflow: hidden;
}

.hbar-fill {
  height: 100%;
  background: linear-gradient(90deg, #004884, #00a3e0);
  border-radius: 5px;
}

.hbar-fill-verde {
  background: linear-gradient(90deg, #5a991b, #73be28);
}

.hbar-value {
  width: 58px;
  flex-shrink: 0;
  font-size: 0.72rem;
  font-family: monospace, monospace;
  font-weight: 700;
  color: #0f172a;
}

/* Barra apilada por tipo de recargo */
.stack-track {
  display: flex;
  height: 26px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
}

.stack-seg {
  height: 100%;
  min-width: 2px;
}

/* Paleta coherente con los badges de tipo del módulo */
.seg-diurna { background: #38bdf8; }
.seg-nocturna { background: #a78bfa; }
.seg-festiva_diurna { background: #fbbf24; }
.seg-festiva_nocturna { background: #f87171; }

.stack-leyenda {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.leyenda-fila {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.74rem;
  color: #334155;
}

.leyenda-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.leyenda-nombre {
  flex: 1;
  font-weight: 600;
}

.leyenda-valor {
  font-weight: 700;
  color: #0f172a;
}

.leyenda-pct {
  width: 48px;
  text-align: right;
  color: #64748b;
}

/* Chips por estado */
.chips-estados {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-estado {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 0.74rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
}

.chip-pendiente { background: #fef3c7; color: #b45309; border-color: #fde68a; }
.chip-aprobado { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
.chip-rechazado { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
.chip-en_curso { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
.chip-anulado { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
.chip-enviado_nomina { background: #ccfbf1; color: #0f766e; border-color: #99f6e4; }
</style>
