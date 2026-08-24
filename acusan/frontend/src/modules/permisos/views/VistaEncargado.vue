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
            title="Seleccionar archivo PDF, Word, TXT o imagen del computador"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Insertar Permiso Escaneado (PDF/Word/TXT/Imagen)</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg,.webp"
              @change="handleScannedFileUpload"
              hidden
            />
          </label>
        </div>
      </div>

      <!-- PANEL DE PROGRESO DE INTELIGENCIA OCR -->
      <transition name="fade">
        <div v-if="isScanningOCR" class="card border-primary border-2 shadow-sm rounded-3 mb-3 bg-primary-subtle text-primary-emphasis p-3 animate-pulse" role="alert">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2">
              <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
              <strong class="text-primary fs-6">🔍 Inteligencia OCR en Ejecución: {{ documentFileName }}</strong>
            </div>
            <span class="badge bg-primary text-white px-2 py-1 fs-6">{{ ocrProgress }}%</span>
          </div>
          <div class="progress mb-2 bg-white" style="height: 10px; border-radius: 6px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary fw-bold" :style="{ width: ocrProgress + '%' }"></div>
          </div>
          <div class="d-flex justify-content-between small text-secondary">
            <span><strong>Estado:</strong> {{ ocrStepMessage }}</span>
            <span>Extrayendo solicitud, firmas y soportes adjuntos...</span>
          </div>
        </div>
      </transition>

      <!-- Main Workspace (Visor Original + Cuadro de Datos OCR con Bootstrap parejos 50/50) -->
      <div class="row g-3">
        <!-- LEFT COLUMN: Visor del PDF / Archivo Original Real Escaneado (50% Parejo) -->
        <div class="col-lg-6 col-md-12">
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
                  <span>🔄 Cambiar Archivo</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg,.webp"
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
                  Inserte el archivo PDF, Word, TXT o imagen desde su computador para visualizar el documento original y extraer su información automáticamente.
                </p>
                <label class="btn btn-primary fw-bold mx-auto mb-0" style="background: #004884; cursor: pointer;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="me-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Seleccionar Permiso Escaneado (PDF/Word/TXT/Imagen)</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg,.webp"
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
                  :data="displayFileUrl"
                  type="application/pdf"
                  class="w-100 rounded bg-white border-0 flex-grow-1"
                  style="min-height: 680px;"
                >
                  <iframe
                    :src="displayFileUrl"
                    class="w-100 h-100 border-0"
                    style="min-height: 680px;"
                    title="Visor PDF Original"
                  ></iframe>
                </object>

                <!-- If it's a Word document: panel with the extracted document text -->
                <div v-else-if="isWordFile && customFileUrl" class="w-100 h-100 bg-white overflow-auto p-3">
                  <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom">
                    <div class="d-flex align-items-center gap-2">
                      <span class="badge bg-primary text-white">DOCX / Word</span>
                      <span class="text-muted small text-truncate">{{ documentFileName }}</span>
                    </div>
                    <a :href="displayFileUrl" :download="documentFileName" class="btn btn-sm btn-outline-primary fw-semibold">Descargar</a>
                  </div>
                  <pre class="mb-0 small text-dark" style="white-space: pre-wrap; word-break: break-word; font-family: inherit;">{{ textoDocumentoExtraido || 'No se pudo extraer el texto del documento Word. Verifique que sea un archivo .docx valido.' }}</pre>
                </div>

                <!-- If it's a plain text file -->
                <div v-else-if="isTextFile && customFileUrl" class="w-100 h-100 bg-white overflow-auto p-3">
                  <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom">
                    <div class="d-flex align-items-center gap-2">
                      <span class="badge bg-secondary text-white">TXT / Texto</span>
                      <span class="text-muted small text-truncate">{{ documentFileName }}</span>
                    </div>
                    <a :href="displayFileUrl" :download="documentFileName" class="btn btn-sm btn-outline-primary fw-semibold">Descargar</a>
                  </div>
                  <pre class="mb-0 small text-dark" style="white-space: pre-wrap; word-break: break-word; font-family: inherit;">{{ textoDocumentoExtraido }}</pre>
                </div>

                <!-- If user uploaded a custom image from PC -->
                <div v-else-if="customFileUrl && !isPdfFile" class="w-100 text-center p-2">
                  <img
                    :src="displayFileUrl"
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

        <!-- RIGHT COLUMN: Formulario con Todos los Campos de Texto Estilo Bootstrap (50% Parejo) -->
        <div class="col-lg-6 col-md-12">
          <div class="card border shadow-sm rounded-3">
            <div class="card-header bg-white py-3 px-3 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <h5 class="fw-bold text-primary m-0" style="color: #004884 !important;">
                  Revisión de Datos (OCR)
                </h5>
                <span v-if="isScanningOCR" class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1">
                  ⏳ Extrayendo datos del documento...
                </span>
                <span v-else-if="documentLoaded" :class="['badge px-2 py-1 border', claseConfianzaOcr]">
                  {{ textoConfianzaOcr }}
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
              <form class="permiso-form" @submit.prevent="confirmarYEnviar">
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
                  <div class="col-md-4">
                    <label class="form-label mb-1 fw-semibold text-secondary small d-flex justify-content-between">
                      <span>Fecha Permiso</span>
                      <span class="text-muted fw-normal" style="font-size: 0.68rem;">(DD/MM/YYYY)</span>
                    </label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted">📅</span>
                      <input
                        v-model="formData.fechaInicio"
                        @input="escribirFechaInput($event, 'fechaInicio')"
                        @blur="completarAnioFechaInput($event, 'fechaInicio')"
                        type="text"
                        inputmode="numeric"
                        maxlength="10"
                        class="form-control fw-bold"
                        placeholder="DD/MM/YYYY"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>

                  <div class="col-md-8">
                    <label class="form-label mb-1 fw-semibold text-secondary small">Horario del Permiso</label>

                    <!-- Confirmación compacta: las horas coinciden con la jornada del día -->
                    <div v-if="esJornadaCompleta" class="aviso-horario aviso-jornada mb-2" :title="tituloJornadaBoton">
                      <span>✓</span> Jornada completa — {{ textoJornadaResumen }}
                    </div>
                    <div
                      v-else-if="esFinDeSemana"
                      class="aviso-horario aviso-fin-semana mb-2"
                      title="En fin de semana solo labora personal en horas extras: registre el horario con los relojes."
                    >
                      <span>⚠</span> Fin de semana — solo horas extras
                    </div>

                    <!-- Relojes: hora de inicio y fin del permiso -->
                    <div class="row g-2">
                      <div class="col-6">
                        <label for="horaInicioPermiso" class="form-label mb-1 small text-muted" style="font-size: 0.72rem;">Hora de inicio</label>
                        <div class="input-group input-group-sm">
                          <span class="input-group-text">🕗</span>
                          <input
                            id="horaInicioPermiso"
                            v-model="horaInicioPermiso"
                            @change="construirHorario"
                            type="time"
                            class="form-control text-center fw-bold"
                            :disabled="!documentLoaded"
                          />
                        </div>
                      </div>
                      <div class="col-6">
                        <label for="horaFinPermiso" class="form-label mb-1 small text-muted" style="font-size: 0.72rem;">Hora de fin</label>
                        <div class="input-group input-group-sm">
                          <span class="input-group-text">🕤</span>
                          <input
                            id="horaFinPermiso"
                            v-model="horaFinPermiso"
                            @change="construirHorario"
                            type="time"
                            class="form-control text-center fw-bold"
                            :disabled="!documentLoaded"
                          />
                        </div>
                      </div>
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
                      <option value="" disabled>Según el PDF — seleccione...</option>
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
                      <div v-if="fila.jornadaCompleta" class="mt-1">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style="font-size: 0.65rem;">
                          Jornada completa
                        </span>
                      </div>
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

// Indicadores del tipo de archivo cargado (Word / TXT / Imagen) y su texto extraido
const isWordFile = ref(false)
const isTextFile = ref(false)
const isImageFile = ref(false)
const textoDocumentoExtraido = ref('')
// MIME type real del archivo cargado (se guarda en la base de datos)
const archivoMimeType = ref('')

// Convierte un Data URL (Base64) muy largo en un Blob URL para evitar crashes en el iframe de Chromium
const displayFileUrl = computed(() => {
  if (!customFileUrl.value || !customFileUrl.value.startsWith('data:')) return customFileUrl.value
  try {
    const arr = customFileUrl.value.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    const blob = new Blob([u8arr], { type: mime })
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('Error convirtiendo base64 a blob url:', e)
    return customFileUrl.value
  }
})

// Detecta el tipo de archivo por MIME y extension
const detectarTipoArchivo = (file) => {
  const nombre = ((file && file.name) || '').toLowerCase()
  const mime = ((file && file.type) || '').toLowerCase()
  return {
    esPdf: mime === 'application/pdf' || nombre.endsWith('.pdf'),
    esWord: /\/(msword|wordprocessingml)/.test(mime) || /\.(docx?|odt)$/.test(nombre),
    esTexto: mime.startsWith('text/') || /\.(txt|csv|md)$/.test(nombre),
    esImagen: mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(nombre),
    esDocAntiguo: /\.doc$/.test(nombre)
  }
}

// Aplica el tipo detectado a los indicadores del visor
const aplicarTipoArchivoAlVisor = (tipo, mime = '') => {
  isPdfFile.value = Boolean(tipo.esPdf)
  isWordFile.value = Boolean(tipo.esWord) && !tipo.esPdf
  isTextFile.value = Boolean(tipo.esTexto) && !tipo.esPdf && !tipo.esWord
  isImageFile.value = Boolean(tipo.esImagen)
  archivoMimeType.value = mime || ''
}

// Extrae el MIME de un Data URL (Base64)
const mimeDesdeDataUrl = (dataUrl) => {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl || '')
  return m ? m[1] : ''
}

// Clasifica un archivo por MIME y nombre para el visor
const clasificarPorMime = (mime, nombreArchivo = '') => {
  const m = (mime || '').toLowerCase()
  const n = (nombreArchivo || '').toLowerCase()
  return {
    esPdf: m === 'application/pdf' || n.endsWith('.pdf'),
    esWord: /\/(msword|wordprocessingml)/.test(m) || /\.(docx?|odt)$/.test(n),
    esTexto: m.startsWith('text/plain') || /\.(txt|csv|md)$/.test(n),
    esImagen: m.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(n)
  }
}

const isScanningOCR = ref(false)
const isSubmitting = ref(false)
const ocrProgress = ref(0)
const ocrStepMessage = ref('Iniciando lectura...')

// Confianza OCR REAL: % de campos clave que el documento aportó con evidencia.
// Los campos que el OCR no pudo leer quedan listados para diligenciar manualmente.
const confianzaOcrReal = ref(0)
const camposFaltantesOcr = ref([])

const claseConfianzaOcr = computed(() => {
  const c = confianzaOcrReal.value
  if (c >= 80) return 'bg-success-subtle text-success border-success-subtle'
  if (c >= 40) return 'bg-warning-subtle text-warning border-warning-subtle'
  return 'bg-danger-subtle text-danger border-danger-subtle'
})

const textoConfianzaOcr = computed(() => {
  if (confianzaOcrReal.value >= 100) return '✔ OCR 100% — verifique antes de radicar'
  const faltan = camposFaltantesOcr.value.length
    ? `completar: ${camposFaltantesOcr.value.join(', ')}`
    : 'verifique los datos'
  return `⚠ OCR ${confianzaOcrReal.value}% — ${faltan}`
})

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

  try {
    await permisosService.eliminarPermiso(radicado)
  } catch (err) {
    modalEliminarVisible.value = false
    lanzarAlertaBootstrap('danger', 'No se pudo eliminar', err.message || 'Sin conexión con el servidor. El permiso no se eliminó de la base de datos.')
    return
  }

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
  tipoPermiso: '',
  motivoManuscrito: '',
  motivo: '',
  observaciones: ''
})

// ─── HORARIO DEL PERMISO ─────────────────────────────────────────────────────
// Jornada laboral Acuasan: lunes a jueves 07:30 a 18:00, viernes 07:30 a
// 17:30. Sábados y domingos NO hay jornada regular: solo labora personal en
// horas extras, por lo que el horario se registra manualmente.
// El horario resultante (formData.horasCalculadas) sigue siendo editable a
// mano, pero lo normal es construirlo con el interruptor de Jornada Completa
// (según el día de la fecha del permiso) o con los dos relojes:
// 08:00 + 12:00 → "08:00 a 12:00 (4 horas)", el formato del radicado/historial.
const JORNADAS_ACUASAN = {
  lunesAJueves: { inicio: '07:30', fin: '18:00' },
  viernes: { inicio: '07:30', fin: '17:30' },
}
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Relojes del permiso: única entrada del horario. Cuando las horas coinciden
// exactamente con la jornada del día (según la fecha), esJornadaCompleta se
// activa solo: se muestra la alerta y queda marcado en el historial.
const horaInicioPermiso = ref('')
const horaFinPermiso = ref('')

// Día de la semana (0=domingo … 6=sábado) de una fecha DD/MM/YYYY válida
const diaSemanaDeFecha = (textoFecha) => {
  if (!esFechaValida(textoFecha)) return null
  const m = textoFecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getDay()
}

// La fecha seleccionada cae en sábado o domingo (no hay jornada regular)
const esFinDeSemana = computed(() => {
  const dia = diaSemanaDeFecha(formData.fechaInicio)
  return dia === 0 || dia === 6
})

// Las horas elegidas coinciden con la jornada completa del día de la fecha
const esJornadaCompleta = computed(() => {
  const dia = diaSemanaDeFecha(formData.fechaInicio)
  if (dia === null || dia === 0 || dia === 6) return false
  const j = dia === 5 ? JORNADAS_ACUASAN.viernes : JORNADAS_ACUASAN.lunesAJueves
  return horaInicioPermiso.value === j.inicio && horaFinPermiso.value === j.fin
})

// Texto de la alerta: la jornada que se reconoció, p. ej. "07:30 a 18:00 · lunes"
const textoJornadaResumen = computed(() => {
  const dia = diaSemanaDeFecha(formData.fechaInicio)
  if (dia === null) return ''
  const j = dia === 5 ? JORNADAS_ACUASAN.viernes : JORNADAS_ACUASAN.lunesAJueves
  return `${j.inicio} a ${j.fin} · ${DIAS_SEMANA[dia]}`
})

// Referencia de la jornada (tooltip de la alerta, no ocupa espacio en pantalla)
const tituloJornadaBoton =
  'Jornada Acuasan: lunes a jueves 07:30 a 18:00 · viernes 07:30 a 17:30 · fines de semana solo personal en horas extras.'

const minutosDeHora = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Escribe formData.horasCalculadas a partir de los relojes. Si las horas no
// forman un rango válido (falta una o el fin es menor/igual al inicio) no se
// toca el campo: queda disponible para diligenciamiento manual.
const construirHorario = () => {
  const ini = minutosDeHora(horaInicioPermiso.value)
  const fin = minutosDeHora(horaFinPermiso.value)
  if (ini === null || fin === null || fin <= ini) return
  const horas = (fin - ini) / 60
  const horasTexto = Number.isInteger(horas) ? String(horas) : horas.toFixed(1).replace('.', ',')
  formData.horasCalculadas = `${horaInicioPermiso.value} a ${horaFinPermiso.value} (${horasTexto} horas)`
}

const reiniciarHorarioPermiso = () => {
  horaInicioPermiso.value = ''
  horaFinPermiso.value = ''
}

// ─── MÁSCARA DE FECHA ────────────────────────────────────────────────────────
// Mientras se escribe, el campo coloca solo el separador de fecha: al digitar
// 03082026 se va mostrando 03 → 03/ → 03/08 → 03/08/2026. Si el usuario digita
// guiones, puntos o espacios (03-08-2026) se ignoran y queda el formato
// DD/MM/YYYY que usa todo el sistema (radicado, historial, duplicados y backend).
const formatearDigitosFecha = (digitos) => {
  const d = digitos.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

const escribirFechaInput = (evento, campo) => {
  const el = evento.target
  const formateado = formatearDigitosFecha(el.value.replace(/\D/g, ''))
  // Se fuerza el valor del input además del modelo: si el usuario digita un
  // carácter suelto (letra, guión) el valor formateado no cambia, Vue no
  // repinta el input y sin esto el carácter quedaría visible en el campo.
  if (el.value !== formateado) el.value = formateado
  formData[campo] = formateado
}

// Al salir del campo, un año de 2 dígitos (03/08/26) se completa a 4 (03/08/2026)
const completarAnioFechaInput = (evento, campo) => {
  const m = String(formData[campo] || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!m) return
  const completo = `${m[1]}/${m[2]}/20${m[3]}`
  formData[campo] = completo
  evento.target.value = completo
}

// La máscara garantiza la forma DD/MM/YYYY, pero no que la fecha exista
// (31/02/2026 pasaría la máscara). Esta validación se usa antes de radicar.
const esFechaValida = (textoFecha) => {
  const m = String(textoFecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return false
  const dia = parseInt(m[1], 10)
  const mes = parseInt(m[2], 10)
  const anio = parseInt(m[3], 10)
  if (mes < 1 || mes > 12) return false
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return dia >= 1 && dia <= diasPorMes[mes - 1]
}

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
    duracion: item.duracion || item.horasCalculadas || '',
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

// Reinicia unicamente los campos del formulario (sin tocar el visor).
// tipoPermiso inicia VACÍO: el tipo se toma del PDF o lo elige el encargado,
// nunca se pre-selecciona un valor que el documento no respalde.
const resetFormData = () => {
  formData.nombreFuncionario = ''
  formData.cedula = ''
  formData.cargo = ''
  formData.dependencia = ''
  formData.fechaInicio = ''
  formData.fechaFin = ''
  formData.fechaPermisoTexto = ''
  formData.horaDetalle = ''
  formData.horasCalculadas = ''
  formData.tipoPermiso = ''
  formData.motivoManuscrito = ''
  formData.motivo = ''
  formData.observaciones = ''
  formData.id = ''
  formData.radicado = ''
  formData.createdAt = ''
  reiniciarHorarioPermiso()
}

// Limpia el formulario y el visor por completo para procesar una nueva solicitud
const limpiarFormularioYVisor = () => {
  documentLoaded.value = false
  documentFileName.value = ''
  customFileUrl.value = ''
  isPdfFile.value = false
  isWordFile.value = false
  isTextFile.value = false
  isImageFile.value = false
  textoDocumentoExtraido.value = ''
  archivoMimeType.value = ''
  confianzaOcrReal.value = 0
  camposFaltantesOcr.value = []
  resetFormData()
  // Reiniciar los inputs de archivo para permitir subir el mismo archivo de nuevo
  if (typeof document !== 'undefined') {
    document.querySelectorAll('input[type=file]').forEach((input) => { input.value = '' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE EXTRACCIÓN INTELIGENTE MULTI-PÁGINA — ACUASAN & SOPORTES EPS
// ═══════════════════════════════════════════════════════════════════════════

// Decodificar Base64 a Uint8Array
const base64ToUint8 = (dataUrl) => {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

// (initPdfWorker se define en el módulo de extracción OCR)

// Mejora de imagen para OCR: escala de grises + stretch de histograma
const mejorarImagenParaOCR = (srcCanvas) => {
  const w = srcCanvas.width, h = srcCanvas.height
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const ctx = out.getContext('2d')
  ctx.drawImage(srcCanvas, 0, 0)
  const d = ctx.getImageData(0, 0, w, h), px = d.data
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i+1] + 0.114 * px[i+2])
    px[i] = px[i+1] = px[i+2] = g
  }
  let min = 255, max = 0
  for (let i = 0; i < px.length; i += 4) { if (px[i] < min) min = px[i]; if (px[i] > max) max = px[i] }
  const rng = (max - min) || 1
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, Math.round(((px[i] - min) / rng) * 255))
    px[i] = px[i+1] = px[i+2] = v; px[i+3] = 255
  }
  ctx.putImageData(d, 0, 0)
  return out
}

// Normalizar texto OCR: corregir confusiones típicas de escaneo
const normalizarTextoOCR = (texto) => (texto || '')
  .replace(/\r\n?/g, '\n').replace(/[ \t]{2,}/g, ' ')
  .replace(/[\u2013\u2014\u2012]/g, '-')
  .replace(/(\d)O(\d)/g, '$10$2')
  .replace(/O(\d{1,2}[-\/.])(\d)/g, '0$1$2')
  .replace(/(\d[-\/.])O(\d)/g, '$10$2')
  .replace(/(\d)l(\d)/g, '$11$2')
  .replace(/(\d{1,2})[\.\-\/]\s+(\d{1,2})/g, '$1-$2')
  .replace(/([0-9])(am|pm)\b/gi, '$1 $2')
  .replace(/(\d)\.(\d{2})\s*(am|pm)/gi, '$1:$2$3')

// Diccionario y normalizador de cargos y áreas de Acuasan
const normalizarCargoYDependencia = (texto) => {
  const c = (texto || '').toLowerCase()
  if (c.includes('potabiliz') || c.includes('lider') || c.includes('líder') || c.includes('planta') || c.includes('tratam')) {
    return { cargo: 'Líder de Potabilización', dependencia: 'Planta de Tratamiento / Potabilización' }
  }
  if (c.includes('aux') && (c.includes('adt') || c.includes('adm') || c.includes('ada') || c.includes('tivo'))) {
    return { cargo: 'Auxiliar Administrativo', dependencia: 'Administrativa' }
  }
  if (c.includes('fontan')) {
    return { cargo: 'Fontanero', dependencia: 'Distribución y Redes' }
  }
  if (c.includes('alcant') || c.includes('redes')) {
    return { cargo: 'Operario de Alcantarillado', dependencia: 'Alcantarillado' }
  }
  if (c.includes('conduct')) {
    return { cargo: 'Conductor Operativo', dependencia: 'Operativa' }
  }
  if (c.includes('analist') || c.includes('fact')) {
    return { cargo: 'Analista de Facturación y Cartera', dependencia: 'Comercial y Facturación' }
  }
  return { cargo: 'Funcionario Acuasan', dependencia: 'Operativa' }
}

// Limpiar y formatear nombre en mayúsculas limpias
const limpiarNombreCompleto = (nombreRaw) => {
  if (!nombreRaw) return ''
  let n = nombreRaw
    .replace(/^PERMISO\s+/i, '')
    .replace(/202[0-9]{5,}.*$/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/[0-9_\-\.\:\;\,\(\)]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  
  if (n.length < 5) return ''
  return n.toUpperCase()
}

// Parser de alta precisión para Formularios Acuasan + Órdenes EPS / Certificados Electorales
const parsearTextoPermiso = (textoCompleto, nombreArchivo = '', textoPagina1 = '') => {
  const texto = normalizarTextoOCR(textoCompleto)
  const p1 = normalizarTextoOCR(textoPagina1 || textoCompleto)
  const campos = {}

  console.groupCollapsed('[OCR texto multi-página extraído]')
  console.log('--- PÁGINA 1 (SOLICITUD) ---', p1)
  console.log('--- TEXTO COMPLETO ---', texto)
  console.groupEnd()

  const nombresMes = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  // 1. NOMBRE DEL TRABAJADOR
  let nombreEncontrado = ''

  // A. De la orden médica o anexo EPS
  const mPaciente = texto.match(/(?:Paciente|PACIENTE|Usuario|USUARIO|Afiliado|Ciudadano)[:\s]+([A-ZÁÉÍÓÚÑa-z\s]{6,55})(?=\s*ID|\s*CC|\s*Contrato|\s*Edad|\s*Plan|\n|$)/i)
  if (mPaciente) {
    const pNombre = limpiarNombreCompleto(mPaciente[1])
    if (pNombre.split(' ').length >= 2) nombreEncontrado = pNombre
  }

  // B. Del nombre del archivo (ej: "PERMISO ANGELICA SANDRIT MORALES ROJAS...")
  if (!nombreEncontrado && nombreArchivo) {
    const pArch = limpiarNombreCompleto(nombreArchivo)
    if (pArch.split(' ').length >= 2) nombreEncontrado = pArch
  }

  // C. De la Página 1 (NOMBRE: ...)
  if (!nombreEncontrado) {
    const mNombre = p1.match(/NOMBRE[:\s*]+([^\n]{5,65})(?=\s*CARGO|\s*FECHA|\n|$)/i)
    if (mNombre) {
      const raw = mNombre[1].replace(/\s*CARGO[:\s].*/i, '').trim()
      const nLimpio = limpiarNombreCompleto(raw)
      if (nLimpio.length >= 5) nombreEncontrado = nLimpio
    }
  }

  if (nombreEncontrado) campos.nombreFuncionario = nombreEncontrado

  // 2. CÉDULA DE CIUDADANÍA — SOLO con evidencia explícita del documento.
  // El membrete de Acuasan trae el NIT 68.679.000 impreso; el OCR suele mal
  // leerlo (p. ej. "58679000") y antes se reportaba como si fuera la cédula.
  // Estrategia: primero etiquetas ("CÉDULA:", "documento No."), y el fallback
  // de número suelto RECHAZA números rodeados de contexto empresarial (NIT,
  // membrete) o que parecen teléfono/año. Sin evidencia: campo vacío.
  const numerosAExcluir = ['890120175', '8901201757', '68679000', '1686790001', '2640000', '2610000']
  let cedulaDetectada = ''

  // Valida que una secuencia de dígitos pueda ser una cédula colombiana
  const esCedulaPlausible = (digitos) => {
    if (!/^[0-9]{6,11}$/.test(digitos)) return false
    if (numerosAExcluir.includes(digitos)) return false
    if (/^20(1[5-9]|2[0-9])$/.test(digitos)) return false        // año suelto
    if (/^20(1[5-9]|2[0-9])[0-9]{4}$/.test(digitos)) return false // aaaamm
    if (/^(30|31|32)[0-9]{8}$/.test(digitos)) return false        // celular
    return true
  }

  // El texto previo a un número delata si es un dato empresarial, no la cédula
  const contextoEsEmpresarial = (textoPrevio) =>
    /(nit|n\.?\s*i\.?\s*t|registro|empresa|acueducto|alcantarillado|acuasan|e\.?\s?s\.?\s?p|tel[eé]fono|pbx)/i.test(textoPrevio || '')

  // A. Etiquetas del formulario de solicitud y del certificado electoral E-18
  const patronesCedula = [
    /\b(?:CEDULA|C[eÉ]DULA)\s*(?:DE\s*CIUDADANIA)?\s*[:\-]?\s*N?o?\.?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gi,
    /\bC\.?\s?C\.?\s*(?:No\.?|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gi,
    /\bdocumento\s*(?:No\.?|n[uú]mero|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gi,
    /\bidentificad[oa]\s*(?:con)?\s*(?:el)?\s*(?:documento|c[eé]dula)?\s*(?:No\.?|#)?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gi
  ]
  for (const rx of patronesCedula) {
    for (const m of texto.matchAll(rx)) {
      const digitos = (m[1] || '').trim().replace(/[^\d]/g, '')
      // Para un número ETIQUETADO la etiqueta es la evidencia; NO se aplica el
      // guard de contexto (el membrete "ACUASAN..." queda a pocas decenas de
      // caracteres de los campos del propio formulario y los rechazaría).
      if (esCedulaPlausible(digitos)) {
        cedulaDetectada = digitos
        break
      }
    }
    if (cedulaDetectada) break
  }

  // B. Último recurso: número suelto FUERA de contexto empresarial
  if (!cedulaDetectada) {
    for (const m of texto.matchAll(/\b[0-9][0-9\.,]{5,14}\b/g)) {
      const digitos = (m[0] || '').replace(/[^\d]/g, '')
      const previo = texto.slice(Math.max(0, m.index - 45), m.index)
      if (esCedulaPlausible(digitos) && !contextoEsEmpresarial(previo)) {
        cedulaDetectada = digitos
        break
      }
    }
  }

  if (cedulaDetectada) campos.cedula = cedulaDetectada

  // 3. CARGO & ÁREA / DEPENDENCIA — SOLO si el formulario lo declara con
  // etiqueta. Antes se infería por palabras clave sobre TODO el texto y el
  // membrete "Acueducto y Alcantarillado de San Gil" hacía que TODOS los
  // funcionarios aparecieran como "Operario de Alcantarillado".
  // NOTA: la captura NO puede cruzar de línea ([ \t] en vez de \s): si el
  // formulario trae "CARGO:" vacío, la regex brincaría al renglón siguiente.
  const mCargo = texto.match(/\bCARGO[ \t]*[:\-][ \t]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\.\t ]{2,50})/i)
  if (mCargo) {
    const cargoLiteral = mCargo[1].replace(/\s{2,}/g, ' ').trim()
    const info = normalizarCargoYDependencia(cargoLiteral)
    // El normalizador solo es confiable si reconoció el cargo; su valor por
    // defecto ("Funcionario Acuasan") NO debe tapar lo que dice el formulario
    campos.cargo = info.cargo !== 'Funcionario Acuasan' ? info.cargo : cargoLiteral
  }

  const mDependencia = texto.match(/\b(?:DEPENDENCIA|ÁREA|AREA)[ \t]*[:\-][ \t]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\.\t ]{2,50})/i)
  if (mDependencia) {
    const depLiteral = mDependencia[1].replace(/\s{2,}/g, ' ').trim()
    const info = normalizarCargoYDependencia(depLiteral)
    campos.dependencia = info.dependencia !== 'Operativa' ? info.dependencia : depLiteral
  }
  // Sin etiqueta CARGO/DEPENDENCIA: los campos quedan vacíos para el encargado

  // 4. FECHA DEL PERMISO (EXTRACCIÓN EXCLUSIVA DE LA PÁGINA 1 — SOLICITUD DE ACUASAN)
  let dd = '', mm = '', aa = ''

  const mesesVariaciones = {
    enero: 1, ene: 1,
    febrero: 2, feb: 2,
    marzo: 3, mar: 3,
    abril: 4, abr: 4,
    mayo: 5, may: 5,
    junio: 6, jun: 6,
    julio: 7, jul: 7,
    agosto: 8, ago: 8, agos: 8, agoslo: 8, agto: 8, agost: 8,
    septiembre: 9, setiembre: 9, sep: 9, sept: 9,
    octubre: 10, oct: 10,
    noviembre: 11, nov: 11,
    diciembre: 12, dic: 12
  }

  // A. Buscar en P1 formato textual: "18 de Agosto 2026", "18 de Agoslo 2026", "03 de Agosto 2026"
  const mP1Texto = p1.match(/(?:FECHA|PERMISO|SOLICITUD)?[\s\:\.\-]*?([0-3]?[0-9])\s+de\s+([a-záéíóúñ]{3,12})\s+(?:de\s+)?(202\d)/i)
  if (mP1Texto) {
    const dVal = parseInt(mP1Texto[1])
    const mStr = mP1Texto[2].toLowerCase()
    let mVal = null
    for (const [k, v] of Object.entries(mesesVariaciones)) {
      if (mStr.startsWith(k) || k.startsWith(mStr)) { mVal = v; break }
    }
    if (dVal >= 1 && dVal <= 31 && mVal) {
      dd = String(dVal).padStart(2, '0')
      mm = String(mVal).padStart(2, '0')
      aa = mP1Texto[3]
    }
  }

  // B. Buscar en P1 formato numérico SOLO con etiqueta ("FECHA: 18/08/2026").
  // Antes había un fallback que tomaba CUALQUIER fecha de la página (fechas de
  // impresión, del anexo E-18, etc.) y otra que inventaba el año "2026" o usaba
  // la fecha del nombre del archivo: eso producía fechas ajenas al PDF.
  if (!dd || !mm || !aa) {
    const mP1Num = p1.match(/(?:FECHA|PERMISO|SOLICITUD)[\s\:\.\-]{0,12}([0-3]?[0-9])\s*[-.\/_]\s*([0-1]?[0-9])\s*[-.\/_]\s*(202\d)/i)
    if (mP1Num) {
      const dVal = parseInt(mP1Num[1]), mVal = parseInt(mP1Num[2])
      if (dVal >= 1 && dVal <= 31 && mVal >= 1 && mVal <= 12) {
        dd = String(dVal).padStart(2, '0')
        mm = String(mVal).padStart(2, '0')
        aa = mP1Num[3]
      }
    }
  }

  // C. Sin fecha reconocida: se deja vacía para diligenciamiento manual (sin fechas inventadas)
  if (dd && mm && aa) {
    campos.fechaInicio = `${dd}/${mm}/${aa}`
    campos.fechaFin = `${dd}/${mm}/${aa}`
    campos.fechaPermisoTexto = `${parseInt(dd)} de ${nombresMes[parseInt(mm)] || ''} de ${aa}`
  } else {
    campos.fechaInicio = ''
    campos.fechaFin = ''
    campos.fechaPermisoTexto = ''
  }

  // 5. HORARIO: Se deja en blanco para que el usuario pueda ingresarlo manualmente
  campos.horaDetalle = ''
  campos.horasCalculadas = ''

  // 6. TIPO DE PERMISO & CASILLAS [X]
  // 6. TIPO DE PERMISO — DETECCIÓN POR CASILLA MARCADA [X] EN EL FORMULARIO (PÁGINA 1)
  // Estrategia: buscar cuál casilla tiene una X o marca junto a ella
  // El formulario tiene: "Compensatorio [ ] Médico* [ ] Personal [ ] ..."
  // La casilla marcada puede aparecer como: "Médico X", "Médico [X]", "Medico* X", etc.

  let tipoDetectado = ''

  // A0. Caso E-18 / función electoral: si la casilla COMPENSATORIO está marcada
  // y el anexo es un certificado electoral (Registraduría/juramento/jurado),
  // el permiso es Compensatorio aunque también esté marcada la casilla Médico
  // (la casilla médica suele venir pre-marcada en el formato impresión).
  const rxCompMarcado = /[Cc]ompensatori[ao]\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]ompensatori[ao]/
  const hayEvidenciaElectoral = /registradur|jurament|jurado|electoral|votaci[oó]n|E-18|E\.?18/i.test(texto)
  if (rxCompMarcado.test(p1) && hayEvidenciaElectoral) {
    tipoDetectado = 'Compensatorio'
  }

  // A. Detectar casilla MÉDICO marcada: "Médico X", "Médico* X", "Medico [X]", "Médico✓"
  const rxMedicoMarcado = /M[eé]dic[ao]\*?\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*M[eé]dic[ao]\*?/
  if (!tipoDetectado && rxMedicoMarcado.test(p1)) {
    tipoDetectado = 'Cita Médica'
  }

  // B. Detectar casilla COMPENSATORIO marcada
  if (!tipoDetectado) {
    if (rxCompMarcado.test(p1)) {
      tipoDetectado = 'Compensatorio'
    }
  }

  // C. Detectar casilla PERSONAL marcada
  if (!tipoDetectado) {
    const rxPersonalMarcado = /[Pp]ersonal\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Pp]ersonal/
    if (rxPersonalMarcado.test(p1)) {
      tipoDetectado = 'Personal'
    }
  }

  // D. Detectar casilla CALAMIDAD marcada
  if (!tipoDetectado) {
    const rxCalaMarcado = /[Cc]alamidad\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]alamidad/
    if (rxCalaMarcado.test(p1)) {
      tipoDetectado = 'Calamidad Doméstica'
    }
  }

  // E. Detectar ESTUDIO / CAPACITACIÓN marcado
  if (!tipoDetectado) {
    const rxEstudioMarcado = /[Ee]studio|[Cc]apacitaci[oó]n\s*[\[\(]?[xX✓✗☑]/
    if (rxEstudioMarcado.test(p1)) {
      tipoDetectado = 'Estudio / Capacitación'
    }
  }

  // F. Si no se detectó por casilla, inferir SOLO del contexto textual real.
  // Sin evidencia: '' — el encargado elige el tipo; no se pre-selecciona nada.
  if (!tipoDetectado) {
    const hayMedico = /m[eé]dic[ao]|cita\s*m[eé]dic|eps|cardiolog|urolog|ortoped|remisi[oó]n|especialista|orden\s*m[eé]dic|diagn[oó]stico/i.test(texto)
    const hayJurado = /jurado|consulta\s*popular|votaci[oó]n|electoral|certificado\s*electoral|registradur|jurament/i.test(texto)
    const hayCalamidad = /calamidad|fallecimiento|inundaci[oó]n|accidente\s*familiar/i.test(texto)
    const hayEstudio = /universidad|capacitaci[oó]n|seminario|congreso|examen\s*acad[eé]mico/i.test(texto)

    if (hayJurado) tipoDetectado = 'Compensatorio'
    else if (hayMedico) tipoDetectado = 'Cita Médica'
    else if (hayCalamidad) tipoDetectado = 'Calamidad Doméstica'
    else if (hayEstudio) tipoDetectado = 'Estudio / Capacitación'
  }

  campos.tipoPermiso = tipoDetectado

  // 7. MOTIVO / JUSTIFICACIÓN — EXTRAÍDO DEL TEXTO REAL DEL FORMULARIO.
  // Antes la captura arrastraba el ruido de las casillas impresas (p. ej.
  // "DY Médico") y, si no hallaba nada, inventaba un motivo genérico. Ahora:
  // se limpia el ruido; sin texto manuscrito verificable se construye un
  // motivo contextual SOLO cuando el documento lo respalda; si no, va vacío
  // para que el encargado lo diligencie.
  let motivoExtraido = ''

  // A. Texto manuscrito después de la línea MOTIVO del formulario de Acuasan
  // El formato es: "MOTIVO: Compensatorio [] Médico* [X] Personal [] {texto_manuscrito}"
  const rxMotivoLinea = /MOTIVO[\s\:\*]*(?:Compensatorio|M[eé]dic[ao]\*?|Personal|Calamidad)?[\s\[\]\(\)xXoO\*]*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\/\s\,\.\-\(\)]{6,120})/i
  const mMotivoLinea = p1.match(rxMotivoLinea)
  if (mMotivoLinea) {
    let trabajo = mMotivoLinea[1]
      .replace(/en caso de cita.*/i, '')
      .replace(/\*en caso.*/i, '')
      .replace(/firma.*/i, '')
      .replace(/solicitante.*/i, '')
      .replace(/jefe.*/i, '')
      .replace(/[_|~]{2,}/g, ' ')

    // Quitar símbolos de casilla y las palabras-etiqueta impresas del formato
    trabajo = trabajo
      .replace(/[\[\]\(\)\{\}]/g, ' ')
      .replace(/[xX✓✗☑☒☐]{1,2}/g, ' ')
      .replace(/\b(?:compensatorio|m[eé]dic[oa]\*?|calamidad|personal|estudio|capacitaci[oó]n)\b/gi, ' ')

    // Descartar tokens de ruido INICIALES cortos ("DY", "X", "O", números sueltos)
    const rxRuidoInicial = /^(?:[^\wáéíóúñ]+|\b[a-záéíóúñ]{1,2}\b|\b\d{1,2}\b)\s*/i
    let estable = false
    while (!estable) {
      const recorte = trabajo.replace(rxRuidoInicial, '')
      estable = recorte === trabajo
      trabajo = recorte
    }
    trabajo = trabajo.replace(/\s{2,}/g, ' ').trim()

    // ¿Quedó texto manuscrito real? (al menos una palabra con 3+ letras)
    if (trabajo.length >= 5 && /[a-záéíóúñ]{3,}/i.test(trabajo)) {
      motivoExtraido = trabajo
    }
  }

  // B. Texto manuscrito cerca de "c/ta médica", "pa tomar", "reclamar"
  if (!motivoExtraido || motivoExtraido.length < 5) {
    const rxCitaManuscrita = /c[\/\.]?ta\s+m[eé]dic[ao][a-z\s\/\,\.]{0,60}/i
    const mCita = texto.match(rxCitaManuscrita)
    if (mCita) {
      motivoExtraido = mCita[0].replace(/\s+/g, ' ').trim()
    }
  }

  // C. Motivo contextual — SOLO con respaldo literal en el documento.
  // Nada de motivos genéricos inventados: si el texto no lo dice, va vacío.
  if (!motivoExtraido || motivoExtraido.length < 5) {
    if (/registradur|jurament|jurado|electoral|votaci[oó]n|E-18/i.test(texto)) {
      motivoExtraido = 'Compensatorio por función electoral (certificado E-18 / Registraduría adjunto)'
    } else if (/cardiolog/i.test(texto)) {
      motivoExtraido = 'Cita médica - Consulta especialista Cardiología'
      if (/reclamar|medicam/i.test(texto)) motivoExtraido += ' / Reclamar medicamentos'
    } else if (/urolog/i.test(texto)) {
      motivoExtraido = 'Cita médica - Consulta especialista Urología'
    } else if (/reclamar|medicam/i.test(texto)) {
      motivoExtraido = 'Cita médica - Reclamar medicamentos (EPS)'
    }
  }

  campos.motivo = motivoExtraido || ''
  campos.motivoManuscrito = motivoExtraido || ''

  return campos
}

// Aplicar campos al formulario Vue. Se asignan TODAS las claves que administra
// el parser (incluidas las vacías): si el OCR no encontró un dato, el campo
// debe quedar VACÍO, no conservar un valor de un escaneo anterior.
const aplicarCampos = (campos) => {
  formData.nombreFuncionario = campos.nombreFuncionario || ''
  formData.cedula = campos.cedula || ''
  formData.cargo = campos.cargo || ''
  formData.dependencia = campos.dependencia || ''
  formData.fechaInicio = campos.fechaInicio || ''
  formData.fechaFin = campos.fechaFin || ''
  formData.fechaPermisoTexto = campos.fechaPermisoTexto || ''
  formData.tipoPermiso = campos.tipoPermiso || ''
  formData.horaDetalle = campos.horaDetalle || ''
  formData.horasCalculadas = campos.horasCalculadas || ''
  formData.motivo = campos.motivo || ''
  formData.motivoManuscrito = campos.motivo || ''
}

// Inicializar pdf.js worker (singleton resiliente con fallback a CDN oficial)
let _pdfWorkerInit = false
const initPdfWorker = async () => {
  if (_pdfWorkerInit) return
  try {
    const pdfjsLib = await import('pdfjs-dist')
    const v = pdfjsLib.version || '4.10.38'
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    } catch (e) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`
    }
    _pdfWorkerInit = true
  } catch (err) {
    console.warn('[PDF Worker Init Warning]', err)
  }
}

// Worker de Tesseract persistente: se crea una sola vez por sesión y se
// reutiliza en todas las páginas y documentos. En tesseract.js v7 los
// parámetros de Tesseract (tessedit_*) SOLO se aplican vía setParameters —
// pasarlos dentro de recognize() no tiene efecto y el OCR corría con la
// configuración por defecto.
let _ocrWorkerTesseract = null
const obtenerWorkerOCR = async () => {
  if (_ocrWorkerTesseract) return _ocrWorkerTesseract
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', '1', { logger: () => {} })
  await worker.setParameters({
    tessedit_pageseg_mode: '6',      // bloque de texto uniforme (formatos)
    preserve_interword_spaces: '1'
  })
  _ocrWorkerTesseract = worker
  return worker
}

const terminarWorkerOCR = async () => {
  if (_ocrWorkerTesseract) {
    try { await _ocrWorkerTesseract.terminate() } catch (e) {}
    _ocrWorkerTesseract = null
  }
}

// Ejecutar Tesseract sobre un canvas. Timeout de 60s: los escaneos borrosos o
// con letra irregular a escala 2.5 tardan bastante más de los 5s que había
// antes — con 5s el OCR devolvía texto vacío en silencio y el parser terminaba
// inventando datos ajenos al documento.
const ejecutarOCR = async (canvas) => {
  try {
    const canvasMejorado = mejorarImagenParaOCR(canvas)
    const worker = await obtenerWorkerOCR()

    const ocrTask = worker.recognize(canvasMejorado)
    const timeoutTask = new Promise((resolve) =>
      setTimeout(() => resolve({ agotado: true }), 60000)
    )

    const res = await Promise.race([ocrTask, timeoutTask])
    if (res && res.agotado) {
      console.warn('[OCR] Tiempo agotado (60s) para esta página')
      return { texto: '', confianza: 0, agotado: true }
    }
    const texto = (res && res.data && res.data.text) ? res.data.text : ''
    const confianza = (res && res.data && typeof res.data.confidence === 'number') ? res.data.confidence : null
    console.info(`[OCR Resultado] ${texto.length} caracteres reconocidos (confianza Tesseract: ${confianza ?? 'n/d'})`)
    return { texto, confianza, agotado: false }
  } catch (e) {
    console.warn('[OCR Bypass]', e)
    // Worker corrupto: se descarta para que el próximo intento lo reconstruya
    await terminarWorkerOCR()
    return { texto: '', confianza: 0, agotado: false }
  }
}

// 🎯 PROCESAMIENTO MULTI-PÁGINA INTELIGENTE CON PROTECCIÓN TOTAL
const procesarDocumentoCompleto = async (dataUrl, isPdf) => {
  let textoPagina1 = ''
  let textoCompleto = ''
  let ocrDocumentoIlegible = false
  let paginasOCRAgotadas = 0

  // --- WORD / ODT: extraccion de texto con mammoth ---
  if (isWordFile.value) {
    try {
      ocrStepMessage.value = 'Leyendo documento de Word...'
      ocrProgress.value = 40
      const mammoth = await import('mammoth')
      const arr = base64ToUint8(dataUrl)
      const arrayBuffer = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
      const resultado = await mammoth.extractRawText({ arrayBuffer })
      textoCompleto = (resultado && resultado.value) ? resultado.value : ''
      textoPagina1 = textoCompleto.split(/\n\s*\n/)[0] || textoCompleto
      textoDocumentoExtraido.value = textoCompleto
    } catch (wordErr) {
      console.warn('[Word Extract Warning]', wordErr)
      textoDocumentoExtraido.value = ''
    }
  } else if (isTextFile.value) {
    // --- TXT / texto plano: decodificacion directa UTF-8 ---
    try {
      ocrStepMessage.value = 'Leyendo archivo de texto...'
      ocrProgress.value = 40
      textoCompleto = new TextDecoder('utf-8').decode(base64ToUint8(dataUrl))
      textoPagina1 = textoCompleto
      textoDocumentoExtraido.value = textoCompleto
    } catch (txtErr) {
      console.warn('[TXT Extract Warning]', txtErr)
    }
  } else if (isPdf) {
    try {
      await initPdfWorker()
      const { getDocument } = await import('pdfjs-dist')
      ocrStepMessage.value = 'Abriendo documento PDF...'
      ocrProgress.value = 20

      const pdfDoc = await getDocument({ data: base64ToUint8(dataUrl) }).promise
      const totalPaginas = pdfDoc.numPages
      console.info(`[PDF] Páginas detectadas: ${totalPaginas}`)

      for (let pNum = 1; pNum <= totalPaginas; pNum++) {
        ocrStepMessage.value = `Digitalizando página ${pNum} de ${totalPaginas}...`
        ocrProgress.value = Math.round(25 + (pNum / totalPaginas) * 60)

        const page = await pdfDoc.getPage(pNum)

        let textoPag = ''
        try {
          const textContent = await page.getTextContent()
          const str = textContent.items.map(item => item.str).join(' ')
          if (str.trim().length > 15) {
            textoPag += str + '\n'
          }
        } catch (e) {}

        try {
          const viewport = page.getViewport({ scale: 2.5 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

          ocrStepMessage.value = `Extrayendo datos de página ${pNum}...`
          const ocrPag = await ejecutarOCR(canvas)
          textoPag += ocrPag.texto
          if (ocrPag.agotado) paginasOCRAgotadas++
        } catch (renderErr) {
          console.warn(`[Page ${pNum} Render Warn]`, renderErr)
        }

        if (pNum === 1) {
          textoPagina1 = textoPag
        }
        textoCompleto += `\n--- PÁGINA ${pNum} ---\n` + textoPag
      }
    } catch (pdfErr) {
      // PDF ilegible/dañado: NO se usa el nombre de archivo como si fuera el
      // texto del documento (el parser "inventaría" datos de él). Se informa
      // honestamente y los campos quedan para diligenciamiento manual.
      console.warn('[PDF Process Warning — documento no legible]', pdfErr)
      ocrDocumentoIlegible = true
      textoCompleto = ''
      textoPagina1 = ''
    }
  } else {
    try {
      ocrStepMessage.value = 'Procesando imagen escaneada...'
      ocrProgress.value = 40
      const img = new Image()
      img.src = dataUrl
      await new Promise(r => { img.onload = r; img.onerror = r })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * 2
      canvas.height = img.naturalHeight * 2
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const ocrImg = await ejecutarOCR(canvas)
      textoCompleto = ocrImg.texto
      textoPagina1 = textoCompleto
      if (ocrImg.agotado) paginasOCRAgotadas++
    } catch (imgErr) {
      console.warn('[Image OCR Error]', imgErr)
    }
  }

  ocrStepMessage.value = 'Interpretando campos con Inteligencia OCR...'
  ocrProgress.value = 95
  await new Promise(r => setTimeout(r, 150))

  return { textoCompleto, textoPagina1, ocrDocumentoIlegible, paginasOCRAgotadas }
}

// 🎯 MANEJADOR PRINCIPAL RESILIENTE CON RESPUESTA INMEDIATA
const handleScannedFileUpload = async (e) => {
  const file = e.target.files[0]
  // Reiniciar el input de archivo para permitir subir el mismo archivo nuevamente
  if (e && e.target) e.target.value = ''
  if (!file) return

  // Limpiar los campos de la carga anterior para no mezclar informacion
  resetFormData()

  // Detectar el tipo real de archivo cargado (PDF / Word / TXT / Imagen)
  const tipoArchivo = detectarTipoArchivo(file)
  aplicarTipoArchivoAlVisor(tipoArchivo, file.type || '')
  textoDocumentoExtraido.value = ''

  if (tipoArchivo.esDocAntiguo) {
    lanzarAlertaBootstrap('warning', 'Formato Word Antiguo', 'El archivo .doc (Word 97-2003) puede no leerse completo. Se recomienda guardarlo como .docx o PDF.')
  }

  documentFileName.value = file.name
  documentLoaded.value = true
  isScanningOCR.value = true
  ocrProgress.value = 10
  ocrStepMessage.value = `Cargando ${file.name}...`
  confianzaOcrReal.value = 0
  camposFaltantesOcr.value = []

  // NOTA: no se pre-llena nada desde el nombre del archivo. Antes se sembraban
  // datos ("nombre + fecha del nombre.pdf") que quedaban como si el OCR los
  // hubiera leído del documento aunque la lectura fallara. El único origen de
  // datos es el contenido real del archivo.
  const reader = new FileReader()
  reader.onload = async (event) => {
    // Almacenar siempre en Base64 para que la base de datos pueda guardar el archivo real
    customFileUrl.value = event.target.result

    try {
      const { textoCompleto, textoPagina1, ocrDocumentoIlegible, paginasOCRAgotadas } =
        await procesarDocumentoCompleto(event.target.result, isPdfFile.value)
      const campos = parsearTextoPermiso(textoCompleto, file.name, textoPagina1)
      aplicarCampos(campos)

      // Confianza REAL: % de campos clave con evidencia en el documento.
      const clavesRevision = [
        ['nombreFuncionario', 'Nombre'],
        ['cedula', 'Cédula'],
        ['fechaInicio', 'Fecha'],
        ['tipoPermiso', 'Tipo'],
        ['motivo', 'Motivo']
      ]
      const faltantes = clavesRevision.filter(([k]) => !String(formData[k] || '').trim())
      confianzaOcrReal.value = Math.round(((clavesRevision.length - faltantes.length) / clavesRevision.length) * 100)
      camposFaltantesOcr.value = faltantes.map(([, etiqueta]) => etiqueta)

      ocrProgress.value = 100
      ocrStepMessage.value = '¡Lectura completada!'

      if (ocrDocumentoIlegible) {
        lanzarAlertaBootstrap(
          'warning',
          'Documento no legible automáticamente',
          `No fue posible leer el contenido de "${file.name}" (puede estar dañado o protegido). El documento queda en el visor: diligencie los campos manualmente antes de radicar.`,
          9000
        )
      } else if (faltantes.length === 0) {
        lanzarAlertaBootstrap(
          'success',
          '✅ Datos del Permiso Extraídos',
          `Se cargó la solicitud de ${formData.nombreFuncionario} para permiso de ${formData.tipoPermiso} (${formData.fechaInicio}). Verifique que los datos coincidan con el PDF antes de radicar.`
        )
      } else {
        lanzarAlertaBootstrap(
          'warning',
          `OCR parcial (${confianzaOcrReal.value}%) — ${faltantes.length} campo(s) pendiente(s)`,
          `El documento se leyó, pero no se pudo confirmar en el PDF: ${faltantes.map(([, etiqueta]) => etiqueta).join(', ')}. Diligencie esos campos manualmente. ${paginasOCRAgotadas > 0 ? `(${paginasOCRAgotadas} página(s) tardaron demasiado en leerse).` : ''}`,
          9000
        )
      }
    } catch (err) {
      console.error('[OCR ERROR]', err)
      lanzarAlertaBootstrap(
        'info',
        'Documento Cargado',
        `El archivo "${file.name}" fue cargado en el visor, pero la extracción automática falló (${err.message || 'error desconocido'}). Diligencie los campos manualmente.`,
        9000
      )
    } finally {
      isScanningOCR.value = false
      ocrProgress.value = 0
    }
  }

  reader.onerror = () => {
    isScanningOCR.value = false
    ocrProgress.value = 0
    lanzarAlertaBootstrap('warning', 'Archivo Cargado', 'El archivo fue cargado en el visor.')
  }

  reader.readAsDataURL(file)
}



// 🎯 CARGAR PERMISO ORIGINAL DESDE EL HISTORIAL (MUESTRA EL DOCUMENTO ESPECÍFICO DEL PERMISO SELECCIONADO)
const cargarEnFormulario = async (item) => {
  documentLoaded.value = true
  // Al venir de un registro ya radicado, los datos son del historial (no de un
  // OCR nuevo): la confianza parte completa, no "0% pendiente".
  confianzaOcrReal.value = 100
  camposFaltantesOcr.value = []
  // El horario mostrado viene del registro del historial: los relojes y el
  // interruptor se limpian para no contradecir el valor cargado.
  reiniciarHorarioPermiso()
  documentFileName.value = item.soporte || `Permiso_${(item.funcionario || 'Funcionario').replace(/\s+/g, '_')} _${item.anio || anioActual}.pdf`

  formData.nombreFuncionario = item.funcionario || item.nombreFuncionario || ''
  formData.cedula = item.cedula || ''
  formData.cargo = item.cargo || 'Funcionario Acuasan'
  formData.dependencia = item.dependencia || 'Operativa'
  formData.tipoPermiso = item.tipo || item.tipoPermiso || 'Compensatorio'
  formData.motivo = item.motivo || item.justificacion || ''
  formData.motivoManuscrito = item.motivoManuscrito || item.motivo || ''
  formData.observaciones = item.observaciones || formData.observaciones
  formData.id = item.id || ''
  formData.radicado = item.radicado || ''
  formData.createdAt = item.createdAt || ''
  formData.fechaPermisoTexto = `${item.dia} de ${todosLosMeses.find(m => m.mesNum === item.mesNum)?.nombre || 'Mes'} ${item.anio}`
  formData.horaDetalle = item.hora24 || item.duracion || '08:00'
  formData.horasCalculadas = item.duracion || ''
  // Los relojes toman las horas del horario guardado ("07:30 a 18:00 (10,5 horas)")
  // para que la alerta de jornada completa se derive sola al cargar el registro.
  const mHorasGuardadas = String(item.duracion || '').match(/(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})/)
  // padStart: "7:30" → "07:30", para que esJornadaCompleta compare bien
  horaInicioPermiso.value = mHorasGuardadas ? mHorasGuardadas[1].padStart(5, '0') : ''
  horaFinPermiso.value = mHorasGuardadas ? mHorasGuardadas[2].padStart(5, '0') : ''
  formData.fechaInicio = item.fechaInicio || item.fechaEntrega || `${String(item.dia).padStart(2, '0')}/${String(item.mesNum).padStart(2, '0')}/${item.anio}`
  formData.fechaFin = item.fechaFin || item.fechaInicio || item.fechaEntrega || `${String(item.dia).padStart(2, '0')}/${String(item.mesNum).padStart(2, '0')}/${item.anio}`

  // Configura el visor a partir de un Data URL (Base64)
  const mostrarDocumentoDesdeDataUrl = async (dataUrl) => {
    const mime = mimeDesdeDataUrl(dataUrl)
    aplicarTipoArchivoAlVisor(clasificarPorMime(mime, documentFileName.value), mime)
    customFileUrl.value = dataUrl
    if (isWordFile.value || isTextFile.value) {
      try {
        if (isTextFile.value) {
          textoDocumentoExtraido.value = new TextDecoder('utf-8').decode(base64ToUint8(dataUrl))
        } else {
          const mammoth = await import('mammoth')
          const arr = base64ToUint8(dataUrl)
          const arrayBuffer = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
          const resultado = await mammoth.extractRawText({ arrayBuffer })
          textoDocumentoExtraido.value = (resultado && resultado.value) ? resultado.value : ''
        }
      } catch (e) {
        console.warn('[Preview Extract Warning]', e)
        textoDocumentoExtraido.value = ''
      }
    } else {
      textoDocumentoExtraido.value = ''
    }
  }

  const limpiarVisor = () => {
    customFileUrl.value = ''
    aplicarTipoArchivoAlVisor({ esPdf: false, esWord: false, esTexto: false, esImagen: false })
    textoDocumentoExtraido.value = ''
  }

  const docUrl = item.archivoUrl || item.customFileUrl || item.soporteUrl || ''
  if (docUrl.startsWith('data:')) {
    await mostrarDocumentoDesdeDataUrl(docUrl)
  } else if (item.id) {
    // El listado ya no viaja con el Base64: se solicita el archivo original al backend
    try {
      const blobUrl = await permisosService.obtenerArchivoPermiso(item.id)
      const blob = await (await fetch(blobUrl)).blob()
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => resolve('')
        reader.readAsDataURL(blob)
      })
      URL.revokeObjectURL(blobUrl)
      if (dataUrl) {
        await mostrarDocumentoDesdeDataUrl(dataUrl)
      } else {
        limpiarVisor()
      }
    } catch (err) {
      console.warn('[cargarEnFormulario] No se pudo recuperar el archivo original:', err)
      limpiarVisor()
    }
  } else {
    limpiarVisor()
  }

  vistaActiva.value = 'formulario'
  lanzarAlertaBootstrap('info', 'Documento del Permiso Cargado', `Se visualiza el documento correspondiente a la solicitud #${item.radicado} (${item.funcionario}).`)
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
  if (e.key === 'acuasan_permisos_v2' || !e.key) {
    cargarHistorialDesdeBackend()
  }
}

onMounted(async () => {
  // Reintentar publicar permisos guardados sin conexión (pendientes de sincronización)
  try {
    await permisosService.sincronizarPendientes()
  } catch (e) { /* sin conexión */ }
  cargarHistorialDesdeBackend()
  window.addEventListener('storage', onStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageChange)
  // Liberar el worker de Tesseract al salir de la vista
  terminarWorkerOCR()
})

// Confirm and Send to Gerencia (Guardar en Base de Datos MongoDB & Formato 24h)
const confirmarYEnviar = async () => {
  if (!formData.nombreFuncionario || !formData.cedula) {
    lanzarAlertaBootstrap('warning', 'Sin Información', 'No hay ninguna solicitud cargada para enviar a Gerencia.')
    return
  }

  // Validación de campos que el OCR pudo dejar vacíos: se exigen explícitos,
  // así ningún permiso se radica con tipo o fecha heredados de un default.
  const pendientes = []
  if (!formData.fechaInicio) pendientes.push('Fecha del Permiso')
  if (!formData.tipoPermiso) pendientes.push('Tipo de Permiso')
  if (!String(formData.motivo || '').trim()) pendientes.push('Motivo')
  if (!String(formData.horasCalculadas || '').trim()) pendientes.push('Horario')
  if (pendientes.length) {
    lanzarAlertaBootstrap(
      'warning',
      'Campos pendientes',
      `Complete manualmente: ${pendientes.join(', ')}. El OCR no los pudo confirmar en el PDF.`,
      7000
    )
    return
  }

  // La máscara da la forma DD/MM/YYYY, pero se verifica que sea una fecha real
  // (evita radicar 31/02/2026 o 03/13/2026).
  if (!esFechaValida(formData.fechaInicio)) {
    lanzarAlertaBootstrap(
      'warning',
      'Fecha inválida',
      `La Fecha del Permiso "${formData.fechaInicio}" no es una fecha real. Verifique día y mes (formato DD/MM/YYYY).`,
      7000
    )
    return
  }

  // Validación: Evitar doble permiso el mismo día para el mismo funcionario
  const isDuplicate = historialRemisiones.value.some(p => {
    return p.cedula === formData.cedula && 
           (p.fechaInicio === formData.fechaInicio || p.fechaEntrega === formData.fechaInicio) &&
           p.id !== formData.id && 
           p.radicado !== formData.radicado
  })

  if (isDuplicate) {
    lanzarAlertaBootstrap(
      'danger', 
      'Permiso Duplicado', 
      `El funcionario ${formData.nombreFuncionario} ya tiene un permiso registrado para el día ${formData.fechaInicio}. No se puede tener más de un permiso el mismo día.`
    )
    return
  }

  isSubmitting.value = true
  try {
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
      // Sin default: la validación de pendientes ya exige este campo, y un
      // horario inventado radica horas que el documento no respalda.
      duracion: formData.horasCalculadas,
      // Marcador de jornada completa (horas = jornada del día): queda en el historial
      jornadaCompleta: esJornadaCompleta.value,
      hora24: hora24Actual,
      justificacion: formData.motivo,
      motivoManuscrito: formData.motivoManuscrito,
      observaciones: formData.observaciones,
      soporte: documentFileName.value || 'Permiso_Escaneado.pdf',
      archivoUrl: customFileUrl.value,
      isPdf: isPdfFile.value,
      archivoMimeType: archivoMimeType.value || mimeDesdeDataUrl(customFileUrl.value),
      // Confianza OCR real (campos confirmados en el PDF / campos clave).
      confianzaOCR: confianzaOcrReal.value,
      id: formData.id || undefined,
      radicado: formData.radicado || undefined,
      createdAt: formData.createdAt || undefined
    }

    // El servicio guarda en el backend (fuente de verdad) o, sin conexión,
    // deja un provisional local pendiente de sincronización (origen 'LOCAL').
    const nuevoRegistro = await permisosService.crearPermiso(payload)

    if (nuevoRegistro) {
      // Agregar al inicio evitando duplicados por radicado o id
      historialRemisiones.value = [
        nuevoRegistro,
        ...historialRemisiones.value.filter(r => r.id !== nuevoRegistro.id && r.radicado !== nuevoRegistro.radicado)
      ]
    }

    const nombreEnviado = formData.nombreFuncionario
    const radicadoGenerado = nuevoRegistro?.radicado || 'PERM'

    limpiarFormularioYVisor()

    if (nuevoRegistro && nuevoRegistro.origen === 'LOCAL') {
      const avisoArchivo = nuevoRegistro.archivoOmitido
        ? ' ATENCIÓN: el soporte escaneado no cupo en el almacenamiento local y NO se guardó; el permiso se publicará sin documento.'
        : ''
      lanzarAlertaBootstrap(
        'warning',
        'Guardado Local — Pendiente de Sincronización',
        `Sin conexión con el servidor: el permiso de ${nombreEnviado} quedó guardado en este equipo con radicado provisional #${radicadoGenerado}. Se publicará en la nube automáticamente cuando se restablezca la conexión.${avisoArchivo}`,
        8000
      )
    } else {
      lanzarAlertaBootstrap(
        'success',
        '¡Permiso Radicado y Publicado en la Base de Datos!',
        `Se radicó con éxito a las ${hora24Actual} hrs con Radicado #${radicadoGenerado} (${payload.tipo}) para ${nombreEnviado}. Gerencia lo verá al instante en su tablero. Formulario y visor listos para la siguiente solicitud.`,
        7500
      )
    }

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

/* ═══════════════════════════════════════════════════════════════════════════
   FORMULARIO DE RADICACIÓN — CAMPOS UNIFORMES Y SOBRIOS
   Bordes, foco y etiquetas consistentes en todo el formulario del permiso.
   ═══════════════════════════════════════════════════════════════════════════ */
.permiso-form .form-label {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #5c6770;
}

.permiso-form .input-group-text {
  background-color: #f6f8fa;
  border-color: #d9e0e6;
  color: #6c757d;
}

.permiso-form .form-control,
.permiso-form .form-select {
  border-color: #d9e0e6;
  color: #212529;
}

/* Foco sobrio en azul institucional (Acuasan #004884) */
.permiso-form .form-control:focus,
.permiso-form .form-select:focus {
  border-color: #004884;
  box-shadow: 0 0 0 0.2rem rgba(0, 72, 132, 0.12);
}

.permiso-form .form-control::placeholder {
  color: #adb5bd;
  font-weight: 400;
}

/* Relojes del permiso: dígitos tabulares y área de click cómoda */
.permiso-form input[type='time'] {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  cursor: pointer;
  min-height: 34px;
}

/* Avisos compactos del horario: píldoras, no alertas gigantes */
.aviso-horario {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.28rem 0.7rem;
  border-radius: 2rem;
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.15;
  max-width: 100%;
}

.aviso-jornada {
  background-color: #e7f4ec;
  border: 1px solid #bfe0cc;
  color: #14602f;
}

.aviso-fin-semana {
  background-color: #fdf6e3;
  border: 1px solid #f0dfae;
  color: #7a5d0b;
}
</style>
