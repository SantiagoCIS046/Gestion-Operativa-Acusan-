<template>
  <div class="excel-grid-container shadow-sm">
    <!-- Excel Top Title Bar -->
    <div class="excel-header-stripe">
      <div class="excel-stripe-left">
        <span class="excel-icon-logo">⏱️</span>
        <span class="excel-tag">Acuasan_Control_HorasExtras_2026.xlsx</span>
        <span class="excel-sheet-badge">Hoja 1: Cuadrillas_Recargos</span>
      </div>
      <span class="excel-meta">
        Funcionarios en Hoja: {{ grupos.length }} · Registros: {{ registrosFiltrados.length }}
      </span>
    </div>

    <!-- Excel Formula Bar (fx) -->
    <div class="excel-formula-bar">
      <div class="cell-name-box">A1</div>
      <div class="fx-icon">fx</div>
      <div class="formula-input">
        <span class="formula-text">
          =CONSOLIDADO_POR_FUNCIONARIO() &rarr; Horas Acumuladas: <strong>{{ totalHorasFiltradas }}h</strong> | Presupuesto Estimado: <strong>${{ formatCurrency(totalMontoFiltrado) }}</strong> | Funcionarios: <strong>{{ grupos.length }}</strong> | Registros: <strong>{{ registrosFiltrados.length }}</strong>
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
        <label class="check-evidencias" title="Mostrar solo funcionarios con fotos de evidencia">
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
            <th class="col-letter text-end">E</th>
            <th class="col-letter text-center">F</th>
            <th class="col-letter text-center">G</th>
            <th class="col-letter text-center">H</th>
          </tr>

          <!-- Excel Main Header Row -->
          <tr class="excel-main-header-row">
            <th class="col-excel-index">#</th>
            <th>FUNCIONARIO & CÉDULA</th>
            <th>CUADRILLAS / ÁREAS</th>
            <th class="text-center">REGISTROS</th>
            <th class="text-center">HORAS DEL MES</th>
            <th class="text-end">MONTO ESTIMADO</th>
            <th class="text-center">EVIDENCIAS</th>
            <th class="text-center">ESTADOS DEL MES</th>
            <th class="text-center">DETALLE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="grupos.length === 0">
            <td colspan="9" class="text-center py-5 text-muted font-mono">
              [Hoja vacía] No se encontraron horas extras que coincidan con la búsqueda en este periodo.
            </td>
          </tr>

          <!-- Un solo cuadro por funcionario: al expandir se ven sus horas del mes -->
          <template v-for="(grupo, index) in grupos" :key="grupo.clave">
            <tr
              :class="{
                'row-even': index % 2 === 1,
                'row-pending': grupo.pendientes > 0
              }"
            >
              <!-- Excel Row Number Header Column -->
              <td class="col-excel-index">{{ index + 1 }}</td>

              <!-- A: Funcionario & Cédula -->
              <td>
                <div class="cell-user">
                  <span class="user-name">{{ grupo.funcionario }}</span>
                  <span class="user-sub font-mono">C.C. {{ grupo.cedula }}</span>
                </div>
              </td>

              <!-- B: Cuadrillas / Áreas (únicas del mes) -->
              <td>
                <span class="cell-dep">{{ grupo.areas.join(' · ') || '—' }}</span>
              </td>

              <!-- C: Registros del mes -->
              <td class="text-center">
                <span class="hours-badge">{{ grupo.registros.length }}</span>
              </td>

              <!-- D: Horas totales del mes -->
              <td class="text-center">
                <span class="hours-badge hours-badge--total">{{ redondear(grupo.totalHoras) }}h</span>
              </td>

              <!-- E: Monto estimado acumulado -->
              <td class="text-end font-mono fw-bold text-success">
                ${{ formatCurrency(grupo.totalMonto) }}
              </td>

              <!-- F: Evidencias fotográficas del mes -->
              <td class="text-center">
                <span
                  v-if="grupo.numEvidencias > 0"
                  class="badge-evidencias badge-evidencias--resumen"
                  :class="{ 'evidencia-pendiente': grupo.evidenciasPorRevisar > 0 }"
                  :title="`${grupo.numEvidencias} fotos en ${grupo.registrosConEvidencias} registro(s) del mes`"
                >
                  📷 {{ grupo.numEvidencias }}
                </span>
                <span v-else class="text-muted font-mono sin-evidencias">—</span>
              </td>

              <!-- G: Resumen de estados del mes -->
              <td class="text-center">
                <div class="chips-estados-usuario">
                  <span
                    v-for="n in grupo.chipsEstado"
                    :key="n.estado"
                    class="status-badge"
                    :class="'status-' + n.estado.toLowerCase()"
                    :title="`${n.total} ${n.etiqueta}`"
                  >{{ n.icono }} {{ n.total }}</span>
                </div>
              </td>

              <!-- H: Ver horas del mes del funcionario -->
              <td class="text-center">
                <button
                  type="button"
                  class="btn-detalle"
                  :title="usuarioAbierto(grupo.clave)
                    ? 'Ocultar las horas del mes de este funcionario'
                    : 'Ver las horas extras de este funcionario en el mes'"
                  @click="alternarUsuario(grupo.clave)"
                >
                  {{ usuarioAbierto(grupo.clave) ? '▾' : '▸' }}
                </button>
              </td>
            </tr>

            <!-- Fila expandible: todas las horas extras del funcionario en el mes -->
            <tr v-if="usuarioAbierto(grupo.clave)" class="fila-detalle">
              <td colspan="9" class="celda-detalle">
                <div class="detalle-titulo">
                  🕑 Horas extras de <strong>{{ grupo.funcionario }}</strong> en el periodo ·
                  {{ grupo.registros.length }} registro{{ grupo.registros.length === 1 ? '' : 's' }} ·
                  {{ redondear(grupo.totalHoras) }}h
                </div>

                <div class="table-responsive table-responsive--anidada">
                  <table class="excel-table tabla-anidada">
                    <thead>
                      <tr class="excel-main-header-row">
                        <th class="text-center">FECHA</th>
                        <th class="text-center">TIPO RECARGO</th>
                        <th class="text-center">HORAS</th>
                        <th class="text-end">MONTO</th>
                        <th class="text-center">ESTADO</th>
                        <th class="text-center">EVIDENCIAS</th>
                        <th class="text-center">ACCIONES</th>
                        <th class="text-center">DETALLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="hora in grupo.registros" :key="hora.id || hora.fechaOperacion">
                        <tr :class="{ 'row-pending': hora.estado === 'PENDIENTE' }">
                          <!-- Fecha operación -->
                          <td class="text-center">
                            <span class="font-mono small text-dark fw-bold">
                              {{ formatearFechaCorta(hora.fechaOperacion || hora.fecha) }}
                            </span>
                          </td>

                          <!-- Tipo recargo -->
                          <td class="text-center">
                            <span
                              class="badge-tipo"
                              :class="'tipo-' + (hora.tipoRecargo || hora.tipo || '').toLowerCase()"
                            >{{ hora.tipoRecargo || hora.tipo }}</span>
                          </td>

                          <!-- Horas -->
                          <td class="text-center">
                            <span class="hours-badge">{{ hora.cantidadHoras }}h</span>
                          </td>

                          <!-- Monto -->
                          <td class="text-end font-mono fw-bold text-success">
                            ${{ formatCurrency(hora.montoEstimado) }}
                          </td>

                          <!-- Estado -->
                          <td class="text-center">
                            <span
                              class="status-badge"
                              :class="'status-' + (hora.estado || '').toLowerCase()"
                            >{{ hora.estado }}</span>
                          </td>

                          <!-- Evidencias: abre el visor con las fotos del registro -->
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

                          <!-- Acciones -->
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

                          <!-- Desglose del cálculo -->
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

                        <!-- Desglose expandible del registro individual -->
                        <tr v-if="filaAbierta(hora.id)" class="fila-detalle fila-detalle--anidada">
                          <td colspan="8" class="celda-detalle">
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
  // Registros del periodo seleccionado por la vista contenedora
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

// ── Expansiones ──────────────────────────────────────────────────────────────
// Grupo abierto (cedula del funcionario) → filas de registros visibles
const usuariosAbiertos = ref(new Set())
const usuarioAbierto = (clave) => usuariosAbiertos.value.has(String(clave))
const alternarUsuario = (clave) => {
  const nueva = new Set(usuariosAbiertos.value)
  if (nueva.has(String(clave))) {
    nueva.delete(String(clave))
  } else {
    nueva.add(String(clave))
  }
  usuariosAbiertos.value = nueva
}

// Fila de registro con el desglose abierto (id del HoraExtra)
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

// ── Filtros de registros (se aplican antes de agrupar) ──────────────────────
const registrosFiltrados = computed(() => {
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

// ── Agrupación por funcionario: un solo cuadro por usuario ──────────────────
// La cédula es la clave natural (única por empleado); si un espejo viejo no la
// trae, se cae al nombre para no perder el registro de la hoja.
const ICONOS_ESTADO = {
  PENDIENTE: '⏳',
  APROBADO: '✔',
  RECHAZADO: '✖',
  EN_CURSO: '▶',
  ANULADO: '⊘',
  ENVIADO_NOMINA: '📤'
}

const ETIQUETAS_ESTADO = {
  PENDIENTE: 'pendiente(s)',
  APROBADO: 'aprobado(s)',
  RECHAZADO: 'rechazado(s)',
  EN_CURSO: 'en curso',
  ANULADO: 'anulado(s)',
  ENVIADO_NOMINA: 'enviado(s) a nómina'
}

const ORDEN_ESTADOS = Object.keys(ICONOS_ESTADO)

const grupos = computed(() => {
  const mapa = new Map()

  for (const item of registrosFiltrados.value) {
    const clave = String(item.cedula || item.funcionario || '—')
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        funcionario: item.funcionario || item.cedula || '—',
        cedula: item.cedula || '—',
        registros: [],
        areasSet: new Set(),
        totalHoras: 0,
        totalMonto: 0,
        numEvidencias: 0,
        registrosConEvidencias: 0,
        evidenciasPorRevisar: 0,
        pendientes: 0,
        porEstado: {}
      })
    }
    const g = mapa.get(clave)
    g.registros.push(item)
    if (item.cuadrillaArea || item.area) g.areasSet.add(item.cuadrillaArea || item.area)
    g.totalHoras += Number(item.cantidadHoras) || 0
    g.totalMonto += Number(item.montoEstimado) || 0
    if ((Number(item.numEvidencias) || 0) > 0) g.registrosConEvidencias++
    g.numEvidencias += Number(item.numEvidencias) || 0
    if (item.estadoEvidencia === 'PENDIENTE_REVISION') g.evidenciasPorRevisar++
    if (item.estado) g.porEstado[item.estado] = (g.porEstado[item.estado] || 0) + 1
    if (item.estado === 'PENDIENTE') g.pendientes++
  }

  const lista = [...mapa.values()].map((g) => ({
    ...g,
    areas: [...g.areasSet],
    // Chips compactos de estado: ⏳ 2 · ✔ 1 (orden fijo, solo presentes)
    chipsEstado: ORDEN_ESTADOS
      .filter((e) => g.porEstado[e])
      .map((e) => ({ estado: e, total: g.porEstado[e], icono: ICONOS_ESTADO[e], etiqueta: ETIQUETAS_ESTADO[e] }))
  }))

  // Orden cronológico dentro de cada funcionario
  for (const g of lista) {
    g.registros.sort((a, b) =>
      new Date(a.fechaOperacion || a.fecha || 0) - new Date(b.fechaOperacion || b.fecha || 0)
    )
  }

  // Mayor carga de horas primero: el funcionario con más horas encabeza la hoja
  lista.sort((a, b) => b.totalHoras - a.totalHoras)
  return lista
})

const totalHorasFiltradas = computed(() =>
  redondear(grupos.value.reduce((acc, g) => acc + g.totalHoras, 0))
)

const totalMontoFiltrado = computed(() =>
  grupos.value.reduce((acc, g) => acc + g.totalMonto, 0)
)

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100

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

/* Total de horas del funcionario en el mes */
.hours-badge--total {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #15803d;
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

/* Resumen a nivel de funcionario: informativo (las fotos se abren por registro) */
.badge-evidencias--resumen {
  cursor: default;
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

/* Chips de estado del funcionario: ⏳ 2 · ✔ 1 */
.chips-estados-usuario {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

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

.detalle-titulo {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

/* Tabla anidada: registros individuales del funcionario */
.table-responsive--anidada {
  max-height: none;
  min-height: 0;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
}

.tabla-anidada {
  min-width: 900px;
  font-size: 0.74rem;
}

.tabla-anidada .excel-main-header-row th {
  font-size: 0.64rem;
  padding: 4px 6px;
}

.tabla-anidada td {
  padding: 5px 6px;
}

.fila-detalle--anidada .celda-detalle {
  border-left-color: #00a3e0;
  background: #f8fafc !important;
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
