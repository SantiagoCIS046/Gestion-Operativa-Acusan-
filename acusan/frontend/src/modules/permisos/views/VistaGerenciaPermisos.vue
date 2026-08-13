<template>
  <div class="gerencia-permisos-view">
    <div class="view-header">
      <div>
        <h1 class="view-title">Aprobación de Permisos — Gerencia General</h1>
        <p class="view-subtitle">Revisión, validación y dictamen final de permisos laborales</p>
      </div>
      <div class="stats-pills">
        <span class="pill pill-pending">Pendientes: {{ pendientesCount }}</span>
        <span class="pill pill-approved">Aprobados hoy: {{ aprobadosCount }}</span>
      </div>
    </div>

    <!-- Permisos Table -->
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Radicado</th>
            <th>Funcionario</th>
            <th>Tipo</th>
            <th>Periodo</th>
            <th>Estado</th>
            <th>OCR Confianza</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in permisos" :key="item.id">
            <td class="font-bold">#{{ item.radicado }}</td>
            <td>
              <div class="user-meta">
                <span class="user-name">{{ item.funcionario }}</span>
                <span class="user-sub">{{ item.cargo }}</span>
              </div>
            </td>
            <td><span class="type-tag">{{ item.tipo }}</span></td>
            <td>{{ item.fechaInicio }} al {{ item.fechaFin }}</td>
            <td>
              <span class="status-badge" :class="'status-' + item.estado.toLowerCase()">
                {{ item.estado }}
              </span>
            </td>
            <td>
              <div class="ocr-score-bar">
                <span class="score-text">{{ item.ocrScore || (item.ocrConfidence ? Math.round(item.ocrConfidence * 100) : 95) }}%</span>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" :style="{ width: (item.ocrScore || (item.ocrConfidence ? Math.round(item.ocrConfidence * 100) : 95)) + '%' }"></div>
                </div>
              </div>
            </td>
            <td class="text-right">
              <div class="actions-group">
                <button class="btn btn-xs btn-approve" @click="aprobar(item)" title="Aprobar Permiso">✔ Aprobar</button>
                <button class="btn btn-xs btn-reject" @click="rechazar(item)" title="Rechazar Permiso">✖ Rechazar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { permisosService } from '../services/permisosService.js'

const permisos = ref([])
const cargando = ref(false)

const cargarPermisos = async () => {
  cargando.value = true
  try {
    const lista = await permisosService.obtenerHistorialPermisos()
    if (lista && lista.length > 0) {
      permisos.value = lista
    }
  } catch (error) {
    console.error('Error al cargar permisos para gerencia:', error)
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  cargarPermisos()
})

const pendientesCount = computed(() => permisos.value.filter(p => p.estado === 'PENDIENTE').length)
const aprobadosCount = computed(() => permisos.value.filter(p => p.estado === 'APROBADO').length)

const aprobar = async (item) => {
  try {
    await permisosService.dictaminarPermiso(item.id, {
      estado: 'APROBADO',
      aprobadoPor: 'Gerencia General Acuasan'
    })
    item.estado = 'APROBADO'
    alert(`Permiso #${item.radicado} (${item.funcionario}) ha sido APROBADO por Gerencia y actualizado en la base de datos.`)
  } catch (error) {
    console.error('Error al aprobar permiso:', error)
    alert(`Error al aprobar el permiso: ${error.message}`)
  }
}

const rechazar = async (item) => {
  const motivo = prompt('Ingrese el motivo del rechazo para Gerencia:', 'No cumple con los requisitos normativos')
  if (motivo === null) return

  try {
    await permisosService.dictaminarPermiso(item.id, {
      estado: 'RECHAZADO',
      aprobadoPor: 'Gerencia General Acuasan',
      observaciones: motivo
    })
    item.estado = 'RECHAZADO'
    alert(`Permiso #${item.radicado} (${item.funcionario}) ha sido RECHAZADO y registrado en la base de datos.`)
  } catch (error) {
    console.error('Error al rechazar permiso:', error)
    alert(`Error al rechazar el permiso: ${error.message}`)
  }
}
</script>

<style scoped>
.gerencia-permisos-view {
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

.stats-pills {
  display: flex;
  gap: 10px;
}

.pill {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.pill-pending {
  background: #fef3c7;
  color: #92400e;
}

.pill-approved {
  background: #dcfce7;
  color: #166534;
}

.table-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  background: #f8fafc;
  padding: 14px 18px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.data-table td {
  padding: 14px 18px;
  font-size: 0.9rem;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}

.user-meta {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  color: #0f172a;
}

.user-sub {
  font-size: 0.8rem;
  color: #64748b;
}

.type-tag {
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #475569;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.status-pendiente {
  background: #fef3c7;
  color: #b45309;
}

.status-aprobado {
  background: #dcfce7;
  color: #15803d;
}

.status-rechazado {
  background: #fee2e2;
  color: #b91c1c;
}

.ocr-score-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #0284c7;
  min-width: 32px;
}

.progress-bar-bg {
  width: 60px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #0284c7;
}

.text-right {
  text-align: right;
}

.actions-group {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-approve {
  background: #10b981;
  color: white;
}

.btn-approve:hover {
  background: #059669;
}

.btn-reject {
  background: #ef4444;
  color: white;
}

.btn-reject:hover {
  background: #dc2626;
}
</style>
