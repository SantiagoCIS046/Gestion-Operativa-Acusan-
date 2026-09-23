<template>
  <div class="gerencia-horas-view">

    <!-- Encabezado con identidad del usuario autenticado -->
    <PageHeader
      titulo="Historial de Horas Extras"
      subtitulo="Plantilla Excel de consolidado operativo, recargos y autorizaciones presupuestales de cuadrillas"
      icono="⏱️"
    />

    <!-- KPI row -->
    <div class="kpi-grid" style="margin-bottom: 16px;">
      <div class="kpi-card">
        <span class="kpi-label">Total Horas Mes</span>
        <span class="kpi-value">{{ totalHoras }}h</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Presupuesto Ejecutado</span>
        <span class="kpi-value text-emerald-600">${{ formatCurrency(totalMonto) }}</span>
      </div>
      <div class="kpi-card" :class="{ 'kpi-alerta': evidenciasPorRevisar > 0 }">
        <span class="kpi-label">📷 Evidencias por Revisar</span>
        <span class="kpi-value">{{ evidenciasPorRevisar }}</span>
      </div>
      <div v-if="puedeEnviarNomina" class="kpi-card kpi-accion">
        <button type="button" class="btn-nomina" @click="abrirModalPeriodo">
          📤 Enviar a Nómina…
        </button>
      </div>
    </div>

    <!-- Tabla de Horas Extras -->
    <TablaHorasExtras
      :items="horasData"
      @approve="aprobarHora"
      @reject="rechazarHora"
      @export="abrirModalPeriodo"
      @evidencias="abrirEvidencias"
    />

    <!-- ══════════ MODAL DE EVIDENCIAS FOTOGRÁFICAS ══════════ -->
    <ModalEvidencias
      :visible="modalEvidenciasVisible"
      :hora-extra="horaEvidenciaSeleccionada"
      :puede-revisar="puedeRevisarEvidencias"
      @cerrar="modalEvidenciasVisible = false"
      @revisada="alRevisarEvidencias"
    />

    <!-- ══════════ MODAL DE PERIODO: EXPORTAR CSV / ENVIAR A NÓMINA ══════════ -->
    <transition name="fade">
      <div
        v-if="modalPeriodoVisible"
        class="modal fade show d-block"
        tabindex="-1"
        style="background: rgba(2, 20, 38, 0.55); backdrop-filter: blur(3px); z-index: 1080;"
        @click.self="cerrarModalPeriodo"
      >
        <div class="modal-dialog modal-dialog-centered" style="max-width: 430px;">
          <div class="modal-content border-0 shadow-lg rounded-3 overflow-hidden bg-white">
            <div class="modal-header border-bottom py-2 px-3 bg-light d-flex align-items-center">
              <h6 class="modal-title fw-bold text-dark m-0" style="font-size: 0.92rem;">
                Reporte y Nómina del Periodo
              </h6>
              <button type="button" class="btn-close btn-close-sm ms-auto" @click="cerrarModalPeriodo"></button>
            </div>

            <div class="modal-body p-3">
              <p class="text-muted mb-2" style="font-size: 0.78rem;">
                Seleccione el periodo sobre el que desea actuar.
              </p>
              <div class="d-flex gap-2">
                <select v-model.number="mesPeriodo" class="form-select form-select-sm">
                  <option v-for="(nombre, i) in MESES" :key="nombre" :value="i + 1">{{ nombre }}</option>
                </select>
                <select v-model.number="anioPeriodo" class="form-select form-select-sm" style="max-width: 110px;">
                  <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
                </select>
              </div>
            </div>

            <div class="modal-footer border-0 bg-light py-2 px-3 d-flex justify-content-end gap-2 flex-wrap">
              <button
                type="button"
                class="btn btn-sm btn-light border text-secondary fw-semibold px-3 rounded-2"
                style="font-size: 0.8rem;"
                @click="cerrarModalPeriodo"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn btn-sm btn-success fw-bold px-3 rounded-2 d-inline-flex align-items-center gap-1"
                style="font-size: 0.8rem;"
                :disabled="exportando"
                @click="exportarReporte"
              >
                <span v-if="exportando" class="spinner-border spinner-border-sm"></span>
                ⬇ Descargar CSV
              </button>
              <button
                v-if="puedeEnviarNomina"
                type="button"
                class="btn btn-sm btn-primary fw-bold px-3 rounded-2 d-inline-flex align-items-center gap-1"
                style="font-size: 0.8rem;"
                :disabled="enviandoNomina"
                @click="enviarANomina"
              >
                <span v-if="enviandoNomina" class="spinner-border spinner-border-sm"></span>
                📤 Enviar a Nómina
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TablaHorasExtras from '../components/TablaHorasExtras.vue'
import ModalEvidencias from '../components/ModalEvidencias.vue'
import PageHeader from '../../../components/PageHeader.vue'
import authService from '../../auth/services/authService.js'
import notificacionService from '../../../services/notificacionService.js'
import horasExtrasService from '../services/horasExtrasService.js'

// Notificaciones profesionales globales (sistema centralizado de toasts)
const lanzarAlertaBootstrap = notificacionService.mostrar

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Mes y año actuales en horario de Colombia ("en-CA" produce YYYY-MM-DD)
const hoyColombia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const [anioHoy, mesHoy] = hoyColombia.split('-').map(Number)
const aniosDisponibles = [anioHoy - 1, anioHoy, anioHoy + 1]

// El envío a Nómina es exclusivo de GERENCIA/ADMIN (la revisión de evidencias
// corresponde a los tres roles que acceden a esta vista)
const rolActual = () => authService.getRol() || ''
const puedeEnviarNomina = computed(() => ['GERENCIA', 'ADMIN'].includes(rolActual()))
const puedeRevisarEvidencias = computed(() =>
  ['ENCARGADO', 'GERENCIA', 'ADMIN'].includes(rolActual())
)

const horasData = ref([])

// Cargar registros de horas extras desde la base de datos MongoDB
const cargarHoras = async () => {
  horasData.value = await horasExtrasService.obtenerTodas()
}

let intervaloPolling = null
// OJO: la llave del espejo es "acuasan_" (1 u) — preexistente a la convención
// de 2 u; renombrarla dejaría huérfanos los dictámenes offline guardados.
const alCambiarStorage = (e) => {
  if (e.key === 'acuasan_horas_v2') cargarHoras()
}

onMounted(async () => {
  // Primero publicar dictámenes offline, después refrescar desde la BD
  await horasExtrasService.sincronizarPendientes()
  await cargarHoras()
  window.addEventListener('storage', alCambiarStorage)
  intervaloPolling = setInterval(cargarHoras, 5000)
})

onUnmounted(() => {
  window.removeEventListener('storage', alCambiarStorage)
  if (intervaloPolling) clearInterval(intervaloPolling)
})

const totalHoras = computed(() => {
  return horasData.value.reduce((acc, curr) => acc + (Number(curr.cantidadHoras) || 0), 0)
})

const totalMonto = computed(() => {
  return horasData.value.reduce((acc, curr) => acc + (Number(curr.montoEstimado) || 0), 0)
})

// Registros con evidencia fotográfica esperando dictamen de revisión
const evidenciasPorRevisar = computed(() =>
  horasData.value.filter((h) => h.estadoEvidencia === 'PENDIENTE_REVISION').length
)

// Aprueba el registro de horas extras en la base de datos
const aprobarHora = async (item) => {
  try {
    const r = await horasExtrasService.dictaminar(item, {
      estado: 'APROBADO',
      autorizadoPor: authService.getUsuarioActual()?.nombre || 'Gerencia General Acuasan',
      observaciones: item.observacionesGerencia || ''
    })
    item.estado = 'APROBADO'
    if (r.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('success', 'Horas Aprobadas', `Registro de horas para ${item.funcionario} aprobado y guardado en la base de datos.`)
    } else if (r.origen === 'NO_ENCONTRADA') {
      lanzarAlertaBootstrap('warning', 'Registro Inexistente', `El registro de ${item.funcionario} ya no existe en la base de datos (eliminado desde otro equipo).`)
      await cargarHoras()
    } else {
      lanzarAlertaBootstrap('warning', 'Guardado Local', `Registro de ${item.funcionario} aprobado localmente; se sincronizará con la base de datos cuando el servidor esté disponible.`)
    }
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message || 'No se pudo aprobar el registro.')
  }
}

// Rechaza el registro de horas extras en la base de datos
const rechazarHora = async (item) => {
  try {
    const r = await horasExtrasService.dictaminar(item, {
      estado: 'RECHAZADO',
      autorizadoPor: authService.getUsuarioActual()?.nombre || 'Gerencia General Acuasan',
      observaciones: item.observacionesGerencia || ''
    })
    item.estado = 'RECHAZADO'
    if (r.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('danger', 'Horas Rechazadas', `Registro de horas para ${item.funcionario} rechazado en la base de datos.`)
    } else if (r.origen === 'NO_ENCONTRADA') {
      lanzarAlertaBootstrap('warning', 'Registro Inexistente', `El registro de ${item.funcionario} ya no existe en la base de datos (eliminado desde otro equipo).`)
      await cargarHoras()
    } else {
      lanzarAlertaBootstrap('warning', 'Guardado Local', `Registro de ${item.funcionario} rechazado localmente; se sincronizará con la base de datos cuando el servidor esté disponible.`)
    }
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message || 'No se pudo rechazar el registro.')
  }
}

// ── Modal de evidencias fotográficas ──
const modalEvidenciasVisible = ref(false)
const horaEvidenciaSeleccionada = ref(null)

const abrirEvidencias = (hora) => {
  horaEvidenciaSeleccionada.value = hora
  modalEvidenciasVisible.value = true
}

// El modal ya avisó del resultado; aquí solo se refleja el estado en la tabla
const alRevisarEvidencias = (data) => {
  if (!data) return
  const item = horasData.value.find((h) => String(h.id) === String(data.id))
  if (item && data.estadoEvidencia) {
    item.estadoEvidencia = data.estadoEvidencia
  }
}

// ── Modal de periodo (exportar CSV / enviar a Nómina) ──
const modalPeriodoVisible = ref(false)
const mesPeriodo = ref(mesHoy)
const anioPeriodo = ref(anioHoy)
const exportando = ref(false)
const enviandoNomina = ref(false)

const abrirModalPeriodo = () => {
  modalPeriodoVisible.value = true
}

const cerrarModalPeriodo = () => {
  modalPeriodoVisible.value = false
}

const periodoISO = () => `${anioPeriodo.value}-${String(mesPeriodo.value).padStart(2, '0')}`

// Descarga real del CSV del periodo (reemplaza el stub anterior de solo-toast)
const exportarReporte = async () => {
  exportando.value = true
  try {
    await horasExtrasService.descargarCsv(mesPeriodo.value, anioPeriodo.value)
    lanzarAlertaBootstrap(
      'success',
      'Reporte descargado',
      `Archivo horas-extras-${periodoISO()}.csv generado correctamente.`
    )
    cerrarModalPeriodo()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error al exportar', e.message)
  } finally {
    exportando.value = false
  }
}

// Cierre del periodo: APROBADO → ENVIADO_NOMINA + correo con CSV adjunto
const enviarANomina = async () => {
  const etiqueta = `${MESES[mesPeriodo.value - 1]} de ${anioPeriodo.value}`
  const ok = window.confirm(
    `¿Enviar a Nómina el periodo ${etiqueta}?\n\n` +
    'Los registros APROBADOS del periodo quedarán marcados como ENVIADO_NOMINA ' +
    'y se enviará el correo con el CSV adjunto.\n\nEsta acción no se puede deshacer.'
  )
  if (!ok) return
  enviandoNomina.value = true
  try {
    const r = await horasExtrasService.enviarNomina(mesPeriodo.value, anioPeriodo.value)
    const partes = []
    if (r && Number.isFinite(Number(r.totalRegistros))) partes.push(`${r.totalRegistros} registros`)
    if (r && Number.isFinite(Number(r.totalHoras))) {
      partes.push(`${Math.round(Number(r.totalHoras) * 10) / 10}h`)
    }
    const detalle = partes.length ? `: ${partes.join(', ')}` : ''
    if (r && r.emailError) {
      lanzarAlertaBootstrap(
        'warning',
        'Enviado con error de correo',
        `El periodo ${etiqueta} se cerró correctamente${detalle}, pero el correo falló: ${r.emailError}`
      )
    } else {
      const correo = r && r.emailEnviadoA ? ` Correo enviado a ${r.emailEnviadoA}.` : ''
      lanzarAlertaBootstrap(
        'success',
        'Enviado a Nómina',
        `Periodo ${etiqueta} cerrado correctamente${detalle}.${correo}`
      )
    }
    cerrarModalPeriodo()
    await cargarHoras()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error al enviar a Nómina', e.message)
  } finally {
    enviandoNomina.value = false
  }
}

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-CO').format(val)
}
</script>

<style scoped>
.gerencia-horas-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

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

.kpi-accion {
  justify-content: center;
  align-items: stretch;
  flex: 0 0 auto;
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

.btn-nomina {
  background: #004884;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 800;
  padding: 8px 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s ease;
}

.btn-nomina:hover {
  background: #00a3e0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
