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
    </div>

    <!-- Tabla de Horas Extras -->
    <TablaHorasExtras
      :items="horasData"
      @approve="aprobarHora"
      @reject="rechazarHora"
      @export="exportarReporte"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TablaHorasExtras from '../components/TablaHorasExtras.vue'
import PageHeader from '../../../components/PageHeader.vue'
import authService from '../../auth/services/authService.js'
import notificacionService from '../../../services/notificacionService.js'
import horasExtrasService from '../services/horasExtrasService.js'

// Notificaciones profesionales globales (sistema centralizado de toasts)
const lanzarAlertaBootstrap = notificacionService.mostrar

const horasData = ref([])

// Cargar registros de horas extras desde la base de datos MongoDB
const cargarHoras = async () => {
  horasData.value = await horasExtrasService.obtenerTodas()
}

let intervaloPolling = null
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

const exportarReporte = () => {
  lanzarAlertaBootstrap('info', 'Exportando Reporte', 'Generando consolidado de nomina para Acuasan (Excel/PDF)...')
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

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.view-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.view-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin: 4px 0 0 0;
}

.kpi-grid {
  display: flex;
  gap: 16px;
}

.kpi-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 18px;
  display: flex;
  flex-direction: column;
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
</style>
