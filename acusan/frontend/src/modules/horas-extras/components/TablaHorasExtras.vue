<template>
  <div class="tabla-horas-card">
    <div class="table-toolbar">
      <div class="filter-group">
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar por funcionario o cuadrilla..."
          class="search-input"
        />
        <select v-model="filtroTipo" class="select-input">
          <option value="">Todos los tipos</option>
          <option value="DIURNA">Extra Diurna (HED)</option>
          <option value="NOCTURNA">Extra Nocturna (HEN)</option>
          <option value="FESTIVA_DIURNA">Festiva Diurna (HEFD)</option>
          <option value="FESTIVA_NOCTURNA">Festiva Nocturna (HEFN)</option>
        </select>
      </div>

      <div class="export-actions">
        <button class="btn btn-outline" @click="$emit('export')">📊 Exportar Reporte</button>
      </div>
    </div>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Funcionario</th>
            <th>Cuadrilla / Área</th>
            <th>Fecha Operación</th>
            <th>Tipo Recargo</th>
            <th>Horas</th>
            <th>Monto Estimado</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hora in filteredList" :key="hora.id">
            <td>
              <div class="font-semibold text-slate-800">{{ hora.funcionario }}</div>
              <div class="text-xs text-slate-500">C.C. {{ hora.cedula }}</div>
            </td>
            <td>{{ hora.area }}</td>
            <td>{{ hora.fecha }}</td>
            <td>
              <span class="badge-tipo" :class="'tipo-' + hora.tipo.toLowerCase()">
                {{ hora.tipo }}
              </span>
            </td>
            <td class="font-bold text-center">{{ hora.cantidadHoras }}h</td>
            <td class="font-semibold text-emerald-600">${{ formatCurrency(hora.montoEstimado) }}</td>
            <td>
              <span class="status-badge" :class="'status-' + hora.estado.toLowerCase()">
                {{ hora.estado }}
              </span>
            </td>
            <td class="text-right">
              <button
                v-if="hora.estado === 'PENDIENTE'"
                class="btn btn-sm btn-approve"
                @click="$emit('approve', hora)"
              >
                Aprobar
              </button>
              <button
                v-if="hora.estado === 'PENDIENTE'"
                class="btn btn-sm btn-reject"
                @click="$emit('reject', hora)"
              >
                Rechazar
              </button>
              <span v-else class="text-xs text-slate-400">Procesado</span>
            </td>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td colspan="8" class="text-center py-6 text-slate-400">
              No se encontraron registros de horas extras que coincidan con la búsqueda.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

defineEmits(['approve', 'reject', 'export'])

const busqueda = ref('')
const filtroTipo = ref('')

const filteredList = computed(() => {
  return props.items.filter((item) => {
    const matchBusqueda =
      item.funcionario.toLowerCase().includes(busqueda.value.toLowerCase()) ||
      item.area.toLowerCase().includes(busqueda.value.toLowerCase()) ||
      item.cedula.includes(busqueda.value)

    const matchTipo = !filtroTipo.value || item.tipo === filtroTipo.value

    return matchBusqueda && matchTipo
  })
})

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-CO').format(val)
}
</script>

<style scoped>
.tabla-horas-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.filter-group {
  display: flex;
  gap: 10px;
  flex: 1;
  max-width: 600px;
}

.search-input, .select-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  outline: none;
  background: #ffffff;
}

.search-input {
  flex: 1;
}

.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  background: #f8fafc;
  padding: 12px 18px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.data-table td {
  padding: 14px 18px;
  font-size: 0.9rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.badge-tipo {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tipo-diurna {
  background: #e0f2fe;
  color: #0369a1;
}

.tipo-nocturna {
  background: #f3e8ff;
  color: #6b21a8;
}

.tipo-festiva_diurna {
  background: #fef3c7;
  color: #92400e;
}

.tipo-festiva_nocturna {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
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

.text-right {
  text-align: right;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  margin-left: 4px;
}

.btn-outline {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #334155;
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
