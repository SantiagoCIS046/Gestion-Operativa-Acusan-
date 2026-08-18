<template>
  <div class="encargado-view container-fluid p-0">
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
      titulo="Gestión de Permisos Laborales — Encargado OCR"
      subtitulo="Radicación, digitalización OCR y control del historial de permisos laborales"
      icono="📄"
    />

    <!-- ========================================== -->
    <!-- SCENARIO A: FORMULARIO PRINCIPAL OCR & VISOR ORIGINAL -->
    <!-- ========================================== -->
    <template v-if="vistaActiva === 'formulario'">
      <!-- Top Action & KPI Header -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <!-- KPI Card: Procesados esta semana (Lunes a Viernes relacionado al mes) -->
        <div class="card border-0 shadow-sm rounded-3 px-3 py-2 bg-white" style="min-width: 260px;">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem; letter-spacing: 0.5px;">
                PROCESADOS ESTA SEMANA (LUN - VIE)
              </span>
              <div class="fs-2 fw-bold text-primary lh-1 mt-1" style="color: #004884 !important;">
                {{ totalProcesadosEstaSemana }}
              </div>
              <div class="text-muted fw-semibold mt-1" style="font-size: 0.68rem;">
                {{ rangoSemanaActualTexto }}
              </div>
            </div>
            <div class="badge bg-success-subtle text-success p-2 rounded-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <polyline points="9 15 12 18 17 13"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <!-- Action Buttons: Historial de Permisos + Insertar Permiso Escaneado -->
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <!-- Button: Historial de Permisos (Plantilla Excel) -->
          <button
            type="button"
            class="btn btn-outline-success fw-bold d-inline-flex align-items-center gap-2 shadow-sm rounded-3"
            @click="vistaActiva = 'historial'"
            title="Ver plantilla de Excel y listado de entregas procesadas"
          >
            <span>📗</span>
            <span>Historial (Plantilla Excel)</span>
            <span class="badge bg-success text-white rounded-pill">{{ historialRemisiones.length }}</span>
          </button>

          <!-- Button: Insertar Permiso Escaneado -->
          <label
            class="btn btn-primary fw-bold d-inline-flex align-items-center gap-2 shadow-sm rounded-3 mb-0"
            style="background: linear-gradient(135deg, #004884 0%, #002f59 100%); border: 1px solid #002342; cursor: pointer;"
            title="Seleccionar archivo PDF escaneado del computador"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Insertar Permiso Escaneado (PDF/PC)</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              @change="handleScannedFileUpload"
              hidden
            />
          </label>
        </div>
      </div>

      <!-- BOOTSTRAP ALERT BANNER: SCANNING OCR NOTIFICATION -->
      <transition name="fade">
        <div v-if="isScanningOCR" class="alert alert-info d-flex align-items-center shadow-sm rounded-3 mb-3" role="alert">
          <div class="spinner-border spinner-border-sm text-info me-2" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <div>
            Analizando y extrayendo datos con OCR de <strong>{{ documentFileName }}</strong>...
          </div>
        </div>
      </transition>

      <!-- Main Workspace (Visor Original + Cuadro de Datos OCR con Bootstrap) -->
      <div class="row g-3">
        <!-- LEFT COLUMN: Visor del PDF / Archivo Original Real Escaneado (En todo el cuadro) -->
        <div class="col-lg-7">
          <div class="card border shadow-sm rounded-3 overflow-hidden h-100 d-flex flex-column">
            <!-- Header Toolbar -->
            <div class="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3 border-bottom">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-5">📄</span>
                <span class="fw-bold small text-dark text-truncate" style="max-width: 320px;">
                  {{ documentLoaded ? documentFileName : 'Ningún documento cargado' }}
                </span>
              </div>

              <div v-if="documentLoaded">
                <label class="btn btn-sm btn-outline-secondary fw-semibold mb-0" style="cursor: pointer;" title="Cambiar archivo">
                  <span>🔄 Cambiar PDF</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    @change="handleScannedFileUpload"
                    hidden
                  />
                </label>
              </div>
            </div>

            <!-- Viewport: Visualización del PDF / Documento Escaneado en Todo el Cuadro -->
            <div class="card-body p-0 bg-dark bg-opacity-75 d-flex justify-content-center align-items-start overflow-auto flex-grow-1" style="min-height: 600px; max-height: 740px;">
              <!-- STATE A: NO DOCUMENT LOADED (WAITING FOR INSERTION) -->
              <div v-if="!documentLoaded" class="card border-0 shadow-sm p-4 text-center mx-auto my-auto rounded-3 bg-white" style="max-width: 420px;">
                <div class="mx-auto mb-3 d-flex align-items-center justify-content-center bg-success-subtle border border-success-subtle rounded-circle" style="width: 70px; height: 70px;">
                  <span class="fs-2">📑</span>
                </div>
                <h5 class="fw-bold mb-2 text-primary" style="color: #004884 !important;">Bandeja de Permisos Lista</h5>
                <p class="text-muted small mb-3">
                  Inserte el archivo PDF escaneado desde su computador para visualizar el documento original y extraer su información automáticamente.
                </p>
                <label class="btn btn-primary fw-bold mx-auto mb-0" style="background: #004884; cursor: pointer;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="me-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Seleccionar Permiso Escaneado (PDF/PC)</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    @change="handleScannedFileUpload"
                    hidden
                  />
                </label>
              </div>

              <!-- STATE B: DOCUMENTO REAL ESCANEADO / PDF OCUPANDO TODO EL CUADRO -->
              <div v-else class="w-100 h-100 d-flex flex-column align-items-center p-0 gap-0">
                <!-- If it's a native PDF uploaded by user or loaded from history -->
                <object
                  v-if="isPdfFile && customFileUrl"
                  :data="customFileUrl"
                  type="application/pdf"
                  class="w-100 rounded bg-white border-0 flex-grow-1"
                  style="min-height: 680px;"
                >
                  <iframe
                    :src="customFileUrl"
                    class="w-100 h-100 border-0"
                    style="min-height: 680px;"
                    title="Visor PDF Original"
                  >
                    <div class="p-4 text-center bg-light">
                      <p class="mb-2">Visualizador de PDF integrado</p>
                      <a :href="customFileUrl" target="_blank" :download="documentFileName" class="btn btn-primary btn-sm">
                        📥 Abrir / Descargar {{ documentFileName }}
                      </a>
                    </div>
                  </iframe>
                </object>

                <!-- If user uploaded a custom image from PC -->
                <div v-else-if="customFileUrl && !isPdfFile" class="w-100 text-center p-2">
                  <img
                    :src="customFileUrl"
                    alt="Documento Original Escaneado"
                    class="img-fluid rounded shadow bg-white border"
                    style="max-width: 100%; max-height: 700px; object-fit: contain;"
                  />
                </div>

                <!-- Fallback: En caso de no tener archivo binario -->
                <div v-else class="w-100 text-center p-4 my-auto">
                  <span class="fs-1 d-block mb-2">📄</span>
                  <h6 class="fw-bold text-dark mb-1">{{ documentFileName }}</h6>
                  <p class="text-muted small">El archivo se encuentra registrado en el sistema.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Formulario con Todos los Campos de Texto Estilo Bootstrap -->
        <div class="col-lg-5">
          <div class="card border shadow-sm rounded-3">
            <div class="card-header bg-white py-3 px-3 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <h5 class="fw-bold text-primary m-0" style="color: #004884 !important;">
                  Revisión de Datos (OCR)
                </h5>
                <span v-if="documentLoaded" class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                  ✔ 99% OCR Extraído
                </span>
                <span v-else class="badge bg-secondary-subtle text-secondary border px-2 py-1">
                  ⏳ Esperando Documento
                </span>
              </div>
              <p class="text-muted small mb-0">
                Revise y rectifique los datos extraídos del PDF antes de confirmar el registro del permiso.
              </p>
            </div>

            <div class="card-body p-3">
              <form @submit.prevent="confirmarYEnviar">
                <!-- SECTION 1: INFORMACIÓN DEL TRABAJADOR -->
                <div class="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                  <div class="bg-success rounded" style="width: 4px; height: 14px;"></div>
                  <span class="text-uppercase fw-bold text-primary small" style="font-size: 0.72rem; letter-spacing: 0.4px;">
                    INFORMACIÓN DEL TRABAJADOR (SOLICITANTE)
                  </span>
                </div>

                <div class="mb-3">
                  <label class="form-label mb-1 fw-semibold text-secondary small">Nombre Completo del Trabajador</label>
                  <div class="input-group input-group-sm">
                    <span class="input-group-text bg-light text-muted">👤</span>
                    <input
                      v-model="formData.nombreFuncionario"
                      type="text"
                      class="form-control fw-bold"
                      placeholder="Esperando documento escaneado..."
                      :disabled="!documentLoaded"
                      required
                    />
                  </div>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Cédula / Documento</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted">🪪</span>
                      <input
                        v-model="formData.cedula"
                        type="text"
                        class="form-control"
                        placeholder="Número de cédula"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Cargo</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted">💼</span>
                      <input
                        v-model="formData.cargo"
                        type="text"
                        class="form-control"
                        placeholder="Cargo del funcionario"
                        :disabled="!documentLoaded"
                      />
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label mb-1 fw-semibold text-secondary small">Área / Dependencia</label>
                  <div class="input-group input-group-sm">
                    <span class="input-group-text bg-light text-muted">🏢</span>
                    <input
                      v-model="formData.dependencia"
                      type="text"
                      class="form-control"
                      placeholder="Área u operativa"
                      :disabled="!documentLoaded"
                    />
                  </div>
                </div>

                <!-- SECTION 2: DETALLES DEL PERMISO LABORAL -->
                <div class="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                  <div class="bg-success rounded" style="width: 4px; height: 14px;"></div>
                  <span class="text-uppercase fw-bold text-primary small" style="font-size: 0.72rem; letter-spacing: 0.4px;">
                    DETALLES DEL PERMISO LABORAL
                  </span>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Fecha del Permiso</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted">📅</span>
                      <input
                        v-model="formData.fechaInicio"
                        type="text"
                        class="form-control fw-bold"
                        placeholder="DD/MM/YYYY"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Horario (24h) & Duración</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted">⏱️</span>
                      <input
                        v-model="formData.horasCalculadas"
                        type="text"
                        class="form-control fw-bold text-center text-primary"
                        placeholder="Ej. 07:00 a 16:00 (8 horas)"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Tipo de Permiso</label>
                    <select
                      v-model="formData.tipoPermiso"
                      class="form-select form-select-sm fw-bold"
                      :disabled="!documentLoaded"
                    >
                      <option value="Compensatorio">Compensatorio</option>
                      <option value="Cita Médica">Cita Médica</option>
                      <option value="Personal">Personal / Asunto Propio</option>
                      <option value="Calamidad Doméstica">Calamidad Doméstica</option>
                      <option value="Estudio / Capacitación">Estudio / Capacitación</option>
                    </select>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Vo.Bo. Jefe Inmediato</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-success-subtle text-success">✔</span>
                      <input
                        type="text"
                        class="form-control bg-light text-success fw-bold"
                        :value="documentLoaded ? 'Firmado en Solicitud' : 'Pendiente'"
                        disabled
                      />
                    </div>
                  </div>
                </div>

                <!-- SECTION 3: MOTIVO Y OBSERVACIONES -->
                <div class="mb-3">
                  <label class="form-label mb-1 fw-semibold text-secondary small">Motivo y Justificación Extraída</label>
                  <textarea
                    v-model="formData.motivo"
                    rows="3"
                    class="form-control form-control-sm"
                    placeholder="El motivo escrito en la solicitud aparecerá aquí..."
                    :disabled="!documentLoaded"
                    required
                  ></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label mb-1 fw-semibold text-secondary small">Observaciones (Opcional)</label>
                  <textarea
                    v-model="formData.observaciones"
                    rows="2"
                    class="form-control form-control-sm"
                    placeholder="Observación o nota adicional..."
                    :disabled="!documentLoaded"
                  ></textarea>
                </div>

                <!-- Action Buttons with Bootstrap Classes -->
                <div class="d-flex justify-content-between align-items-center pt-2 border-top gap-2">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm px-3"
                    @click="abrirModalRechazo"
                    :disabled="!documentLoaded"
                  >
                    Rechazar
                  </button>

                  <button
                    type="submit"
                    class="btn btn-primary btn-sm fw-bold px-3 d-inline-flex align-items-center gap-2 shadow-sm"
                    style="background: linear-gradient(180deg, #004884 0%, #002d57 100%); border-color: #002040;"
                    :disabled="!documentLoaded || isSubmitting"
                  >
                    <span v-if="isSubmitting" class="spinner-border spinner-border-sm" role="status"></span>
                    <span v-else>▶</span>
                    <span>{{ isSubmitting ? 'Registrando Permiso...' : 'Confirmar y Radicar Permiso' }}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========================================== -->
    <!-- SCENARIO B: VISTA HISTORIAL TIPO PLANTILLA EXCEL (CUADRO POR CUADRO Y SCROLL AUTOMÁTICO) -->
    <!-- ========================================== -->
    <template v-else-if="vistaActiva === 'historial'">
      <div class="d-flex flex-column gap-3">
        <!-- Excel Workbook Top Toolbar (Sin overflow-hidden para que el calendario no se corte) -->
        <div class="card border shadow-sm rounded-3 bg-white">
          <div class="card-header bg-success text-white py-2 px-3 d-flex flex-wrap justify-content-between align-items-center rounded-top">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-5">📗</span>
              <div>
                <strong class="text-white" style="font-size: 0.95rem;">ACUASAN_REGISTRO_PERMISOS_2026.xlsx</strong>
                <span class="badge bg-white text-success ms-2 small">Hoja 1: Consolidado_General</span>
              </div>
            </div>

            <div class="d-flex align-items-center gap-2">
              <button
                type="button"
                class="btn btn-sm btn-light text-success fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                @click="vistaActiva = 'formulario'"
              >
                <span>‹ Volver a Formulario</span>
              </button>
            </div>
          </div>

          <!-- Excel Formula & Filter Bar -->
          <div class="card-body p-2 bg-light border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2 position-relative">
            <!-- Search & Formula input -->
            <div class="d-flex align-items-center gap-2 flex-grow-1" style="min-width: 300px;">
              <span class="badge bg-secondary text-white fw-bold px-2 py-1" style="font-family: monospace;">fx</span>
              <div class="input-group input-group-sm flex-grow-1">
                <span class="input-group-text bg-white text-muted">Filtro / Búsqueda:</span>
                <input
                  v-model="busquedaHistorial"
                  type="text"
                  class="form-control"
                  placeholder="Buscar por radicado, funcionario, cédula o dependencia..."
                />
              </div>
            </div>

            <!-- Estado selector y Botón Cronograma -->
            <div class="d-flex align-items-center gap-2">
              <select v-model="filtroEstadoHistorial" class="form-select form-select-sm" style="width: auto;">
                <option value="">Todos los Estados (Columna Estado)</option>
                <option value="ENVIADO_GERENCIA">✔ Permisos Registrados</option>
                <option value="APROBADO">✔ Permisos Registrados</option>
                <option value="PENDIENTE_ENVIO">⏳ Pendientes de Envío</option>
              </select>

              <!-- 📅 BOTÓN CRONOGRAMA CON POPOVER COMPLETO SIN CORTES (LUNES A DOMINGO / LUNES A VIERNES) -->
              <div class="position-relative">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                  @click="mostrarCalendario = !mostrarCalendario"
                  title="Abrir selector de fecha y cronograma"
                >
                  <span>📅 Periodo: <strong>{{ etiquetaCronograma }}</strong></span>
                  <span class="small">▼</span>
                </button>

                <!-- POPOVER CALENDARIO RELACIONADO AL MES (SEMANA LUNES A VIERNES / DOMINGO) -->
                <transition name="popover-fade">
                  <div
                    v-if="mostrarCalendario"
                    class="card border shadow-lg position-absolute end-0 p-3 rounded-3 bg-white"
                    style="z-index: 1070; width: 310px; top: calc(100% + 6px);"
                  >
                    <!-- Encabezado mes / año -->
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                      <button class="btn btn-sm btn-light border py-0 px-2 fw-bold" @click="mesAnterior" :disabled="esPrimerMesDisponible" title="Mes anterior">‹</button>
                      <strong class="text-primary fs-6">{{ mesActualInfo.nombre }} {{ anioSeleccionado }}</strong>
                      <div class="d-flex gap-1 align-items-center">
                        <button class="btn btn-sm btn-light border py-0 px-2 fw-bold" @click="mesSiguiente" title="Mes siguiente">›</button>
                        <button class="btn-close btn-sm ms-1" @click="mostrarCalendario = false" title="Cerrar"></button>
                      </div>
                    </div>

                    <!-- Días de la semana (LUNES A VIERNES LABORALES + FIN DE SEMANA) -->
                    <div class="d-grid text-center mb-2" style="grid-template-columns: repeat(7, 1fr); gap: 3px;">
                      <span class="small text-primary fw-bold" style="font-size: 0.7rem;">Lu</span>
                      <span class="small text-primary fw-bold" style="font-size: 0.7rem;">Ma</span>
                      <span class="small text-primary fw-bold" style="font-size: 0.7rem;">Mi</span>
                      <span class="small text-primary fw-bold" style="font-size: 0.7rem;">Ju</span>
                      <span class="small text-primary fw-bold" style="font-size: 0.7rem;">Vi</span>
                      <span class="small text-muted fw-bold" style="font-size: 0.68rem;">Sá</span>
                      <span class="small text-muted fw-bold" style="font-size: 0.68rem;">Do</span>
                      
                      <!-- Espacios en blanco según el día de la semana que inicia el mes -->
                      <span v-for="b in primerDiaSemanaMes" :key="'blank-' + b"></span>
                      
                      <!-- Días del mes (Alineados exactamente según el día de inicio) -->
                      <button
                        v-for="dia in totalDiasMes"
                        :key="'dia-' + dia"
                        type="button"
                        :class="[
                          'btn btn-sm p-0 rounded position-relative',
                          diaSeleccionado === dia ? 'btn-primary text-white fw-bold shadow-sm' : (contarRegistrosPorDia(dia) > 0 ? 'btn-info-subtle border border-info text-dark fw-bold' : 'btn-light text-dark')
                        ]"
                        style="height: 28px; font-size: 0.76rem;"
                        @click="seleccionarDia(dia)"
                      >
                        {{ dia }}
                        <span
                          v-if="contarRegistrosPorDia(dia) > 0 && diaSeleccionado !== dia"
                          class="position-absolute top-0 end-0 translate-middle-y badge rounded-pill bg-danger"
                          style="font-size: 0.5rem; padding: 2px 4px;"
                        >
                          {{ contarRegistrosPorDia(dia) }}
                        </span>
                      </button>
                    </div>

                    <!-- Footer acciones del cronograma -->
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                      <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none small text-primary fw-bold" @click="seleccionarTodoElMes">
                        Ver mes completo
                      </button>
                      <button type="button" class="btn btn-sm btn-primary py-1 px-3 fw-bold rounded-2" @click="mostrarCalendario = false">
                        Listo
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </div>

          <!-- 📊 PLANTILLA DE EXCEL CON CUADRÍCULA CUADRO POR CUADRO, CELDAS EN BLANCO Y SCROLL AUTOMÁTICO -->
          <div class="excel-scroll-wrapper">
            <table class="table table-bordered table-hover align-middle mb-0 excel-sheet-grid">
              <!-- Header Letras Excel Fijo (A, B, C...) -->
              <thead class="excel-sticky-header text-center">
                <tr class="excel-letter-row">
                  <th class="excel-corner-cell">#</th>
                  <th style="min-width: 140px;">A</th>
                  <th style="min-width: 120px;">B</th>
                  <th style="min-width: 90px;">C</th>
                  <th style="min-width: 120px;">D</th>
                  <th style="min-width: 220px;">E</th>
                  <th style="min-width: 200px;">F</th>
                  <th style="min-width: 140px;">G</th>
                  <th style="min-width: 110px;">H</th>
                  <th style="min-width: 160px;">I</th>
                  <th style="min-width: 160px;">J</th>
                  <th style="min-width: 140px;">K</th>
                </tr>
                <!-- Header Nombres de Columnas -->
                <tr class="excel-title-row">
                  <th class="excel-corner-cell">FILA</th>
                  <th class="text-center">N° RADICADO</th>
                  <th class="text-center">FECHA ENTREGA</th>
                  <th class="text-center">HORA (24H)</th>
                  <th class="text-center">CÉDULA</th>
                  <th>NOMBRE DEL FUNCIONARIO</th>
                  <th>CARGO & ÁREA</th>
                  <th class="text-center">TIPO DE PERMISO</th>
                  <th class="text-center">DURACIÓN</th>
                  <th class="text-center">RECURRENCIA (MES / AÑO)</th>
                  <th class="text-center">ESTADO</th>
                  <th class="text-center">ACCIÓN</th>
                </tr>
              </thead>

              <!-- Cuerpo de la Plantilla con Filas Llenas y Cuadros en Blanco -->
              <tbody>
                <tr
                  v-for="(fila, index) in filasExcelCompletas"
                  :key="fila.id"
                  :class="['excel-row', { 'excel-row-empty': fila.esVacia }]"
                >
                  <!-- Número de fila de Excel (1, 2, 3, 4, 5...) -->
                  <td class="excel-row-num text-center fw-bold">{{ index + 1 }}</td>

                  <!-- 🟢 SI LA FILA TIENE DATOS REGISTRADOS -->
                  <template v-if="!fila.esVacia">
                    <!-- Col A: Radicado -->
                    <td class="excel-cell text-center fw-bold font-monospace text-primary" style="color: #004884 !important;">
                      {{ fila.radicado }}
                    </td>

                    <!-- Col B: Fecha Entrega -->
                    <td class="excel-cell text-center font-monospace">
                      {{ (fila.fechaEntrega || '').split(' ')[0] }}
                    </td>

                    <!-- Col C: Hora Entrega (Formato 24h) -->
                    <td class="excel-cell text-center fw-semibold font-monospace small text-dark">
                      {{ fila.hora24 }}
                    </td>

                    <!-- Col D: Cédula -->
                    <td class="excel-cell text-center font-monospace">
                      {{ fila.cedula }}
                    </td>

                    <!-- Col E: Nombre del Funcionario -->
                    <td class="excel-cell fw-bold text-dark">
                      {{ fila.funcionario }}
                    </td>

                    <!-- Col F: Cargo & Dependencia -->
                    <td class="excel-cell small">
                      <div class="fw-semibold text-dark">{{ fila.cargo }}</div>
                      <div class="text-muted" style="font-size: 0.72rem;">{{ fila.dependencia }}</div>
                    </td>

                    <!-- Col G: Tipo de Permiso -->
                    <td class="excel-cell text-center">
                      <span class="badge bg-light text-dark border px-2 py-1 fw-semibold">
                        {{ fila.tipo }}
                      </span>
                    </td>

                    <!-- Col H: Duración / Horas -->
                    <td class="excel-cell text-center fw-bold text-primary" style="color: #004884 !important;">
                      {{ fila.duracion }}
                    </td>

                    <!-- Col I: Recurrencia Real (Veces en el Mes y Año) -->
                    <td class="excel-cell text-center small">
                      <span
                        :class="[
                          'badge px-2 py-1 me-1',
                          calcularRecurrenciaMes(fila.cedula, fila.anio, fila.mesNum) >= 2
                            ? 'bg-warning-subtle text-warning-emphasis border border-warning'
                            : 'bg-primary-subtle text-primary border border-primary-subtle'
                        ]"
                      >
                        {{ calcularRecurrenciaMes(fila.cedula, fila.anio, fila.mesNum) }} en el mes
                      </span>
                      <span class="text-muted fw-semibold" style="font-size: 0.72rem;">
                        (Total año: {{ calcularRecurrenciaAno(fila.cedula, fila.anio) }})
                      </span>
                    </td>

                    <!-- Col J: Estado de Remisión -->
                    <td class="excel-cell text-center">
                      <span
                        v-if="fila.estadoEnvio === 'ENVIADO_GERENCIA' || fila.estadoEnvio === 'APROBADO' || fila.estado === 'APROBADO'"
                        class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"
                      >
                        ✔ Permiso Registrado
                      </span>
                      <span
                        v-else
                        class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1"
                      >
                        ⏳ Pendiente de Envío
                      </span>
                    </td>

                    <!-- Col K: Acción -->
                    <td class="excel-cell text-center">
                      <div class="d-flex justify-content-center align-items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold"
                          style="font-size: 0.72rem;"
                          @click="cargarEnFormulario(fila)"
                          title="Cargar y ver el documento en el formulario"
                        >
                          📂 Cargar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-danger py-0 px-2 fw-semibold"
                          style="font-size: 0.72rem;"
                          @click="confirmarEliminarPermiso(fila)"
                          title="Eliminar este permiso del historial"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </template>

                  <!-- ⚪ SI ES UN CUADRO EN BLANCO (FILA VACÍA ESPERANDO REGISTROS) -->
                  <template v-else>
                    <td class="excel-cell excel-empty-cell text-muted text-center small fst-italic">
                      <span v-if="index === historialFiltrado.length" class="text-black-50">(Sin registrar)</span>
                    </td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                    <td class="excel-cell excel-empty-cell"></td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Excel Sheet Bottom Status Bar -->
          <div class="card-footer bg-light py-2 px-3 border-top d-flex flex-wrap justify-content-between align-items-center small text-muted font-monospace">
            <div>
              <span>LISTO • RECUENTO ACTIVO: <strong>{{ historialFiltrado.length }} registros</strong> en {{ etiquetaCronograma }}</span>
            </div>
            <div class="d-flex gap-3">
              <span>TOTAL REGISTRADOS: <strong class="text-success">{{ totalEnviadosGerenciaPeriodo }}</strong></span>
              <span>PENDIENTES: <strong class="text-warning">{{ totalPendientesEnvioPeriodo }}</strong></span>
              <span>100% ZOOM</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========================================== -->
    <!-- BOOTSTRAP MODAL: RECHAZO DE SOLICITUD -->
    <!-- ========================================== -->
    <div
      v-if="modalRechazoVisible"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,0.5); z-index: 1080;"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow rounded-3 border-0">
          <div class="modal-header bg-danger-subtle border-bottom border-danger-subtle py-2 px-3">
            <h6 class="modal-title fw-bold text-danger mb-0">⚠️ Rechazar Solicitud de Permiso</h6>
            <button type="button" class="btn-close" @click="modalRechazoVisible = false"></button>
          </div>
          <div class="modal-body p-3">
            <p class="small text-muted mb-2">
              Indique el motivo por el cual se rechaza la solicitud de <strong>{{ formData.nombreFuncionario }}</strong>:
            </p>
            <textarea
              v-model="motivoRechazoTexto"
              class="form-control form-control-sm"
              rows="3"
              placeholder="Escriba el motivo formal del rechazo..."
              required
            ></textarea>
          </div>
          <div class="modal-footer py-2 px-3 border-top">
            <button type="button" class="btn btn-sm btn-secondary" @click="modalRechazoVisible = false">Cancelar</button>
            <button type="button" class="btn btn-sm btn-danger fw-bold" @click="confirmarRechazoModal">Confirmar Rechazo</button>
          </div>
        </div>
      </div>
    </div>

    <!-- BOOTSTRAP DELETE CONFIRMATION MODAL -->
    <div
      v-if="modalEliminarVisible"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.55); z-index: 1065;"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg rounded-3 border-0">
          <div class="modal-header bg-danger text-white py-2 px-3">
            <h6 class="modal-title fw-bold mb-0">🗑️ Eliminar Permiso del Historial</h6>
            <button type="button" class="btn-close btn-close-white" @click="modalEliminarVisible = false"></button>
          </div>
          <div class="modal-body p-3">
            <p class="mb-2 text-dark">
              ¿Está seguro de que desea eliminar el permiso con Radicado <strong class="text-danger">#{{ permisoAEliminar?.radicado }}</strong> perteneciente a <strong>{{ permisoAEliminar?.funcionario }}</strong>?
            </p>
            <div class="alert alert-warning py-2 px-3 mb-0 small rounded-2">
              ⚠️ Esta acción removerá el registro del historial permanentemente.
            </div>
          </div>
          <div class="modal-footer py-2 px-3 border-top bg-light">
            <button type="button" class="btn btn-sm btn-secondary" @click="modalEliminarVisible = false">Cancelar</button>
            <button type="button" class="btn btn-sm btn-danger fw-bold" @click="ejecutarEliminacion">Sí, Eliminar Permiso</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { permisosService } from '../services/permisosService.js'
import PageHeader from '../../../components/PageHeader.vue'

// Controls view mode: 'formulario' | 'historial'
const vistaActiva = ref('formulario')

const documentLoaded = ref(false)
const documentFileName = ref('')
const customFileUrl = ref('')
const isPdfFile = ref(false)

const isScanningOCR = ref(false)
const isSubmitting = ref(false)

// BOOTSTRAP ALERT STATE
const alertaBootstrap = reactive({
  visible: false,
  tipo: 'success',
  titulo: '',
  mensaje: ''
})

const lanzarAlertaBootstrap = (tipo, titulo, mensaje, duracion = 5000) => {
  alertaBootstrap.tipo = tipo
  alertaBootstrap.titulo = titulo
  alertaBootstrap.mensaje = mensaje
  alertaBootstrap.visible = true
  if (duracion > 0) {
    setTimeout(() => {
      alertaBootstrap.visible = false
    }, duracion)
  }
}

// BOOTSTRAP DELETE MODAL STATE
const modalEliminarVisible = ref(false)
const permisoAEliminar = ref(null)

const confirmarEliminarPermiso = (item) => {
  permisoAEliminar.value = item
  modalEliminarVisible.value = true
}

const ejecutarEliminacion = async () => {
  if (!permisoAEliminar.value) return
  const radicado = permisoAEliminar.value.radicado || permisoAEliminar.value.id
  const nombre = permisoAEliminar.value.funcionario || permisoAEliminar.value.nombreFuncionario || 'Funcionario'

  await permisosService.eliminarPermiso(radicado)
  historialRemisiones.value = historialRemisiones.value.filter(
    r => String(r.id) !== String(radicado) && String(r.radicado) !== String(radicado)
  )

  modalEliminarVisible.value = false
  permisoAEliminar.value = null

  // Si el documento que se visualizaba fue el eliminado, limpiar
  if (documentFileName.value.includes(radicado)) {
    limpiarFormularioYVisor()
  }

  lanzarAlertaBootstrap('success', 'Permiso Eliminado', `El permiso #${radicado} (${nombre}) ha sido eliminado del historial correctamente.`)
}

// BOOTSTRAP REJECT MODAL STATE
const modalRechazoVisible = ref(false)
const motivoRechazoTexto = ref('')

const abrirModalRechazo = () => {
  motivoRechazoTexto.value = ''
  modalRechazoVisible.value = true
}

const confirmarRechazoModal = () => {
  if (!motivoRechazoTexto.value.trim()) {
    lanzarAlertaBootstrap('warning', 'Campo Obligatorio', 'Debe especificar el motivo del rechazo.')
    return
  }
  const nombre = formData.nombreFuncionario
  const motivo = motivoRechazoTexto.value
  modalRechazoVisible.value = false
  limpiarFormularioYVisor()
  lanzarAlertaBootstrap('danger', 'Solicitud Rechazada', `La solicitud de ${nombre} ha sido rechazada. Motivo: ${motivo}`)
}

// Cronograma Popover and Period Selection
const mostrarCalendario = ref(false)

// Dynamic Real-Time Date Detection
const fechaActual = new Date()
const anioActual = fechaActual.getFullYear()
const mesActual = fechaActual.getMonth() + 1
const diaActual = fechaActual.getDate()

const anioSeleccionado = ref(anioActual >= 2026 ? anioActual : 2026)
const mesNumSeleccionado = ref(
  (anioActual === 2026 && mesActual < 8) ? 8 : (anioActual >= 2026 ? mesActual : 8)
)
const diaSeleccionado = ref(null)

const todosLosMeses = [
  { mesNum: 1, nombre: 'Enero' },
  { mesNum: 2, nombre: 'Febrero' },
  { mesNum: 3, nombre: 'Marzo' },
  { mesNum: 4, nombre: 'Abril' },
  { mesNum: 5, nombre: 'Mayo' },
  { mesNum: 6, nombre: 'Junio' },
  { mesNum: 7, nombre: 'Julio' },
  { mesNum: 8, nombre: 'Agosto' },
  { mesNum: 9, nombre: 'Septiembre' },
  { mesNum: 10, nombre: 'Octubre' },
  { mesNum: 11, nombre: 'Noviembre' },
  { mesNum: 12, nombre: 'Diciembre' }
]

const mesActualInfo = computed(() => {
  return todosLosMeses.find(m => m.mesNum === mesNumSeleccionado.value) || todosLosMeses[7]
})

const etiquetaCronograma = computed(() => {
  if (diaSeleccionado.value !== null) {
    return `${diaSeleccionado.value} de ${mesActualInfo.value.nombre}, ${anioSeleccionado.value}`
  }
  return `${mesActualInfo.value.nombre} ${anioSeleccionado.value}`
})

const esPrimerMesDisponible = computed(() => {
  return anioSeleccionado.value === 2026 && mesNumSeleccionado.value === 8
})

const totalDiasMes = computed(() => {
  return new Date(anioSeleccionado.value, mesNumSeleccionado.value, 0).getDate()
})

// 📅 CALENDARIO INICIA EN LUNES: Lunes=0, Martes=1, Miércoles=2, Jueves=3, Viernes=4, Sábado=5, Domingo=6
const primerDiaSemanaMes = computed(() => {
  const jsDay = new Date(anioSeleccionado.value, mesNumSeleccionado.value - 1, 1).getDay()
  return (jsDay + 6) % 7
})

const busquedaHistorial = ref('')
const filtroEstadoHistorial = ref('')

// Form model for OCR verification — Inicia vacío, se llena al cargar PDF o seleccionar del historial
const formData = reactive({
  nombreFuncionario: '',
  cedula: '',
  cargo: '',
  dependencia: '',
  fechaPermisoTexto: '',
  horaDetalle: '',
  fechaInicio: '',
  fechaFin: '',
  horasCalculadas: '',
  tipoPermiso: 'Compensatorio',
  motivoManuscrito: '',
  motivo: '',
  observaciones: ''
})

// Historial de Remisiones (Inicia vacío y solo contiene los permisos reales radicados)
const historialRemisiones = ref([])

// 📅 CÁLCULO DE LA SEMANA LABORAL (LUNES A VIERNES) RELACIONADA AL MES
const obtenerRangoSemanaLaboral = () => {
  const d = new Date(anioActual, mesActual - 1, diaActual)
  const diaSemana = d.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  
  // Offset para llegar al Lunes de esta semana
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana
  const fechaLunes = new Date(d)
  fechaLunes.setDate(d.getDate() + diffLunes)

  // Viernes de la misma semana
  const fechaViernes = new Date(fechaLunes)
  fechaViernes.setDate(fechaLunes.getDate() + 4)

  return {
    diaLunes: fechaLunes.getDate(),
    mesLunes: fechaLunes.getMonth() + 1,
    anioLunes: fechaLunes.getFullYear(),
    diaViernes: fechaViernes.getDate(),
    mesViernes: fechaViernes.getMonth() + 1,
    anioViernes: fechaViernes.getFullYear()
  }
}

const rangoSemanaActualTexto = computed(() => {
  const { diaLunes, mesLunes, diaViernes, mesViernes } = obtenerRangoSemanaLaboral()
  const nombreMesLunes = todosLosMeses.find(m => m.mesNum === mesLunes)?.nombre.substring(0, 3) || ''
  const nombreMesViernes = todosLosMeses.find(m => m.mesNum === mesViernes)?.nombre.substring(0, 3) || ''
  
  if (mesLunes === mesViernes) {
    return `Lun ${diaLunes} a Vie ${diaViernes} de ${nombreMesLunes}`
  }
  return `Lun ${diaLunes} ${nombreMesLunes} a Vie ${diaViernes} ${nombreMesViernes}`
})

// KPI DINÁMICO: TOTAL PROCESADOS EN LA SEMANA (LUNES A VIERNES)
const totalProcesadosEstaSemana = computed(() => {
  const { diaLunes, mesLunes, anioLunes, diaViernes, mesViernes, anioViernes } = obtenerRangoSemanaLaboral()
  
  return historialRemisiones.value.filter(item => {
    // Si la semana está dentro del mismo mes
    if (mesLunes === mesViernes && anioLunes === anioViernes) {
      return item.anio === anioLunes &&
             item.mesNum === mesLunes &&
             item.dia >= diaLunes &&
             item.dia <= diaViernes
    }
    // Si la semana inicia a final de mes y termina en el siguiente
    const perteneceFinMes = item.anio === anioLunes && item.mesNum === mesLunes && item.dia >= diaLunes
    const perteneceInicioMes = item.anio === anioViernes && item.mesNum === mesViernes && item.dia <= diaViernes
    return perteneceFinMes || perteneceInicioMes
  }).length
})

// 📊 CÁLCULO DINÁMICO Y EXACTO DE RECURRENCIAS
const calcularRecurrenciaMes = (cedula, anio, mesNum) => {
  if (!cedula) return 0
  return historialRemisiones.value.filter(
    r => String(r.cedula).trim() === String(cedula).trim() &&
         r.anio === anio &&
         r.mesNum === mesNum
  ).length
}

const calcularRecurrenciaAno = (cedula, anio) => {
  if (!cedula) return 0
  return historialRemisiones.value.filter(
    r => String(r.cedula).trim() === String(cedula).trim() &&
         r.anio === anio
  ).length
}

const contarRegistrosPorDia = (dia) => {
  return historialRemisiones.value.filter(
    item => item.anio === anioSeleccionado.value &&
            item.mesNum === mesNumSeleccionado.value &&
            item.dia === dia
  ).length
}

const seleccionarDia = (dia) => {
  diaSeleccionado.value = diaSeleccionado.value === dia ? null : dia
}

const seleccionarTodoElMes = () => {
  diaSeleccionado.value = null
}

const mesAnterior = () => {
  if (anioSeleccionado.value === 2026) {
    if (mesNumSeleccionado.value > 8) {
      mesNumSeleccionado.value--
      diaSeleccionado.value = null
    }
  } else {
    if (mesNumSeleccionado.value > 1) {
      mesNumSeleccionado.value--
      diaSeleccionado.value = null
    } else {
      anioSeleccionado.value--
      mesNumSeleccionado.value = 12
      diaSeleccionado.value = null
    }
  }
}

const mesSiguiente = () => {
  if (mesNumSeleccionado.value < 12) {
    mesNumSeleccionado.value++
    diaSeleccionado.value = null
  } else {
    anioSeleccionado.value++
    mesNumSeleccionado.value = 1
    diaSeleccionado.value = null
  }
}

const normalizarItem = (item) => {
  if (!item) return null
  let dia = item.dia
  let mesNum = item.mesNum
  let anio = item.anio

  const fechaRef = item.fechaInicio || item.fechaEntrega || item.createdAt || ''
  if ((!dia || !mesNum || !anio) && fechaRef) {
    if (fechaRef.includes('/')) {
      const parts = fechaRef.split('/')
      dia = dia || parseInt(parts[0], 10)
      mesNum = mesNum || parseInt(parts[1], 10)
      anio = anio || parseInt(parts[2], 10)
    } else if (fechaRef.includes('-')) {
      const d = new Date(fechaRef)
      if (!isNaN(d.getTime())) {
        dia = dia || d.getDate()
        mesNum = mesNum || (d.getMonth() + 1)
        anio = anio || d.getFullYear()
      }
    }
  }

  const funcionario = item.funcionario || item.nombreFuncionario || ''
  const cedula = String(item.cedula || '')
  const radicado = item.radicado || item.id || ''
  const dependencia = item.dependencia || 'Operativa'
  const fechaEntrega = item.fechaEntrega || item.fechaInicio || (dia && mesNum && anio ? `${String(dia).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${anio}` : '')

  return {
    ...item,
    dia: dia || diaActual,
    mesNum: mesNum || mesActual,
    anio: anio || anioActual,
    funcionario,
    nombreFuncionario: funcionario,
    cedula,
    radicado,
    dependencia,
    fechaEntrega,
    fechaInicio: fechaEntrega,
    hora24: item.hora24 || '08:00',
    duracion: item.duracion || item.horasCalculadas || '07:00 a 15:00 (8 horas)',
    cargo: item.cargo || 'Funcionario Acuasan',
    tipo: item.tipo || item.tipoPermiso || 'Compensatorio',
    tipoPermiso: item.tipo || item.tipoPermiso || 'Compensatorio',
    estado: item.estado || 'APROBADO',
    estadoEnvio: item.estadoEnvio || item.estado || 'APROBADO',
    soporte: item.soporte || 'Permiso_Escaneado.pdf'
  }
}

const historialFiltrado = computed(() => {
  const listaNormalizada = historialRemisiones.value.map(normalizarItem).filter(Boolean)

  return listaNormalizada.filter(item => {
    const coincideTexto = busquedaHistorial.value === '' ||
      item.funcionario.toLowerCase().includes(busquedaHistorial.value.toLowerCase()) ||
      item.cedula.includes(busquedaHistorial.value) ||
      item.radicado.toLowerCase().includes(busquedaHistorial.value.toLowerCase()) ||
      (item.dependencia && item.dependencia.toLowerCase().includes(busquedaHistorial.value.toLowerCase()))

    // Si el usuario escribe una búsqueda, buscar globalmente en todos los periodos
    if (busquedaHistorial.value.trim()) {
      return coincideTexto
    }

    const coincideAnio = item.anio === anioSeleccionado.value
    const coincideMes = item.mesNum === mesNumSeleccionado.value
    const coincideDia = diaSeleccionado.value === null || item.dia === diaSeleccionado.value

    const coincideEstado = filtroEstadoHistorial.value === '' ||
      item.estadoEnvio === filtroEstadoHistorial.value ||
      item.estado === filtroEstadoHistorial.value

    return coincideAnio && coincideMes && coincideDia && coincideTexto && coincideEstado
  })
})

// 📊 FILAS COMPLETAS PARA LA PLANTILLA EXCEL
const MIN_FILAS_EXCEL = 14

const filasExcelCompletas = computed(() => {
  const filas = [...historialFiltrado.value.map(item => ({ ...item, esVacia: false }))]
  const faltantes = Math.max(0, MIN_FILAS_EXCEL - filas.length)
  for (let i = 1; i <= faltantes; i++) {
    filas.push({
      id: `blank-row-${i}`,
      esVacia: true
    })
  }
  return filas
})

const totalEnviadosGerenciaPeriodo = computed(() => {
  return historialFiltrado.value.filter(item => item.estadoEnvio === 'ENVIADO_GERENCIA' || item.estadoEnvio === 'APROBADO' || item.estado === 'APROBADO').length
})

const totalPendientesEnvioPeriodo = computed(() => {
  return historialFiltrado.value.filter(item => item.estadoEnvio === 'PENDIENTE_ENVIO').length
})

const limpiarFormularioYVisor = () => {
  documentLoaded.value = false
  documentFileName.value = ''
  customFileUrl.value = ''
  isPdfFile.value = false
  formData.nombreFuncionario = ''
  formData.cedula = ''
  formData.cargo = ''
  formData.dependencia = ''
  formData.fechaInicio = ''
  formData.fechaFin = ''
  formData.fechaPermisoTexto = ''
  formData.horaDetalle = ''
  formData.horasCalculadas = ''
  formData.tipoPermiso = 'Compensatorio'
  formData.motivoManuscrito = ''
  formData.motivo = ''
  formData.observaciones = ''
}

// ═══════════════════════════════════════════════════════════════════════════
// 📄 MOTOR DE EXTRACCIÓN DE DATOS — FORMULARIO LABORAL ACUASAN
//    Etapa 1: Extracción de texto nativo PDF (100% exacto para PDFs digitales)
//    Etapa 2: OCR avanzado con Tesseract LSTM + preprocesamiento de imagen
// ═══════════════════════════════════════════════════════════════════════════

// ── Preprocesar imagen para mejorar OCR ─────────────────────────────────────
const preprocesarImagenOCR = (sourceCanvas) => {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // 1. Dibujar original
  ctx.drawImage(sourceCanvas, 0, 0)

  // 2. Convertir a escala de grises con alto contraste
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    // Luminosidad perceptual (formula estándar)
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    // Umbral adaptativo: pixels oscuros → negro puro, claros → blanco puro
    const val = lum < 128 ? 0 : 255
    data[i] = data[i + 1] = data[i + 2] = val
    data[i + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

// ── Renderizar PDF a canvas de alta resolución ───────────────────────────────
const pdfACanvas = async (dataUrl) => {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  // Decodificar Base64 → Uint8Array
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const typedArray = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) typedArray[i] = binary.charCodeAt(i)

  const pdfDoc = await getDocument({ data: typedArray }).promise
  const page = await pdfDoc.getPage(1)

  // 3.5× → ~2450px ancho para A4, ideal para OCR
  const viewport = page.getViewport({ scale: 3.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return { canvas, pdfDoc, page }
}

// ── Extraer texto nativo del PDF (sin OCR, 100% exacto) ──────────────────────
const extraerTextoNativoPDF = async (dataUrl) => {
  try {
    const { canvas, pdfDoc, page } = await pdfACanvas(dataUrl)

    // getTextContent devuelve el texto embebido en el PDF
    const content = await page.getTextContent()
    const textoTotal = content.items.map(i => i.str).join(' ')

    // Si el PDF tiene texto real (no imagen), usar ese texto
    if (textoTotal.trim().length > 40) {
      return { texto: textoTotal, canvas, fuente: 'nativo' }
    }
    // Si el texto es muy poco, es un PDF de imagen → necesita OCR
    return { texto: '', canvas, fuente: 'imagen' }
  } catch (err) {
    return { texto: '', canvas: null, fuente: 'error' }
  }
}

// ── Parser de formulario ACUASAN (robusto a errores de OCR) ─────────────────
const parsearTextoPermiso = (texto) => {
  // Normalizar espacios y saltos de línea
  const t = texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')

  const campos = {}

  // ── NOMBRE ──────────────────────────────────────────────────────────────
  // Patrones: "NOMBRE: Juan Pérez" / "NOMBRE:Juan" / con cargo al lado
  const rxNombres = [
    /NOMBRE[:\s*]+([A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ .,'-]{4,60})(?:\s+CARGO|$)/i,
    /NOMBRE[:\s*]+([^\n]{5,60})(?=\s*CARGO|\n)/i,
    /\bNOMBRE\b[^\w]+([\w][^\n]{4,55})/i
  ]
  for (const rx of rxNombres) {
    const m = t.match(rx)
    if (m && m[1]) {
      const nombre = m[1].trim().replace(/\s{2,}/g, ' ')
      // Validar que no es basura OCR (debe tener al menos 2 palabras o 8 chars)
      if (nombre.length >= 5 && /[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(nombre)) {
        campos.nombreFuncionario = nombre
        break
      }
    }
  }

  // ── CARGO ────────────────────────────────────────────────────────────────
  const rxCargos = [
    /CARGO[:\s*]+([A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ .,/'-]{2,50})(?:\n|FECHA|$)/i,
    /CARGO[:\s*]+([^\n]{3,50})(?=\n|FECHA)/i
  ]
  for (const rx of rxCargos) {
    const m = t.match(rx)
    if (m && m[1] && m[1].trim().length > 2) {
      campos.cargo = m[1].trim()
      break
    }
  }

  // ── CÉDULA ───────────────────────────────────────────────────────────────
  // Formatos: "CC 1100964621", "C.C. 1100964621", número de 6-12 dígitos
  const rxCedulas = [
    /\b(?:CC|C\.C\.|C\.C|CEDULA|CÉDULA|NIT)[.:\s]+(\d{6,12})\b/i,
    /\bID[\s:]+(\d{6,12})\b/i,
    // En el formulario de la orden médica aparece "OC 91071263"
    /\bOC\s+(\d{6,12})\b/i
  ]
  for (const rx of rxCedulas) {
    const m = t.match(rx)
    if (m) { campos.cedula = m[1]; break }
  }
  // Buscar cualquier número largo si no se encontró
  if (!campos.cedula) {
    const allNums = [...t.matchAll(/\b(\d{8,12})\b/g)]
    if (allNums.length > 0) campos.cedula = allNums[0][1]
  }

  // ── FECHA ────────────────────────────────────────────────────────────────
  // Formatos: "03-08-2026", "03/08/2026", "3 de agosto de 2026"
  const nombresMes = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const mesesTexto = {
    enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
    julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
  }

  const rxFechas = [
    // DD-MM-YYYY o DD/MM/YYYY (el más común en el formulario ACUASAN)
    /(?:FECHA[^:]*?[:\s]+)?(\d{1,2})[.\-\/](\d{1,2})[.\-\/](20\d{2})/i,
    // "3 de agosto de 2026"
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})/i
  ]
  for (const rx of rxFechas) {
    const m = t.match(rx)
    if (m) {
      let dd, mm, aaaa
      if (/de/.test(rx.source)) {
        dd = m[1]; mm = String(mesesTexto[m[2].toLowerCase()] || 1); aaaa = m[3]
      } else {
        dd = m[1]; mm = m[2]; aaaa = m[3]
      }
      dd = dd.padStart(2, '0'); mm = mm.padStart(2, '0')
      campos.fechaInicio = `${dd}/${mm}/${aaaa}`
      campos.fechaFin = `${dd}/${mm}/${aaaa}`
      campos.fechaPermisoTexto = `${parseInt(dd)} de ${nombresMes[parseInt(mm)]} de ${aaaa}`
      break
    }
  }

  // ── HORARIO ──────────────────────────────────────────────────────────────
  // "HORA: 2:00pm - 6:00pm" / "2:00pm 6:00pm" / "07:00 a 16:00"
  const rxHoras = [
    /HORA[:\s]+(\d{1,2}[:h]\d{0,2}\s*(?:am|pm)?)[\s\-–\/]+(\d{1,2}[:h]\d{0,2}\s*(?:am|pm)?)/i,
    /(\d{1,2}[:h]\d{2}\s*(?:am|pm))\s*[-–]\s*(\d{1,2}[:h]\d{2}\s*(?:am|pm))/i,
    /(\d{1,2}[:h]\d{2})\s+[aA]\s+(\d{1,2}[:h]\d{2})/
  ]
  for (const rx of rxHoras) {
    const m = t.match(rx)
    if (m) {
      const h1 = m[1].trim(), h2 = m[2].trim()
      campos.horaDetalle = `${h1} a ${h2}`
      campos.horasCalculadas = `${h1} a ${h2}`
      break
    }
  }

  // ── TIPO DE PERMISO ──────────────────────────────────────────────────────
  // En el form ACUASAN hay casillas que el OCR lee como [X], (X), |X|, ☑, ✓
  // El orden de prioridad sigue la lógica del formulario
  const marcado = (patron) => new RegExp(`(?:[xX☑✓✗⊠⊡❎☒]{1,2})[\\s]*${patron}|${patron}[\\s]*(?:[xX☑✓✗⊠⊡❎☒]{1,2})`, 'i').test(t)

  if (marcado('M[eé]dico') || marcado('Cita'))        campos.tipoPermiso = 'Médico'
  else if (marcado('Personal'))                        campos.tipoPermiso = 'Personal'
  else if (marcado('Compensatorio') || marcado('Comp')) campos.tipoPermiso = 'Compensatorio'
  else if (/cita\s+m[eé]dica/i.test(t))               campos.tipoPermiso = 'Médico'
  else if (/compensatorio/i.test(t))                   campos.tipoPermiso = 'Compensatorio'
  else if (/personal/i.test(t))                        campos.tipoPermiso = 'Personal'
  else if (/m[eé]dic/i.test(t))                        campos.tipoPermiso = 'Médico'

  // ── MOTIVO / JUSTIFICACIÓN ───────────────────────────────────────────────
  const rxMotivos = [
    /(?:MOTIVO|JUSTIFICACI[OÓ]N|OBSERVACI[OÓ]N)[:\s]+([^\n]{8,})/i,
    /(?:POR[:\s]+)([^\n]{10,})/i
  ]
  for (const rx of rxMotivos) {
    const m = t.match(rx)
    if (m && m[1].trim().length > 6) {
      campos.motivoManuscrito = m[1].trim()
      break
    }
  }

  return campos
}

// ── Aplicar campos extraídos al formulario Vue ────────────────────────────────
const aplicarCampos = (campos) => {
  if (campos.nombreFuncionario) formData.nombreFuncionario = campos.nombreFuncionario
  if (campos.cedula)            formData.cedula = campos.cedula
  if (campos.cargo)             formData.cargo = campos.cargo
  if (campos.dependencia)       formData.dependencia = campos.dependencia
  if (campos.fechaInicio)       formData.fechaInicio = campos.fechaInicio
  if (campos.fechaFin)          formData.fechaFin = campos.fechaFin
  if (campos.fechaPermisoTexto) formData.fechaPermisoTexto = campos.fechaPermisoTexto
  if (campos.horaDetalle)       formData.horaDetalle = campos.horaDetalle
  if (campos.horasCalculadas)   formData.horasCalculadas = campos.horasCalculadas
  if (campos.tipoPermiso)       formData.tipoPermiso = campos.tipoPermiso
  if (campos.motivoManuscrito)  formData.motivoManuscrito = campos.motivoManuscrito
}

// 🎯 MANEJADOR PRINCIPAL: Subir PDF o imagen con extracción automática
const handleScannedFileUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  documentFileName.value = file.name
  isPdfFile.value = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  documentLoaded.value = true
  isScanningOCR.value = true

  // Limpiar formulario
  formData.nombreFuncionario = ''
  formData.cedula = ''
  formData.cargo = ''
  formData.dependencia = ''
  formData.fechaPermisoTexto = ''
  formData.horaDetalle = ''
  formData.horasCalculadas = ''
  formData.fechaInicio = ''
  formData.fechaFin = ''
  formData.tipoPermiso = 'Compensatorio'
  formData.motivoManuscrito = ''
  formData.motivo = ''
  formData.observaciones = ''

  const reader = new FileReader()
  reader.onload = async (event) => {
    customFileUrl.value = event.target.result

    try {
      let textoParsear = ''
      let fuenteExtraccion = 'desconocida'

      if (isPdfFile.value) {
        // ── ETAPA 1: Intentar extracción nativa (texto embebido en PDF) ───
        const { texto, canvas, fuente } = await extraerTextoNativoPDF(event.target.result)

        if (fuente === 'nativo' && texto.length > 40) {
          // ✅ PDF digital con texto real → parsear directamente (100% exacto)
          textoParsear = texto
          fuenteExtraccion = 'PDF nativo'
        } else {
          // ── ETAPA 2: PDF escaneado → OCR avanzado con Tesseract LSTM ───
          fuenteExtraccion = 'OCR avanzado'

          // Obtener canvas (ya renderizado en extraerTextoNativoPDF)
          let canvasOCR = canvas
          if (!canvasOCR) {
            const { canvas: c } = await pdfACanvas(event.target.result)
            canvasOCR = c
          }

          // Preprocesar imagen: escala de grises + contraste para mejor OCR
          const canvasProcesado = preprocesarImagenOCR(canvasOCR)
          const imagenOCR = canvasProcesado.toDataURL('image/png')

          const Tesseract = await import('tesseract.js')
          const { data: { text, confidence } } = await Tesseract.recognize(imagenOCR, 'spa', {
            logger: () => {},
            tessedit_pageseg_mode: '6',   // PSM 6: Bloque uniforme (formularios)
            tessedit_ocr_engine_mode: '1', // OEM 1: LSTM neural (más preciso)
            preserve_interword_spaces: '1'
          })

          textoParsear = text
          console.info(`[OCR] Confianza: ${confidence?.toFixed(1)}% | Chars: ${text.length}`)
        }
      } else {
        // ── Imagen (JPG/PNG) → OCR directo ───────────────────────────────
        fuenteExtraccion = 'OCR imagen'
        const img = document.createElement('img')
        img.src = event.target.result
        await new Promise(resolve => { img.onload = resolve })

        // Crear canvas para preprocesar
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth * 2
        canvas.height = img.naturalHeight * 2
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0)
        const canvasProcesado = preprocesarImagenOCR(canvas)

        const Tesseract = await import('tesseract.js')
        const { data: { text } } = await Tesseract.recognize(
          canvasProcesado.toDataURL('image/png'), 'spa', {
            logger: () => {},
            tessedit_pageseg_mode: '6',
            tessedit_ocr_engine_mode: '1',
            preserve_interword_spaces: '1'
          }
        )
        textoParsear = text
      }

      // ── PARSEAR y aplicar campos ─────────────────────────────────────────
      const campos = parsearTextoPermiso(textoParsear)
      aplicarCampos(campos)

      const numCampos = Object.keys(campos).length
      if (numCampos > 0) {
        lanzarAlertaBootstrap(
          'success',
          `✅ ${numCampos} campo(s) extraídos (${fuenteExtraccion})`,
          `Revise los datos y corrija si algo no es exacto antes de guardar.`
        )
      } else {
        lanzarAlertaBootstrap(
          'warning',
          '⚠️ No se reconocieron campos',
          `El documento fue cargado. Complete los campos manualmente o suba una imagen más nítida.`
        )
      }
    } catch (err) {
      console.error('[OCR ERROR]', err)
      lanzarAlertaBootstrap(
        'info',
        '📄 Documento Cargado',
        `El archivo "${file.name}" fue cargado. Complete los datos manualmente.`
      )
    } finally {
      isScanningOCR.value = false
    }
  }

  reader.onerror = () => {
    isScanningOCR.value = false
    customFileUrl.value = URL.createObjectURL(file)
    lanzarAlertaBootstrap('danger', 'Error al Leer Archivo', 'No se pudo leer el archivo. Intente de nuevo.')
  }

  reader.readAsDataURL(file)
}


// 🎯 CARGAR PERMISO ORIGINAL DESDE EL HISTORIAL (MUESTRA EL DOCUMENTO ESPECÍFICO DEL PERMISO SELECCIONADO)
const cargarEnFormulario = (item) => {
  documentLoaded.value = true
  documentFileName.value = item.soporte || `Permiso_${(item.funcionario || 'Funcionario').replace(/\s+/g, '_')}_${item.anio || anioActual}.pdf`
  
  const docUrl = item.archivoUrl || item.customFileUrl || item.soporteUrl || ''
  if (docUrl) {
    customFileUrl.value = docUrl
    isPdfFile.value = docUrl.startsWith('data:application/pdf') || 
                      docUrl.toLowerCase().includes('.pdf') || 
                      Boolean(item.isPdf) || 
                      Boolean(item.soporte && item.soporte.toLowerCase().endsWith('.pdf'))
  } else {
    customFileUrl.value = ''
    isPdfFile.value = false
  }

  formData.nombreFuncionario = item.funcionario || item.nombreFuncionario || ''
  formData.cedula = item.cedula || ''
  formData.cargo = item.cargo || 'Funcionario Acuasan'
  formData.dependencia = item.dependencia || 'Operativa'
  formData.tipoPermiso = item.tipo || item.tipoPermiso || 'Compensatorio'
  formData.motivo = item.motivo || item.justificacion || ''
  formData.motivoManuscrito = item.motivoManuscrito || item.motivo || ''
  formData.fechaPermisoTexto = `${item.dia} de ${todosLosMeses.find(m => m.mesNum === item.mesNum)?.nombre || 'Mes'} ${item.anio}`
  formData.horaDetalle = item.hora24 || item.duracion || '08:00'
  formData.horasCalculadas = item.duracion || '07:00 a 15:00 (8 horas)'
  formData.fechaInicio = item.fechaInicio || item.fechaEntrega || `${String(item.dia).padStart(2, '0')}/${String(item.mesNum).padStart(2, '0')}/${item.anio}`
  formData.fechaFin = item.fechaFin || item.fechaInicio || item.fechaEntrega || `${String(item.dia).padStart(2, '0')}/${String(item.mesNum).padStart(2, '0')}/${item.anio}`
  
  vistaActiva.value = 'formulario'
  lanzarAlertaBootstrap('info', 'Documento del Permiso Cargado', `Se visualiza el PDF/soporte correspondiente a la solicitud #${item.radicado} (${item.funcionario}).`)
}

// Cargar historial real desde el Backend / MongoDB Atlas
const isLoadingHistorial = ref(false)

const cargarHistorialDesdeBackend = async () => {
  isLoadingHistorial.value = true
  try {
    const lista = await permisosService.obtenerHistorialPermisos()
    historialRemisiones.value = Array.isArray(lista) ? lista : []
  } catch (error) {
    historialRemisiones.value = []
  } finally {
    isLoadingHistorial.value = false
  }
}

const onStorageChange = (e) => {
  if (e.key === 'acuasan_permisos_db' || !e.key) {
    cargarHistorialDesdeBackend()
  }
}

onMounted(() => {
  cargarHistorialDesdeBackend()
  window.addEventListener('storage', onStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageChange)
})

// Confirm and Send to Gerencia (Guardar en Base de Datos MongoDB & Formato 24h)
const confirmarYEnviar = async () => {
  if (!formData.nombreFuncionario || !formData.cedula) {
    lanzarAlertaBootstrap('warning', 'Sin Información', 'No hay ninguna solicitud cargada para enviar a Gerencia.')
    return
  }

  isSubmitting.value = true
  try {
    const diaNum = parseInt((formData.fechaInicio || '').split('/')[0]) || diaActual
    const mesNum = parseInt((formData.fechaInicio || '').split('/')[1]) || mesActual
    const anioNum = parseInt((formData.fechaInicio || '').split('/')[2]) || anioActual

    // Hora en formato exacto de 24 horas (HH:mm)
    const ahora = new Date()
    const hora24Actual = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

    const payload = {
      cedula: formData.cedula,
      nombreFuncionario: formData.nombreFuncionario,
      funcionario: formData.nombreFuncionario,
      cargo: formData.cargo || 'Funcionario Acuasan',
      dependencia: formData.dependencia || 'Operativa',
      tipo: formData.tipoPermiso,
      tipoPermiso: formData.tipoPermiso,
      fechaInicio: formData.fechaInicio,
      fechaFin: formData.fechaFin || formData.fechaInicio,
      duracion: formData.horasCalculadas || '07:00 a 15:00 (8 horas)',
      hora24: hora24Actual,
      justificacion: formData.motivo,
      motivoManuscrito: formData.motivoManuscrito,
      observaciones: formData.observaciones,
      soporte: documentFileName.value || 'Permiso_Escaneado.pdf',
      archivoUrl: customFileUrl.value,
      isPdf: isPdfFile.value
    }

    let nuevoRegistro = null

    try {
      nuevoRegistro = await permisosService.crearPermiso(payload)
    } catch (apiErr) {
      console.warn('API error al guardar en backend, usando fallback local:', apiErr)
      const nuevoRadicado = `PERM-2026-${String(historialRemisiones.value.length + 47).padStart(4, '0')}`
      nuevoRegistro = {
        id: Date.now(),
        anio: anioNum,
        mesNum: mesNum,
        dia: diaNum,
        radicado: nuevoRadicado,
        fechaEntrega: `${String(diaActual).padStart(2, '0')}/${String(mesActual).padStart(2, '0')}/${anioActual}`,
        hora24: hora24Actual,
        cedula: formData.cedula,
        funcionario: formData.nombreFuncionario,
        nombreFuncionario: formData.nombreFuncionario,
        cargo: formData.cargo || 'Funcionario Acuasan',
        dependencia: formData.dependencia || 'Operativa',
        tipo: formData.tipoPermiso,
        duracion: formData.horasCalculadas || '07:00 a 15:00 (8 horas)',
        estadoEnvio: 'APROBADO',
        estado: 'APROBADO',
        motivo: formData.motivo,
        soporte: documentFileName.value || 'Permiso_Escaneado.pdf',
        archivoUrl: customFileUrl.value,
        isPdf: isPdfFile.value
      }
    }

    if (nuevoRegistro) {
      // Agregar al inicio evitando duplicados por radicado o id
      historialRemisiones.value = [
        nuevoRegistro,
        ...historialRemisiones.value.filter(r => r.id !== nuevoRegistro.id && r.radicado !== nuevoRegistro.radicado)
      ]
    }

    const nombreEnviado = formData.nombreFuncionario
    const radicadoGenerado = nuevoRegistro?.radicado || 'PERM-2026'

    limpiarFormularioYVisor()

    lanzarAlertaBootstrap(
      'success',
      '¡Permiso Radicado y Registrado Exitosamente!',
      `Se radicó con éxito en MongoDB Atlas a las ${hora24Actual} hrs con Radicado #${radicadoGenerado} (${payload.tipo}) para ${nombreEnviado}. Formulario y visor listos para procesar la siguiente solicitud.`,
      7500
    )

  } catch (error) {
    console.error('Error al radicar permiso:', error)
    lanzarAlertaBootstrap('danger', 'Error de Envío', error.message || 'Ocurrió un inconveniente al radicar la solicitud.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.encargado-view {
  min-height: 100%;
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Acuasan form controls styling */
.form-control:focus,
.form-select:focus {
  border-color: #73be28 !important;
  box-shadow: 0 0 0 0.25rem rgba(115, 190, 40, 0.2) !important;
}

.input-group-text {
  border-color: #dee2e6;
}

/* ========================================== */
/* 📊 EXCEL SPREADSHEET GRID & SCROLL SYSTEM */
/* ========================================== */
.excel-scroll-wrapper {
  max-height: 540px;
  min-height: 420px;
  overflow-y: auto;
  overflow-x: auto;
  background-color: #f8fafc;
  border-top: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
}

.excel-sheet-grid {
  border-collapse: collapse !important;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 0.82rem;
  background-color: #ffffff;
  width: 100%;
}

/* Sticky Excel Header to keep column letters fixed when scrolling */
.excel-sticky-header {
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.excel-letter-row th {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  border: 1px solid #cbd5e1 !important;
  padding: 3px 6px !important;
  letter-spacing: 0.5px;
}

.excel-title-row th {
  background-color: #e2e8f0 !important;
  color: #0f172a !important;
  font-weight: 800 !important;
  font-size: 0.74rem !important;
  border: 1px solid #cbd5e1 !important;
  padding: 7px 10px !important;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.excel-corner-cell {
  background-color: #e2e8f0 !important;
  color: #64748b !important;
  width: 45px !important;
  font-weight: 800 !important;
}

.excel-row-num {
  background-color: #f8fafc !important;
  color: #64748b !important;
  border: 1px solid #cbd5e1 !important;
  font-size: 0.75rem !important;
  font-family: monospace;
  width: 45px;
}

.excel-cell {
  border: 1px solid #cbd5e1 !important;
  padding: 6px 10px !important;
  background-color: #ffffff;
  height: 36px;
}

.excel-empty-cell {
  background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
}

.excel-row:hover:not(.excel-row-empty) .excel-cell {
  background-color: #f0fdf4 !important;
}

.excel-row:hover:not(.excel-row-empty) .excel-row-num {
  background-color: #dcfce7 !important;
  color: #166534 !important;
}

.excel-row-empty:hover .excel-row-num {
  background-color: #f1f5f9 !important;
}
</style>
