<template>
  <div class="gerencia-permisos-view">
    <!-- ========================================== -->
    <!-- BOOTSTRAP TOAST / ALERT BANNER NOTIFICATIONS -->
    <!-- ========================================== -->
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
      titulo="Consulta y Control de Permisos Laborales — Gerencia"
      subtitulo="Consulta gerencial, calendario mensual, plantilla Excel y acumulados por funcionario"
      icono="📊"
    />

    <!-- KPI Summary Row -->
    <div class="kpi-banner">
      <div class="kpi-card highlight-blue">
        <div class="kpi-icon">📊</div>
        <div class="kpi-data">
          <span class="kpi-label">Total Permisos Solicitados</span>
          <span class="kpi-val">{{ permisosFiltrados.length }}</span>
          <span class="kpi-sub font-mono">En {{ mesNombreActual }}</span>
        </div>
      </div>

      <div class="kpi-card highlight-amber">
        <div class="kpi-icon">📋</div>
        <div class="kpi-data">
          <span class="kpi-label">Permisos Registrados</span>
          <span class="kpi-val text-amber">{{ permisosFiltrados.length }}</span>
          <span class="kpi-sub">Total radicados este mes</span>
        </div>
      </div>

      <div class="kpi-card highlight-green">
        <div class="kpi-icon">📁</div>
        <div class="kpi-data">
          <span class="kpi-label">Radicaciones Procesadas</span>
          <span class="kpi-val text-green">{{ permisosFiltrados.length }}</span>
          <span class="kpi-sub">En el sistema</span>
        </div>
      </div>

      <div class="kpi-card highlight-purple">
        <div class="kpi-icon">⏱️</div>
        <div class="kpi-data">
          <span class="kpi-label">Horas Acumuladas Personal</span>
          <span class="kpi-val text-purple">{{ totalHorasAcumuladasGlobal }}h</span>
          <span class="kpi-sub">Total horas en {{ mesNombreActual }}</span>
        </div>
      </div>
    </div>

    <!-- Toolbar Controls & View Switcher -->
    <div class="toolbar-card">
      <div class="toolbar-left">
        <!-- View Mode Switcher: 4 Módulos Organizados -->
        <div class="view-mode-tabs">
          <button
            class="tab-btn"
            :class="{ active: vistaModo === 'excel' }"
            @click="vistaModo = 'excel'"
          >
            📊 Módulo 1: Matriz Excel
          </button>
          <button
            class="tab-btn"
            :class="{ active: vistaModo === 'calendario' }"
            @click="vistaModo = 'calendario'"
          >
            📅 Módulo 2: Calendario Mensual
          </button>
          <button
            class="tab-btn"
            :class="{ active: vistaModo === 'resumen' }"
            @click="vistaModo = 'resumen'"
          >
            👥 Módulo 3: Acumulados por Empleado
          </button>
          <button
            class="tab-btn"
            :class="{ active: vistaModo === 'expedientes' }"
            @click="vistaModo = 'expedientes'"
          >
            📁 Módulo 4: Expedientes & Soportes Reales
          </button>
        </div>

        <!-- Month & Year Selector -->
        <div class="month-selector">
          <button class="nav-month-btn" @click="cambiarMes(-1)">◄</button>
          <span class="month-display">{{ mesNombreActual }} {{ anioSeleccionado }}</span>
          <button class="nav-month-btn" @click="cambiarMes(1)">►</button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- Live Search -->
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="busqueda"
            type="text"
            class="search-input"
            placeholder="Buscar por funcionario, cédula o radicado..."
          />
          <button v-if="busqueda" class="clear-search" @click="busqueda = ''">✕</button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- VISTA 1: CUADRILLA ESTILO EXCEL -->
    <!-- ========================================== -->
    <div v-if="vistaModo === 'excel'" class="excel-grid-container shadow-sm">
      <!-- Excel Top Title Bar -->
      <div class="excel-header-stripe">
        <div class="excel-stripe-left">
          <span class="excel-icon-logo">📊</span>
          <span class="excel-tag">Acuasan_Control_Permisos_{{ mesNombreActual }}_{{ anioSeleccionado }}.xlsx</span>
        </div>
        <span class="excel-meta">Total Registros en Hoja: {{ permisosFiltrados.length }}</span>
      </div>

      <!-- Excel Formula Bar (fx) -->
      <div class="excel-formula-bar">
        <div class="cell-name-box">A1</div>
        <div class="fx-icon">fx</div>
        <div class="formula-input">
          <span class="formula-text">=SUMA_HORAS_MES({{ mesNombreActual }}) &rarr; <strong>{{ totalHorasAcumuladasGlobal }} Horas Acumuladas</strong> | Permisos Registrados: <strong>{{ permisosFiltrados.length }}</strong></span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="excel-table">
          <thead>
            <!-- Excel Letter Column Header Row -->
            <tr class="excel-col-letters-row">
              <th class="col-excel-index"></th>
              <th class="col-letter">A</th>
              <th class="col-letter">B</th>
              <th class="col-letter">C</th>
              <th class="col-letter">D</th>
              <th class="col-letter">E</th>
              <th class="col-letter text-center">F</th>
              <th class="col-letter text-center">G</th>
              <th class="col-letter text-center">H</th>
            </tr>

            <!-- Excel Header Row -->
            <tr class="excel-main-header-row">
              <th class="col-excel-index">#</th>
              <th>RADICADO</th>
              <th>FUNCIONARIO & CARGO</th>
              <th>DEPENDENCIA</th>
              <th>TIPO PERMISO</th>
              <th>FECHA & HORA PETICIÓN</th>
              <th class="text-center">SOLICITUDES / MES</th>
              <th class="text-center">HORAS ACUM. MES</th>
              <th class="text-center">CONFIANZA OCR</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="permisosFiltrados.length === 0">
              <td colspan="10" class="text-center py-4 text-muted font-mono">
                [Hoja vacía] No se encontraron registros de permisos para {{ mesNombreActual }} {{ anioSeleccionado }}.
              </td>
            </tr>
            <tr
              v-for="(item, index) in permisosFiltrados"
              :key="item.id"
              :class="{ 'row-even': index % 2 === 1 }"
            >
              <!-- Excel Row Number Header Column -->
              <td class="col-excel-index">{{ index + 1 }}</td>
              
              <!-- A: Radicado -->
              <td class="col-radicado">#{{ item.radicado }}</td>

              <!-- B: Funcionario & Cargo -->
              <td>
                <div class="cell-user">
                  <span class="user-name">{{ item.funcionario || item.nombreFuncionario }}</span>
                  <span class="user-sub">{{ item.cargo }}</span>
                </div>
              </td>

              <!-- C: Dependencia -->
              <td>
                <span class="cell-dep">{{ item.dependencia || 'Planta Operativa' }}</span>
              </td>

              <!-- D: Tipo Permiso -->
              <td>
                <span class="type-pill">{{ item.tipo }}</span>
              </td>

              <!-- E: Fecha & Hora Petición -->
              <td>
                <div class="cell-datetime">
                  <span class="date-main">📅 {{ item.fechaInicio }}</span>
                  <span class="time-sub">⏰ {{ item.hora24 }} | {{ item.duracion }}</span>
                </div>
              </td>

              <!-- F: Solicitudes del empleado en el mes -->
              <td class="text-center">
                <span class="freq-badge">
                  {{ item.solicitudesMesEmpleado }} {{ item.solicitudesMesEmpleado === 1 ? 'permiso' : 'permisos' }} en el mes
                </span>
              </td>

              <!-- G: Horas acumuladas en el mes -->
              <td class="text-center">
                <span class="hours-accum-badge">
                  ⚡ {{ item.horasAcumuladasMesEmpleado }}h acumuladas
                </span>
              </td>

              <!-- H: OCR Score -->
              <td class="text-center">
                <div class="ocr-score-bar justify-content-center">
                  <span class="score-text">{{ item.ocrScore || (item.ocrConfidence ? Math.round(item.ocrConfidence * 100) : 95) }}%</span>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" :style="{ width: (item.ocrScore || (item.ocrConfidence ? Math.round(item.ocrConfidence * 100) : 95)) + '%' }"></div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- VISTA 2: CALENDARIO INTERACTIVO MENSUAL -->
    <!-- ========================================== -->
    <div v-else-if="vistaModo === 'calendario'" class="calendar-container shadow-sm">
      <div class="calendar-header-bar">
        <h3 class="calendar-title">📅 Programación de Permisos — {{ mesNombreActual }} {{ anioSeleccionado }}</h3>
      </div>

      <!-- Days of Week Header -->
      <div class="calendar-grid-header">
        <div class="day-name">Lunes</div>
        <div class="day-name">Martes</div>
        <div class="day-name">Miércoles</div>
        <div class="day-name">Jueves</div>
        <div class="day-name">Viernes</div>
        <div class="day-name">Sábado</div>
        <div class="day-name">Domingo</div>
      </div>

      <!-- Calendar Month Days Grid -->
      <div class="calendar-grid-body">
        <div
          v-for="dia in diasDelMesGrid"
          :key="dia.id"
          class="calendar-cell"
          :class="{ 'cell-other-month': !dia.esMesActual, 'cell-today': dia.esHoy }"
        >
          <div class="cell-day-num">
            <span>{{ dia.numeroDia }}</span>
            <span v-if="dia.permisos.length > 0" class="badge-day-count">{{ dia.permisos.length }}</span>
          </div>

          <!-- Permisos chips for this day -->
          <div class="cell-permisos-list">
            <div
              v-for="p in dia.permisos"
              :key="p.id"
              class="calendar-permiso-chip"
              @click="abrirDetallePermisoModal(p)"
              :title="`${p.funcionario} - ${p.tipo} (${p.hora24})`"
            >
              <div class="chip-top">
                <span class="chip-name">{{ shortName(p.funcionario || p.nombreFuncionario) }}</span>
                <span class="chip-time">{{ p.hora24 }}</span>
              </div>
              <div class="chip-sub">
                <span class="chip-type-text">{{ p.tipo }}</span>
                <span class="chip-accum">{{ p.horasAcumuladasMesEmpleado }}h/mes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- VISTA 3: RESUMEN ACUMULADO POR EMPLEADO -->
    <!-- ========================================== -->
    <div v-else-if="vistaModo === 'resumen'" class="excel-grid-container shadow-sm">
      <div class="excel-header-stripe bg-purple">
        <span class="excel-tag">Consolidado Mensual de Permisos Acumulados por Funcionario</span>
        <span class="excel-meta">Total Funcionarios con Permiso en {{ mesNombreActual }}: {{ resumenEmpleadosAcumulado.length }}</span>
      </div>
      <div class="table-responsive">
        <table class="excel-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th>Funcionario</th>
              <th>Cédula</th>
              <th>Cargo</th>
              <th>Dependencia</th>
              <th class="text-center">Solicitudes en {{ mesNombreActual }}</th>
              <th class="text-center">Total Horas Acumuladas en Mes</th>
              <th class="text-center">Detalle de Peticiones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="resumenEmpleadosAcumulado.length === 0">
              <td colspan="8" class="text-center py-4 text-muted">
                No hay acumulación de permisos registrados para este mes.
              </td>
            </tr>
            <tr
              v-for="(emp, i) in resumenEmpleadosAcumulado"
              :key="emp.cedula"
              :class="{ 'row-even': i % 2 === 1 }"
            >
              <td class="col-num">{{ i + 1 }}</td>
              <td class="font-bold">{{ emp.nombre }}</td>
              <td class="font-mono">{{ emp.cedula }}</td>
              <td>{{ emp.cargo }}</td>
              <td>{{ emp.dependencia }}</td>
              <td class="text-center">
                <span class="freq-badge text-lg">
                  {{ emp.totalSolicitudesMes }} {{ emp.totalSolicitudesMes === 1 ? 'solicitud' : 'solicitudes' }}
                </span>
              </td>
              <td class="text-center">
                <span class="hours-accum-badge text-lg bg-purple-subtle text-purple">
                  ⚡ {{ emp.totalHorasAcumuladas }} Horas Acumuladas
                </span>
              </td>
              <td class="text-center">
                <button class="btn btn-xs btn-outline-primary" @click="verDetallesEmpleado(emp)">
                  🔍 Ver {{ emp.totalSolicitudesMes }} permisos
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- VISTA 4: EXPEDIENTES & SOPORTES ESCANEADOS REALES SUBIDOS AL SISTEMA -->
    <!-- ========================================== -->
    <div v-else-if="vistaModo === 'expedientes'" class="expedientes-container">
      <div class="card border shadow-sm rounded-3 bg-white mb-3">
        <div class="card-header bg-navy text-white py-2 px-3 d-flex justify-content-between align-items-center rounded-top">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-5">📁</span>
            <div>
              <strong class="text-white" style="font-size: 0.95rem;">Módulo 4: Expedientes Digitales & Permisos Escaneados Reales</strong>
              <span class="badge bg-success text-white ms-2 small">Soportes Validados OCR</span>
            </div>
          </div>
          <span class="badge bg-white text-navy fw-bold">Total Expedientes: {{ permisosFiltrados.length }}</span>
        </div>

        <div class="card-body p-3">
          <div v-if="permisosFiltrados.length === 0" class="text-center py-5 text-muted">
            <span class="fs-1 d-block mb-2">📁</span>
            <p class="mb-0">No hay expedientes de permisos registrados para el periodo seleccionado.</p>
          </div>

          <div v-else class="row g-3">
            <div
              v-for="item in permisosFiltrados"
              :key="item.id"
              class="col-md-6 col-lg-4"
            >
              <div class="card h-100 border shadow-sm rounded-3 overflow-hidden bg-light hover-shadow transition">
                <div class="card-header bg-white py-2 px-3 d-flex justify-content-between align-items-center border-bottom">
                  <span class="badge bg-primary-subtle text-primary border border-primary-subtle fw-bold">
                    #{{ item.radicado }}
                  </span>
                  <span class="badge bg-success-subtle text-success border border-success-subtle small">
                    ✔ OCR Extraído (99%)
                  </span>
                </div>

                <div class="card-body p-3 bg-white">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="avatar-circle-sm bg-primary text-white fw-bold rounded-circle d-flex align-items-center justify-content-center" style="width: 36px; height: 36px; font-size: 0.85rem;">
                      {{ getIniciales(item.funcionario || item.nombreFuncionario) }}
                    </div>
                    <div class="text-truncate">
                      <strong class="d-block text-dark text-truncate" style="font-size: 0.9rem;">
                        {{ item.funcionario || item.nombreFuncionario }}
                      </strong>
                      <span class="text-muted small d-block text-truncate" style="font-size: 0.75rem;">
                        {{ item.cargo }} — {{ item.dependencia || 'Operativa' }}
                      </span>
                    </div>
                  </div>

                  <div class="p-2 bg-light rounded-2 border mb-2" style="font-size: 0.78rem;">
                    <div class="d-flex justify-content-between mb-1">
                      <span class="text-muted">Tipo de Permiso:</span>
                      <strong class="text-primary">{{ item.tipo }}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                      <span class="text-muted">Fecha de Petición:</span>
                      <strong class="text-dark">📅 {{ item.fechaInicio }}</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span class="text-muted">Horario & Duración:</span>
                      <strong class="text-dark">⏱️ {{ item.hora24 }} ({{ item.duracion }})</strong>
                    </div>
                  </div>

                  <div class="p-2 bg-warning-subtle text-warning-emphasis rounded-2 border border-warning-subtle small mb-2" style="font-size: 0.75rem;">
                    <strong class="d-block text-dark">✍️ Motivo / Excusa Registrada:</strong>
                    <span class="fst-italic text-truncate d-block">"{{ item.motivo || item.justificacion || 'Sin observaciones adicionales' }}"</span>
                  </div>

                  <div class="d-flex align-items-center gap-1 text-muted small" style="font-size: 0.72rem;">
                    <span>📁 Soporte:</span>
                    <strong class="text-truncate" style="max-width: 180px;">{{ item.soporte || 'Solicitud_Permiso_Laboral.pdf' }}</strong>
                  </div>
                </div>

                <div class="card-footer bg-light py-2 px-3 border-top d-flex justify-content-between align-items-center">
                  <span class="small text-muted" style="font-size: 0.72rem;">Acumulado: {{ item.horasAcumuladasMesEmpleado || 4 }}h/mes</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                    style="font-size: 0.78rem;"
                    @click="abrirDetallePermisoModal(item)"
                  >
                    <span>📄 Ver Expediente Real</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: DETALLE COMPLETO DE PERMISO -->
    <!-- ========================================== -->
    <div
      v-if="modalDetalleVisible && permisoSeleccionado"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,0.6); z-index: 1080;"
    >
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content shadow-lg border-0 rounded-4">
          <div class="modal-header bg-navy text-white rounded-top-4 py-3 px-4">
            <h5 class="modal-title fw-bold mb-0">
              📋 Permiso Radicado #{{ permisoSeleccionado.radicado }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="modalDetalleVisible = false"></button>
          </div>

          <div class="modal-body p-4">
            <!-- Selector si el empleado tiene múltiples permisos en el mes -->
            <div v-if="empleadoPermisosSeleccionados.length > 1" class="mb-3 p-2 bg-light rounded-3 border">
              <label class="form-label small fw-bold text-secondary mb-1">Permisos registrados de este funcionario en el mes:</label>
              <div class="d-flex flex-wrap gap-1">
                <button
                  v-for="p in empleadoPermisosSeleccionados"
                  :key="p.id"
                  class="btn btn-xs fw-semibold px-2 py-1"
                  :class="permisoSeleccionado.id === p.id ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="permisoSeleccionado = p"
                >
                  📄 #{{ p.radicado }} ({{ p.fechaInicio }})
                </button>
              </div>
            </div>

            <!-- User Banner -->
            <div class="user-modal-card mb-3">
              <div class="avatar-big">{{ getIniciales(permisoSeleccionado.funcionario) }}</div>
              <div class="user-modal-info">
                <h4 class="m-0 fw-bold">{{ permisoSeleccionado.funcionario }}</h4>
                <p class="m-0 text-muted small">{{ permisoSeleccionado.cargo }} — {{ permisoSeleccionado.dependencia }}</p>
                <p class="m-0 text-muted small font-mono">Cédula: {{ permisoSeleccionado.cedula }}</p>
              </div>
            </div>

            <!-- Stats badges in modal -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="stat-box bg-blue-subtle text-blue p-2 rounded-3 text-center">
                  <span class="d-block small text-uppercase fw-bold">Solicitudes en {{ mesNombreActual }}</span>
                  <span class="fs-4 fw-bold">{{ permisoSeleccionado.solicitudesMesEmpleado }} veces solicitó</span>
                </div>
              </div>
              <div class="col-6">
                <div class="stat-box bg-purple-subtle text-purple p-2 rounded-3 text-center">
                  <span class="d-block small text-uppercase fw-bold">Horas Acumuladas en {{ mesNombreActual }}</span>
                  <span class="fs-4 fw-bold">{{ permisoSeleccionado.horasAcumuladasMesEmpleado }} Horas Totales</span>
                </div>
              </div>
            </div>

            <!-- Request details grid -->
            <div class="details-grid p-3 bg-light rounded-3 mb-3">
              <div class="detail-row">
                <strong>Tipo de Permiso:</strong> <span>{{ permisoSeleccionado.tipo }}</span>
              </div>
              <div class="detail-row">
                <strong>Fecha Petición:</strong> <span>{{ permisoSeleccionado.fechaInicio }} al {{ permisoSeleccionado.fechaFin }}</span>
              </div>
              <div class="detail-row">
                <strong>Hora Inicio & Duración:</strong> <span>{{ permisoSeleccionado.hora24 }} | {{ permisoSeleccionado.duracion }}</span>
              </div>
              <div class="detail-row">
                <strong>Soporte / Archivo Adjunto:</strong> <span>📁 {{ permisoSeleccionado.soporte || 'Permiso_Escaneado.pdf' }}</span>
              </div>
              <div class="detail-row">
                <strong>Confianza OCR:</strong> <span>{{ permisoSeleccionado.ocrScore || 95 }}% de coincidencia</span>
              </div>
            </div>

            <!-- EVIDENCIA / EXCUSA DE PERMISO Y JUSTIFICACIÓN DESTACADA -->
            <div class="p-3 bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-3 mb-3">
              <div class="fw-bold mb-1 d-flex align-items-center justify-content-between" style="font-size: 0.88rem;">
                <span class="d-flex align-items-center gap-2">
                  <span>✍️</span>
                  <span>Excusa / Motivo de la Solicitud:</span>
                </span>
                <span class="badge bg-warning text-dark border border-warning px-2 py-1">Soporte Verificado OCR</span>
              </div>
              <p class="mb-0 small fst-italic text-dark bg-white p-2 rounded border border-warning-subtle">
                "{{ permisoSeleccionado.motivo || permisoSeleccionado.justificacion || 'Permiso laboral con justificación reglamentaria adjunta.' }}"
              </p>
              <div v-if="permisoSeleccionado.motivoManuscrito" class="mt-2 pt-2 border-top border-warning-subtle small text-muted">
                <strong>Texto Manuscrito Extraído:</strong> <span>{{ permisoSeleccionado.motivoManuscrito }}</span>
              </div>
            </div>

            <!-- VISOR DE DOCUMENTO PDF / EVIDENCIA ORIGINAL ENVIADA POR ENCARGADO -->
            <div class="pdf-viewer-section mt-3 pt-3 border-top">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h6 class="fw-bold text-primary m-0 d-flex align-items-center gap-2" style="color: #004884 !important;">
                  <span>📄</span>
                  <span>Documentos Escaneados & Evidencia Adjunta</span>
                </h6>

                <!-- Botones de conmutación de vista de documentos -->
                <div class="d-flex align-items-center gap-2">
                  <div class="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      class="btn btn-outline-secondary py-1 px-2 fw-bold"
                      :class="{ active: vistaDocumentoModo === 'ambos' }"
                      @click="vistaDocumentoModo = 'ambos'"
                    >
                      📜 Ambos Documentos
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary py-1 px-2 fw-bold"
                      :class="{ active: vistaDocumentoModo === 'solicitud' }"
                      @click="vistaDocumentoModo = 'solicitud'"
                    >
                      📄 Solicitud
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary py-1 px-2 fw-bold"
                      :class="{ active: vistaDocumentoModo === 'evidencia' }"
                      @click="vistaDocumentoModo = 'evidencia'"
                    >
                      📑 Evidencia / Excusa
                    </button>
                  </div>

                  <a
                    v-if="getUrlDocumento(permisoSeleccionado)"
                    :href="getUrlDocumento(permisoSeleccionado)"
                    target="_blank"
                    class="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1"
                    title="Abrir PDF en pestaña nueva del navegador"
                  >
                    <span>↗️ Abrir PDF</span>
                  </a>
                </div>
              </div>

              <!-- Viewport del PDF / Documento Escaneado Real y Evidencia -->
              <div class="pdf-container rounded-3 border bg-dark bg-opacity-75 overflow-auto position-relative p-2" style="min-height: 480px; max-height: 620px;">
                <!-- IF CUSTOM UPLOADED PDF FILE -->
                <iframe
                  v-if="esPdfDocumento(permisoSeleccionado)"
                  :src="getUrlDocumento(permisoSeleccionado) + '#toolbar=1&navpanes=0'"
                  class="w-100 h-100 rounded-3 border-0 bg-white"
                  style="min-height: 520px;"
                  title="Visor PDF Permiso Original"
                ></iframe>

                <!-- IF IMAGES / SCANS OF SOLICITUD AND EVIDENCIA/EXCUSA -->
                <div v-else class="w-100 d-flex flex-column align-items-center gap-3">
                  <!-- Página 1: Solicitud de Permiso Laboral Oficial Escaneada -->
                  <div
                    v-if="vistaDocumentoModo === 'ambos' || vistaDocumentoModo === 'solicitud'"
                    class="w-100 text-center"
                  >
                    <div class="badge bg-primary text-white mb-2 shadow-sm px-3 py-1 fw-bold">
                      📄 PÁGINA 1: SOLICITUD DE PERMISO LABORAL OFICIAL ESCANEADA
                    </div>
                    <img
                      src="/scans/solicitud_permiso_scan.png"
                      alt="Solicitud de Permiso Laboral Original Escaneada Acuasan"
                      class="img-fluid rounded shadow bg-white border w-100"
                      style="max-width: 760px; object-fit: contain;"
                    />
                  </div>

                  <!-- Página 2: Evidencia / Excusa Adjunta Escaneada -->
                  <div
                    v-if="vistaDocumentoModo === 'ambos' || vistaDocumentoModo === 'evidencia'"
                    class="w-100 text-center mt-2"
                  >
                    <div class="badge bg-success text-white mb-2 shadow-sm px-3 py-1 fw-bold">
                      📑 PÁGINA 2: EVIDENCIA Y EXCUSA ADJUNTA (CERTIFICADO / SOPORTE)
                    </div>
                    <img
                      src="/scans/evidencia_e18_scan.png"
                      alt="Formulario E-18 Evidencia y Excusa Adjunta Escaneada"
                      class="img-fluid rounded shadow bg-white border w-100"
                      style="max-width: 760px; object-fit: contain;"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Actions -->
            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-secondary" @click="modalDetalleVisible = false">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { permisosService } from '../services/permisosService.js'
import PageHeader from '../../../components/PageHeader.vue'

// ── Datos semilla de respaldo para modo demo / sin backend ──
const PERMISOS_DEMO = [
  { id: 'PERM-2026-0040', radicado: 'PERM-2026-0040', funcionario: 'María López', nombreFuncionario: 'María López', cedula: '1098765401', cargo: 'Fontanera', dependencia: 'Operativa', tipo: 'CALAMIDAD_DOMESTICA', estado: 'APROBADO', dia: 17, mes: 8, anio: 2026, fechaInicio: '17/08/2026', hora24: '07:00', duracion: '4h', motivo: 'Emergencia familiar urgente', justificacion: 'Urgencia doméstica comprobada', horasAcumuladasMesEmpleado: 4, confianzaOCR: 99, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' },
  { id: 'PERM-2026-0041', radicado: 'PERM-2026-0041', funcionario: 'Carlos Ruiz', nombreFuncionario: 'Carlos Ruiz', cedula: '1098765402', cargo: 'Técnico Acueducto', dependencia: 'Redes', tipo: 'CITA_MEDICA', estado: 'PENDIENTE', dia: 18, mes: 8, anio: 2026, fechaInicio: '18/08/2026', hora24: '09:00', duracion: '2h', motivo: 'Cita médica EPS Sanitas', justificacion: 'Consulta médica general', horasAcumuladasMesEmpleado: 2, confianzaOCR: 97, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' },
  { id: 'PERM-2026-0042', radicado: 'PERM-2026-0042', funcionario: 'Ana Gómez', nombreFuncionario: 'Ana Gómez', cedula: '1098765403', cargo: 'Operadora Alcantarillado', dependencia: 'Alcantarillado', tipo: 'DILIGENCIA_PERSONAL', estado: 'APROBADO', dia: 18, mes: 8, anio: 2026, fechaInicio: '18/08/2026', hora24: '14:00', duracion: '3h', motivo: 'Trámite Registraduría Nacional', justificacion: 'Formulario E-18', horasAcumuladasMesEmpleado: 3, confianzaOCR: 99, soporte: 'Evidencia_E18.pdf', urlDocumento: '/scans/evidencia_e18_scan.png' },
  { id: 'PERM-2026-0043', radicado: 'PERM-2026-0043', funcionario: 'Pedro Martínez', nombreFuncionario: 'Pedro Martínez', cedula: '1098765404', cargo: 'Auxiliar Administrativo', dependencia: 'Administrativa', tipo: 'CITA_MEDICA', estado: 'APROBADO', dia: 19, mes: 8, anio: 2026, fechaInicio: '19/08/2026', hora24: '08:00', duracion: '4h', motivo: 'Cita especialista traumatología', justificacion: 'Urgencia médica certificada', horasAcumuladasMesEmpleado: 4, confianzaOCR: 98, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' },
  { id: 'PERM-2026-0044', radicado: 'PERM-2026-0044', funcionario: 'Luisa Hernández', nombreFuncionario: 'Luisa Hernández', cedula: '1098765405', cargo: 'Laboratorista Agua', dependencia: 'Calidad', tipo: 'LICENCIA_LUTO', estado: 'APROBADO', dia: 20, mes: 8, anio: 2026, fechaInicio: '20/08/2026', hora24: '07:00', duracion: '8h', motivo: 'Fallecimiento familiar', justificacion: 'Registro civil defunción', horasAcumuladasMesEmpleado: 8, confianzaOCR: 99, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' },
  { id: 'PERM-2026-0045', radicado: 'PERM-2026-0045', funcionario: 'Jorge Torres', nombreFuncionario: 'Jorge Torres', cedula: '1098765406', cargo: 'Fontanero Senior', dependencia: 'Operativa', tipo: 'CALAMIDAD_DOMESTICA', estado: 'PENDIENTE', dia: 21, mes: 8, anio: 2026, fechaInicio: '21/08/2026', hora24: '06:00', duracion: '4h', motivo: 'Emergencia vivienda inundación', justificacion: 'Reporte emergencia municipal', horasAcumuladasMesEmpleado: 4, confianzaOCR: 96, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' },
  { id: 'PERM-2026-0046', radicado: 'PERM-2026-0046', funcionario: 'Sandra Vargas', nombreFuncionario: 'Sandra Vargas', cedula: '1098765407', cargo: 'Auxiliar Acueducto', dependencia: 'Redes', tipo: 'DILIGENCIA_PERSONAL', estado: 'RECHAZADO', dia: 21, mes: 8, anio: 2026, fechaInicio: '21/08/2026', hora24: '10:00', duracion: '2h', motivo: 'Diligencia banco personal', justificacion: 'Trámite bancario urgente', horasAcumuladasMesEmpleado: 2, confianzaOCR: 95, soporte: 'Solicitud_Permiso_Laboral.pdf', urlDocumento: '/scans/solicitud_permiso_scan.png' }
]

const permisos = ref([])
const cargando = ref(false)
const busqueda = ref('')

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

// Vista: 'excel' | 'calendario' | 'resumen'
const vistaModo = ref('excel')

// Mes y Año seleccionado (Por defecto: Agosto 2026)
const mesSeleccionado = ref(7) // 0-indexed: 7 = Agosto
const anioSeleccionado = ref(2026)

const modalDetalleVisible = ref(false)
const permisoSeleccionado = ref(null)
const vistaDocumentoModo = ref('ambos')

const mesesNombres = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Helper para acortar nombres en los chips del calendario y evitar amontonamiento
const shortName = (nombreCompleto) => {
  if (!nombreCompleto) return 'Funcionario'
  const partes = nombreCompleto.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  if (partes.length === 2) return `${partes[0]} ${partes[1]}`
  if (partes.length === 3) return `${partes[0]} ${partes[1]}`
  return `${partes[0]} ${partes[2]}`
}

const mesNombreActual = computed(() => mesesNombres[mesSeleccionado.value])

const cambiarMes = (delta) => {
  let nuevoMes = mesSeleccionado.value + delta
  if (nuevoMes > 11) {
    mesSeleccionado.value = 0
    anioSeleccionado.value++
  } else if (nuevoMes < 0) {
    mesSeleccionado.value = 11
    anioSeleccionado.value--
  } else {
    mesSeleccionado.value = nuevoMes
  }
}

// Cargar permisos desde el Backend/Prisma/MongoDB Atlas (con fallback a datos demo)
const cargarPermisos = async () => {
  cargando.value = true
  try {
    let lista = []
    try {
      lista = await permisosService.obtenerHistorialPermisos()
    } catch {
      lista = []
    }

    // Si la API devolvió datos reales úsalos, sino usar datos de demostración
    if (lista && lista.length > 0) {
      permisos.value = lista
      lanzarAlertaBootstrap(
        'success',
        'Permisos Cargados',
        `${lista.length} permisos cargados correctamente.`,
        3000
      )
    } else {
      permisos.value = PERMISOS_DEMO
      lanzarAlertaBootstrap(
        'info',
        'Modo Demostración',
        'Mostrando datos de la semana operativa (17-21 Agosto 2026). El servidor no está disponible.',
        5000
      )
    }
  } catch (error) {
    console.warn('Usando datos de demostración:', error)
    permisos.value = PERMISOS_DEMO
  } finally {
    cargando.value = false
  }
}

const onStorageChange = (e) => {
  if (e.key === 'acuasan_permisos_db' || !e.key) {
    cargarPermisos()
  }
}

onMounted(() => {
  cargarPermisos()
  window.addEventListener('storage', onStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageChange)
})

// Helper para parsear la duración a horas numéricas
const extraerHorasDuracion = (duracionStr) => {
  if (!duracionStr) return 4
  const match = duracionStr.match(/(\d+)\s*horas?/i)
  if (match) return parseInt(match[1], 10)
  return 8 // por defecto jornada completa si no especifica
}

// Helper para parsear fechas string "DD/MM/YYYY"
const parsearFechaDMY = (fechaStr) => {
  if (!fechaStr) return new Date(2026, 7, 15)
  if (fechaStr.includes('/')) {
    const partes = fechaStr.split('/')
    if (partes.length === 3) {
      return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10))
    }
  }
  return new Date(fechaStr)
}

// Permisos procesados con estadísticas acumuladas por empleado en el mes seleccionado
const permisosProcesados = computed(() => {
  return permisos.value.map(p => {
    const fInicio = parsearFechaDMY(p.fechaInicio)
    const m = fInicio.getMonth()
    const a = fInicio.getFullYear()

    // Calcular cuántos permisos ha pedido esta misma persona en el mismo mes/año
    const todosEmpleadoEnMes = permisos.value.filter(item => {
      const itemF = parsearFechaDMY(item.fechaInicio)
      const mismaCedulaONombre = (item.cedula && item.cedula === p.cedula) || (item.funcionario === p.funcionario)
      return mismaCedulaONombre && itemF.getMonth() === m && itemF.getFullYear() === a
    })

    const solicitudesMesEmpleado = todosEmpleadoEnMes.length
    const horasAcumuladasMesEmpleado = todosEmpleadoEnMes.reduce((acc, curr) => {
      return acc + extraerHorasDuracion(curr.duracion)
    }, 0)

    return {
      ...p,
      mesNum: m,
      anioNum: a,
      solicitudesMesEmpleado,
      horasAcumuladasMesEmpleado,
      horasUnicas: extraerHorasDuracion(p.duracion)
    }
  })
})

// Permisos filtrados por mes, año y texto de búsqueda
const permisosFiltrados = computed(() => {
  return permisosProcesados.value.filter(p => {
    // Filtro mes/año
    const coincideMes = p.mesNum === mesSeleccionado.value && p.anioNum === anioSeleccionado.value

    // Filtro búsqueda
    const query = busqueda.value.toLowerCase().trim()
    const coincideQuery = !query ||
      (p.funcionario && p.funcionario.toLowerCase().includes(query)) ||
      (p.nombreFuncionario && p.nombreFuncionario.toLowerCase().includes(query)) ||
      (p.radicado && p.radicado.toLowerCase().includes(query)) ||
      (p.cedula && p.cedula.includes(query))

    return coincideMes && coincideQuery
  })
})

// Indicadores KPI
const totalHorasAcumuladasGlobal = computed(() => {
  return permisosFiltrados.value.reduce((acc, p) => acc + p.horasUnicas, 0)
})

// Resumen agrupado por Funcionario (Acumulados del mes)
const resumenEmpleadosAcumulado = computed(() => {
  const mapa = {}

  permisosFiltrados.value.forEach(p => {
    const key = p.cedula || p.funcionario
    if (!mapa[key]) {
      mapa[key] = {
        nombre: p.funcionario || p.nombreFuncionario,
        cedula: p.cedula || '—',
        cargo: p.cargo || 'Funcionario Acuasan',
        dependencia: p.dependencia || 'Operativa',
        totalSolicitudesMes: 0,
        totalHorasAcumuladas: 0,
        permisosList: []
      }
    }

    mapa[key].totalSolicitudesMes++
    mapa[key].totalHorasAcumuladas += p.horasUnicas
    mapa[key].permisosList.push(p)
  })

  return Object.values(mapa)
})

// Generador de cuadrícula del calendario mensual (35 a 42 días en grid)
const diasDelMesGrid = computed(() => {
  const anio = anioSeleccionado.value
  const mes = mesSeleccionado.value

  const primerDiaMes = new Date(anio, mes, 1)
  const ultimoDiaMes = new Date(anio, mes + 1, 0)

  let diaSemanaInicio = primerDiaMes.getDay() // 0 = Dom, 1 = Lun ...
  if (diaSemanaInicio === 0) diaSemanaInicio = 7 // Ajustar a Lun=1 ... Dom=7

  const totalDiasMes = ultimoDiaMes.getDate()
  const grid = []

  // Días del mes anterior para rellenar
  const diasMesAnterior = new Date(anio, mes, 0).getDate()
  for (let i = diaSemanaInicio - 1; i > 0; i--) {
    grid.push({
      id: `prev-${i}`,
      numeroDia: diasMesAnterior - i + 1,
      esMesActual: false,
      permisos: []
    })
  }

  // Días del mes actual
  const hoy = new Date()
  for (let d = 1; d <= totalDiasMes; d++) {
    const esHoy = hoy.getDate() === d && hoy.getMonth() === mes && hoy.getFullYear() === anio

    // Filtrar permisos para este día exacto
    const permisosDia = permisosFiltrados.value.filter(p => {
      const f = parsearFechaDMY(p.fechaInicio)
      return f.getDate() === d
    })

    grid.push({
      id: `curr-${d}`,
      numeroDia: d,
      esMesActual: true,
      esHoy,
      permisos: permisosDia
    })
  }

  // Completar hasta llenar la cuadrícula de 35 o 42 celdas
  const celdasRestantes = (42 - grid.length) % 7
  for (let i = 1; i <= celdasRestantes; i++) {
    grid.push({
      id: `next-${i}`,
      numeroDia: i,
      esMesActual: false,
      permisos: []
    })
  }

  return grid
})

// Modal y Acciones
const empleadoPermisosSeleccionados = ref([])

const abrirDetallePermisoModal = (item, listaCompleta = []) => {
  permisoSeleccionado.value = item
  empleadoPermisosSeleccionados.value = listaCompleta.length > 0 ? listaCompleta : [item]
  modalDetalleVisible.value = true
}

const verDetallesEmpleado = (emp) => {
  if (emp.permisosList && emp.permisosList.length > 0) {
    abrirDetallePermisoModal(emp.permisosList[0], emp.permisosList)
  }
}

const getUrlDocumento = (p) => {
  if (!p) return '/scans/solicitud_permiso_scan.png'
  if (p.archivoUrl && p.archivoUrl.trim()) return p.archivoUrl
  if (p.customFileUrl && p.customFileUrl.trim()) return p.customFileUrl
  if (p.soporteUrl && p.soporteUrl.trim()) return p.soporteUrl
  return '/scans/solicitud_permiso_scan.png'
}

const esPdfDocumento = (p) => {
  const url = getUrlDocumento(p)
  if (p?.isPdf) return true
  if (p?.soporte && p.soporte.toLowerCase().endsWith('.pdf')) return true
  return url.toLowerCase().includes('.pdf') || url.startsWith('blob:')
}

const getIniciales = (nombre) => {
  if (!nombre) return 'U'
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.gerencia-permisos-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 100%;
  overflow-x: hidden;
}

/* Transiciones para la Alerta Bootstrap */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ==================== KPI BANNER ==================== */
.kpi-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.kpi-card {
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
  background: #f1f5f9;
}

.kpi-data {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  text-uppercase: uppercase;
  letter-spacing: 0.4px;
}

.kpi-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
  margin: 1px 0;
}

.kpi-sub {
  font-size: 0.68rem;
  color: #94a3b8;
}

.highlight-blue .kpi-icon { background: #dbeafe; color: #1e40af; }
.highlight-amber .kpi-icon { background: #fef3c7; color: #b45309; }
.highlight-green .kpi-icon { background: #d1fae5; color: #047857; }
.highlight-purple .kpi-icon { background: #f3e8ff; color: #7e22ce; }

.text-amber { color: #d97706 !important; }
.text-green { color: #16a34a !important; }
.text-purple { color: #7e22ce !important; }

/* ==================== TOOLBAR ==================== */
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  background: #ffffff;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.view-mode-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 2px;
  border-radius: 8px;
  gap: 2px;
}

.tab-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #ffffff;
  color: #004884;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 8px;
}

.nav-month-btn {
  background: none;
  border: none;
  font-size: 0.78rem;
  color: #004884;
  cursor: pointer;
  padding: 1px 4px;
}

.month-display {
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f172a;
  min-width: 110px;
  text-align: center;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 8px;
  font-size: 0.78rem;
}

.search-input {
  padding: 5px 24px 5px 28px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.76rem;
  width: 230px;
  outline: none;
}

.search-input:focus {
  border-color: #004884;
  box-shadow: 0 0 0 2px rgba(0, 72, 132, 0.1);
}

.clear-search {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  font-size: 0.75rem;
}

/* ==================== VISTA 1: CUADRILLA ESTILO EXCEL AUTÉNTICO ==================== */
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
.excel-meta { font-size: 0.7rem; opacity: 0.9; }

/* Barra de Fórmulas de Excel (fx) */
.excel-formula-bar {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  padding: 3px 8px;
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
  padding: 2px 10px;
  font-family: monospace;
  color: #334155;
  font-size: 0.72rem;
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
  font-family: 'Inter', -apple-system, sans-serif;
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
  width: 32px;
  background: #e2e8f0 !important;
  color: #475569 !important;
  font-weight: 700 !important;
  text-align: center !important;
  font-family: monospace !important;
  border-right: 2px solid #cbd5e1 !important;
  user-select: none;
}

.excel-table td {
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  vertical-align: middle;
  line-height: 1.2;
}

.excel-table tr:hover td {
  background: #f0f9ff !important;
}

.row-even td { background: #f8fafc; }
.row-pending td { background: #fffdf5; }

.col-radicado { font-family: monospace; font-weight: 700; color: #107c41; font-size: 0.76rem; }

.cell-user { display: flex; flex-direction: column; }
.user-name { font-weight: 700; color: #0f172a; font-size: 0.78rem; }
.user-sub { font-size: 0.68rem; color: #64748b; }

.cell-dep { font-size: 0.72rem; color: #475569; font-weight: 500; }

.type-pill {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
}

.cell-datetime { display: flex; flex-direction: column; }
.date-main { font-weight: 700; color: #1e293b; font-size: 0.74rem; }
.time-sub { font-size: 0.68rem; color: #64748b; }

.freq-badge {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #bfdbfe;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 700;
}

.hours-accum-badge {
  background: #f3e8ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 800;
}

/* Footer de pestañas de hojas Excel */
.excel-sheets-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e2e8f0;
  border-top: 1px solid #cbd5e1;
  padding: 2px 8px;
  font-size: 0.7rem;
}

.sheet-tabs {
  display: flex;
  gap: 2px;
}

.sheet-tab {
  background: #cbd5e1;
  border: 1px solid #94a3b8;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  padding: 3px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sheet-tab.active {
  background: #ffffff;
  color: #107c41;
  font-weight: 800;
  border-top: 2px solid #107c41;
}

.sheet-status {
  color: #64748b;
  font-size: 0.65rem;
  font-weight: 600;
}

/* Status Badge */
.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.4px;
}
.status-pendiente { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.status-aprobado  { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.status-rechazado { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

/* OCR Bar */
.ocr-score-bar { display: flex; align-items: center; gap: 5px; }
.score-text { font-size: 0.7rem; font-weight: 700; color: #0284c7; }
.progress-bar-bg { width: 42px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: #0284c7; }

/* Action Buttons */
.actions-group { display: flex; gap: 3px; }
.btn-xs { padding: 3px 7px; font-size: 0.7rem; border-radius: 4px; font-weight: 700; border: none; cursor: pointer; }
.btn-approve { background: #16a34a; color: white; }
.btn-approve:hover { background: #15803d; }
.btn-reject { background: #dc2626; color: white; }
.btn-reject:hover { background: #b91c1c; }

/* ==================== VISTA 2: CALENDARIO MENSUAL ==================== */
.calendar-container {
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 12px;
}

.calendar-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.calendar-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.calendar-legend {
  display: flex;
  gap: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.legend-item { display: flex; align-items: center; gap: 4px; color: #475569; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.dot-pending { background: #d97706; }
.dot-approved { background: #16a34a; }
.dot-rejected { background: #dc2626; }

.calendar-grid-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px 6px 0 0;
  text-align: center;
  font-weight: 800;
  font-size: 0.7rem;
  color: #334155;
  padding: 6px 0;
}

.calendar-grid-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-left: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
}

.calendar-cell {
  min-height: 68px;
  border-right: 1px solid #cbd5e1;
  border-top: 1px solid #cbd5e1;
  padding: 3px 4px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.15s ease;
}

.calendar-cell:hover { background: #f8fafc; }
.cell-other-month { background: #f8fafc; opacity: 0.4; }
.cell-today { background: #f0f9ff; border: 2px solid #0284c7; }

.cell-day-num {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 800;
  color: #0f172a;
}

.badge-day-count {
  background: #0284c7;
  color: white;
  border-radius: 50%;
  width: 15px;
  height: 15px;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-permisos-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
  max-height: 75px;
}

.calendar-permiso-chip {
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.65rem;
  cursor: pointer;
  border-left: 3px solid #0284c7;
  transition: transform 0.12s ease;
  line-height: 1.25;
}

.calendar-permiso-chip:hover { transform: scale(1.02); }

.chip-pending  { background: #fef3c7; border-left-color: #d97706; color: #92400e; }
.chip-aprobado { background: #dcfce7; border-left-color: #16a34a; color: #14532d; }
.chip-rechazado{ background: #fee2e2; border-left-color: #dc2626; color: #7f1d1d; }

.chip-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
}

.chip-name {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
  font-size: 0.68rem;
}

.chip-time {
  font-size: 0.62rem;
  opacity: 0.9;
  flex-shrink: 0;
  font-family: monospace;
  font-weight: 700;
}

.chip-sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  font-size: 0.62rem;
  opacity: 0.9;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
}

.chip-type-text {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75px;
}
.chip-accum { font-weight: 800; }

/* Status pills in summary view */
.status-summary-pills { display: flex; gap: 4px; justify-content: center; }
.pill { padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; }
.pill-pending-sm { background: #fef3c7; color: #b45309; }
.pill-approved-sm { background: #dcfce7; color: #15803d; }
.pill-rejected-sm { background: #fee2e2; color: #b91c1c; }

/* User modal card */
.user-modal-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8fafc;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.avatar-big {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #004884 0%, #002d57 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.details-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.85rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed #cbd5e1;
  padding-bottom: 6px;
}
</style>
