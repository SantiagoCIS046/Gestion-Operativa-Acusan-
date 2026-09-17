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
      <!-- Top Action & KPI Header Compacto -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <!-- KPI Card Compacto -->
        <div class="card border shadow-sm rounded-2 px-2.5 py-1.5 bg-white d-flex flex-row align-items-center gap-2.5" style="border-color: #e2e8f0 !important;">
          <div class="badge bg-success-subtle text-success p-1.5 rounded-2 d-flex align-items-center justify-content-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <polyline points="9 15 12 18 17 13"></polyline>
            </svg>
          </div>
          <div class="d-flex flex-column">
            <div class="d-flex align-items-baseline gap-1.5">
              <span class="fw-bold text-primary lh-1" style="color: #004884 !important; font-size: 1.25rem;">
                {{ totalProcesadosEstaSemana }}
              </span>
              <span class="text-uppercase fw-bold text-muted" style="font-size: 0.62rem; letter-spacing: 0.4px;">
                PROCESADOS ESTA SEMANA (LUN - VIE)
              </span>
            </div>
            <span class="text-muted fw-semibold" style="font-size: 0.63rem;">
              {{ rangoSemanaActualTexto }}
            </span>
          </div>
        </div>

        <!-- Botones de Acción Compactos -->
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <!-- Button: Historial de Permisos (Plantilla Excel) -->
          <button
            type="button"
            class="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1.5 shadow-sm rounded-2 py-1 px-2.5"
            style="font-size: 0.77rem;"
            @click="vistaActiva = 'historial'"
            title="Ver plantilla de Excel y listado de entregas procesadas"
          >
            <span>📗</span>
            <span>Historial (Plantilla Excel)</span>
            <span class="badge bg-success text-white rounded-pill ms-1" style="font-size: 0.65rem; padding: 2px 5px;">{{ historialRemisiones.length }}</span>
          </button>
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
      <div class="row g-2">
        <!-- LEFT COLUMN: Visor del PDF / Archivo Original Real Escaneado (50% Parejo) -->
        <div class="col-lg-6 col-md-12">
          <div class="card border shadow-sm rounded-2 overflow-hidden h-100 d-flex flex-column" style="border-color: #e2e8f0 !important;">
            <!-- Header Toolbar -->
            <div class="card-header bg-light d-flex justify-content-between align-items-center py-1.5 px-3 border-bottom">
              <div class="d-flex align-items-center gap-1.5">
                <span class="fs-6">📄</span>
                <span class="fw-bold small text-dark text-truncate" style="max-width: 240px; font-size: 0.8rem;">
                  {{ documentLoaded ? documentFileName : 'Ningún documento cargado' }}
                </span>
              </div>

              <!-- BOTÓN ÚNICO SELECTOR DE ARCHIVO (Cargar o Reemplazar) -->
              <div>
                <label
                  @click="precalentarMotorOCR"
                  class="btn btn-sm btn-primary fw-bold d-inline-flex align-items-center gap-1.5 shadow-sm rounded-2 py-1 px-2.5 mb-0"
                  style="font-size: 0.77rem; background: linear-gradient(135deg, #004884 0%, #002f59 100%); border: 1px solid #002342; cursor: pointer;"
                  :title="documentLoaded ? 'Cambiar por otro documento PDF' : 'Seleccionar archivo PDF, Word, TXT o imagen del computador'"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>📂 Cargar PDF / Archivo</span>
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
            <div class="card-body p-0 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center overflow-auto flex-grow-1" style="min-height: 440px; max-height: 520px;">
              <!-- STATE A: NO DOCUMENT LOADED (WAITING FOR INSERTION) -->
              <div v-if="!documentLoaded" class="card border-0 shadow-sm p-3 text-center mx-auto my-auto rounded-3 bg-white" style="max-width: 310px;">
                <div class="mx-auto mb-2 d-flex align-items-center justify-content-center bg-primary-subtle border border-primary-subtle rounded-circle" style="width: 44px; height: 44px;">
                  <span class="fs-5">📄</span>
                </div>
                <h6 class="fw-bold mb-1 text-primary" style="color: #004884 !important; font-size: 0.88rem;">Sin documento cargado</h6>
                <p class="text-muted mb-0" style="font-size: 0.74rem; line-height: 1.35;">
                  Haz clic en <strong>📂 Cargar PDF / Archivo</strong> arriba para previsualizar el documento y extraer sus datos.
                </p>
              </div>

              <!-- STATE B: DOCUMENTO REAL ESCANEADO / PDF OCUPANDO TODO EL CUADRO -->
              <div v-else class="w-100 h-100 d-flex flex-column align-items-center p-0 gap-0">
                <!-- If it's a native PDF uploaded by user or loaded from history -->
                <object
                  v-if="isPdfFile && customFileUrl"
                  :data="displayFileUrl"
                  type="application/pdf"
                  class="w-100 rounded bg-white border-0 flex-grow-1"
                  style="min-height: 480px;"
                >
                  <iframe
                    :src="displayFileUrl"
                    class="w-100 h-100 border-0"
                    style="min-height: 480px;"
                    title="Visor PDF Original"
                  ></iframe>
                </object>

                <!-- If it's a Word document: panel with the extracted document text -->
                <div v-else-if="isWordFile && customFileUrl" class="w-100 h-100 bg-white overflow-auto p-2.5">
                  <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-1.5 border-bottom">
                    <div class="d-flex align-items-center gap-1.5">
                      <span class="badge bg-primary text-white" style="font-size: 0.68rem;">DOCX / Word</span>
                      <span class="text-muted small text-truncate" style="font-size: 0.75rem;">{{ documentFileName }}</span>
                    </div>
                    <a :href="displayFileUrl" :download="documentFileName" class="btn btn-sm btn-outline-primary fw-semibold py-0.5 px-2" style="font-size: 0.72rem;">Descargar</a>
                  </div>
                  <pre class="mb-0 small text-dark" style="white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 0.75rem;">{{ textoDocumentoExtraido || 'No se pudo extraer el texto del documento Word. Verifique que sea un archivo .docx valido.' }}</pre>
                </div>

                <!-- If it's a plain text file -->
                <div v-else-if="isTextFile && customFileUrl" class="w-100 h-100 bg-white overflow-auto p-2.5">
                  <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-1.5 border-bottom">
                    <div class="d-flex align-items-center gap-1.5">
                      <span class="badge bg-secondary text-white" style="font-size: 0.68rem;">TXT / Texto</span>
                      <span class="text-muted small text-truncate" style="font-size: 0.75rem;">{{ documentFileName }}</span>
                    </div>
                    <a :href="displayFileUrl" :download="documentFileName" class="btn btn-sm btn-outline-primary fw-semibold py-0.5 px-2" style="font-size: 0.72rem;">Descargar</a>
                  </div>
                  <pre class="mb-0 small text-dark" style="white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 0.75rem;">{{ textoDocumentoExtraido }}</pre>
                </div>

                <!-- If user uploaded a custom image from PC -->
                <div v-else-if="customFileUrl && !isPdfFile" class="w-100 text-center p-2">
                  <img
                    :src="displayFileUrl"
                    alt="Documento Original Escaneado"
                    class="img-fluid rounded shadow bg-white border"
                    style="max-width: 100%; max-height: 480px; object-fit: contain;"
                  />
                </div>

                <!-- Fallback: En caso de no tener archivo binario -->
                <div v-else class="w-100 text-center p-3 my-auto">
                  <span class="fs-2 d-block mb-1">📄</span>
                  <h6 class="fw-bold text-dark mb-1" style="font-size: 0.85rem;">{{ documentFileName }}</h6>
                  <p class="text-muted mb-0" style="font-size: 0.73rem;">El archivo se encuentra registrado en el sistema.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Formulario con Todos los Campos de Texto Estilo Bootstrap (50% Parejo) -->
        <div class="col-lg-6 col-md-12">
          <div class="card border shadow-sm rounded-2" style="border-color: #e2e8f0 !important;">
            <div class="card-header bg-white py-2 px-3 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-0.5">
                <h6 class="fw-bold text-primary m-0" style="color: #004884 !important; font-size: 0.88rem;">
                  Revisión de Datos (OCR)
                </h6>
                <span v-if="isScanningOCR" class="badge bg-info-subtle text-info border border-info-subtle px-2 py-0.5" style="font-size: 0.68rem;">
                  ⏳ Extrayendo datos...
                </span>
                <span v-else-if="documentLoaded" :class="['badge px-2 py-0.5 border', claseConfianzaOcr]" style="font-size: 0.68rem;">
                  {{ textoConfianzaOcr }}
                </span>
                <span v-else class="badge bg-secondary-subtle text-secondary border px-2 py-0.5" style="font-size: 0.68rem;">
                  ⏳ Esperando Documento
                </span>
              </div>
              <p class="text-muted mb-0" style="font-size: 0.7rem;">
                Revise y rectifique los datos extraídos antes de confirmar la radicación.
              </p>
            </div>

            <div class="card-body p-2.5">
              <form class="permiso-form" @submit.prevent="confirmarYEnviar">
                <!-- SECTION 1: INFORMACIÓN DEL TRABAJADOR -->
                <div class="d-flex align-items-center mb-1.5 pb-1 border-bottom">
                  <div class="bg-success rounded" style="width: 3px; height: 12px; margin-right: 6px; flex-shrink: 0;"></div>
                  <span class="text-uppercase fw-bold text-primary" style="font-size: 0.68rem; letter-spacing: 0.3px;">
                    INFORMACIÓN DEL TRABAJADOR (SOLICITANTE)
                  </span>
                </div>

                <div class="row g-2 mb-1.5" style="padding-top: 4px;">
                  <div class="col-7">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Nombre Completo del Trabajador</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted py-0.5 px-2" style="font-size: 0.75rem;">👤</span>
                      <input
                        v-model="formData.nombreFuncionario"
                        type="text"
                        class="form-control form-control-sm fw-bold py-1"
                        style="font-size: 0.78rem;"
                        placeholder="Esperando documento escaneado..."
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>

                  <div class="col-5">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Cédula / Documento</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted py-0.5 px-2" style="font-size: 0.75rem;">🪪</span>
                      <input
                        v-model="formData.cedula"
                        type="text"
                        class="form-control form-control-sm py-1"
                        style="font-size: 0.78rem;"
                        placeholder="Número de cédula"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div class="row g-2 mb-2">
                  <div class="col-6">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Cargo</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted py-0.5 px-2" style="font-size: 0.75rem;">💼</span>
                      <input
                        v-model="formData.cargo"
                        type="text"
                        class="form-control form-control-sm py-1"
                        style="font-size: 0.78rem;"
                        placeholder="Cargo del funcionario"
                        :disabled="!documentLoaded"
                      />
                    </div>
                  </div>

                  <div class="col-6">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Área / Dependencia</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted py-0.5 px-2" style="font-size: 0.75rem;">🏢</span>
                      <input
                        v-model="formData.dependencia"
                        type="text"
                        class="form-control form-control-sm py-1"
                        style="font-size: 0.78rem;"
                        placeholder="Área u operativa"
                        :disabled="!documentLoaded"
                      />
                    </div>
                  </div>
                </div>

                <!-- SECTION 2: DETALLES DEL PERMISO LABORAL -->
                <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom" style="margin-top: 12px;">
                  <div class="d-flex align-items-center">
                    <div class="bg-success rounded" style="width: 3px; height: 12px; margin-right: 6px; flex-shrink: 0;"></div>
                    <span class="text-uppercase fw-bold text-primary" style="font-size: 0.68rem; letter-spacing: 0.3px;">
                      DETALLES DEL PERMISO LABORAL
                    </span>
                  </div>
                  <!-- Aviso de Jornada / Fin de semana integrado discretamente en la cabecera -->
                  <div v-if="esJornadaCompleta" class="badge bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5" style="font-size: 0.67rem;" :title="tituloJornadaBoton">
                    ✓ Jornada completa ({{ textoJornadaResumen }})
                  </div>
                  <div v-else-if="esFinDeSemana" class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-1.5 py-0.5" style="font-size: 0.67rem;" title="En fin de semana solo labora personal en horas extras: registre el horario con los relojes.">
                    ⚠ Fin de semana (Horas extras)
                  </div>
                </div>

                <!-- Fila de 3 columnas estrictamente al mismo nivel (Fecha, Hora Inicio, Hora Fin) -->
                <div class="row g-2 flex-nowrap align-items-start mb-1.5" style="padding-top: 4px;">
                  <div class="col-4" style="min-width: 0;">
                    <label class="form-label mb-0.5 fw-semibold text-secondary d-block text-truncate" style="font-size: 0.7rem; line-height: 1.2; height: 16px;" title="Fecha del permiso">
                      Fecha <span class="text-muted fw-normal" style="font-size: 0.61rem;">(DD/MM/AAAA)</span>
                    </label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted px-1.5 py-0" style="font-size: 0.72rem; height: 28px;">📅</span>
                      <input
                        v-model="formData.fechaInicio"
                        @input="escribirFechaInput($event, 'fechaInicio')"
                        @blur="completarAnioFechaInput($event, 'fechaInicio')"
                        type="text"
                        inputmode="numeric"
                        maxlength="10"
                        class="form-control form-control-sm fw-bold px-1.5 py-0"
                        style="font-size: 0.75rem; height: 28px;"
                        placeholder="DD/MM/YYYY"
                        :disabled="!documentLoaded"
                        required
                      />
                    </div>
                  </div>

                  <div class="col-4" style="min-width: 0;">
                    <label for="horaInicioPermiso" class="form-label mb-0.5 fw-semibold text-secondary d-block text-truncate" style="font-size: 0.7rem; line-height: 1.2; height: 16px;" title="Hora de inicio">
                      Hora Inicio
                    </label>
                    <input
                      id="horaInicioPermiso"
                      v-model="horaInicioPermiso"
                      @change="construirHorario"
                      type="time"
                      class="form-control form-control-sm text-center fw-bold px-1 py-0"
                      style="font-size: 0.74rem; height: 28px;"
                      :disabled="!documentLoaded"
                    />
                  </div>

                  <div class="col-4" style="min-width: 0;">
                    <label for="horaFinPermiso" class="form-label mb-0.5 fw-semibold text-secondary d-block text-truncate" style="font-size: 0.7rem; line-height: 1.2; height: 16px;" title="Hora de fin">
                      Hora Fin
                    </label>
                    <input
                      id="horaFinPermiso"
                      v-model="horaFinPermiso"
                      @change="construirHorario"
                      type="time"
                      class="form-control form-control-sm text-center fw-bold px-1 py-0"
                      style="font-size: 0.74rem; height: 28px;"
                      :disabled="!documentLoaded"
                    />
                  </div>
                </div>

                <div class="row g-2 mb-2" style="margin-top: 4px;">
                  <div class="col-6">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Tipo de Permiso</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light text-muted py-0.5 px-2" style="font-size: 0.75rem;">📋</span>
                      <select
                        v-model="formData.tipoPermiso"
                        class="form-select form-select-sm fw-bold py-1"
                        style="font-size: 0.78rem;"
                        :disabled="!documentLoaded"
                      >
                        <option value="" disabled>Seleccione...</option>
                        <option value="Compensatorio">Compensatorio</option>
                        <option value="Cita Médica">Cita Médica</option>
                        <option value="Personal">Personal / Asunto Propio</option>
                        <option value="Calamidad Doméstica">Calamidad Doméstica</option>
                        <option value="Estudio / Capacitación">Estudio / Capacitación</option>
                      </select>
                    </div>
                  </div>

                  <div class="col-6">
                    <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Vo.Bo. Jefe Inmediato</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-success-subtle text-success py-0.5 px-2" style="font-size: 0.72rem;">✔</span>
                      <input
                        type="text"
                        class="form-control form-control-sm bg-light text-success fw-bold py-1"
                        style="font-size: 0.78rem;"
                        :value="documentLoaded ? 'Firmado en Solicitud' : 'Pendiente'"
                        disabled
                      />
                    </div>
                  </div>
                </div>

                <!-- SECTION 3: MOTIVO Y OBSERVACIONES -->
                <div class="mb-2" style="margin-top: 8px;">
                  <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Motivo y Justificación Extraída</label>
                  <textarea
                    v-model="formData.motivo"
                    rows="2"
                    class="form-control form-control-sm py-1"
                    style="font-size: 0.78rem;"
                    placeholder="El motivo escrito en la solicitud aparecerá aquí..."
                    :disabled="!documentLoaded"
                    required
                  ></textarea>
                </div>

                <div class="mb-2">
                  <label class="form-label mb-0.5 fw-semibold text-secondary" style="font-size: 0.71rem;">Observaciones (Opcional)</label>
                  <textarea
                    v-model="formData.observaciones"
                    rows="1"
                    class="form-control form-control-sm py-1"
                    style="font-size: 0.78rem;"
                    placeholder="Observación o nota adicional..."
                    :disabled="!documentLoaded"
                  ></textarea>
                </div>

                <!-- Action Buttons with Bootstrap Classes -->
                <div class="d-flex justify-content-between align-items-center pt-2 border-top gap-2">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm px-2.5 py-1"
                    style="font-size: 0.76rem;"
                    @click="abrirModalRechazo"
                    :disabled="!documentLoaded"
                  >
                    Rechazar
                  </button>

                  <button
                    type="submit"
                    class="btn btn-primary btn-sm fw-bold px-3 py-1 d-inline-flex align-items-center gap-1.5 shadow-sm"
                    style="background: linear-gradient(180deg, #004884 0%, #002d57 100%); border-color: #002040; font-size: 0.76rem;"
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
                          'btn btn-sm p-0 rounded position-relative btn-cal-dia',
                          esDiaHoy(dia) ? 'cal-dia-hoy' : '',
                          dia === diaPermisoUsuario ? 'cal-dia-permiso-usuario' : '',
                          diaSeleccionado === dia
                            ? 'btn-primary text-white fw-bold shadow-sm'
                            : (contarRegistrosPorDia(dia) > 0
                                ? 'btn-info-subtle border border-info text-dark fw-bold'
                                : (dia === diaPermisoUsuario ? 'btn-warning-subtle border border-warning text-dark fw-bold' : 'btn-light text-dark'))
                        ]"
                        style="height: 30px; font-size: 0.76rem;"
                        @click="seleccionarDia(dia)"
                        :title="construirTooltipDia(dia)"
                      >
                        {{ dia }}

                        <!-- Pin indicador de día del permiso del funcionario cargado en formulario -->
                        <span
                          v-if="dia === diaPermisoUsuario && diaSeleccionado !== dia"
                          class="position-absolute top-0 start-0 translate-middle-y badge rounded-pill bg-success"
                          style="font-size: 0.48rem; padding: 1px 3px; z-index: 3;"
                          title="Día de la solicitud de permiso activa"
                        >
                          📌
                        </span>

                        <!-- Badge contador de permisos registrados en este día -->
                        <span
                          v-if="contarRegistrosPorDia(dia) > 0 && diaSeleccionado !== dia"
                          class="position-absolute top-0 end-0 translate-middle-y badge rounded-pill bg-danger"
                          style="font-size: 0.5rem; padding: 2px 4px; z-index: 3;"
                          :title="`${contarRegistrosPorDia(dia)} permiso(s) registrados`"
                        >
                          {{ contarRegistrosPorDia(dia) }}
                        </span>

                        <!-- Punto indicador exclusivo de HOY (sin afectar color de fondo ni badges de permisos) -->
                        <span
                          v-if="esDiaHoy(dia)"
                          class="indicador-hoy-dot"
                        ></span>
                      </button>
                    </div>

                    <!-- Leyenda institucional de señalización y acceso rápido a Hoy -->
                    <div class="cal-legend d-flex justify-content-between align-items-center py-1 px-1 mb-1 border-top border-bottom" style="font-size: 0.67rem; color: #64748b;">
                      <div class="d-flex align-items-center gap-2">
                        <span class="d-inline-flex align-items-center gap-1" title="Día actual en el que estamos">
                          <span class="legend-ring-hoy"></span> <strong>Hoy</strong>
                        </span>
                        <span class="d-inline-flex align-items-center gap-1" title="Días con permisos de funcionarios">
                          <span class="legend-badge-perm">#</span> Permisos
                        </span>
                        <span v-if="diaPermisoUsuario" class="d-inline-flex align-items-center gap-1 text-success fw-semibold" title="Permiso del funcionario en el formulario">
                          <span class="legend-pin-func">📌</span> Solicitud
                        </span>
                      </div>
                      <button
                        type="button"
                        class="btn btn-link btn-sm p-0 text-decoration-none fw-bold text-primary"
                        style="font-size: 0.67rem;"
                        @click="irAHoy"
                        title="Ir a la fecha actual"
                      >
                        Ir a Hoy
                      </button>
                    </div>

                    <!-- Footer acciones del cronograma -->
                    <div class="d-flex flex-column gap-2 pt-1">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-success w-100 py-1 small fw-bold"
                        @click="mesNumSeleccionado = null; diaSeleccionado = null; mostrarCalendario = false"
                      >
                        📋 Ver Todos los Meses (Historial Completo)
                      </button>
                      <div class="d-flex justify-content-between align-items-center">
                        <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none small text-primary fw-bold" @click="seleccionarTodoElMes">
                          Ver mes completo
                        </button>
                        <button type="button" class="btn btn-sm btn-primary py-1 px-3 fw-bold rounded-2" @click="mostrarCalendario = false">
                          Listo
                        </button>
                      </div>
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
                  :class="['excel-row', { 'excel-row-empty': fila.esVacia, 'table-hover-row': !fila.esVacia }]"
                  @click="!fila.esVacia && cargarEnFormulario(fila)"
                  :style="!fila.esVacia ? 'cursor: pointer;' : ''"
                  :title="!fila.esVacia ? 'Haga clic para cargar este permiso en el formulario y ver su documento' : ''"
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
                          @click.stop="cargarEnFormulario(fila)"
                          title="Cargar y ver el documento en el formulario"
                        >
                          📂 Cargar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-danger py-0 px-2 fw-semibold"
                          style="font-size: 0.72rem;"
                          @click.stop="confirmarEliminarPermiso(fila)"
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
import adjuntosOffline from '../../../services/adjuntosOffline.js'
import precalentarMotorOCR from '../../../services/ocrWarmup.service.js'
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
  if (mesNumSeleccionado.value === null) {
    return 'Todos los Meses'
  }
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

// ─── HORARIO DEL PERMISO — JORNADAS LABORALES INSTITUCIONALES ACUASAN ────────
// Lunes a Jueves: 7:30 a.m. a 12:00 m. y 2:00 p.m. a 6:00 p.m. (8.5 horas)
// Viernes: 7:30 a.m. a 12:00 m. y 2:00 p.m. a 5:30 p.m. (8 horas)
// Sábados y domingos: No hay jornada regular (solo horas extras manuales).
const JORNADAS_ACUASAN = {
  lunesAJueves: {
    inicio: '07:30',
    fin: '18:00',
    horas: 8.5,
    descripcionCorta: 'Lun-Jue: 7:30 a.m. - 12:00 m. / 2:00 p.m. - 6:00 p.m. (8.5h)',
    descripcionDetallada: '7:30 a.m. a 12:00 p.m. y 2:00 p.m. a 6:00 p.m. (8.5 horas)'
  },
  viernes: {
    inicio: '07:30',
    fin: '17:30',
    horas: 8.0,
    descripcionCorta: 'Viernes: 7:30 a.m. - 12:00 m. / 2:00 p.m. - 5:30 p.m. (8h)',
    descripcionDetallada: '7:30 a.m. a 12:00 p.m. y 2:00 p.m. a 5:30 p.m. (8 horas)'
  },
}
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Relojes del permiso: hora de inicio y hora de fin
const horaInicioPermiso = ref('')
const horaFinPermiso = ref('')

// Día de la semana (0=domingo … 6=sábado) de una fecha DD/MM/YYYY válida
const diaSemanaDeFecha = (textoFecha) => {
  if (!esFechaValida(textoFecha)) return null
  const m = String(textoFecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
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
  if (dia === null || dia === 0 || dia === 6) {
    return horaInicioPermiso.value === '07:30' && (horaFinPermiso.value === '18:00' || horaFinPermiso.value === '17:30')
  }
  const j = dia === 5 ? JORNADAS_ACUASAN.viernes : JORNADAS_ACUASAN.lunesAJueves
  return horaInicioPermiso.value === j.inicio && horaFinPermiso.value === j.fin
})

// Texto descriptivo detallado de la jornada completa según el día
const textoJornadaResumen = computed(() => {
  const dia = diaSemanaDeFecha(formData.fechaInicio)
  if (dia === 5) {
    return JORNADAS_ACUASAN.viernes.descripcionCorta
  }
  return JORNADAS_ACUASAN.lunesAJueves.descripcionCorta
})

// Referencia institucional completa
const tituloJornadaBoton =
  'Jornada laboral Acuasan: Lunes a Jueves de 7:30 a.m. a 12:00 m. y 2:00 p.m. a 6:00 p.m. (8.5h) · Viernes de 7:30 a.m. a 12:00 m. y 2:00 p.m. a 5:30 p.m. (8h).'

const minutosDeHora = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Aplica automáticamente la jornada completa institucional según el día de la semana
const aplicarJornadaCompletaSegunFecha = (fecha = formData.fechaInicio) => {
  const dia = diaSemanaDeFecha(fecha)
  if (dia === 5) {
    horaInicioPermiso.value = JORNADAS_ACUASAN.viernes.inicio
    horaFinPermiso.value = JORNADAS_ACUASAN.viernes.fin
    formData.horasCalculadas = JORNADAS_ACUASAN.viernes.descripcionDetallada
  } else {
    horaInicioPermiso.value = JORNADAS_ACUASAN.lunesAJueves.inicio
    horaFinPermiso.value = JORNADAS_ACUASAN.lunesAJueves.fin
    formData.horasCalculadas = JORNADAS_ACUASAN.lunesAJueves.descripcionDetallada
  }
  formData.horaDetalle = formData.horasCalculadas
}

// Construye formData.horasCalculadas a partir de los relojes
const construirHorario = () => {
  const ini = minutosDeHora(horaInicioPermiso.value)
  const fin = minutosDeHora(horaFinPermiso.value)
  if (ini === null || fin === null || fin <= ini) return

  const dia = diaSemanaDeFecha(formData.fechaInicio)
  if (esJornadaCompleta.value) {
    if (dia === 5) {
      formData.horasCalculadas = JORNADAS_ACUASAN.viernes.descripcionDetallada
    } else {
      formData.horasCalculadas = JORNADAS_ACUASAN.lunesAJueves.descripcionDetallada
    }
    formData.horaDetalle = formData.horasCalculadas
    return
  }

  const horas = (fin - ini) / 60
  const horasTexto = Number.isInteger(horas) ? String(horas) : horas.toFixed(1).replace('.', ',')
  formData.horasCalculadas = `${horaInicioPermiso.value} a ${horaFinPermiso.value} (${horasTexto} horas)`
  formData.horaDetalle = formData.horasCalculadas
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

// 📅 Detección exacta de HOY (el día en el que estamos)
const esDiaHoy = (dia) => {
  return dia === diaActual &&
         mesNumSeleccionado.value === mesActual &&
         anioSeleccionado.value === anioActual
}

// 📅 Detección del día de permiso del funcionario que está activo en el formulario OCR/Verificación
const diaPermisoUsuario = computed(() => {
  if (!formData.fechaInicio) return null
  const str = String(formData.fechaInicio).trim().split(' ')[0]
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const a = parseInt(parts[2], 10)
      if (a === anioSeleccionado.value && m === mesNumSeleccionado.value) return d
    }
  } else if (str.includes('-')) {
    const parts = str.split('-')
    if (parts.length >= 3) {
      const a = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const d = parseInt(parts[2], 10)
      if (a === anioSeleccionado.value && m === mesNumSeleccionado.value) return d
    }
  }
  return null
})

// Función para ir directamente al periodo actual (Hoy)
const irAHoy = () => {
  anioSeleccionado.value = anioActual
  mesNumSeleccionado.value = mesActual
  diaSeleccionado.value = diaActual
}

// Tooltip informativo descriptivo por día
const construirTooltipDia = (dia) => {
  const partes = []
  if (esDiaHoy(dia)) partes.push('Hoy (Día en el que estamos)')
  if (dia === diaPermisoUsuario.value) partes.push(`Solicitud activa de ${formData.nombreFuncionario || 'este funcionario'}`)
  const cant = contarRegistrosPorDia(dia)
  if (cant > 0) partes.push(`${cant} permiso(s) en historial`)
  return partes.length > 0 ? partes.join(' • ') : `Día ${dia}`
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

    const coincideAnio = anioSeleccionado.value === null || item.anio === anioSeleccionado.value
    const coincideMes = mesNumSeleccionado.value === null || item.mesNum === mesNumSeleccionado.value
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

// Mejora de imagen para OCR: escala de grises + stretch de histograma y,
// solo cuando el escaneo tiene muchos tonos medios (letra borrosa, fondo
// sucio), una binarización Otsu que afila el borde de la tinta. En imágenes
// limpias (render digital nítido) no se binariza: el antialiasing ayuda.
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

  // ─── Binarización Otsu condicional ───
  // Umbral óptimo por varianza entre clases; se aplica únicamente si más del
  // 25% de los píxeles quedaron en la zona media del histograma (escaneo
  // borroso). Un documento nítido es casi blanco/negro puro y se respeta.
  const total = Math.floor(px.length / 4)
  const hist = new Array(256).fill(0)
  for (let i = 0; i < px.length; i += 4) hist[px[i]]++
  let sumaTotal = 0
  for (let t = 0; t < 256; t++) sumaTotal += t * hist[t]
  let sumaB = 0, pesoB = 0, maxVar = -1, umbral = 128
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t]
    if (pesoB === 0) continue
    const pesoF = total - pesoB
    if (pesoF === 0) break
    sumaB += t * hist[t]
    const mB = sumaB / pesoB
    const mF = (sumaTotal - sumaB) / pesoF
    const varianza = pesoB * pesoF * (mB - mF) * (mB - mF)
    if (varianza > maxVar) { maxVar = varianza; umbral = t }
  }
  let zonaMedia = 0
  for (let t = 51; t < 204; t++) zonaMedia += hist[t]
  if (total > 0 && zonaMedia / total > 0.25) {
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i] <= umbral ? 0 : 255
      px[i] = px[i+1] = px[i+2] = v
    }
  }

  ctx.putImageData(d, 0, 0)
  return out
}

// Normalizar texto OCR y parsear los campos del permiso: el motor completo
// vive en el paquete Python del backend (acuusan_ocr), invocado desde
// handleScannedFileUpload vía /api/ocr/escanear. La regla de oro se
// mantiene: «el dato sale del documento o el campo queda vacío» — nunca se
// inventa un valor.

// Aplicar campos al formulario Vue
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
  if (campos.jornadaCompleta && campos.fechaInicio) {
    // El documento marca jornada completa: la jornada real depende del día de
    // la semana de la fecha extraída (el viernes termina 5:30 p.m., no 6:00).
    // fechaInicio ya quedó asignado unas líneas arriba.
    aplicarJornadaCompletaSegunFecha(campos.fechaInicio)
  } else if (campos.horaInicio && campos.horaFin) {
    horaInicioPermiso.value = campos.horaInicio
    horaFinPermiso.value = campos.horaFin
    construirHorario()
  } else {
    reiniciarHorarioPermiso()
  }
  formData.motivo = campos.motivo || ''
  formData.motivoManuscrito = campos.motivo || ''
  formData.observaciones = campos.observaciones || ''
}

// Singleton de pdfjs para lectura de permisos
let pdfjsCacheEncargado = null
const getPdfjsEncargado = async () => {
  if (pdfjsCacheEncargado) return pdfjsCacheEncargado
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const m = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = m.default
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    }
  }
  pdfjsCacheEncargado = pdfjs
  return pdfjs
}

// Extracción espacial estructurada de texto respetando líneas y columnas
const extraerTextoPaginaEncargado = async (page) => {
  const content = await page.getTextContent({ includeMarkedContent: false })
  const viewport = page.getViewport({ scale: 1 })
  const altoPagina = viewport.height

  const items = content.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: altoPagina - it.transform[5],
      ancho: it.width || 0,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  if (!items.length) return ''

  const lineas = []
  let lineaActual = [items[0]]
  let yRef = items[0].y

  for (let i = 1; i < items.length; i++) {
    const it = items[i]
    if (Math.abs(it.y - yRef) <= 4) {
      lineaActual.push(it)
    } else {
      lineas.push(lineaActual.sort((a, b) => a.x - b.x))
      lineaActual = [it]
      yRef = it.y
    }
  }
  if (lineaActual.length) lineas.push(lineaActual.sort((a, b) => a.x - b.x))

  return lineas
    .map((linea) => {
      let resultado = ''
      for (let i = 0; i < linea.length; i++) {
        if (i === 0) {
          resultado = linea[i].str
        } else {
          const prev = linea[i - 1]
          const gap = linea[i].x - (prev.x + prev.ancho)
          resultado += (gap > 8 ? '  ' : ' ') + linea[i].str
        }
      }
      return resultado.trimEnd()
    })
    .filter((l) => l.trim())
    .join('\n')
}

// 🎯 CARGA DE ARCHIVO ESCANEADO — motor OCR Python: al seleccionar el
// documento se envía el ORIGINAL al backend (que lo reenvía al servicio
// Python con preprocesado de borrosos + multi-pase Tesseract + parser de
// permisos). Si el motor no está disponible, el formulario queda manual
// como siempre: aviso informativo, nunca un error.
let tokenEscaneoOcr = 0

const handleScannedFileUpload = async (e) => {
  const file = e.target.files[0]
  if (e && e.target) e.target.value = ''
  if (!file) return
  precalentarMotorOCR()
  const token = ++tokenEscaneoOcr

  resetFormData()
  const tipoArchivo = detectarTipoArchivo(file)
  aplicarTipoArchivoAlVisor(tipoArchivo, file.type || '')
  textoDocumentoExtraido.value = ''

  documentFileName.value = file.name
  documentLoaded.value = true
  isScanningOCR.value = false
  ocrProgress.value = 0
  ocrStepMessage.value = ''
  confianzaOcrReal.value = 0
  camposFaltantesOcr.value = []

  const reader = new FileReader()
  reader.onload = async (event) => {
    customFileUrl.value = event.target.result

    // Solo PDFs e imágenes van al motor Python; .docx/.txt siguen su flujo
    const esPdfOImagen = (file.type || '').startsWith('application/pdf') || (file.type || '').startsWith('image/')
    if (!esPdfOImagen) return

    isScanningOCR.value = true
    ocrProgress.value = 15
    ocrStepMessage.value = 'Enviando al motor Python…'
    let falloOcr = false
    // El progreso real del motor no es observable desde el cliente: este
    // avance lento (35→80, +1 cada 7 s) solo señala vida — un permiso
    // escaneado tarda ~3 min por página en el motor remoto.
    const avanceLento = setInterval(() => {
      if (token === tokenEscaneoOcr && ocrProgress.value < 80) ocrProgress.value += 1
    }, 7000)
    try {
      ocrProgress.value = 35
      ocrStepMessage.value = 'Motor Python leyendo el documento… (puede tardar unos minutos)'
      const escaneo = await permisosService.escanearDocumento(event.target.result, file.name, file.type || 'application/pdf')
      if (token !== tokenEscaneoOcr) return
      ocrProgress.value = 85
      ocrStepMessage.value = 'Interpretando los datos del permiso…'
      aplicarCampos(escaneo.campos || {})
      confianzaOcrReal.value = Number(escaneo.confianza) || 0
      camposFaltantesOcr.value = Array.isArray(escaneo.faltantes) ? escaneo.faltantes : []
      if (escaneo.texto) textoDocumentoExtraido.value = escaneo.texto
      ocrProgress.value = 100
      ocrStepMessage.value = `Lectura completa (${escaneo.metodo})`
    } catch (err) {
      if (token !== tokenEscaneoOcr) return
      falloOcr = true
      console.info('[OCR] Falló el escaneo con el motor Python:', err?.status || '', err?.codigo || '', err?.message)
      // El motivo real, no un mensaje genérico: peso, espera agotada u otro.
      if (err?.status === 413) {
        ocrStepMessage.value = 'Documento demasiado pesado para el servidor (máx ~3 MB) — comprima el PDF y reintente'
      } else if (err?.status === 504 || err?.codigo === 'no-disponible') {
        ocrStepMessage.value = 'El motor tardó más de la espera máxima — reintente o diligencie manualmente'
      } else {
        ocrStepMessage.value = err?.message || 'Motor Python no disponible — diligencie manualmente'
      }
    } finally {
      clearInterval(avanceLento)
      if (token === tokenEscaneoOcr) {
        // El panel de progreso se recogé un instante después para que el
        // 100% sea visible; si falló, se deja 7 s para leer el motivo.
        // Una re-selección lo cancela.
        setTimeout(() => {
          if (token === tokenEscaneoOcr) isScanningOCR.value = false
        }, falloOcr ? 7000 : 600)
      }
    }
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
  // Estricto como los demás 11 campos: la observación del registro cargado o
  // vacío — conservar la de un escaneo anterior contaminaría este registro al
  // guardar (el "|| formData.observaciones" anterior dejaba pasar la del PDF
  // previo cuando el historial viene sin observaciones).
  formData.observaciones = item.observaciones || ''
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
  } else if (item.sincronizado === false && item.archivoEnIndexedDB) {
    // Adjunto grande resguardado en IndexedDB (no cupo en localStorage)
    const adj = await adjuntosOffline.obtenerAdjunto(item.idLocal || String(item.id))
    if (adj && adj.dataUrl) {
      await mostrarDocumentoDesdeDataUrl(adj.dataUrl)
    } else {
      limpiarVisor()
    }
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

    // Si el mes actualmente seleccionado no tiene registros pero hay registros en otros periodos,
    // ajustar automáticamente al mes con registros para que la tabla muestre los datos de inmediato
    if (historialRemisiones.value.length > 0 && mesNumSeleccionado.value !== null) {
      const itemsNormalizados = historialRemisiones.value.map(normalizarItem).filter(Boolean)
      const hayEnMesActual = itemsNormalizados.some(
        it => (anioSeleccionado.value === null || it.anio === anioSeleccionado.value) && it.mesNum === mesNumSeleccionado.value
      )
      if (!hayEnMesActual) {
        const primerItem = itemsNormalizados[0]
        if (primerItem && primerItem.mesNum) {
          anioSeleccionado.value = primerItem.anio || anioActual
          mesNumSeleccionado.value = primerItem.mesNum
        }
      }
    }
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

/* 📅 Estilos del Calendario y Señalización de Hoy / Permisos */
.btn-cal-dia {
  height: 30px !important;
  font-size: 0.76rem !important;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-cal-dia:hover {
  filter: brightness(0.95);
  transform: scale(1.04);
  z-index: 2;
}

/* Señalización destacada de HOY (el día en el que estamos) */
.cal-dia-hoy {
  outline: 2px solid #004884 !important;
  outline-offset: -1px;
  font-weight: 800 !important;
  position: relative;
}
.cal-dia-hoy:not(.btn-primary):not(.btn-info-subtle):not(.btn-warning-subtle) {
  background-color: #f0f7ff !important;
  color: #004884 !important;
}
.cal-dia-hoy.btn-primary {
  outline: 2px solid #38bdf8 !important;
  outline-offset: -2px;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.35) !important;
}

/* Indicador de punto inferior exclusivo de HOY (coexiste con badges y colores de permiso) */
.indicador-hoy-dot {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #004884;
  pointer-events: none;
}
.btn-primary .indicador-hoy-dot {
  background: #ffffff;
}
.btn-info-subtle .indicador-hoy-dot {
  background: #0284c7;
}
.btn-warning-subtle .indicador-hoy-dot {
  background: #d97706;
}

/* Señalización del día de permiso del usuario cargado en el formulario */
.cal-dia-permiso-usuario:not(.btn-primary):not(.btn-info-subtle) {
  background-color: #fef3c7 !important;
  border-color: #f59e0b !important;
  color: #78350f !important;
  font-weight: 800 !important;
}

/* Leyenda del calendario */
.legend-ring-hoy {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  border: 2px solid #004884;
  background: #f0f7ff;
  display: inline-block;
}
.legend-badge-perm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #dc3545;
  color: #ffffff;
  font-size: 0.5rem;
  font-weight: 700;
}
.legend-pin-func {
  font-size: 0.72rem;
  line-height: 1;
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

/* Relojes del permiso: dígitos tabulares, compactos y perfectamente nivelados a 28px */
.permiso-form input[type='time'] {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  cursor: pointer;
  height: 28px !important;
  min-height: 28px !important;
  font-size: 0.74rem !important;
  padding: 2px 6px !important;
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
