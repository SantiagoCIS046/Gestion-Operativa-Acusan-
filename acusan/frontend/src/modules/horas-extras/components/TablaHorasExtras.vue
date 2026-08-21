<template>
  <div class="excel-grid-container shadow-sm">
    <!-- Excel Top Title Bar -->
    <div class="excel-header-stripe">
      <div class="excel-stripe-left">
        <span class="excel-icon-logo">⏱️</span>
        <span class="excel-tag">Acuasan_Control_HorasExtras_2026.xlsx</span>
        <span class="excel-sheet-badge">Hoja 1: Cuadrillas_Recargos</span>
      </div>
      <span class="excel-meta">Total Registros en Hoja: {{ filteredList.length }}</span>
    </div>

    <!-- Excel Formula Bar (fx) -->
    <div class="excel-formula-bar">
      <div class="cell-name-box">A1</div>
      <div class="fx-icon">fx</div>
      <div class="formula-input">
        <span class="formula-text">
          =RESUMEN_HORAS_EXTRAS() &rarr; Horas Acumuladas: <strong>{{ totalHorasFiltradas }}h</strong> | Presupuesto Estimado: <strong>${{ formatCurrency(totalMontoFiltrado) }}</strong> | Total Registros: <strong>{{ filteredList.length }}</strong>
        </span>
      </div>
    </div>

    <!-- Excel Filter & Action Toolbar -->
    <div class="table-toolbar">
      <div class="filter-group">
        <div class="search-box-wrap">
          <span class="search-icon">🔍</span>
          <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar por funcionario, cédula o cuadrilla..."
            class="search-input"
          />
        </div>
        <select v-model="filtroTipo" class="select-input">
          <option value="">Todos los tipos de recargo</option>
          <option value="DIURNA">Extra Diurna (HED)</option>
          <option value="NOCTURNA">Extra Nocturna (HEN)</option>
          <option value="FESTIVA_DIURNA">Festiva Diurna (HEFD)</option>
          <option value="FESTIVA_NOCTURNA">Festiva Nocturna (HEFN)</option>
        </select>
        <select v-model="filtroEstado" class="select-input">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">⏳ Pendientes</option>
          <option value="APROBADO">✔ Aprobados</option>
          <option value="RECHAZADO">✖ Rechazados</option>
        </select>
      </div>

      <div class="export-actions">
        <button class="btn btn-export-excel" @click="$emit('export')">
          <span>📗</span>
          <span>Exportar Reporte Excel</span>
        </button>
      </div>
    </div>

    <!-- Excel Sheet Table with Horizontal and Vertical Scrolling -->
    <div class="table-responsive">
      <table class="excel-table">
        <thead>
          <!-- Excel Letter Column Header Row -->
          <tr class="excel-col-letters-row">
            <th class="col-excel-index"></th>
            <th class="col-letter">A</th>
            <th class="col-letter">B</th>
            <th class="col-letter text-center">C</th>
            <th class="col-letter text-center">D</th>
            <th class="col-letter text-center">E</th>
            <th class="col-letter text-end">F</th>
            <th class="col-letter text-center">G</th>
            <th class="col-letter text-center">H</th>
          </tr>

          <!-- Excel Main Header Row -->
          <tr class="excel-main-header-row">
            <th class="col-excel-index">#</th>
            <th>FUNCIONARIO & CÉDULA</th>
            <th>CUADRILLA / ÁREA</th>
            <th class="text-center">FECHA OPERACIÓN</th>
            <th class="text-center">TIPO RECARGO</th>
            <th class="text-center">HORAS</th>
            <th class="text-end">MONTO ESTIMADO</th>
            <th class="text-center">ESTADO</th>
            <th class="text-center">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredList.length === 0">
            <td colspan="9" class="text-center py-5 text-muted font-mono">
              [Hoja vacía] No se encontraron registros de horas extras que coincidan con la búsqueda.
            </td>
          </tr>
          <tr
            v-for="(hora, index) in filteredList"
            :key="hora.id || index"
            :class="{ 'row-even': index % 2 === 1, 'row-pending': hora.estado === 'PENDIENTE' }"
          >
            <!-- Excel Row Number Header Column -->
            <td class="col-excel-index">{{ index + 1 }}</td>

            <!-- A: Funcionario & Cédula -->
            <td>
              <div class="cell-user">
                <span class="user-name">{{ hora.funcionario }}</span>
                <span class="user-sub font-mono">C.C. {{ hora.cedula }}</span>
              </div>
            </td>

            <!-- B: Cuadrilla / Área -->
            <td>
              <span class="cell-dep">{{ hora.area }}</span>
            </td>

            <!-- C: Fecha Operación -->
            <td class="text-center">
              <span class="font-mono small text-dark fw-bold">{{ hora.fecha }}</span>
            </td>

            <!-- D: Tipo Recargo -->
            <td class="text-center">
              <span class="badge-tipo" :class="'tipo-' + (hora.tipo || '').toLowerCase()">
                {{ hora.tipo }}
              </span>
            </td>

            <!-- E: Horas -->
            <td class="text-center">
              <span class="hours-badge">{{ hora.cantidadHoras }}h</span>
            </td>

            <!-- F: Monto Estimado -->
            <td class="text-end font-mono fw-bold text-success">
              ${{ formatCurrency(hora.montoEstimado) }}
            </td>

            <!-- G: Estado -->
            <td class="text-center">
              <span class="status-badge" :class="'status-' + (hora.estado || '').toLowerCase()">
                {{ hora.estado }}
              </span>
            </td>

            <!-- H: Acciones -->
            <td class="text-center">
              <div v-if="hora.estado === 'PENDIENTE'" class="d-inline-flex gap-1">
                <button
                  type="button"
                  class="btn-action btn-approve"
                  @click="$emit('approve', hora)"
                  title="Aprobar registro de horas"
                >
                  ✔ Aprobar
                </button>
                <button
                  type="button"
                  class="btn-action btn-reject"
                  @click="$emit('reject', hora)"
                  title="Rechazar registro de horas"
                >
                  ✖ Rechazar
                </button>
              </div>
              <span v-else class="text-muted font-mono" style="font-size: 0.72rem;">Procesado</span>
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
const filtroEstado = ref('')

const filteredList = computed(() => {
  return props.items.filter((item) => {
    const matchBusqueda =
      (item.funcionario || '').toLowerCase().includes(busqueda.value.toLowerCase()) ||
      (item.area || '').toLowerCase().includes(busqueda.value.toLowerCase()) ||
      (item.cedula || '').includes(busqueda.value)

    const matchTipo = !filtroTipo.value || item.tipo === filtroTipo.value
    const matchEstado = !filtroEstado.value || item.estado === filtroEstado.value

    return matchBusqueda && matchTipo && matchEstado
  })
})

const totalHorasFiltradas = computed(() => {
  return filteredList.value.reduce((acc, curr) => acc + (Number(curr.cantidadHoras) || 0), 0)
})

const totalMontoFiltrado = computed(() => {
  return filteredList.value.reduce((acc, curr) => acc + (Number(curr.montoEstimado) || 0), 0)
})

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-CO').format(val || 0)
}
</script>

<style scoped>
/* ==================== CUADRILLA ESTILO EXCEL AUTÉNTICO ==================== */
.excel-grid-container {
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #94a3b8;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.excel-header-stripe {
  background: #107c41; /* Verde oficial Microsoft Excel */
  color: #ffffff;
  padding: 5px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
}

.excel-stripe-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.excel-icon-logo { font-size: 0.9rem; }
.excel-tag { font-family: monospace; font-weight: 700; letter-spacing: 0.3px; }
.excel-sheet-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 600;
}
.excel-meta { font-size: 0.7rem; opacity: 0.9; }

/* Barra de Fórmulas de Excel (fx) */
.excel-formula-bar {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  padding: 4px 10px;
  gap: 6px;
  font-size: 0.74rem;
}

.cell-name-box {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  padding: 1px 10px;
  font-family: monospace;
  font-weight: 700;
  color: #0f172a;
  min-width: 44px;
  text-align: center;
}

.fx-icon {
  font-family: serif;
  font-style: italic;
  font-weight: 700;
  color: #64748b;
  padding: 0 4px;
  font-size: 0.85rem;
}

.formula-input {
  flex: 1;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  padding: 3px 10px;
  font-family: monospace;
  color: #334155;
  font-size: 0.72rem;
}

/* Toolbar & Filtros */
.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
}

.filter-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.search-box-wrap {
  position: relative;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 5px 10px 5px 28px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 0.76rem;
  background: #ffffff;
  outline: none;
}

.search-input:focus {
  border-color: #107c41;
  box-shadow: 0 0 0 2px rgba(16, 124, 65, 0.15);
}

.select-input {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 0.76rem;
  background: #ffffff;
  outline: none;
}

.select-input:focus {
  border-color: #107c41;
}

.btn-export-excel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #107c41;
  color: #107c41;
  font-weight: 700;
  font-size: 0.76rem;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-export-excel:hover {
  background: #107c41;
  color: #ffffff;
}

/* Tabla Estilo Excel Grid con Scroll Automático */
.table-responsive {
  width: 100%;
  overflow-x: auto !important;
  overflow-y: auto !important;
  max-height: calc(100vh - 280px);
  min-height: 250px;
  -webkit-overflow-scrolling: touch;
}

.excel-table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 0.76rem;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Fila de letras de columna Excel (A, B, C...) */
.excel-col-letters-row th {
  background: #e2e8f0 !important;
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.65rem !important;
  text-align: center !important;
  padding: 2px 4px !important;
  border: 1px solid #cbd5e1 !important;
  user-select: none;
}

/* Fila principal de encabezados */
.excel-main-header-row th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 800;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  font-size: 0.68rem;
  letter-spacing: 0.3px;
}

.col-excel-index {
  width: 34px;
  background: #e2e8f0 !important;
  color: #475569 !important;
  font-weight: 700 !important;
  text-align: center !important;
  font-family: monospace !important;
  border-right: 2px solid #cbd5e1 !important;
  user-select: none;
}

.excel-table td {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  vertical-align: middle;
  line-height: 1.2;
}

.excel-table tr:hover td {
  background: #f0f9ff !important;
}

.row-even td { background: #f8fafc; }
.row-pending td { background: #fffdf5; }

.cell-user { display: flex; flex-direction: column; }
.user-name { font-weight: 700; color: #0f172a; font-size: 0.78rem; }
.user-sub { font-size: 0.68rem; color: #64748b; }
.cell-dep { font-size: 0.72rem; color: #475569; font-weight: 600; }

.font-mono { font-family: monospace, monospace; }

.badge-tipo {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  font-family: monospace;
}

.tipo-diurna { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.tipo-nocturna { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
.tipo-festiva_diurna { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.tipo-festiva_nocturna { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

.hours-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 800;
  font-family: monospace;
  color: #0f172a;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-pendiente { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.status-aprobado { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.status-rechazado { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

.btn-action {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.btn-approve {
  background: #107c41;
  color: #ffffff;
}

.btn-approve:hover {
  background: #0b5a2f;
}

.btn-reject {
  background: #dc2626;
  color: #ffffff;
}

.btn-reject:hover {
  background: #b91c1c;
}
</style>
