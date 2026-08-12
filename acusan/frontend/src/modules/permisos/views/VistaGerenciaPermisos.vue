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
                <span class="score-text">{{ item.ocrScore }}%</span>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" :style="{ width: item.ocrScore + '%' }"></div>
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
import { ref, computed } from 'vue'

const permisos = ref([
  {
    id: 1,
    radicado: 'PERM-2026-0042',
    funcionario: 'Carlos Andrés Gómez',
    cargo: 'Operario de Redes',
    tipo: 'Calamidad Doméstica',
    fechaInicio: '15/08/2026',
    fechaFin: '16/08/2026',
    estado: 'PENDIENTE',
    ocrScore: 96
  },
  {
    id: 2,
    radicado: 'PERM-2026-0041',
    funcionario: 'María Fernanda Ruiz',
    cargo: 'Analista de Facturación',
    tipo: 'Cita Médica',
    fechaInicio: '14/08/2026',
    fechaFin: '14/08/2026',
    estado: 'PENDIENTE',
    ocrScore: 92
  },
  {
    id: 3,
    radicado: 'PERM-2026-0039',
    funcionario: 'Jorge Eliécer Prada',
    cargo: 'Conductor Operativo',
    tipo: 'Compensatorio',
    fechaInicio: '12/08/2026',
    fechaFin: '13/08/2026',
    estado: 'APROBADO',
    ocrScore: 98
  }
])

const pendientesCount = computed(() => permisos.value.filter(p => p.estado === 'PENDIENTE').length)
const aprobadosCount = computed(() => permisos.value.filter(p => p.estado === 'APROBADO').length)

const aprobar = (item) => {
  item.estado = 'APROBADO'
  alert(`Permiso ${item.radicado} ha sido APROBADO por Gerencia.`)
}

const rechazar = (item) => {
  item.estado = 'RECHAZADO'
  alert(`Permiso ${item.radicado} ha sido RECHAZADO.`)
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
