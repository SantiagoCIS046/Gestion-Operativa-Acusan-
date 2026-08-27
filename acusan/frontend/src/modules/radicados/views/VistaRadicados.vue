<template>
  <div class="radicados-container">
    <!-- ═══════════════ HEADER & ACCIONES ═══════════════ -->
    <div class="radicados-header">
      <div class="header-title">
        <div class="title-icon">📊</div>
        <div>
          <h2>Control y Gestión de Radicados</h2>
          <p class="subtitle">Módulo oficial de registro documental y control de vencimientos — Acuasan E.S.P.</p>
        </div>
      </div>
      <div class="header-actions d-flex align-items-center gap-2">
        <button 
          class="btn btn-sm btn-warning text-dark position-relative d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" 
          @click="mostrarAlertas = !mostrarAlertas" 
          title="Ver radicados próximos a vencer"
        >
          <span>🔔 Vencimientos</span>
          <span v-if="proximosAVencer.length" class="badge rounded-pill bg-danger">
            {{ proximosAVencer.length }}
          </span>
        </button>
        <button 
          class="btn btn-sm btn-secondary d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" 
          @click="toggleHistorial"
        >
          <span>📜 {{ verHistorial ? 'Ocultar Historial' : 'Ver Historial' }}</span>
        </button>
      </div>

    </div>

    <!-- ═══════════════ ALERTA GLOBAL BOOTSTRAP (NOTIFICACIONES DE ÉXITO Y ERROR) ═══════════════ -->
    <div 
      v-if="notificacion.mensaje" 
      :class="['alert', `alert-${notificacion.tipo}`, 'alert-dismissible', 'fade', 'show', 'shadow-sm', 'mb-3']" 
      role="alert"
    >
      <div class="d-flex align-items-center">
        <span class="me-2 fs-5">
          <template v-if="notificacion.tipo === 'success'">✅</template>
          <template v-else-if="notificacion.tipo === 'danger'">⚠️</template>
          <template v-else-if="notificacion.tipo === 'warning'">⚡</template>
          <template v-else>ℹ️</template>
        </span>
        <div>
          <strong>{{ notificacion.titulo }}: </strong> {{ notificacion.mensaje }}
        </div>
      </div>
      <button type="button" class="btn-close" @click="notificacion.mensaje = ''" aria-label="Close"></button>
    </div>

    <!-- ═══════════════ PANEL ALERTAS DE VENCIMIENTO ULTRA-COMPACTO ═══════════════ -->
    <div v-if="mostrarAlertas" class="alert alert-warning shadow-sm border-warning animate-fade-in p-2 px-3 mb-2" role="alert">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-6">🔔</span>
          <div>
            <strong class="alert-heading mb-0 text-dark fw-bold" style="font-size: 0.85rem;">Centro de Notificaciones de Vencimiento</strong>
            <small class="text-muted d-block" style="font-size: 0.68rem;">Radicados pendientes ordenados por proximidad de vencimiento</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-sm" @click="mostrarAlertas = false" aria-label="Close"></button>
      </div>

      <div v-if="!proximosAVencer.length" class="alert alert-light border mb-0 text-center text-success py-1 fw-bold" style="font-size: 0.75rem;">
        ✅ No hay radicados próximos a vencer o vencidos en este momento.
      </div>
      <div v-else class="row g-2">
        <div v-for="rad in proximosAVencer" :key="rad.id" class="col-md-4 col-lg-3">
          <div :class="['card', 'h-100', 'border-start', 'border-3', getClaseBordeBootstrap(rad), 'shadow-sm']">
            <div class="card-body p-2" style="font-size: 0.72rem; line-height: 1.2;">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span :class="['badge', getBadgeBootstrap(rad)]" style="font-size: 0.62rem; padding: 0.2em 0.4em;">{{ getDiasRestantesTexto(rad) }}</span>
                <small class="text-muted" style="font-size: 0.65rem;">Vence: {{ formatearFecha(rad.fechaVencimiento) }}</small>
              </div>
              <div class="fw-bold text-dark text-truncate mb-0" style="font-size: 0.76rem;" :title="rad.numeroRadicado + ' — ' + rad.peticionario">
                {{ rad.numeroRadicado }} — {{ rad.peticionario }}
              </div>
              <div class="text-secondary text-truncate mb-1" style="font-size: 0.68rem;">
                <strong>Asunto:</strong> {{ rad.asunto || 'Sin asunto' }}
              </div>
              <button class="btn btn-sm btn-outline-primary w-100 py-0.5 px-1 fw-semibold" style="font-size: 0.68rem;" @click="abrirModal(rad)">
                Ver Detalle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>


    <!-- ═══════════════ ÁREA PRINCIPAL (VISOR PDF + FORMULARIO) ═══════════════ -->
    <div class="main-content-grid">
      <!-- ── COLUMNA IZQUIERDA: Visor PDF & Extracción OCR ── -->
      <div class="card-panel pdf-viewer-panel">
        <div class="card-header flex-header">
          <div>
            <h3>📄 Visor de Documento PDF</h3>
            <p>Se previsualiza y se lee automáticamente para llenar el formulario</p>
          </div>
          <input type="file" ref="fileInput" accept="application/pdf,image/*" style="display:none" @change="onFileSelected">
          <button type="button" class="btn btn-primary btn-sm" @click="$refs.fileInput.click()">
            <span>📂 Cargar PDF / Archivo</span>
          </button>
        </div>

        <div class="pdf-container-box">
          <div v-if="!pdfPreviewUrl" class="pdf-empty-state">
            <div class="pdf-big-icon">📄</div>
            <h4>Sin documento cargado</h4>
            <p>Haz clic en <strong>Cargar PDF / Archivo</strong>: el documento se previsualiza aquí y sus datos se leen solos.</p>
          </div>
          <iframe v-else :src="pdfPreviewUrl" class="pdf-frame"></iframe>
        </div>

        <!-- Estado de la lectura automática del documento -->
        <div v-if="lecturaEstado" class="lectura-status" :class="'lectura-' + lecturaEstado">
          <template v-if="lecturaEstado === 'leyendo'">
            <div class="lectura-titulo"><span class="lectura-spinner"></span> Leyendo el documento…</div>
            <p class="lectura-etapa">{{ lecturaEtapa }}</p>
            <div class="lectura-barra">
              <div class="lectura-barra-fill" :style="{ width: Math.round(lecturaProgreso * 100) + '%' }"></div>
            </div>
          </template>
          <template v-else-if="lecturaEstado === 'exito' && resumenLectura">
            <div class="lectura-titulo">✅ Documento leído — {{ resumenLectura.metodo }}</div>
            <p v-if="resumenLectura.leidos.length" class="lectura-detalle">
              <strong>Campos llenados automáticamente:</strong> {{ resumenLectura.leidos.join(' · ') }}
            </p>
            <p v-if="resumenLectura.faltantes.length" class="lectura-detalle lectura-faltan">
              <strong>Sin dato en el documento:</strong> {{ resumenLectura.faltantes.join(' · ') }} — complételos manualmente.
            </p>
          </template>
          <template v-else-if="lecturaEstado === 'error'">
            <div class="lectura-titulo">⚠️ La lectura automática no pudo completarse</div>
            <p class="lectura-detalle">{{ lecturaError }} El documento queda adjunto igual: llene los campos manualmente y guarde.</p>
          </template>
        </div>

        <!-- Indicador de compresión del documento -->
        <div v-if="compresionEstado" class="compresion-status" :class="'compresion-' + compresionEstado">
          <template v-if="compresionEstado === 'comprimiendo'">
            <div class="compresion-titulo"><span class="lectura-spinner"></span> Optimizando peso del documento…</div>
            <p class="compresion-etapa">{{ compresionEtapa }}</p>
            <div class="lectura-barra">
              <div class="lectura-barra-fill compresion-fill" :style="{ width: Math.round(compresionProgreso * 100) + '%' }"></div>
            </div>
          </template>
          <template v-else-if="compresionEstado === 'listo' && compresionMetricas">
            <div class="compresion-titulo" v-if="compresionMetricas.comprimido">
              🗜️ Documento optimizado — de <strong>{{ compresionMetricas.textoOrig }}</strong>
              a <strong>{{ compresionMetricas.textoFinal }}</strong>
              <span class="compresion-badge">-{{ compresionMetricas.ahorro }}%</span>
            </div>
            <div class="compresion-titulo compresion-ok" v-else>
              ✅ Documento listo — {{ compresionMetricas.textoFinal }} (no requirió compresión)
            </div>
          </template>
        </div>

      </div>


      <!-- ── COLUMNA DERECHA: Formulario de Registro ── -->
      <div class="card-panel form-panel">
        <div class="card-header">
          <h3>📝 Registrar Radicado</h3>
          <p>Diligencie los campos del radicado</p>
        </div>

        <form @submit.prevent="guardarRadicado" class="radicado-form">
          <!-- Sección 1: Datos del Sello -->
          <div class="form-section-label">📌 Datos del sello / PDF</div>
          <div class="form-row">
            <div class="form-group">
              <label>N° Radicado PDF</label>
              <input type="text" v-model="form.numeroRadicadoPdf" class="form-control form-control-sm" placeholder="Número extraído del documento">
            </div>
            <div class="form-group">
              <label>Fecha / Hora Sello</label>
              <input type="text" v-model="form.fechaDocumento" class="form-control form-control-sm" placeholder="Fecha y hora del documento">
            </div>
          </div>

          <div class="form-group">
            <label>Lugar y Fecha de la Carta</label>
            <input type="text" v-model="form.lugarFecha" class="form-control form-control-sm" placeholder="Lugar y fecha de emisión">
          </div>

          <!-- Sección 2: Partes -->
          <div class="form-section-label">👥 Partes del radicado</div>
          <div class="form-group">
            <label>Remitente / Peticionario <span class="req">*</span></label>
            <input type="text" v-model="form.peticionario" class="form-control form-control-sm" placeholder="Nombre completo o entidad peticionaria" required>
          </div>

          <div class="form-group">
            <label>Empresa Destinataria <span class="req">*</span></label>
            <input type="text" v-model="form.dependencia" class="form-control form-control-sm" placeholder="Empresa o entidad destinataria" required>
          </div>

          <div class="form-group">
            <label>Destinatario (Funcionario / Área)</label>
            <input type="text" v-model="form.destinatario" class="form-control form-control-sm" placeholder="Funcionario o dependencia destinataria">
          </div>

          <!-- Sección 3: Contenido -->
          <div class="form-section-label">📄 Contenido del documento</div>
          <div class="form-group">
            <label>Asunto</label>
            <input type="text" v-model="form.asunto" class="form-control form-control-sm" placeholder="Asunto o tema principal de la solicitud">
          </div>

          <div class="form-group">
            <label>Referencia</label>
            <input type="text" v-model="form.referencia" class="form-control form-control-sm" placeholder="Referencia, código o número de cuenta">
          </div>

          <div class="form-group">
            <label>Contexto / Observaciones</label>
            <textarea v-model="form.contexto" class="form-control form-control-sm" rows="2" placeholder="Detalle o resumen de la petición..."></textarea>
          </div>

          <!-- Sección 4: Datos Operacionales -->
          <div class="form-section-label">⚙️ Datos operacionales</div>
          <div class="form-row">
            <div class="form-group">
              <label>Registrado Por <span class="req">*</span></label>
              <input type="text" v-model="form.registradoPor" class="form-control form-control-sm" placeholder="Responsable" required>
            </div>
            <div class="form-group">
              <label>Días para Vencer <span class="req">*</span></label>
              <select v-model="form.diasParaVencer" class="form-select form-select-sm" required>
                <option :value="3">🔴 3 Días (Crítico)</option>
                <option :value="5">🟠 5 Días (Urgente)</option>
                <option :value="10">🟡 10 Días (Atención)</option>
                <option :value="15">🔵 15 Días (Normal)</option>
                <option :value="30">🟢 30 Días (Holgado)</option>
              </select>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-guardar mt-2" :disabled="guardando">
            <span>{{ guardando ? '⏳ Guardando...' : '➕ Registrar Radicado' }}</span>
          </button>
        </form>
      </div>
    </div>

    <!-- ═══════════════ HISTORIAL DE RADICADOS CORPORATIVO ═══════════════ -->
    <div v-if="verHistorial" class="card-panel historial-panel-corporate animate-fade-in">
      <!-- Encabezado Corporativo del Historial -->
      <div class="historial-header-top">
        <div class="d-flex align-items-center gap-3">
          <div class="historial-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div>
            <div class="d-flex align-items-center gap-2">
              <h3 class="m-0 fw-bold text-dark" style="font-size: 1.15rem; letter-spacing: -0.2px;">Historial Oficial de Radicados</h3>
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-size: 0.72rem;">
                {{ listaRadicados.length }} Registros
              </span>
            </div>
            <p class="m-0 text-muted" style="font-size: 0.78rem;">Trazabilidad documental, términos de ley y control de respuestas institucionales</p>
          </div>
        </div>

        <div class="historial-toolbar d-flex align-items-center gap-2 flex-wrap">
          <div class="search-input-wrapper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" v-model="filtroBusqueda" class="corporate-search-input" placeholder="Buscar radicado, remitente, asunto...">
            <button v-if="filtroBusqueda" class="btn-clear-search" @click="filtroBusqueda = ''" title="Limpiar">✕</button>
          </div>

          <select v-model="filtroEstado" class="form-select form-select-sm corporate-select">
            <option value="">Todos los Estados</option>
            <option value="Pendiente">⏳ Pendientes</option>
            <option value="Resuelto">✅ Resueltos</option>
          </select>

          <button class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 corporate-btn-action" @click="CargarLista(false)" title="Actualizar datos">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'spin-animate': cargandoTabla }">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- KPI Cards Corporativos de Resumen -->
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-total">
            <div class="kpi-body">
              <div class="kpi-info">
                <span class="kpi-label">TOTAL RADICADOS</span>
                <span class="kpi-number">{{ listaRadicados.length }}</span>
              </div>
              <div class="kpi-icon-badge">📁</div>
            </div>
            <div class="kpi-stripe stripe-blue"></div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-pendientes" @click="filtroEstado = filtroEstado === 'Pendiente' ? '' : 'Pendiente'" style="cursor: pointer;" title="Clic para filtrar pendientes">
            <div class="kpi-body">
              <div class="kpi-info">
                <span class="kpi-label">PENDIENTES EN GESTIÓN</span>
                <span class="kpi-number text-warning-emphasis">{{ statsPendientes }}</span>
              </div>
              <div class="kpi-icon-badge">⏳</div>
            </div>
            <div class="kpi-stripe stripe-amber"></div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-criticos">
            <div class="kpi-body">
              <div class="kpi-info">
                <span class="kpi-label">PRÓXIMOS A VENCER</span>
                <span class="kpi-number text-danger">{{ statsProximosAVencer }}</span>
              </div>
              <div class="kpi-icon-badge">⚠️</div>
            </div>
            <div class="kpi-stripe stripe-red"></div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-resueltos" @click="filtroEstado = filtroEstado === 'Resuelto' ? '' : 'Resuelto'" style="cursor: pointer;" title="Clic para filtrar resueltos">
            <div class="kpi-body">
              <div class="kpi-info">
                <span class="kpi-label">RESUELTOS / CERRADOS</span>
                <span class="kpi-number text-success">{{ statsResueltos }}</span>
              </div>
              <div class="kpi-icon-badge">✅</div>
            </div>
            <div class="kpi-stripe stripe-green"></div>
          </div>
        </div>
      </div>

      <!-- Barra de Leyenda de Términos con Filtros Interactivos -->
      <div class="term-legend-bar d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="legend-title">SLA DE TÉRMINOS:</span>
          <button 
            type="button" 
            :class="['term-pill', filtroUrgencia === '' ? 'active' : '']" 
            @click="filtroUrgencia = ''"
          >
            Todos ({{ listaRadicados.length }})
          </button>
          <button 
            type="button" 
            :class="['term-pill', 'pill-vencido', filtroUrgencia === 'vencido' ? 'active' : '']" 
            @click="filtroUrgencia = filtroUrgencia === 'vencido' ? '' : 'vencido'"
          >
            <span class="dot-indicator bg-danger"></span> Vencidos
          </button>
          <button 
            type="button" 
            :class="['term-pill', 'pill-critico', filtroUrgencia === 'critico' ? 'active' : '']" 
            @click="filtroUrgencia = filtroUrgencia === 'critico' ? '' : 'critico'"
          >
            <span class="dot-indicator bg-warning"></span> Crítico (&lt;3d)
          </button>
          <button 
            type="button" 
            :class="['term-pill', 'pill-urgente', filtroUrgencia === 'urgente' ? 'active' : '']" 
            @click="filtroUrgencia = filtroUrgencia === 'urgente' ? '' : 'urgente'"
          >
            <span class="dot-indicator bg-info"></span> Urgente (&lt;7d)
          </button>
          <button 
            type="button" 
            :class="['term-pill', 'pill-normal', filtroUrgencia === 'normal' ? 'active' : '']" 
            @click="filtroUrgencia = filtroUrgencia === 'normal' ? '' : 'normal'"
          >
            <span class="dot-indicator bg-primary"></span> En Término (&gt;7d)
          </button>
          <button 
            type="button" 
            :class="['term-pill', 'pill-resuelto', filtroUrgencia === 'resuelto' ? 'active' : '']" 
            @click="filtroUrgencia = filtroUrgencia === 'resuelto' ? '' : 'resuelto'"
          >
            <span class="dot-indicator bg-success"></span> Resueltos
          </button>
        </div>

        <div class="text-muted" style="font-size: 0.73rem;">
          Mostrando <strong>{{ radicadosFiltrados.length }}</strong> de <strong>{{ listaRadicados.length }}</strong> radicados
        </div>
      </div>

      <!-- ═══════════════ CUADRILLA OFICIAL ESTILO EXCEL ═══════════════ -->
      <div class="excel-grid-container shadow-sm">
        <!-- Excel Top Title Bar -->
        <div class="excel-header-stripe">
          <div class="excel-stripe-left">
            <span class="excel-icon-logo">📑</span>
            <span class="excel-tag">Acuasan_Libro_Radicados_Oficial_2026.xlsx</span>
            <span class="excel-sheet-badge">Hoja 1: Ventanilla_Correspondencia</span>
          </div>
          <span class="excel-meta">Total Registros en Hoja: {{ radicadosFiltrados.length }}</span>
        </div>

        <!-- Excel Formula Bar (fx) -->
        <div class="excel-formula-bar">
          <div class="cell-name-box">A1</div>
          <div class="fx-icon">fx</div>
          <div class="formula-input">
            <span class="formula-text">
              =RESUMEN_RADICADOS() &rarr; Total Radicados: <strong>{{ listaRadicados.length }}</strong> | Resueltos: <strong>{{ statsResueltos }}</strong> | Pendientes en Término: <strong>{{ statsPendientes }}</strong> | Vencidos / Críticos: <strong>{{ proximosAVencer.length }}</strong>
            </span>
          </div>
        </div>

        <div class="table-responsive-wrapper">
          <table class="corporate-table excel-table">
            <thead>
              <!-- Excel Letters Row -->
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
              <tr class="excel-main-header-row">
                <th class="col-excel-index">#</th>
                <th style="width: 140px;">N° RADICADO</th>
                <th style="width: 110px;">FECHA REG.</th>
                <th style="width: 230px;">REMITENTE / ENTIDAD</th>
                <th>ASUNTO / DESTINATARIO</th>
                <th style="width: 140px;">RESPONSABLE</th>
                <th style="width: 115px; text-align: center;">ESTADO</th>
                <th style="width: 140px;">VENCIMIENTO / SLA</th>
                <th style="width: 100px; text-align: center;">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="cargandoTabla && !listaRadicados.length">
                <td colspan="9" class="text-center py-5 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  <span>Cargando registros oficiales de Acuasan...</span>
                </td>
              </tr>
              <tr v-else-if="!radicadosFiltrados.length">
                <td colspan="9" class="text-center py-5">
                  <div class="empty-state-box font-mono">
                    <span class="fs-1 d-block mb-2">📂</span>
                    <strong class="d-block text-dark mb-1">[Hoja vacía] No se encontraron radicados</strong>
                    <p class="text-muted mb-0" style="font-size: 0.8rem;">No hay registros que coincidan con los filtros aplicados.</p>
                  </div>
                </td>
              </tr>
              <tr 
                v-else 
                v-for="(rad, index) in radicadosFiltrados" 
                :key="rad.id"
                :class="['corporate-row', rad.estado === 'Resuelto' ? 'row-resuelto' : 'row-activo', { 'row-even': index % 2 === 1 }]"
              >
                <!-- Excel Row Number Index -->
                <td class="col-excel-index">{{ index + 1 }}</td>
                <!-- N° Radicado -->
              <td>
                <div class="radicado-code-box">
                  <span class="radicado-badge">{{ rad.numeroRadicado }}</span>
                  <span v-if="rad.numeroRadicadoPdf" class="pdf-tag" :title="'N° Documento: ' + rad.numeroRadicadoPdf">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    PDF: {{ rad.numeroRadicadoPdf }}
                  </span>
                </div>
              </td>

              <!-- Fecha Registro -->
              <td>
                <div class="date-cell">
                  <span class="date-main">{{ formatearFecha(rad.fechaRadicacion) }}</span>
                  <span class="date-sub">{{ obtenerHoraFormateada(rad.fechaRadicacion) }}</span>
                </div>
              </td>

              <!-- Remitente / Entidad -->
              <td>
                <div class="remitente-cell">
                  <div class="remitente-name" :title="rad.peticionario">{{ formatNombreRemitente(rad.peticionario) }}</div>
                  <div class="dependencia-tag text-truncate" :title="rad.dependencia">
                    <span class="tag-icon">🏢</span>
                    <span>{{ rad.dependencia || 'Acuasan E.S.P.' }}</span>
                  </div>
                </div>
              </td>

              <!-- Asunto / Destinatario -->
              <td>
                <div class="asunto-cell">
                  <div class="asunto-text" :title="rad.asunto">{{ rad.asunto || 'Sin asunto registrado' }}</div>
                  <div v-if="rad.destinatario" class="destinatario-tag text-truncate" :title="'Para: ' + rad.destinatario">
                    <span class="text-muted fw-semibold">Para:</span> {{ rad.destinatario }}
                  </div>
                </div>
              </td>

              <!-- Responsable -->
              <td>
                <div class="user-chip">
                  <div class="user-chip-avatar">{{ getInicialesNombre(rad.registradoPor) }}</div>
                  <span class="user-chip-name text-truncate" :title="rad.registradoPor">{{ rad.registradoPor || 'Encargada' }}</span>
                </div>
              </td>

              <!-- Estado -->
              <td style="text-align: center;">
                <span :class="['status-pill', rad.estado === 'Resuelto' ? 'status-resuelto' : 'status-pendiente']">
                  <span class="status-dot"></span>
                  {{ rad.estado }}
                </span>
              </td>

              <!-- Vencimiento / SLA -->
              <td>
                <div class="sla-cell">
                  <div class="sla-date">{{ formatearFecha(rad.fechaVencimiento) }}</div>
                  <span :class="['sla-tag', getSlaClass(rad)]">
                    {{ getDiasRestantesTexto(rad) }}
                  </span>
                </div>
              </td>

              <!-- Acciones -->
              <td style="text-align: center;">
                <div class="action-buttons-group">
                  <button 
                    class="btn-action btn-action-view" 
                    @click="abrirModal(rad)" 
                    title="Ver detalle del radicado"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                  <button 
                    v-if="rad.estado !== 'Resuelto'"
                    class="btn-action btn-action-resolve" 
                    @click="confirmarMarcarResuelto(rad)" 
                    title="Marcar como Resuelto"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                  <!-- Botón eliminar: solo encargada de Radicados -->
                  <button 
                    v-if="esEncargadaRadicados"
                    class="btn-action btn-action-delete" 
                    @click="solicitarEliminar(rad)" 
                    title="Eliminar radicado"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

    <!-- ═══════════════ MODAL CONFIRMAR ELIMINACIÓN ═══════════════ -->
    <div v-if="modalEliminar.visible" class="modal-overlay" @click.self="modalEliminar.visible = false">
      <div class="modal-card animate-zoom-in" style="max-width: 420px; width: 90%;">
        <div class="modal-header bg-danger py-2 px-3 border-bottom d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <span class="text-white fs-6">🗑️</span>
            <strong class="text-white" style="font-size: 0.88rem;">Eliminar Radicado</strong>
          </div>
          <button type="button" class="btn-close btn-close-white btn-close-sm" @click="modalEliminar.visible = false" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body p-3 text-center">
          <div class="mb-3">
            <div class="bg-danger-subtle rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:56px;height:56px;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path><path d="M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </div>
            <h6 class="fw-bold text-dark mb-1">¿Eliminar este radicado?</h6>
            <p class="text-muted mb-2" style="font-size: 0.82rem;">Esta acción es <strong>permanente</strong> y no se puede deshacer.</p>
            <div class="alert alert-warning py-1 px-2 mb-0" style="font-size: 0.8rem;">
              <strong>{{ modalEliminar.radicado?.numeroRadicado }}</strong><br>
              <span class="text-muted" style="font-size: 0.74rem;">{{ modalEliminar.radicado?.peticionario }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 bg-light py-2 px-3 d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-sm btn-light border fw-semibold px-3" @click="modalEliminar.visible = false">Cancelar</button>
          <button 
            type="button" 
            class="btn btn-sm btn-danger fw-bold px-3 d-inline-flex align-items-center gap-1"
            @click="ejecutarEliminar"
            :disabled="eliminando"
          >
            <span v-if="eliminando" class="spinner-border spinner-border-sm" role="status"></span>
            <span>🗑️ Eliminar definitivamente</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════ MODAL VISTA DIGITAL STAMP (ULTRA-COMPACT BOOTSTRAP MODAL) ═══════════════ -->
    <div v-if="modalRadicado" class="modal-overlay" @click.self="cerrarModal()">
      <div class="modal-card modal-card-micro modal-viewer-wide animate-zoom-in">
        <div class="modal-header bg-light py-1 px-2 border-bottom">
          <div class="modal-header-info d-flex align-items-center gap-2">
            <span class="modal-icon fs-6">🏛️</span>
            <div>
              <strong class="modal-title fw-bold mb-0 text-dark" style="font-size: 0.8rem;">{{ modalRadicado.numeroRadicado }}</strong>
              <div class="text-muted" style="font-size: 0.62rem;">Registrado: {{ formatearFechaHora(modalRadicado.fechaRadicacion) }}</div>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-sm" @click="cerrarModal()" aria-label="Close"></button>
        </div>

        <div class="modal-body p-2" style="max-height: 75vh; overflow-y: auto;">
          <div class="alert alert-primary text-center mb-1 py-1 px-2 border-dashed">
            <div class="fw-bold text-uppercase tracking-wide" style="font-size: 0.6rem;">SELLO DIGITAL DE RADICACIÓN — ACUASAN</div>
            <div class="fw-bold text-dark mt-0" style="font-size: 0.78rem;">
              {{ modalRadicado.numeroRadicado }} | ESTADO: {{ modalRadicado.estado.toUpperCase() }}
            </div>
          </div>

          <div class="row g-1" style="font-size: 0.68rem; line-height: 1.2;">
            <div class="col-6"><label class="text-muted d-block" style="font-size: 0.62rem;">N° Radicado PDF:</label> <strong class="text-dark">{{ modalRadicado.numeroRadicadoPdf || '—' }}</strong></div>
            <div class="col-6"><label class="text-muted d-block" style="font-size: 0.62rem;">Fecha / Hora Sello:</label> <strong class="text-dark">{{ modalRadicado.fechaDocumento || '—' }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Lugar y Fecha Carta:</label> <strong class="text-dark">{{ modalRadicado.lugarFecha || '—' }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Remitente / Peticionario:</label> <strong class="text-dark">{{ modalRadicado.peticionario }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Empresa Destinataria:</label> <strong class="text-dark">{{ modalRadicado.dependencia }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Destinatario (Funcionario):</label> <strong class="text-dark">{{ modalRadicado.destinatario || '—' }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Asunto:</label> <strong class="text-dark">{{ modalRadicado.asunto || '—' }}</strong></div>
            <div class="col-12"><label class="text-muted d-block" style="font-size: 0.62rem;">Referencia:</label> <strong class="text-dark">{{ modalRadicado.referencia || '—' }}</strong></div>
            <div class="col-6"><label class="text-muted d-block" style="font-size: 0.62rem;">Registrado Por:</label> <strong class="text-dark">{{ modalRadicado.registradoPor }}</strong></div>
            <div class="col-6"><label class="text-muted d-block" style="font-size: 0.62rem;">Fecha Vencimiento:</label> <strong class="text-dark">{{ formatearFecha(modalRadicado.fechaVencimiento) }}</strong></div>
          </div>

          <div class="alert alert-secondary mt-1 mb-1 p-1 px-2" style="font-size: 0.66rem; line-height: 1.2;">
            <strong class="d-block text-dark mb-0">Contexto / Observaciones:</strong>
            <span class="text-secondary">{{ modalRadicado.contexto || 'Sin observaciones adicionales.' }}</span>
          </div>

          <!-- 📄 VISOR DEL DOCUMENTO ORIGINAL (mismo patrón que Permisos) -->
          <div class="modal-pdf-vista border rounded bg-white mb-0 overflow-hidden">
            <div class="d-flex align-items-center justify-content-between gap-2 px-2 py-1 bg-light border-bottom">
              <div class="text-truncate me-auto">
                <small class="d-block text-muted fw-bold" style="font-size: 0.58rem;">📎 DOCUMENTO ORIGINAL</small>
                <strong class="text-dark d-block text-truncate" style="font-size: 0.68rem;">
                  {{ modalRadicado.archivoNombre || (modalRadicado.numeroRadicadoPdf ? modalRadicado.numeroRadicadoPdf + '.pdf' : 'Radicado.pdf') }}
                </strong>
              </div>
              <a
                v-if="modalPdfUrl"
                :href="modalPdfUrl"
                target="_blank"
                class="btn btn-outline-primary btn-sm py-0 px-2 flex-shrink-0"
                style="font-size: 0.62rem;"
                title="Abrir en una pestaña nueva a pantalla completa"
              >
                ↗️ Abrir Archivo
              </a>
            </div>
            <div class="pdf-container rounded-3 border bg-dark bg-opacity-75 overflow-auto position-relative p-2" style="min-height: 380px; max-height: 540px;">
              <div v-if="modalPdfCargando" class="d-flex align-items-center justify-content-center text-white-50" style="font-size: 0.78rem; min-height: 300px;">
                ⏳ Cargando documento...
              </div>

              <!-- PDF original de la base de datos -->
              <object
                v-else-if="modalPdfUrl && !esImagenDocumento(modalRadicado)"
                :data="modalPdfUrl"
                type="application/pdf"
                class="w-100 rounded-3 border-0 bg-white"
                style="min-height: 460px;"
              >
                <iframe :src="modalPdfUrl" class="w-100 h-100 rounded-3 border-0 bg-white" style="min-height: 460px;" title="Visor PDF Radicado Original"></iframe>
              </object>

              <!-- Imagen escaneada adjunta -->
              <div v-else-if="modalPdfUrl" class="w-100 text-center">
                <div class="badge bg-info text-dark mb-2 shadow-sm px-3 py-1 fw-bold">IMAGEN ADJUNTA ORIGINAL</div>
                <img
                  :src="modalPdfUrl"
                  class="img-fluid rounded shadow bg-white border w-100"
                  style="max-width: 720px; object-fit: contain;"
                  alt="Documento original del radicado"
                />
              </div>

              <!-- Error de carga (reintentable): distinto de "sin documento" -->
              <div v-else-if="modalPdfError" class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 300px;">
                <div style="font-size: 2rem;">⚠️</div>
                <p class="text-warning mb-2" style="font-size: 0.8rem;">{{ modalPdfError }}</p>
                <button class="btn btn-outline-light btn-sm px-3" style="font-size: 0.72rem;" @click="abrirModal(modalRadicado)">
                  🔄 Reintentar
                </button>
              </div>

              <!-- Sin documento (estado honesto) + reparación: adjuntar el original a posteriori -->
              <div v-else class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 300px;">
                <div style="font-size: 2rem;">📄</div>
                <p class="text-white-50 mb-2" style="font-size: 0.8rem;">
                  Este radicado no tiene documento adjunto en la base de datos.
                </p>
                <input ref="inputAdjuntarArchivo" type="file" accept=".pdf,image/*" class="d-none" @change="onAdjuntarArchivo" />
                <button
                  class="btn btn-warning btn-sm px-3 fw-bold"
                  style="font-size: 0.72rem;"
                  :disabled="adjuntandoDoc"
                  @click="inputAdjuntarArchivo && inputAdjuntarArchivo.click()"
                >
                  {{ adjuntandoDoc ? '⏳ Adjuntando documento...' : '📎 Adjuntar documento original' }}
                </button>
                <small class="text-white-50 mt-1" style="font-size: 0.62rem;">
                  Seleccione el PDF o imagen escaneada: quedará guardado en la base de datos.
                </small>
              </div>
            </div>
          </div>

        </div>

        <div class="modal-footer bg-light p-1 pe-2 border-top">
          <button class="btn btn-secondary btn-sm px-2 py-0.5" style="font-size: 0.72rem;" @click="cerrarModal()">Cerrar</button>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import radicadosService from '../services/radicadosService.js'
import ocrRadicados from '../services/ocrRadicados.js'
import compressorRadicados from '../services/compressorRadicados.js'
import authService from '../../auth/services/authService.js'

// Estado
const listaRadicados = ref([])
const cargandoTabla = ref(false)
const guardando = ref(false)
const verHistorial = ref(true)
const mostrarAlertas = ref(false)
const modalRadicado = ref(null)
const pdfPreviewUrl = ref(null)

// Lectura automática del documento seleccionado
const lecturaEstado = ref(null) // null | 'leyendo' | 'exito' | 'error'
const lecturaEtapa = ref('')
const lecturaProgreso = ref(0)
const lecturaError = ref('')
const resumenLectura = ref(null) // { metodo, leidos: [], faltantes: [] }

// Compresión del documento antes de guardar
const compresionEstado = ref(null)  // null | 'comprimiendo' | 'listo'
const compresionEtapa = ref('')
const compresionProgreso = ref(0)
const compresionMetricas = ref(null) // { textoOrig, textoFinal, ahorro, comprimido }

let timerAutoRefresh = null

const filtroBusqueda = ref('')
const filtroEstado = ref('')
const filtroUrgencia = ref('')

// Estadísticas de Resumen (KPIs)
const statsPendientes = computed(() => {
  return listaRadicados.value.filter(r => r.estado !== 'Resuelto').length
})

const statsProximosAVencer = computed(() => {
  return listaRadicados.value.filter(r => {
    if (r.estado === 'Resuelto') return false
    const dias = calcularDiasRestantes(r.fechaVencimiento)
    return dias <= 7
  }).length
})

const statsResueltos = computed(() => {
  return listaRadicados.value.filter(r => r.estado === 'Resuelto').length
})

// Sistema de Notificaciones Bootstrap
const notificacion = reactive({
  titulo: '',
  mensaje: '',
  tipo: 'success'
})

const mostrarAlertaBootstrap = (titulo, mensaje, tipo = 'success') => {
  notificacion.titulo = titulo
  notificacion.mensaje = mensaje
  notificacion.tipo = tipo
  setTimeout(() => {
    if (notificacion.mensaje === mensaje) {
      notificacion.mensaje = ''
    }
  }, 6000)
}

const usuarioActual = authService.getUsuarioActual()

const DEPENDENCIA_POR_DEFECTO = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'

const form = reactive({
  numeroRadicadoPdf: '',
  fechaDocumento: '',
  lugarFecha: '',
  peticionario: '',
  dependencia: DEPENDENCIA_POR_DEFECTO,
  destinatario: '',
  asunto: '',
  referencia: '',
  contexto: '',
  registradoPor: usuarioActual?.nombre || 'Eliana',
  diasParaVencer: 10,
  archivoNombre: null,
  archivoBase64: ''
})


const CargarLista = async (silencioso = false) => {
  try {
    if (!silencioso) cargandoTabla.value = true
    const datos = await radicadosService.obtenerTodos()
    listaRadicados.value = datos
  } catch (err) {
    if (!silencioso) {
      console.error(err)
      mostrarAlertaBootstrap('Error de Conexión', 'No se pudieron consultar los radicados del servidor.', 'danger')
    }
  } finally {
    if (!silencioso) cargandoTabla.value = false
  }
}


let desuscribirCambios = null

onMounted(async () => {
  CargarLista()
  
  // Aviso inmediato dentro de la pestaña cuando otra vista crea/edita/elimina;
  // el sondeo cada 5s cubre el resto (otras pestañas y otros equipos)
  desuscribirCambios = radicadosService.suscribirCambios(() => {
    CargarLista(true)
  })

  // Auto-actualización periódica silenciosa (respaldo)
  timerAutoRefresh = setInterval(() => {
    CargarLista(true)
  }, 5000)
})

onUnmounted(() => {
  if (timerAutoRefresh) clearInterval(timerAutoRefresh)
  if (desuscribirCambios) desuscribirCambios()
  // Liberar el blob del visor si la vista se desmonta con el modal abierto
  if (modalPdfUrl.value && modalPdfUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(modalPdfUrl.value)
  }
  if (pdfPreviewUrl.value && pdfPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
  }
})

const toggleHistorial = () => {
  verHistorial.value = !verHistorial.value
}

// Filtros
const radicadosFiltrados = computed(() => {
  return listaRadicados.value.filter(r => {
    const texto = `${r.numeroRadicado} ${r.peticionario} ${r.asunto} ${r.numeroRadicadoPdf} ${r.dependencia} ${r.destinatario}`.toLowerCase()
    const cumpleTexto = !filtroBusqueda.value || texto.includes(filtroBusqueda.value.toLowerCase())
    const cumpleEstado = !filtroEstado.value || r.estado === filtroEstado.value
    
    // Filtro por semáforo de urgencia / SLA
    let cumpleUrgencia = true
    if (filtroUrgencia.value) {
      const dias = calcularDiasRestantes(r.fechaVencimiento)
      if (filtroUrgencia.value === 'vencido') {
        cumpleUrgencia = r.estado !== 'Resuelto' && dias < 0
      } else if (filtroUrgencia.value === 'critico') {
        cumpleUrgencia = r.estado !== 'Resuelto' && dias >= 0 && dias <= 3
      } else if (filtroUrgencia.value === 'urgente') {
        cumpleUrgencia = r.estado !== 'Resuelto' && dias > 3 && dias <= 7
      } else if (filtroUrgencia.value === 'normal') {
        cumpleUrgencia = r.estado !== 'Resuelto' && dias > 7
      } else if (filtroUrgencia.value === 'resuelto') {
        cumpleUrgencia = r.estado === 'Resuelto'
      }
    }

    return cumpleTexto && cumpleEstado && cumpleUrgencia
  })
})

const calcularDiasRestantes = (fechaVencimiento) => {
  if (!fechaVencimiento) return 0
  const fVenc = new Date(fechaVencimiento)
  const hoy = new Date()
  hoy.setHours(0,0,0,0)
  fVenc.setHours(0,0,0,0)
  return Math.ceil((fVenc - hoy) / (1000 * 60 * 60 * 24))
}

const proximosAVencer = computed(() => {
  return listaRadicados.value.filter(r => {
    if (r.estado === 'Resuelto') return false
    const dias = calcularDiasRestantes(r.fechaVencimiento)
    return dias <= 15
  }).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
})

// OCR & PDF Upload — seleccionar → comprimir → previsualizar → lectura automática
const onFileSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  // Reset del input: sin esto, re-seleccionar el MISMO archivo no dispara change
  event.target.value = ''

  // Revocar la URL anterior para no fugar blobs en RAM
  if (pdfPreviewUrl.value && pdfPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
  }
  // Preview inmediato con el archivo original (fluido visualmente)
  pdfPreviewUrl.value = URL.createObjectURL(file)
  form.archivoNombre = file.name

  // Limpiar estados previos
  form.archivoBase64 = ''
  compresionEstado.value = null
  compresionMetricas.value = null
  tokenLectura++
  for (const [campo] of CAMPOS_LEIBLES) form[campo] = ''
  form.dependencia = DEPENDENCIA_POR_DEFECTO
  form.diasParaVencer = 10

  // ── Comprimir y leer en paralelo ───────────────────────────────────────
  // El OCR trabaja sobre el archivo ORIGINAL (máxima calidad para el texto).
  // La compresión produce el Base64 que se guarda en MongoDB (menor peso).
  // Ambos procesos son independientes y pueden correr sin bloquearse.
  const tokenActual = tokenLectura

  // Compresión en paralelo (no bloquea el OCR)
  const comprimir = async () => {
    try {
      compresionEstado.value = 'comprimiendo'
      const resultado = await compressorRadicados.comprimir(file, (etapa, p) => {
        if (tokenLectura !== tokenActual) return
        compresionEtapa.value = etapa
        compresionProgreso.value = p
      })
      if (tokenLectura !== tokenActual) return
      form.archivoBase64 = resultado.dataUrl
      form.archivoNombre = resultado.nombre
      compresionMetricas.value = resultado.metricas
      compresionEstado.value = 'listo'
    } catch (err) {
      if (tokenLectura !== tokenActual) return
      // Si la compresión falla, guardar el original sin comprimir
      console.warn('Compresión fallida, usando original:', err.message)
      const reader = new FileReader()
      reader.onload = (e) => {
        if (tokenLectura !== tokenActual) return
        form.archivoBase64 = e.target.result
        compresionEstado.value = 'listo'
      }
      reader.onerror = () => {
        form.archivoBase64 = ''
        compresionEstado.value = null
        mostrarAlertaBootstrap('Documento no legible', 'No fue posible leer el archivo.', 'warning')
      }
      reader.readAsDataURL(file)
    }
  }

  // Lanzar compresión y OCR en paralelo
  comprimir()
  leerDocumento(file)
}

// ── Lectura automática del documento (OCR en el navegador) ───────────────────

const CAMPOS_LEIBLES = [
  ['numeroRadicadoPdf', 'N° radicado del sello'],
  ['fechaDocumento', 'fecha del sello'],
  ['lugarFecha', 'lugar y fecha de la carta'],
  ['peticionario', 'peticionario'],
  ['dependencia', 'empresa destinataria'],
  ['destinatario', 'destinatario'],
  ['asunto', 'asunto'],
  ['referencia', 'referencia'],
  ['contexto', 'contexto']
]

// Generación de lectura: si el usuario cambia de documento o guarda mientras
// una lectura lenta sigue en vuelo, su resultado tardío se descarta (no puede
// pisar los campos del documento que ahora muestra la previsualización).
let tokenLectura = 0

const leerDocumento = async (file) => {
  const token = ++tokenLectura
  lecturaEstado.value = 'leyendo'
  lecturaEtapa.value = 'Comenzando lectura del documento…'
  lecturaProgreso.value = 0
  lecturaError.value = ''
  resumenLectura.value = null
  try {
    const { texto, metodo } = await ocrRadicados.extraerTexto(file, (etapa, progreso) => {
      if (token !== tokenLectura) return
      lecturaEtapa.value = etapa
      lecturaProgreso.value = progreso
    })
    if (token !== tokenLectura) return
    lecturaEtapa.value = 'Interpretando los datos del documento…'
    const campos = await radicadosService.extraerCampos(texto)
    if (token !== tokenLectura) return
    aplicarCamposExtraidos(campos, metodo)
    lecturaEstado.value = 'exito'
  } catch (err) {
    if (token !== tokenLectura) return
    console.error('Lectura del radicado:', err)
    lecturaError.value = err?.message || 'Error desconocido durante la lectura.'
    lecturaEstado.value = 'error'
  }
}

// Solo se llenan los campos con dato real del documento: lo que no apareció
// queda como estaba para que el usuario lo complete (nunca se inventa).
const aplicarCamposExtraidos = (campos, metodo) => {
  const leidos = []
  const faltantes = []
  for (const [campo, etiqueta] of CAMPOS_LEIBLES) {
    const valor = (campos[campo] || '').toString().trim()
    if (valor) {
      form[campo] = valor
      leidos.push(etiqueta)
    } else {
      faltantes.push(etiqueta)
    }
  }
  const dias = Number(campos.diasParaVencer)
  if (Number.isFinite(dias) && dias > 0) {
    form.diasParaVencer = dias
  }
  resumenLectura.value = { metodo, leidos, faltantes }
}

// Guardar
const guardarRadicado = async () => {
  try {
    guardando.value = true
    const nuevoRad = await radicadosService.crear(form)

    mostrarAlertaBootstrap(
      'Radicado Publicado en la Base de Datos',
      `Se guardó exitosamente el radicado ${nuevoRad.numeroRadicado}. Gerencia lo verá al instante en su tablero.`,
      'success'
    )

    // Reset parcial del formulario
    form.numeroRadicadoPdf = ''
    form.fechaDocumento = ''
    form.lugarFecha = ''
    form.peticionario = ''
    form.destinatario = ''
    form.asunto = ''
    form.referencia = ''
    form.contexto = ''
    form.archivoBase64 = ''
    form.archivoNombre = null
    form.registradoPor = authService.getUsuarioActual()?.nombre || 'Eliana'
    lecturaEstado.value = null
    lecturaEtapa.value = ''
    lecturaProgreso.value = 0
    lecturaError.value = ''
    resumenLectura.value = null
    tokenLectura++ // anula lecturas en vuelo: el formulario ya se reinició
    if (pdfPreviewUrl.value && pdfPreviewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreviewUrl.value)
    }
    pdfPreviewUrl.value = null

    await CargarLista()
  } catch (err) {
    mostrarAlertaBootstrap('Error al Guardar', err.message || 'No se pudo registrar el radicado.', 'danger')
  } finally {
    guardando.value = false
  }
}

const confirmarMarcarResuelto = async (rad) => {
  try {
    await radicadosService.actualizarEstado(rad.id, 'Resuelto')
    mostrarAlertaBootstrap('Estado Actualizado', `El radicado ${rad.numeroRadicado} se marcó como RESUELTO.`, 'info')
    await CargarLista()
  } catch (err) {
    mostrarAlertaBootstrap('Error', err.message, 'danger')
  }
}

// ── Control de eliminación (solo encargada de Radicados) ──
const esEncargadaRadicados = computed(() => authService.getUsuarioActual()?.rol === 'RADICADOS')

const modalEliminar = reactive({
  visible: false,
  radicado: null
})
const eliminando = ref(false)

const solicitarEliminar = (rad) => {
  modalEliminar.radicado = rad
  modalEliminar.visible = true
}

const ejecutarEliminar = async () => {
  if (!modalEliminar.radicado) return
  try {
    eliminando.value = true
    await radicadosService.eliminar(modalEliminar.radicado.id)
    mostrarAlertaBootstrap(
      'Radicado Eliminado',
      `El radicado ${modalEliminar.radicado.numeroRadicado} fue eliminado correctamente.`,
      'danger'
    )
    modalEliminar.visible = false
    modalEliminar.radicado = null
    await CargarLista()
  } catch (err) {
    mostrarAlertaBootstrap('Error al Eliminar', err.message || 'No se pudo eliminar el radicado.', 'danger')
  } finally {
    eliminando.value = false
  }
}

const modalPdfUrl = ref(null)
const modalPdfCargando = ref(false)
// Mensaje de error de CARGA (string | null): fallo de transporte reintentable.
// "Sin documento" es el estado implícito !cargando && !url && !error (honesto).
const modalPdfError = ref(null)
const modalPdfMime = ref('')
// Token de generación: si el usuario cierra/reabre el modal con una carga en
// vuelo, la promesa vieja ya no pisa el visor de la nueva (documento equivocado).
let modalPdfToken = 0


// Liberar el blob del visor
const liberarModalPdfUrl = () => {
  if (modalPdfUrl.value && modalPdfUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(modalPdfUrl.value)
  }
  modalPdfUrl.value = null
}

const abrirModal = async (rad) => {
  const token = ++modalPdfToken
  modalRadicado.value = rad
  liberarModalPdfUrl()
  modalPdfError.value = null
  modalPdfMime.value = ''

  if (!rad) return

  // Mismo orden de resolución que el visor de Permisos: el documento se pide
  // al servidor — si existe en la BD, se muestra.
  modalPdfCargando.value = true
  try {

    // Servidor — camino principal para todo radicado con id real
    if (rad.id) {
      const { url, mime } = await radicadosService.obtenerArchivoRadicado(rad.id)
      if (token !== modalPdfToken) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return }
      modalPdfUrl.value = url
      modalPdfMime.value = mime
      return
    }

    // Sin documento: 404 real del servidor
  } catch (e) {
    if (token !== modalPdfToken) return
    // 404 = sin documento real: queda todo en null para que el template muestre
    // el estado honesto (con botón de reparación), no un error reintentable.
    if (e && e.status === 404) return
    modalPdfError.value = (e && e.message) || 'No se pudo cargar el documento del radicado.'
  } finally {
    if (token === modalPdfToken) modalPdfCargando.value = false
  }
}

const cerrarModal = () => {
  liberarModalPdfUrl()
  modalRadicado.value = null
}

// ── Reparación: adjuntar el documento original a un radicado ya creado ──
// Repara registros que llegaron a la BD sin archivo.
const inputAdjuntarArchivo = ref(null)
const adjuntandoDoc = ref(false)


const onAdjuntarArchivo = async (event) => {
  const file = event.target.files[0]
  event.target.value = '' // permite re-seleccionar el mismo archivo
  if (!file || !modalRadicado.value) return

  try {
    adjuntandoDoc.value = true
    const actualizado = await radicadosService.adjuntarArchivo(modalRadicado.value.id, file)
    mostrarAlertaBootstrap(
      'Documento Adjuntado',
      `El documento quedó guardado en la base de datos del radicado ${actualizado.numeroRadicado || modalRadicado.value.numeroRadicado}.`,
      'success'
    )
    // El usuario pudo cerrar el modal durante la subida (PDF de varios MB):
    // no se reabre — solo se refresca el tablero.
    if (!modalRadicado.value) {
      await CargarLista()
      return
    }
    // Refrescar el visor con el radicado reparado y el tablero
    await abrirModal({ ...modalRadicado.value, ...actualizado })
    await CargarLista()
  } catch (err) {
    mostrarAlertaBootstrap('Error al Adjuntar', err.message || 'No se pudo adjuntar el documento.', 'danger')
  } finally {
    adjuntandoDoc.value = false
  }
}

// El documento adjunto puede ser PDF (visor object/iframe) o imagen escaneada (<img>).
// Prefiere el MIME REAL del documento mostrado (blob servido o data URL) — mismo
// criterio que Permisos —; solo si no existe infiere por campo del registro/extensión.
const esImagenDocumento = (rad) => {
  const mime = modalPdfMime.value || rad?.archivoMimeType || ''
  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(rad?.archivoNombre || '')
}

// Helpers de formato y estado
const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

const obtenerHoraFormateada = (fecha) => {
  if (!fecha) return '08:00 AM'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '08:00 AM'
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const formatearFechaHora = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const formatNombreRemitente = (nombre) => {
  if (!nombre) return 'Remitente no especificado'
  // Si viene en MAYÚSCULAS sostenidas, convertirlo a formato capitalizado legible
  if (nombre === nombre.toUpperCase() && nombre.length > 4) {
    return nombre.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  return nombre
}

const getInicialesNombre = (nombre) => {
  if (!nombre) return 'EC'
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

const getDiasRestantesTexto = (rad) => {
  if (rad.estado === 'Resuelto') return 'Resuelto'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return `Vencido (${Math.abs(dias)}d)`
  if (dias === 0) return 'Vence Hoy'
  return `${dias} días restantes`
}

const getSlaClass = (rad) => {
  if (rad.estado === 'Resuelto') return 'sla-resuelto'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return 'sla-vencido'
  if (dias <= 3) return 'sla-critico'
  if (dias <= 7) return 'sla-urgente'
  return 'sla-normal'
}

const getClaseBordeBootstrap = (rad) => {
  if (rad.estado === 'Resuelto') return 'border-success'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return 'border-danger'
  if (dias <= 3) return 'border-warning'
  return 'border-info'
}

const getBadgeBootstrap = (rad) => {
  if (rad.estado === 'Resuelto') return 'bg-success'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return 'bg-danger'
  if (dias <= 3) return 'bg-warning text-dark'
  if (dias <= 7) return 'bg-info text-dark'
  return 'bg-secondary'
}
</script>

<style scoped>
.radicados-container {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.85rem 1.25rem;
  max-width: 1380px;
  margin: 0 auto;
}

.radicados-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: var(--bg-surface, #ffffff);
  padding: 0.75rem 1.15rem;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-color, #e2e8f0);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon {
  font-size: 1.4rem;
  background: #eff6ff;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
}

.header-title h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 0.1rem 0 0 0;
  font-size: 0.75rem;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Botones */
.btn-alert-indicator {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #ffedd5;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

/* Grid Principal */
.main-content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

@media (max-width: 1024px) {
  .main-content-grid {
    grid-template-columns: 1fr;
  }
}

.card-panel {
  background: #ffffff;
  border-radius: 10px;
  padding: 0.85rem 1.15rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.card-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

.card-header p {
  margin: 0.15rem 0 0.5rem 0;
  font-size: 0.75rem;
  color: #64748b;
}

.flex-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

/* Visor PDF Box */
.pdf-container-box {
  height: 270px;
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-empty-state {
  text-align: center;
  padding: 1rem;
  color: #64748b;
  font-size: 0.8rem;
}

.pdf-big-icon {
  font-size: 2.2rem;
  margin-bottom: 0.3rem;
}

.pdf-frame {
  width: 100%;
  height: 100%;
  border: none;
}

/* Estado de la lectura automática (OCR) del documento cargado */
.lectura-status {
  margin-top: 0.6rem;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.lectura-titulo {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #334155;
}

.lectura-leyendo .lectura-titulo { color: #1d4ed8; }
.lectura-exito   { border-color: #bbf7d0; background: #f0fdf4; }
.lectura-exito   .lectura-titulo { color: #15803d; }
.lectura-error   { border-color: #fecaca; background: #fef2f2; }
.lectura-error   .lectura-titulo { color: #b91c1c; }

.lectura-etapa {
  margin: 0.25rem 0 0.35rem;
  color: #64748b;
  font-size: 0.74rem;
}

.lectura-barra {
  height: 6px;
  border-radius: 4px;
  background: #e2e8f0;
  overflow: hidden;
}

.lectura-barra-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.lectura-detalle {
  margin: 0.25rem 0 0;
  color: #475569;
  line-height: 1.45;
}

.lectura-faltan {
  color: #92400e;
}

.lectura-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: lectura-girar 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes lectura-girar {
  to { transform: rotate(360deg); }
}

/* Indicador de compresión del documento */
.compresion-status {
  margin-top: 0.5rem;
  padding: 0.55rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid #e0f2fe;
  background: #f0f9ff;
}

.compresion-comprimiendo {
  border-color: #bae6fd;
  background: #f0f9ff;
}

.compresion-listo {
  border-color: #a7f3d0;
  background: #f0fdf4;
}

.compresion-titulo {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #0369a1;
  flex-wrap: wrap;
}

.compresion-listo .compresion-titulo { color: #065f46; }
.compresion-ok { color: #065f46 !important; }

.compresion-etapa {
  margin: 0.2rem 0 0.3rem;
  color: #64748b;
  font-size: 0.73rem;
}

.compresion-fill {
  background: linear-gradient(90deg, #0ea5e9, #0284c7) !important;
}

.compresion-badge {
  display: inline-block;
  background: #059669;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 20px;
  letter-spacing: 0.02em;
}


/* Visor de documento dentro del modal de detalle del radicado (patrón Permisos) */
.modal-pdf-vista {
  display: flex;
  flex-direction: column;
}


/* Formulario */
.radicado-form {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.form-section-label {
  font-size: 0.73rem;
  font-weight: 700;
  color: #2563eb;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.2rem;
  margin-top: 0.2rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.form-group label {
  font-size: 0.73rem;
  font-weight: 600;
  color: #334155;
}

.req {
  color: #ef4444;
}

.btn-guardar {
  margin-top: 0.35rem;
  width: 100%;
  justify-content: center;
  padding: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
}

/* ═══════════════ HISTORIAL CORPORATIVO STYLES ═══════════════ */
.historial-panel-corporate {
  background: #ffffff;
  border-radius: 12px;
  padding: 1.1rem 1.35rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(0, 72, 132, 0.06);
}

.historial-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 1rem;
}

.historial-icon-box {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #004884 0%, #02203d 100%);
  color: #ffffff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 72, 132, 0.25);
  flex-shrink: 0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  pointer-events: none;
}

.corporate-search-input {
  padding: 0.4rem 1.8rem 0.4rem 2rem;
  font-size: 0.78rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  width: 250px;
  transition: all 0.2s ease;
  outline: none;
}

.corporate-search-input:focus {
  background: #ffffff;
  border-color: #004884;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
  width: 290px;
}

.btn-clear-search {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0 4px;
}

.btn-clear-search:hover {
  color: #334155;
}

.corporate-select {
  font-size: 0.78rem;
  border-radius: 8px;
  border-color: #cbd5e1;
  background-color: #f8fafc;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  width: auto;
  font-weight: 500;
}

.corporate-btn-action {
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  border-color: #cbd5e1;
  color: #004884;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.corporate-btn-action:hover {
  background: #004884;
  color: #ffffff;
  border-color: #004884;
}

.spin-animate {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* KPI Cards */
.kpi-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}

.kpi-body {
  padding: 0.75rem 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #64748b;
  margin-bottom: 0.2rem;
}

.kpi-number {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
}

.kpi-icon-badge {
  font-size: 1.4rem;
  opacity: 0.85;
}

.kpi-stripe {
  height: 3px;
  width: 100%;
}

.stripe-blue { background: #004884; }
.stripe-amber { background: #f59e0b; }
.stripe-red { background: #ef4444; }
.stripe-green { background: #73be28; }

/* Leyenda de Términos / Badges */
.term-legend-bar {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
}

.legend-title {
  font-size: 0.68rem;
  font-weight: 800;
  color: #475569;
  letter-spacing: 0.3px;
  margin-right: 0.2rem;
}

.term-pill {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
}

.term-pill:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.term-pill.active {
  background: #02203d;
  color: #ffffff;
  border-color: #02203d;
  box-shadow: 0 2px 6px rgba(2, 32, 61, 0.25);
}

.dot-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

/* Tabla Corporativa */
.corporate-table-wrapper {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.corporate-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.78rem;
}

.corporate-table thead tr {
  background: linear-gradient(180deg, #02203d 0%, #01182e 100%);
  color: #ffffff;
}

.corporate-table thead th {
  padding: 0.65rem 0.85rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #f1f5f9;
  border-bottom: none;
  white-space: nowrap;
  vertical-align: middle;
}

.corporate-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.corporate-row:hover {
  background-color: #f8fafc !important;
}

.corporate-row td {
  padding: 0.7rem 0.85rem;
  vertical-align: middle;
  border-bottom: 1px solid #edf2f7;
}

/* Filas según estado */
.row-resuelto {
  background-color: #fafdfb;
}

.row-activo {
  background-color: #ffffff;
}

/* N° Radicado Cell */
.radicado-code-box {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.radicado-badge {
  font-size: 0.82rem;
  font-weight: 800;
  color: #004884;
  letter-spacing: 0.2px;
}

.pdf-tag {
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  border: 1px solid #e2e8f0;
}

/* Fecha Cell */
.date-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.date-main {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.78rem;
}

.date-sub {
  font-size: 0.67rem;
  color: #64748b;
}

/* Remitente Cell */
.remitente-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 230px;
}

.remitente-name {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.8rem;
  line-height: 1.25;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.dependencia-tag {
  font-size: 0.67rem;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

/* Asunto Cell */
.asunto-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.asunto-text {
  color: #1e293b;
  font-weight: 500;
  font-size: 0.78rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.destinatario-tag {
  font-size: 0.68rem;
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
  max-width: 250px;
}

/* User Chip */
.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 140px;
}

.user-chip-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #004884;
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-chip-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
}

/* Status Pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-resuelto {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.status-resuelto .status-dot {
  background: #22c55e;
}

.status-pendiente {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.status-pendiente .status-dot {
  background: #f59e0b;
}

/* SLA Cell */
.sla-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sla-date {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.78rem;
}

.sla-tag {
  font-size: 0.67rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

.sla-resuelto {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #dcfce7;
}

.sla-normal {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
}

.sla-urgente {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fef08a;
}

.sla-critico {
  background: #ffedd5;
  color: #c2410c;
  border: 1px solid #fed7aa;
  font-weight: 700;
}

.sla-vencido {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-weight: 800;
}

/* Action Buttons */
.action-buttons-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn-action {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #f8fafc;
}

.btn-action-view {
  border-color: #cbd5e1;
  color: #475569;
}

.btn-action-view:hover {
  background: #004884;
  border-color: #004884;
  color: #ffffff;
  transform: scale(1.06);
}

.btn-action-resolve {
  border-color: #86efac;
  color: #16a34a;
  background: #f0fdf4;
}

.btn-action-resolve:hover {
  background: #16a34a;
  border-color: #16a34a;
  color: #ffffff;
  transform: scale(1.06);
}

.btn-action-delete {
  border-color: #fecaca;
  color: #dc2626;
  background: #fff5f5;
}

.btn-action-delete:hover {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
  transform: scale(1.06);
}

/* Empty State */
.empty-state-box {
  padding: 1.5rem;
  text-align: center;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background: #ffffff;
  border-radius: 12px;
  width: 92%;
  max-width: 380px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* El modal de detalle lleva el visor de PDF: más ancho para leer el documento
   (width: 92% lo mantiene responsive en pantallas pequeñas) */
.modal-viewer-wide {
  max-width: 720px;
}

.modal-header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease;
}

.animate-zoom-in {
  animation: zoomIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* ==================== ESTILOS EXCEL UNIFICADOS ==================== */
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
</style>

