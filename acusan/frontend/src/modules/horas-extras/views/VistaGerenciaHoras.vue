<template>
  <div class="gerencia-horas-view">
    <!-- Bootstrap Toast / Alert Notification Banner -->
    <transition name="toast-slide">
      <div
        v-if="alertaBootstrap.visible"
        :class="['alert', `alert-${alertaBootstrap.tipo}`, 'alert-dismissible', 'fade', 'show', 'd-flex', 'align-items-center', 'shadow-sm', 'mb-3', 'rounded-3']"
        role="alert"
      >
        <div class="me-2 fs-5">
          <span v-if="alertaBootstrap.tipo === 'success'">✔</span>
          <span v-else-if="alertaBootstrap.tipo === 'danger'">⚠️</span>
          <span v-else-if="alertaBootstrap.tipo === 'warning'">⚡</span>
          <span v-else>ℹ️</span>
        </div>
        <div class="flex-grow-1">
          <strong class="d-block">{{ alertaBootstrap.titulo }}</strong>
          <span class="small">{{ alertaBootstrap.mensaje }}</span>
        </div>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          @click="alertaBootstrap.visible = false"
        ></button>
      </div>
    </transition>

    <!-- Encabezado con identidad del usuario autenticado -->
    <PageHeader
      titulo="Control y Aprobación de Horas Extras"
      subtitulo="Consolidado operativo, recargos y autorizaciones presupuestales de cuadrillas"
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
import { ref, computed } from 'vue'
import TablaHorasExtras from '../components/TablaHorasExtras.vue'
import PageHeader from '../../../components/PageHeader.vue'

const alertaBootstrap = ref({
  visible: false,
  tipo: 'success',
  titulo: '',
  mensaje: ''
})

const lanzarAlertaBootstrap = (tipo, titulo, mensaje, duracion = 5000) => {
  alertaBootstrap.value = { visible: true, tipo, titulo, mensaje }
  setTimeout(() => {
    alertaBootstrap.value.visible = false
  }, duracion)
}

const horasData = ref([
  {
    id: 101,
    cedula: '91234567',
    funcionario: 'Héctor Fabio Ramírez',
    area: 'Cuadrilla Alcantarillado - Red Principal',
    fecha: '10/08/2026',
    tipo: 'NOCTURNA',
    cantidadHoras: 4,
    montoEstimado: 98000,
    estado: 'PENDIENTE'
  },
  {
    id: 102,
    cedula: '1098444555',
    funcionario: 'Mauricio Gómez Santos',
    area: 'Mantenimiento Planta de Tratamiento',
    fecha: '09/08/2026',
    tipo: 'FESTIVA_DIURNA',
    cantidadHoras: 8,
    montoEstimado: 240000,
    estado: 'PENDIENTE'
  },
  {
    id: 103,
    cedula: '13888999',
    funcionario: 'Álvaro Uribe Pinzón',
    area: 'Reparación de Fugas - Sector San Gil',
    fecha: '08/08/2026',
    tipo: 'DIURNA',
    cantidadHoras: 3,
    montoEstimado: 55000,
    estado: 'APROBADO'
  }
])

const totalHoras = computed(() => {
  return horasData.value.reduce((acc, curr) => acc + curr.cantidadHoras, 0)
})

const totalMonto = computed(() => {
  return horasData.value.reduce((acc, curr) => acc + curr.montoEstimado, 0)
})

const aprobarHora = (item) => {
  item.estado = 'APROBADO'
  lanzarAlertaBootstrap('success', 'Horas Aprobadas', `Registro de horas para ${item.funcionario} aprobado.`)
}

const rechazarHora = (item) => {
  item.estado = 'RECHAZADO'
  lanzarAlertaBootstrap('danger', 'Horas Rechazadas', `Registro de horas para ${item.funcionario} rechazado.`)
}

const exportarReporte = () => {
  lanzarAlertaBootstrap('info', 'Exportando Reporte', 'Generando consolidado de nómina para Acuasan (Excel/PDF)...')
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
