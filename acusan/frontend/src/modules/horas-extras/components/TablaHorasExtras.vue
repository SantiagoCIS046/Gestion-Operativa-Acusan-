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
          <option value="EN_CURSO">▶ En curso</option>
          <option value="ANULADO">⊘ Anulados</option>
          <option value="ENVIADO_NOMINA">📤 Enviados a nómina</option>
        </select>
        <label class="check-evidencias" title="Mostrar solo registros con fotos de evidencia">
          <input type="checkbox" v-model="soloConEvidencias" />
          📷 Solo con evidencias
        </label>
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
            <th class="col-letter text-center">I</th>
            <th class="col-letter text-center">J</th>
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
            <th class="text-center">EVIDENCIAS</th>
            <th class="text-center">ESTADO</th>
            <th class="text-center">ACCIONES</th>
            <th class="text-center">DETALLE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredList.length === 0">
            <td colspan="11" class="text-center py-5 text-muted font-mono">
              [Hoja vacía] No se encontraron registros de horas extras que coincidan con la búsqueda.
            </td>
          </tr>
          <template v-for="(hora, index) in filteredList" :key="hora.id || index">
            <tr
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
                <span class="cell-dep">{{ hora.cuadrillaArea || hora.area }}</span>
              </td>

              <!-- C: Fecha Operación -->
              <td class="text-center">
                <span class="font-mono small text-dark fw-bold">{{ formatearFechaCorta(hora.fechaOperacion || hora.fecha) }}</span>
              </td>

              <!-- D: Tipo Recargo -->
              <td class="text-center">
                <span class="badge-tipo" :class="'tipo-' + (hora.tipoRecargo || hora.tipo || '').toLowerCase()">
                  {{ hora.tipoRecargo || hora.tipo }}
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

              <!-- G: Evidencias fotográficas -->
              <td class="text-center">
                <button
                  v-if="tieneEvidencias(hora)"
                  type="button"
                  class="badge-evidencias"
                  :class="{ 'evidencia-pendiente': hora.estadoEvidencia === 'PENDIENTE_REVISION' }"
                  title="Ver evidencias fotográficas del registro"
                  @click="$emit('evidencias', hora)"
                >
                  📷 {{ hora.numEvidencias }}
                </button>
                <span v-else class="text-muted font-mono sin-evidencias">—</span>
              </td>

              <!-- H: Estado -->
              <td class="text-center">
                <span class="status-badge" :class="'status-' + (hora.estado || '').toLowerCase()">
                  {{ hora.estado }}
                </span>
              </td>

              <!-- I: Acciones -->
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

              <!-- J: Detalle expandible (desglose del clasificador) -->
              <td class="text-center">
                <button
                  v-if="tieneDetalle(hora)"
                  type="button"
                  class="btn-detalle"
                  :title="filaAbierta(hora.id) ? 'Ocultar desglose del cálculo' : 'Ver desglose del cálculo'"
                  @click="alternarFila(hora.id)"
                >
                  {{ filaAbierta(hora.id) ? '▾' : '▸' }}
                </button>
                <span v-else class="text-muted font-mono" style="font-size: 0.72rem;">—</span>
              </td>
            </tr>

            <!-- Fila expandible: turno aplicado + desglose del clasificador -->
            <tr v-if="filaAbierta(hora.id)" class="fila-detalle">
              <td :colspan="11" class="celda-detalle">
                <div class="d-flex flex-wrap gap-4">
                  <div v-if="hora.turnoNombre">
                    <span class="detalle-label">Turno aplicado</span>
                    <span class="detalle-valor font-mono">🕒 {{ hora.turnoNombre }}</span>
                  </div>
                  <div v-for="campo in entradasDesglose(hora.recargoDesglose)" :key="campo.clave">
                    <span class="detalle-label">{{ campo.etiqueta }}</span>
                    <span class="detalle-valor font-mono">{{ campo.valor }}</span>
                  </div>
                  <div v-if="hora.justificacion">
                    <span class="detalle-label">Justificación / descripción</span>
                    <span class="detalle-valor">{{ hora.justificacion }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
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

defineEmits(['approve', 'reject', 'export', 'evidencias'])

const busqueda = ref('')
const filtroTipo = ref('')
const filtroEstado = ref('')
const soloConEvidencias = ref(false)

// Filas expandibles (Set de ids con el desglose abierto)
const filasAbiertas = ref(new Set())
const filaAbierta = (id) => filasAbiertas.value.has(String(id))
const alternarFila = (id) => {
  const nueva = new Set(filasAbiertas.value)
  if (nueva.has(String(id))) {
    nueva.delete(String(id))
  } else {
    nueva.add(String(id))
  }
  filasAbiertas.value = nueva
}

const filteredList = computed(() => {
  return props.items.filter((item) => {
    const termino = busqueda.value.toLowerCase()
    const matchBusqueda =
      (item.funcionario || '').toLowerCase().includes(termino) ||
      (item.cuadrillaArea || item.area || '').toLowerCase().includes(termino) ||
      (item.cedula || '').includes(busqueda.value)

    // CORREGIDO: el campo del modelo es tipoRecargo (antes leía item.tipo y
    // el filtro nunca matcheaba); se mantiene el respaldo para espejos viejos
    const matchTipo = !filtroTipo.value || (item.tipoRecargo || item.tipo) === filtroTipo.value
    const matchEstado = !filtroEstado.value || item.estado === filtroEstado.value
    const matchEvidencias = !soloConEvidencias.value || (Number(item.numEvidencias) || 0) > 0

    return matchBusqueda && matchTipo && matchEstado && matchEvidencias
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

const formatearFechaCorta = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const tieneEvidencias = (hora) => (Number(hora.numEvidencias) || 0) > 0

const tieneDetalle = (hora) =>
  Boolean(hora.turnoNombre) || entradasDesglose(hora.recargoDesglose).length > 0

// Etiquetas en español para las claves conocidas del desglose del clasificador;
// las desconocidas se muestran con su nombre de campo tal cual
const ETIQUETAS_DESGLOSE = {
  horasDiurnas: 'Horas diurnas',
  horasNocturnas: 'Horas nocturnas',
  horasFestivas: 'Horas festivas',
  recargo: 'Recargo',
  factor: 'Factor',
  monto: 'Monto',
  valorHora: 'Valor hora',
  turno: 'Turno'
}

const entradasDesglose = (desglose) => {
  if (!desglose || typeof desglose !== 'object' || Array.isArray(desglose)) return []
  return Object.entries(desglose)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .map(([clave, valor]) => {
      let texto
      if (typeof valor === 'number') {
        texto = Math.round(valor * 100) / 100
      } else if (typeof valor === 'boolean') {
        texto = valor ? 'Sí' : 'No'
      } else if (typeof valor === 'object') {
        texto = JSON.stringify(valor)
      } else {
        texto = valor
      }
      return { clave, etiqueta: ETIQUETAS_DESGLOSE[clave] || clave, valor: texto }
    })
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

.check-evidencias {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #334155;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.check-evidencias input {
  accent-color: #107c41;
  cursor: pointer;
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
  min-width: 1100px;
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

/* Insignia de evidencias (clic → modal de fotos) */
.badge-evidencias {
  background: #ffffff;
  border: 1px solid #0e7490;
  color: #0e7490;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.badge-evidencias:hover {
  background: #0e7490;
  color: #ffffff;
}

/* Registro con evidencia pendiente de revisión: borde ámbar de atención */
.badge-evidencias.evidencia-pendiente {
  border-color: #d97706;
  color: #b45309;
  background: #fffbeb;
}
.badge-evidencias.evidencia-pendiente:hover {
  background: #d97706;
  color: #ffffff;
}

.sin-evidencias { font-size: 0.72rem; }

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.status-pendiente { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.status-aprobado { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.status-rechazado { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.status-en_curso { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
.status-anulado { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
.status-enviado_nomina { background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }

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

/* Botón de detalle expandible */
.btn-detalle {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 800;
  width: 24px;
  height: 20px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.btn-detalle:hover {
  background: #004884;
  border-color: #004884;
  color: #ffffff;
}

/* Fila expandible de desglose */
.fila-detalle .celda-detalle {
  background: #f8fafc !important;
  border-left: 4px solid #73be28;
  padding: 8px 12px;
}

.detalle-label {
  display: block;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #64748b;
  margin-bottom: 2px;
}

.detalle-valor {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
  max-width: 260px;
  overflow-wrap: break-word;
}
</style>
