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
            <th class="text-center">REPORTE</th>
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
              <td class="cell-clickable" @click="abrirReporteFuncionario(grupo)" title="Clic para abrir el reporte completo de este funcionario">
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

              <!-- H: Ver reporte completo del funcionario en cuadro externo -->
              <td class="text-center">
                <button
                  type="button"
                  class="btn-ver-reporte-externo"
                  title="Abrir reporte ejecutivo completo de este funcionario"
                  @click="abrirReporteFuncionario(grupo)"
                >
                  <span class="btn-ver-icon">📋</span>
                  <span class="btn-ver-text">Ver Reporte</span>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ══════════ CUADRO EXTERNO / MODAL EJECUTIVO DEL FUNCIONARIO ══════════ -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div
          v-if="funcionarioSeleccionado"
          class="modal-ejecutivo-backdrop"
          role="dialog"
          aria-modal="true"
          @click.self="cerrarModalFuncionario"
        >
          <div class="modal-ejecutivo-dialog">
            <!-- Encabezado Ejecutivo -->
            <div class="modal-ejecutivo-header">
              <div class="header-left">
                <div class="funcionario-avatar-circle">
                  <span>{{ inicialFuncionario(funcionarioSeleccionado.funcionario) }}</span>
                </div>
                <div class="funcionario-info-block">
                  <div class="funcionario-title-row">
                    <h3 class="funcionario-nombre">{{ funcionarioSeleccionado.funcionario }}</h3>
                    <span class="badge-cedula font-mono">C.C. {{ funcionarioSeleccionado.cedula }}</span>
                    <span class="badge-area">{{ funcionarioSeleccionado.areas.join(' · ') || 'Planta Operativa' }}</span>
                  </div>
                  <div class="funcionario-subtitle-row">
                    <span>Reporte Consolidado de Horas Extras y Novedades Laborales · Acuasan E.S.P.</span>
                  </div>
                </div>
              </div>

              <div class="header-right">
                <!-- Navegación secuencial entre funcionarios -->
                <div v-if="grupos.length > 1" class="nav-funcionarios-group">
                  <button
                    type="button"
                    class="btn-nav-func"
                    :disabled="indiceFuncionarioActual <= 0"
                    @click="navegarFuncionario(-1)"
                    title="Ver funcionario anterior"
                  >
                    ◀ Anterior
                  </button>
                  <span class="nav-func-counter">{{ indiceFuncionarioActual + 1 }} / {{ grupos.length }}</span>
                  <button
                    type="button"
                    class="btn-nav-func"
                    :disabled="indiceFuncionarioActual >= grupos.length - 1"
                    @click="navegarFuncionario(1)"
                    title="Ver funcionario siguiente"
                  >
                    Siguiente ▶
                  </button>
                </div>

                <!-- Único botón de salida del cuadro (ESC también cierra) -->
                <button
                  type="button"
                  class="btn-cerrar-ejecutivo"
                  @click="cerrarModalFuncionario"
                  title="Salir del reporte para seleccionar otro funcionario (ESC)"
                >
                  <span class="btn-cerrar-icon">✕</span>
                  <span class="btn-cerrar-text">Salir</span>
                </button>
              </div>
            </div>

            <!-- Barra de Métricas Rápidas (KPIs Ejecutivos) -->
            <div class="modal-kpi-bar">
              <div class="kpi-mini-card">
                <span class="kpi-mini-lbl">TOTAL HORAS</span>
                <span class="kpi-mini-val text-primary">{{ redondear(funcionarioSeleccionado.totalHoras) }}h</span>
                <span class="kpi-mini-sub">Acumulado del periodo</span>
              </div>
              <div class="kpi-mini-card">
                <span class="kpi-mini-lbl">MONTO ESTIMADO</span>
                <span class="kpi-mini-val text-success">${{ formatCurrency(funcionarioSeleccionado.totalMonto) }}</span>
                <span class="kpi-mini-sub">Liquidación preliminar</span>
              </div>
              <div class="kpi-mini-card">
                <span class="kpi-mini-lbl">JORNADAS</span>
                <span class="kpi-mini-val text-dark">{{ funcionarioSeleccionado.registros.length }}</span>
                <span class="kpi-mini-sub">Reportes individuales</span>
              </div>
              <div class="kpi-mini-card kpi-mini-card--wide">
                <span class="kpi-mini-lbl">ESTADO DE APROBACIÓN</span>
                <div class="kpi-estados-pills">
                  <span v-if="cuentaEstado('APROBADO') > 0" class="badge-status-kpi status-aprobado">
                    ✔ {{ cuentaEstado('APROBADO') }} Aprobadas
                  </span>
                  <span v-if="cuentaEstado('PENDIENTE') > 0" class="badge-status-kpi status-pendiente">
                    ⏳ {{ cuentaEstado('PENDIENTE') }} Pendientes
                  </span>
                  <span v-if="cuentaEstado('RECHAZADO') > 0" class="badge-status-kpi status-rechazado">
                    ✖ {{ cuentaEstado('RECHAZADO') }} Rechazadas
                  </span>
                  <span v-if="cuentaEstado('EN_CURSO') > 0" class="badge-status-kpi status-en_curso">
                    ▶ {{ cuentaEstado('EN_CURSO') }} En curso
                  </span>
                </div>
              </div>
              <div class="kpi-mini-card">
                <span class="kpi-mini-lbl">EVIDENCIAS FOTOGRÁFICAS</span>
                <span class="kpi-mini-val text-cyan">📷 {{ funcionarioSeleccionado.numEvidencias }}</span>
                <span class="kpi-mini-sub">{{ funcionarioSeleccionado.registrosConEvidencias }} jornada(s)</span>
              </div>
            </div>

            <!-- Toolbar de Filtros y Búsqueda Interna -->
            <div class="modal-toolbar">
              <div class="toolbar-search">
                <span class="search-icon">🔍</span>
                <input
                  v-model="busquedaInterna"
                  type="text"
                  placeholder="Filtrar por fecha (ej: 24/09), tipo de recargo o motivo..."
                  class="toolbar-search-input"
                />
                <button v-if="busquedaInterna" type="button" class="btn-clear-search" @click="busquedaInterna = ''">✕</button>
              </div>

              <div class="toolbar-actions">
                <div class="filter-pills-group">
                  <button
                    type="button"
                    class="btn-filter-pill"
                    :class="{ active: filtroEstadoModal === '' }"
                    @click="filtroEstadoModal = ''"
                  >
                    Todos ({{ registrosModal.length }})
                  </button>
                  <button
                    v-if="cuentaEstado('PENDIENTE') > 0"
                    type="button"
                    class="btn-filter-pill pill-warning"
                    :class="{ active: filtroEstadoModal === 'PENDIENTE' }"
                    @click="filtroEstadoModal = 'PENDIENTE'"
                  >
                    ⏳ Pendientes ({{ cuentaEstado('PENDIENTE') }})
                  </button>
                  <button
                    v-if="cuentaEstado('APROBADO') > 0"
                    type="button"
                    class="btn-filter-pill pill-success"
                    :class="{ active: filtroEstadoModal === 'APROBADO' }"
                    @click="filtroEstadoModal = 'APROBADO'"
                  >
                    ✔ Aprobados ({{ cuentaEstado('APROBADO') }})
                  </button>
                  <button
                    v-if="cuentaEstado('RECHAZADO') > 0"
                    type="button"
                    class="btn-filter-pill pill-danger"
                    :class="{ active: filtroEstadoModal === 'RECHAZADO' }"
                    @click="filtroEstadoModal = 'RECHAZADO'"
                  >
                    ✖ Rechazados ({{ cuentaEstado('RECHAZADO') }})
                  </button>
                </div>

                <button
                  type="button"
                  class="btn-toggle-all-details"
                  @click="alternarTodosDesgloses"
                >
                  {{ todosDesglosesAbiertos ? '🔼 Contraer desgloses' : '🔽 Expandir desgloses' }}
                </button>
              </div>
            </div>

            <!-- Tabla de Registros del Funcionario con Scroll Suave -->
            <div class="modal-table-scroll-wrap">
              <table class="tabla-ejecutiva">
                <thead>
                  <tr>
                    <th class="text-center col-num">#</th>
                    <th>FECHA DE JORNADA</th>
                    <th>HORARIO LABORADO</th>
                    <th>TIPO RECARGO</th>
                    <th class="text-center">HORAS</th>
                    <th class="text-end">MONTO ESTIMADO</th>
                    <th class="text-center">ESTADO</th>
                    <th class="text-center">EVIDENCIAS</th>
                    <th class="text-center">ACCIONES</th>
                    <th class="text-center">DESGLOSE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="registrosModalFiltrados.length === 0">
                    <td colspan="10" class="text-center py-4 text-muted font-mono">
                      No se encontraron registros que coincidan con la búsqueda o filtro.
                    </td>
                  </tr>

                  <template v-for="(hora, idx) in registrosModalFiltrados" :key="hora.id || hora.fechaOperacion || idx">
                    <tr class="fila-registro-ejecutiva" :class="{ 'row-pendiente': hora.estado === 'PENDIENTE' }">
                      <td class="text-center col-num font-mono">{{ idx + 1 }}</td>

                      <!-- Fecha con Día -->
                      <td>
                        <div class="cell-fecha">
                          <span class="fecha-dia">{{ formatearDiaSemana(hora.fechaOperacion || hora.fecha) }}</span>
                          <span class="fecha-valor font-mono">{{ formatearFechaCorta(hora.fechaOperacion || hora.fecha) }}</span>
                        </div>
                      </td>

                      <!-- Horario Inicio - Fin / Cuadrilla -->
                      <td>
                        <div class="cell-horario">
                          <span v-if="hora.horaInicio && hora.horaFin" class="horario-badge font-mono">
                            {{ hora.horaInicio }} → {{ hora.horaFin }}
                          </span>
                          <span v-else class="text-muted small">—</span>
                          <span v-if="hora.cuadrillaArea" class="cuadrilla-subtag">{{ hora.cuadrillaArea }}</span>
                        </div>
                      </td>

                      <!-- Tipo Recargo -->
                      <td>
                        <span class="badge-tipo-ejecutivo" :class="'tipo-' + (hora.tipoRecargo || hora.tipo || '').toLowerCase()">
                          {{ hora.tipoRecargo || hora.tipo || 'Sin clasificar' }}
                        </span>
                      </td>

                      <!-- Cantidad Horas -->
                      <td class="text-center">
                        <span class="hours-badge-ejecutivo">{{ hora.cantidadHoras }}h</span>
                      </td>

                      <!-- Monto Estimado -->
                      <td class="text-end font-mono fw-bold text-success">
                        ${{ formatCurrency(hora.montoEstimado) }}
                      </td>

                      <!-- Estado -->
                      <td class="text-center">
                        <span class="status-badge-ejecutivo" :class="'status-' + (hora.estado || '').toLowerCase()">
                          {{ hora.estado }}
                        </span>
                      </td>

                      <!-- Evidencias Fotográficas -->
                      <td class="text-center">
                        <button
                          v-if="tieneEvidencias(hora)"
                          type="button"
                          class="btn-evidencias-ejecutivo"
                          :class="{ 'evidencia-pendiente': hora.estadoEvidencia === 'PENDIENTE_REVISION' }"
                          title="Abrir visor de evidencias fotográficas"
                          @click="$emit('evidencias', hora)"
                        >
                          📷 {{ hora.numEvidencias }} foto{{ hora.numEvidencias === 1 ? '' : 's' }}
                        </button>
                        <span v-else class="text-muted font-mono sin-evidencias">—</span>
                      </td>

                      <!-- Acciones de Aprobación -->
                      <td class="text-center">
                        <div v-if="hora.estado === 'PENDIENTE'" class="btn-acciones-ejecutivas">
                          <button
                            type="button"
                            class="btn-action-ejecutivo btn-approve-ejecutivo"
                            title="Aprobar reporte de horas"
                            @click="$emit('approve', hora)"
                          >
                            ✔ Aprobar
                          </button>
                          <button
                            type="button"
                            class="btn-action-ejecutivo btn-reject-ejecutivo"
                            title="Rechazar reporte"
                            @click="$emit('reject', hora)"
                          >
                            ✖ Rechazar
                          </button>
                        </div>
                        <span v-else class="badge-procesado font-mono">Procesado</span>
                      </td>

                      <!-- Botón Desglose -->
                      <td class="text-center">
                        <button
                          v-if="tieneDetalle(hora)"
                          type="button"
                          class="btn-desglose-toggle"
                          :class="{ active: filaAbierta(hora.id) }"
                          :title="filaAbierta(hora.id) ? 'Ocultar desglose técnico' : 'Ver desglose técnico'"
                          @click="alternarFila(hora.id)"
                        >
                          {{ filaAbierta(hora.id) ? '▴ Ocultar' : '▾ Detalle' }}
                        </button>
                        <span v-else class="text-muted font-mono" style="font-size: 0.72rem;">—</span>
                      </td>
                    </tr>

                    <!-- Desglose Técnico Expandido -->
                    <tr v-if="filaAbierta(hora.id)" class="fila-desglose-ejecutivo">
                      <td colspan="10">
                        <div class="desglose-card-ejecutivo">
                          <div class="desglose-grid">
                            <div v-if="hora.turnoNombre" class="desglose-item">
                              <span class="desglose-item-lbl">TURNO OFICIAL APLICADO</span>
                              <span class="desglose-item-val font-mono">🕒 {{ hora.turnoNombre }}</span>
                            </div>
                            <div v-for="campo in entradasDesglose(hora.recargoDesglose)" :key="campo.clave" class="desglose-item">
                              <span class="desglose-item-lbl">{{ campo.etiqueta.toUpperCase() }}</span>
                              <span class="desglose-item-val font-mono">{{ campo.valor }}</span>
                            </div>
                          </div>
                          <div v-if="hora.justificacion" class="desglose-justificacion">
                            <span class="justificacion-lbl">📝 JUSTIFICACIÓN / DESCRIPCIÓN OPERATIVA:</span>
                            <p class="justificacion-txt">{{ hora.justificacion }}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <!-- Footer Ejecutivo: resumen del reporte (la salida vive solo en el encabezado) -->
            <div class="modal-ejecutivo-footer">
              <div class="footer-summary-text">
                Registros listados: <strong>{{ registrosModalFiltrados.length }}</strong> de <strong>{{ funcionarioSeleccionado.registros.length }}</strong>
                · Total Horas: <strong class="text-primary">{{ redondear(funcionarioSeleccionado.totalHoras) }}h</strong>
                · Liquidación Estimada: <strong class="text-success">${{ formatCurrency(funcionarioSeleccionado.totalMonto) }}</strong>
              </div>
            </div>

          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

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

// ── Cuadro Externo / Modal Ejecutivo del Funcionario ──────────────────────────
const funcionarioSeleccionadoClave = ref(null)
const busquedaInterna = ref('')
const filtroEstadoModal = ref('')
const todosDesglosesAbiertos = ref(false)

const abrirReporteFuncionario = (grupo) => {
  funcionarioSeleccionadoClave.value = String(grupo.clave)
  busquedaInterna.value = ''
  filtroEstadoModal.value = ''
}

const cerrarModalFuncionario = () => {
  funcionarioSeleccionadoClave.value = null
  busquedaInterna.value = ''
  filtroEstadoModal.value = ''
}

// Funcionario activo sincronizado reactivamente con grupos
const funcionarioSeleccionado = computed(() => {
  if (!funcionarioSeleccionadoClave.value) return null
  return grupos.value.find((g) => String(g.clave) === String(funcionarioSeleccionadoClave.value)) || null
})

// Navegación entre funcionarios desde el propio cuadro externo
const indiceFuncionarioActual = computed(() => {
  if (!funcionarioSeleccionado.value) return -1
  return grupos.value.findIndex((g) => String(g.clave) === String(funcionarioSeleccionado.value.clave))
})

const navegarFuncionario = (delta) => {
  const actual = indiceFuncionarioActual.value
  if (actual === -1) return
  const nuevoIndice = actual + delta
  if (nuevoIndice >= 0 && nuevoIndice < grupos.value.length) {
    funcionarioSeleccionadoClave.value = String(grupos.value[nuevoIndice].clave)
    busquedaInterna.value = ''
    filtroEstadoModal.value = ''
  }
}

const inicialFuncionario = (nombre) => {
  if (!nombre) return '?'
  const partes = String(nombre).trim().split(/\s+/)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return (nombre[0] || '?').toUpperCase()
}

const formatearDiaSemana = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return dias[d.getDay()] || ''
}

const registrosModal = computed(() => {
  return funcionarioSeleccionado.value?.registros || []
})

const registrosModalFiltrados = computed(() => {
  const lista = registrosModal.value
  return lista.filter((hora) => {
    if (filtroEstadoModal.value && hora.estado !== filtroEstadoModal.value) {
      return false
    }
    if (busquedaInterna.value) {
      const q = busquedaInterna.value.toLowerCase().trim()
      const fecha = (hora.fechaOperacion || hora.fecha || '').toLowerCase()
      const tipo = (hora.tipoRecargo || hora.tipo || '').toLowerCase()
      const just = (hora.justificacion || '').toLowerCase()
      const turno = (hora.turnoNombre || '').toLowerCase()
      const area = (hora.cuadrillaArea || hora.area || '').toLowerCase()
      return fecha.includes(q) || tipo.includes(q) || just.includes(q) || turno.includes(q) || area.includes(q)
    }
    return true
  })
})

const cuentaEstado = (estado) => {
  if (!funcionarioSeleccionado.value) return 0
  return funcionarioSeleccionado.value.porEstado[estado] || 0
}

const alternarTodosDesgloses = () => {
  todosDesglosesAbiertos.value = !todosDesglosesAbiertos.value
  const nueva = new Set(filasAbiertas.value)
  for (const h of registrosModal.value) {
    if (todosDesglosesAbiertos.value) {
      nueva.add(String(h.id))
    } else {
      nueva.delete(String(h.id))
    }
  }
  filasAbiertas.value = nueva
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && funcionarioSeleccionado.value) {
    cerrarModalFuncionario()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

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

/* ==================== BOTÓN EN TABLA EXCEL ==================== */
.cell-clickable {
  cursor: pointer;
  transition: background 0.15s ease;
}
.cell-clickable:hover {
  background: #f1f5f9;
}
.cell-clickable:hover .user-name {
  color: #004884;
  text-decoration: underline;
}

.btn-ver-reporte-externo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #004884;
  color: #ffffff;
  border: 1px solid #003366;
  border-radius: 5px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-ver-reporte-externo:hover {
  background: #005fa3;
  border-color: #004884;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.18);
}
.btn-ver-reporte-externo:active {
  transform: translateY(0);
}
.btn-ver-icon {
  font-size: 0.85rem;
}

/* ==================== CUADRO EXTERNO / MODAL EJECUTIVO ==================== */
.modal-ejecutivo-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 22, 39, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

.modal-ejecutivo-dialog {
  background: #ffffff;
  border-radius: 14px;
  width: 100%;
  max-width: 1160px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -12px rgba(0, 20, 40, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Encabezado Ejecutivo ── */
.modal-ejecutivo-header {
  background: linear-gradient(135deg, #061c33 0%, #003666 50%, #004b80 100%);
  color: #ffffff;
  padding: 16px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 2px solid #73be28;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.funcionario-avatar-circle {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73be28, #38bdf8);
  color: #ffffff;
  font-size: 1.15rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  border: 2px solid #ffffff;
  flex-shrink: 0;
}

.funcionario-info-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.funcionario-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.funcionario-nombre {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.3px;
}

.badge-cedula {
  background: rgba(255, 255, 255, 0.15);
  color: #e0f2fe;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.badge-area {
  background: rgba(115, 190, 40, 0.25);
  color: #a3e635;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.74rem;
  font-weight: 700;
  border: 1px solid rgba(115, 190, 40, 0.4);
}

.funcionario-subtitle-row {
  font-size: 0.76rem;
  color: #94a3b8;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-funcionarios-group {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 2px 4px;
}

.btn-nav-func {
  background: transparent;
  color: #ffffff;
  border: none;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s ease;
}
.btn-nav-func:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}
.btn-nav-func:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-func-counter {
  font-size: 0.72rem;
  font-family: monospace;
  font-weight: 700;
  color: #e2e8f0;
  padding: 0 6px;
}

.btn-cerrar-ejecutivo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #dc2626;
  color: #ffffff;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-cerrar-ejecutivo:hover {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.45);
}
.btn-cerrar-ejecutivo:active {
  transform: translateY(0);
}

.btn-cerrar-icon {
  font-size: 0.95rem;
  font-weight: 900;
}

/* ── Métricas Rápidas (KPI Bar) ── */
.modal-kpi-bar {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 12px 22px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.kpi-mini-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.kpi-mini-card--wide {
  grid-column: span 1.5;
}

.kpi-mini-lbl {
  font-size: 0.64rem;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.4px;
}

.kpi-mini-val {
  font-size: 1.25rem;
  font-weight: 900;
  font-family: monospace;
  line-height: 1.2;
}

.kpi-mini-sub {
  font-size: 0.68rem;
  color: #94a3b8;
}

.kpi-estados-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.badge-status-kpi {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
  white-space: nowrap;
}

/* ── Toolbar de Filtros y Búsqueda ── */
.modal-toolbar {
  padding: 10px 22px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 280px;
  flex: 1;
  max-width: 420px;
}

.toolbar-search .search-icon {
  position: absolute;
  left: 9px;
  font-size: 0.85rem;
  color: #94a3b8;
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  padding: 6px 28px 6px 28px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #0f172a;
  outline: none;
  transition: all 0.15s ease;
}
.toolbar-search-input:focus {
  border-color: #004884;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

.btn-clear-search {
  position: absolute;
  right: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 6px;
}
.btn-clear-search:hover { color: #0f172a; }

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-pills-group {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.btn-filter-pill {
  background: transparent;
  border: none;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-filter-pill.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.btn-filter-pill.pill-warning.active {
  background: #fef3c7;
  color: #b45309;
}
.btn-filter-pill.pill-success.active {
  background: #dcfce7;
  color: #15803d;
}
.btn-filter-pill.pill-danger.active {
  background: #fee2e2;
  color: #b91c1c;
}

.btn-toggle-all-details {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-toggle-all-details:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: #94a3b8;
}

/* ── Scroll de la Tabla Ejecutiva ── */
.modal-table-scroll-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: #ffffff;
  min-height: 240px;
}

.tabla-ejecutiva {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.tabla-ejecutiva thead {
  position: sticky;
  top: 0;
  background: #f1f5f9;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.tabla-ejecutiva th {
  padding: 10px 10px;
  font-size: 0.68rem;
  font-weight: 800;
  color: #475569;
  letter-spacing: 0.4px;
  border-bottom: 2px solid #cbd5e1;
  text-transform: uppercase;
  white-space: nowrap;
}

.tabla-ejecutiva td {
  padding: 9px 10px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}

.fila-registro-ejecutiva:hover {
  background: #f8fafc;
}
.fila-registro-ejecutiva.row-pendiente {
  background: #fffbeb;
}
.fila-registro-ejecutiva.row-pendiente:hover {
  background: #fef3c7;
}

.col-num {
  width: 38px;
  color: #94a3b8;
  font-size: 0.74rem;
}

.cell-fecha {
  display: flex;
  flex-direction: column;
}
.fecha-dia {
  font-size: 0.68rem;
  font-weight: 800;
  color: #004884;
  text-transform: uppercase;
}
.fecha-valor {
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
}

.cell-horario {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.horario-badge {
  font-size: 0.74rem;
  font-weight: 700;
  color: #1e293b;
}
.cuadrilla-subtag {
  font-size: 0.66rem;
  color: #64748b;
  font-weight: 600;
}

.badge-tipo-ejecutivo {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.hours-badge-ejecutivo {
  display: inline-block;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 800;
  font-size: 0.78rem;
}

.status-badge-ejecutivo {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.btn-evidencias-ejecutivo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ecfeff;
  border: 1px solid #06b6d4;
  color: #0891b2;
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-evidencias-ejecutivo:hover {
  background: #0891b2;
  color: #ffffff;
}
.btn-evidencias-ejecutivo.evidencia-pendiente {
  background: #fffbeb;
  border-color: #d97706;
  color: #b45309;
}
.btn-evidencias-ejecutivo.evidencia-pendiente:hover {
  background: #d97706;
  color: #ffffff;
}

.btn-acciones-ejecutivas {
  display: inline-flex;
  gap: 4px;
}

.btn-action-ejecutivo {
  padding: 4px 9px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-approve-ejecutivo {
  background: #107c41;
  color: #ffffff;
}
.btn-approve-ejecutivo:hover {
  background: #0b5a2f;
  transform: translateY(-1px);
}

.btn-reject-ejecutivo {
  background: #dc2626;
  color: #ffffff;
}
.btn-reject-ejecutivo:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.badge-procesado {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 600;
}

.btn-desglose-toggle {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-desglose-toggle:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.btn-desglose-toggle.active {
  background: #004884;
  color: #ffffff;
  border-color: #004884;
}

/* ── Desglose Expandido dentro de la Tabla ── */
.fila-desglose-ejecutivo td {
  background: #f8fafc !important;
  padding: 10px 18px !important;
  border-bottom: 2px solid #e2e8f0;
}

.desglose-card-ejecutivo {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-left: 4px solid #004884;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.desglose-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.desglose-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.desglose-item-lbl {
  font-size: 0.62rem;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.4px;
}
.desglose-item-val {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
}

.desglose-justificacion {
  border-top: 1px dashed #e2e8f0;
  padding-top: 6px;
}
.justificacion-lbl {
  font-size: 0.64rem;
  font-weight: 800;
  color: #64748b;
  display: block;
  margin-bottom: 2px;
}
.justificacion-txt {
  margin: 0;
  font-size: 0.78rem;
  color: #1e293b;
  line-height: 1.4;
  font-style: italic;
}

/* ── Footer Ejecutivo ── */
.modal-ejecutivo-footer {
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: 12px 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-summary-text {
  font-size: 0.78rem;
  color: #334155;
}

/* Transición Modal */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
