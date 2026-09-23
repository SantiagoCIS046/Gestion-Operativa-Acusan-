<template>
  <div class="nomina-horas-view">

    <PageHeader
      titulo="Cierre de Nómina de Horas Extras"
      subtitulo="Consolidado mensual de horas extras aprobadas, envío a Nómina e historial de cierres"
      icono="🧾"
    />

    <div class="row g-3">

      <!-- ══════════ PANEL DE CIERRE MENSUAL ══════════ -->
      <div class="col-12 col-lg-5">
        <div class="card-modulo">
          <h2 class="titulo-seccion">Cierre mensual</h2>
          <p class="text-muted small">
            Revise el resumen del periodo y confirme el envío a Nómina. Los registros
            <strong>APROBADOS</strong> quedarán marcados como <strong>ENVIADO_NOMINA</strong> y se
            enviará el correo con el CSV adjunto.
          </p>

          <div class="d-flex gap-2 mb-3 flex-wrap">
            <select v-model.number="mes" class="form-select form-select-sm" style="width: 150px;">
              <option v-for="(nombre, i) in MESES" :key="nombre" :value="i + 1">{{ nombre }}</option>
            </select>
            <select v-model.number="anio" class="form-select form-select-sm" style="width: 100px;">
              <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>

          <!-- Resumen previo del periodo -->
          <div v-if="cargandoResumen" class="text-center text-muted py-3">
            <span class="spinner-border spinner-border-sm me-2"></span> Consultando resumen...
          </div>
          <div v-else-if="errorResumen" class="alert alert-danger py-2" style="font-size: 0.78rem;">
            {{ errorResumen }}
          </div>
          <div v-else-if="!resumen" class="text-center text-muted py-3 small">
            Sin datos del periodo.
          </div>
          <div v-else class="resumen-box">
            <div class="resumen-titulo font-mono">{{ etiquetaPeriodo }}</div>
            <div v-if="resumenCampos.length === 0 && resumenEstados.length === 0" class="text-muted small">
              El servidor no devolvió totales para este periodo.
            </div>
            <div v-for="c in resumenCampos" :key="c.etiqueta" class="resumen-fila">
              <span class="resumen-label">{{ c.etiqueta }}</span>
              <span class="resumen-valor font-mono">{{ c.valor }}</span>
            </div>
            <div v-if="resumenEstados.length > 0" class="mt-2 d-flex flex-wrap gap-1">
              <span
                v-for="e in resumenEstados"
                :key="e.estado"
                class="chip-estado"
                :class="'chip-' + String(e.estado).toLowerCase()"
              >
                {{ etiquetaEstado(e.estado) }}: <strong>{{ e.total }}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            class="btn-enviar-nomina w-100 mt-3"
            :disabled="enviando || cargandoResumen"
            @click="enviarANomina"
          >
            <span v-if="enviando" class="spinner-border spinner-border-sm me-1"></span>
            📤 Enviar a Nómina
          </button>
        </div>
      </div>

      <!-- ══════════ HISTORIAL DE ENVÍOS ══════════ -->
      <div class="col-12 col-lg-7">
        <div class="card-modulo">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h2 class="titulo-seccion m-0">Historial de envíos</h2>
            <button type="button" class="btn-actualizar" :disabled="cargandoEnvios" @click="cargarEnvios">
              <span v-if="cargandoEnvios" class="spinner-border spinner-border-sm me-1"></span>
              ↻ Actualizar
            </button>
          </div>

          <div v-if="cargandoEnvios && envios.length === 0" class="text-center text-muted py-4">
            <span class="spinner-border spinner-border-sm me-2"></span> Cargando envíos...
          </div>
          <div v-else-if="envios.length === 0" class="text-center text-muted py-4">
            Todavía no se ha enviado ningún periodo a Nómina.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0 tabla-envios">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th class="text-center">Registros</th>
                  <th class="text-center">Horas</th>
                  <th>Generado por</th>
                  <th class="text-center">Generado</th>
                  <th class="text-center">Correo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in envios" :key="e.id || (e.periodo)">
                  <td class="fw-bold font-mono">{{ periodoDeEnvio(e) }}</td>
                  <td class="text-center font-mono">{{ e.totalRegistros ?? 0 }}</td>
                  <td class="text-center font-mono">{{ formatoHoras(e.totalHoras) }}</td>
                  <td class="celda-acotada" :title="e.generadoPor">{{ e.generadoPor }}</td>
                  <td class="text-center text-nowrap" :title="formatearFecha(e.generadoEn)">
                    {{ formatearFechaCorta(e.generadoEn) }}
                  </td>
                  <td class="text-center">
                    <span
                      v-if="e.emailError"
                      class="chip-correo correo-error"
                      :title="e.emailError"
                    >✖ Error</span>
                    <span
                      v-else-if="e.emailEnviadoA"
                      class="chip-correo correo-ok"
                      :title="e.emailEnviadoA"
                    >✔ Enviado</span>
                    <span v-else class="chip-correo correo-sin" title="Sin correo configurado">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
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
import notificacionService from '../../../services/notificacionService.js'

const lanzarAlertaBootstrap = notificacionService.mostrar

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

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

const etiquetaPeriodo = computed(() => `${MESES[mes.value - 1]} de ${anio.value}`)
const periodoISO = computed(() => `${anio.value}-${String(mes.value).padStart(2, '0')}`)

// ── Resumen previo (reportes/mensual) ──
const resumen = ref(null)
const cargandoResumen = ref(false)
const errorResumen = ref('')

// Campos que el backend envía de verdad en reportes/mensual (el módulo es
// solo horas: ningún agregado de dinero — decisión del usuario)
const CAMPOS_RESUMEN = [
  ['totalRegistros', 'Registros del periodo'],
  ['totalHoras', 'Total horas'],
  ['totalEmpleados', 'Empleados']
]

const resumenCampos = computed(() => {
  if (!resumen.value) return []
  return CAMPOS_RESUMEN
    .filter(([clave]) => resumen.value[clave] !== undefined && resumen.value[clave] !== null)
    .map(([clave, etiqueta]) => {
      let valor = resumen.value[clave]
      if (clave === 'totalHoras') valor = formatoHoras(valor)
      return { etiqueta, valor }
    })
})

const resumenEstados = computed(() => {
  const pe = resumen.value?.porEstado
  if (!pe) return []
  if (Array.isArray(pe)) {
    return pe.map((x) => ({
      estado: x.estado ?? x.clave ?? '—',
      total: Number(x.total ?? x.cantidad ?? x.registros ?? 0) || 0
    }))
  }
  return Object.entries(pe).map(([estado, total]) => ({
    estado,
    total: Number(typeof total === 'object' && total !== null ? (total.total ?? total.registros) : total) || 0
  }))
})

const cargarResumen = async () => {
  cargandoResumen.value = true
  errorResumen.value = ''
  resumen.value = null
  try {
    const reporte = await horasExtrasService.reporteMensual(mes.value, anio.value)
    // Empleados con registros del periodo (derivado; el backend no lo manda suelto)
    resumen.value = { ...reporte, totalEmpleados: Array.isArray(reporte?.porEmpleado) ? reporte.porEmpleado.length : 0 }
  } catch (e) {
    errorResumen.value = e.message
  } finally {
    cargandoResumen.value = false
  }
}

// ── Envío a Nómina ──
const enviando = ref(false)

const enviarANomina = async () => {
  const etiqueta = etiquetaPeriodo.value
  const ok = window.confirm(
    `¿Enviar a Nómina el periodo ${etiqueta}?\n\n` +
    'Los registros APROBADOS del periodo quedarán marcados como ENVIADO_NOMINA ' +
    'y se enviará el correo con el CSV adjunto.\n\nEsta acción no se puede deshacer.'
  )
  if (!ok) return
  enviando.value = true
  try {
    const r = await horasExtrasService.enviarNomina(mes.value, anio.value)
    const partes = []
    if (r && Number.isFinite(Number(r.totalRegistros))) partes.push(`${r.totalRegistros} registros`)
    if (r && Number.isFinite(Number(r.totalHoras))) partes.push(`${formatoHoras(r.totalHoras)}`)
    const detalle = partes.length ? `: ${partes.join(', ')}` : ''
    if (r && r.emailError) {
      lanzarAlertaBootstrap(
        'warning',
        'Enviado con error de correo',
        `El periodo ${etiqueta} se cerró correctamente${detalle}, pero el correo falló: ${r.emailError}`
      )
    } else {
      const correo = r && r.emailEnviadoA ? ` Correo enviado a ${r.emailEnviadoA}.` : ''
      lanzarAlertaBootstrap('success', 'Enviado a Nómina', `Periodo ${etiqueta} cerrado correctamente${detalle}.${correo}`)
    }
    await Promise.all([cargarResumen(), cargarEnvios()])
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error al enviar a Nómina', e.message)
  } finally {
    enviando.value = false
  }
}

// ── Historial de envíos ──
const envios = ref([])
const cargandoEnvios = ref(false)

const cargarEnvios = async () => {
  cargandoEnvios.value = true
  try {
    envios.value = await horasExtrasService.listarEnvios()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  } finally {
    cargandoEnvios.value = false
  }
}

watch([mes, anio], () => cargarResumen())
onMounted(() => {
  cargarResumen()
  cargarEnvios()
})

// ── Formatos ──
const etiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || estado

const periodoDeEnvio = (e) => e.periodo || `${e.anio || '—'}-${String(e.mes || 0).padStart(2, '0')}`

const formatoHoras = (valor) => {
  const n = Number(valor) || 0
  return `${Math.round(n * 10) / 10}h`
}

const formatearFecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatearFechaCorta = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<style scoped>
.nomina-horas-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.font-mono {
  font-family: monospace, monospace;
}

.card-modulo {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 18px;
  height: 100%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.titulo-seccion {
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.resumen-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
}

.resumen-titulo {
  font-size: 0.82rem;
  font-weight: 800;
  color: #004884;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.resumen-fila {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  border-bottom: 1px dotted #e2e8f0;
  padding: 4px 0;
}

.resumen-label {
  font-size: 0.74rem;
  font-weight: 600;
  color: #64748b;
}

.resumen-valor {
  font-size: 0.82rem;
  font-weight: 800;
  color: #0f172a;
}

.chip-estado {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
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

.btn-enviar-nomina {
  background: #004884;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 800;
  padding: 9px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.btn-enviar-nomina:hover:not(:disabled) {
  background: #00a3e0;
}
.btn-enviar-nomina:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-actualizar {
  background: #ffffff;
  border: 1px solid #004884;
  color: #004884;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-actualizar:hover:not(:disabled) {
  background: #004884;
  color: #ffffff;
}
.btn-actualizar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tabla-envios th {
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 2px solid #cbd5e1;
  padding: 6px 8px;
  white-space: nowrap;
}

.tabla-envios td {
  font-size: 0.76rem;
  color: #334155;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
}

.celda-acotada {
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-correo {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: help;
}
.correo-ok {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.correo-error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.correo-sin {
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}
</style>
