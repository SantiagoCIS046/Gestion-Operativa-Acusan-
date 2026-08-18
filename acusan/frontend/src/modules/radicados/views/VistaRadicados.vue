<template>
  <div class="radicados-container">
    <!-- ═══════════════ HEADER & ACCIONES ═══════════════ -->
    <div class="radicados-header">
      <div class="header-title">
        <div class="title-icon">📊</div>
        <div>
          <h2>Control y Gestión de Radicados</h2>
          <p class="subtitle">Módulo oficial de registro documental, visor OCR y control de vencimientos — Acuasan E.S.P.</p>
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
            <p>Carga el PDF para extraer los campos con OCR automáticamente</p>
          </div>
          <input type="file" ref="fileInput" accept="application/pdf,image/*" style="display:none" @change="onFileSelected">
          <button type="button" class="btn btn-primary btn-sm" @click="$refs.fileInput.click()" :disabled="cargandoOcr">
            <span>{{ cargandoOcr ? '⏳ Procesando OCR...' : '📂 Cargar PDF / Archivo' }}</span>
          </button>
        </div>

        <div class="pdf-container-box">
          <div v-if="!pdfPreviewUrl" class="pdf-empty-state">
            <div class="pdf-big-icon">📄</div>
            <h4>Sin documento cargado</h4>
            <p>Haz clic en <strong>Cargar PDF / Archivo</strong> para previsualizar y extraer campos automáticamente.</p>
          </div>
          <iframe v-else :src="pdfPreviewUrl" class="pdf-frame"></iframe>
        </div>

        <!-- Banner de estado de OCR (Bootstrap Alert) -->
        <div 
          v-if="ocrMensaje" 
          :class="['alert', ocrError ? 'alert-danger' : 'alert-success', 'alert-dismissible', 'fade', 'show', 'mt-3', 'mb-0']" 
          role="alert"
        >
          <div class="d-flex align-items-center">
            <span class="me-2 fs-5">{{ ocrError ? '⚠️' : '✅' }}</span>
            <div class="fw-semibold">{{ ocrMensaje }}</div>
          </div>
          <button type="button" class="btn-close" @click="ocrMensaje = ''" aria-label="Close"></button>
        </div>

        <!-- Resumen de extracción de campos -->
        <div v-if="resumenOcr" class="ocr-resumen-box mt-3">
          <div class="resumen-title">
            <span>📋 Lectura Inteligente de Documento</span>
            <span class="badge bg-success">{{ resumenOcr.metodo }}</span>
          </div>
          <div class="resumen-grid">
            <div><label>N° Radicado PDF:</label> <span>{{ form.numeroRadicadoPdf || '—' }}</span></div>
            <div><label>Remitente:</label> <span>{{ form.peticionario || '—' }}</span></div>
            <div><label>Destinatario:</label> <span>{{ form.destinatario || '—' }}</span></div>
            <div><label>Asunto:</label> <span>{{ form.asunto || '—' }}</span></div>
          </div>
        </div>
      </div>

      <!-- ── COLUMNA DERECHA: Formulario de Registro ── -->
      <div class="card-panel form-panel">
        <div class="card-header">
          <h3>📝 Registrar Radicado</h3>
          <p>Diligencie los campos manualmente o mediante la extracción del PDF</p>
        </div>

        <form @submit.prevent="guardarRadicado" class="radicado-form">
          <!-- Sección 1: Datos del Sello -->
          <div class="form-section-label">📌 Datos del sello / PDF</div>
          <div class="form-row">
            <div class="form-group">
              <label>N° Radicado PDF</label>
              <input type="text" v-model="form.numeroRadicadoPdf" class="form-control form-control-sm" placeholder="Ej. 2640000645">
            </div>
            <div class="form-group">
              <label>Fecha / Hora Sello</label>
              <input type="text" v-model="form.fechaDocumento" class="form-control form-control-sm" placeholder="Ej. 22/jul/2026 5:31 PM">
            </div>
          </div>

          <div class="form-group">
            <label>Lugar y Fecha de la Carta</label>
            <input type="text" v-model="form.lugarFecha" class="form-control form-control-sm" placeholder="Ej. Pinchote, 22 Julio de 2026">
          </div>

          <!-- Sección 2: Partes -->
          <div class="form-section-label">👥 Partes del radicado</div>
          <div class="form-group">
            <label>Remitente / Peticionario <span class="req">*</span></label>
            <input type="text" v-model="form.peticionario" class="form-control form-control-sm" placeholder="Ej. Laura Dulcey Nieves" required>
          </div>

          <div class="form-group">
            <label>Empresa Destinataria <span class="req">*</span></label>
            <input type="text" v-model="form.dependencia" class="form-control form-control-sm" placeholder="Ej. EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO..." required>
          </div>

          <div class="form-group">
            <label>Destinatario (Funcionario / Área)</label>
            <input type="text" v-model="form.destinatario" class="form-control form-control-sm" placeholder="Ej. Ruiz Suarez Luz Marina - Gerencia">
          </div>

          <!-- Sección 3: Contenido -->
          <div class="form-section-label">📄 Contenido del documento</div>
          <div class="form-group">
            <label>Asunto</label>
            <input type="text" v-model="form.asunto" class="form-control form-control-sm" placeholder="Ej. Solicitud de visita técnica y medidor">
          </div>

          <div class="form-group">
            <label>Referencia</label>
            <input type="text" v-model="form.referencia" class="form-control form-control-sm" placeholder="Ej. Código de suscriptor No. 009699">
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
                <option value="3">🔴 3 Días (Crítico)</option>
                <option value="5">🟠 5 Días (Urgente)</option>
                <option value="10">🟡 10 Días (Atención)</option>
                <option value="15">🔵 15 Días (Normal)</option>
                <option value="30">🟢 30 Días (Holgado)</option>
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

      <!-- Tabla Corporativa Oficial -->
      <div class="corporate-table-wrapper">
        <table class="corporate-table">
          <thead>
            <tr>
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
              <td colspan="8" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                <span>Cargando registros oficiales de Acuasan...</span>
              </td>
            </tr>
            <tr v-else-if="!radicadosFiltrados.length">
              <td colspan="8" class="text-center py-5">
                <div class="empty-state-box">
                  <span class="fs-1 d-block mb-2">📂</span>
                  <strong class="d-block text-dark mb-1">No se encontraron radicados</strong>
                  <p class="text-muted mb-0" style="font-size: 0.8rem;">No hay registros que coincidan con los filtros aplicados.</p>
                </div>
              </td>
            </tr>
            <tr 
              v-else 
              v-for="rad in radicadosFiltrados" 
              :key="rad.id"
              :class="['corporate-row', rad.estado === 'Resuelto' ? 'row-resuelto' : 'row-activo']"
            >
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
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════ MODAL VISTA DIGITAL STAMP (ULTRA-COMPACT BOOTSTRAP MODAL) ═══════════════ -->
    <div v-if="modalRadicado" class="modal-overlay" @click.self="modalRadicado = null">
      <div class="modal-card modal-card-micro animate-zoom-in">
        <div class="modal-header bg-light py-1 px-2 border-bottom">
          <div class="modal-header-info d-flex align-items-center gap-2">
            <span class="modal-icon fs-6">🏛️</span>
            <div>
              <strong class="modal-title fw-bold mb-0 text-dark" style="font-size: 0.8rem;">{{ modalRadicado.numeroRadicado }}</strong>
              <div class="text-muted" style="font-size: 0.62rem;">Registrado: {{ formatearFechaHora(modalRadicado.fechaRadicacion) }}</div>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-sm" @click="modalRadicado = null" aria-label="Close"></button>
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

          <!-- 📎 DOCUMENTO / ARCHIVO ADJUNTO INTERACTIVO -->
          <div 
            class="alert alert-info mb-0 p-1 px-2 d-flex align-items-center justify-content-between border border-info shadow-sm"
            @click="abrirArchivoAdjunto(modalRadicado)"
            title="Haz clic para abrir o previsualizar el archivo"
            style="cursor: pointer;"
          >
            <div class="d-flex align-items-center gap-1 overflow-hidden me-1">
              <span class="fs-6">📎</span>
              <div class="text-truncate">
                <small class="d-block text-muted fw-bold" style="font-size: 0.58rem;">DOCUMENTO / ARCHIVO ADJUNTO</small>
                <strong class="text-dark d-block text-truncate" style="font-size: 0.7rem;">
                  {{ modalRadicado.archivoNombre || (modalRadicado.numeroRadicadoPdf ? modalRadicado.numeroRadicadoPdf + '.pdf' : 'Radicado.pdf') }}
                </strong>
              </div>
            </div>
            <button class="btn btn-primary btn-sm py-0.5 px-2 fw-bold flex-shrink-0" style="font-size: 0.65rem;" type="button">
              👁️ Abrir Archivo
            </button>
          </div>

        </div>

        <div class="modal-footer bg-light p-1 pe-2 border-top">
          <button class="btn btn-secondary btn-sm px-2 py-0.5" style="font-size: 0.72rem;" @click="modalRadicado = null">Cerrar</button>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import radicadosService from '../services/radicadosService.js'
import authService from '../../auth/services/authService.js'

// Estado
const listaRadicados = ref([])
const cargandoTabla = ref(false)
const guardando = ref(false)
const cargandoOcr = ref(false)
const verHistorial = ref(true)
const mostrarAlertas = ref(false)
const modalRadicado = ref(null)
const pdfPreviewUrl = ref(null)
const ocrMensaje = ref('')
const ocrError = ref(false)
const resumenOcr = ref(null)
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

const form = reactive({
  numeroRadicadoPdf: '',
  fechaDocumento: '',
  lugarFecha: '',
  peticionario: '',
  dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
  destinatario: '',
  asunto: '',
  referencia: '',
  contexto: '',
  registradoPor: usuarioActual?.nombre || 'Encargada',
  diasParaVencer: 10,
  archivoNombre: null,
  archivoBase64: ''
})


const excelUrl = computed(() => radicadosService.getDescargarExcelUrl())

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

onMounted(() => {
  CargarLista()
  // Auto-actualización automática en tiempo real cada 6 segundos
  timerAutoRefresh = setInterval(() => {
    CargarLista(true)
  }, 6000)
})

onUnmounted(() => {
  if (timerAutoRefresh) clearInterval(timerAutoRefresh)
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

// OCR & PDF Upload
const onFileSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  pdfPreviewUrl.value = URL.createObjectURL(file)
  form.archivoNombre = file.name

  // Convertir a base64 para almacenar el documento PDF original en la BD
  const reader = new FileReader()
  reader.onload = (e) => {
    form.archivoBase64 = e.target.result
  }
  reader.readAsDataURL(file)


  try {
    cargandoOcr.value = true
    ocrMensaje.value = '🔍 Analizando y extrayendo campos con OCR de Acuasan...'
    ocrError.value = false
    resumenOcr.value = null

    const resultado = await radicadosService.extraerPdf(file)

    form.numeroRadicadoPdf = resultado.numeroRadicadoPdf || form.numeroRadicadoPdf
    form.fechaDocumento = resultado.fechaDocumento || form.fechaDocumento
    form.lugarFecha = resultado.lugarFecha || form.lugarFecha
    form.peticionario = resultado.peticionario || form.peticionario
    form.dependencia = resultado.dependencia || form.dependencia
    form.destinatario = resultado.destinatario || form.destinatario
    form.asunto = resultado.asunto || form.asunto
    form.referencia = resultado.referencia || form.referencia
    form.contexto = resultado.contexto || form.contexto
    form.diasParaVencer = resultado.diasParaVencer || 10

    resumenOcr.value = resultado
    ocrMensaje.value = `Extracción completada exitosamente (${resultado.metodo})`
    mostrarAlertaBootstrap('Lectura OCR Exitosa', `Se extrajeron los datos del archivo ${file.name}`, 'success')
  } catch (err) {
    console.error(err)
    ocrError.value = true
    ocrMensaje.value = 'No se pudo realizar el OCR automático. Por favor complete los campos manualmente.'
    mostrarAlertaBootstrap('Aviso OCR', 'Complete los campos manualmente.', 'warning')
  } finally {
    cargandoOcr.value = false
  }
}

// Guardar
const guardarRadicado = async () => {
  try {
    guardando.value = true
    const nuevoRad = await radicadosService.crear(form)
    mostrarAlertaBootstrap('Radicado Registrado', `Se guardó exitosamente el radicado ${nuevoRad.numeroRadicado}`, 'success')
    
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
    pdfPreviewUrl.value = null

    resumenOcr.value = null
    ocrMensaje.value = ''

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

const abrirModal = (rad) => {
  modalRadicado.value = rad
}

const abrirArchivoAdjunto = (rad) => {
  modalRadicado.value = null

  const base64Data = (rad && rad.archivoBase64) || form.archivoBase64

  if (base64Data) {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html style="margin:0;height:100%;">
        <head>
          <title>Documento Original Escaneado - ${rad ? rad.numeroRadicado : 'Radicado'}</title>
        </head>
        <body style="margin:0;height:100%;overflow:hidden;background:#525659;">
          <iframe src="${base64Data}" width="100%" height="100%" frameborder="0"></iframe>
        </body>
        </html>
      `)
      win.document.close()
      mostrarAlertaBootstrap('Archivo Original', `Visualizando el documento original escaneado.`, 'success')
      return
    }
  }

  if (pdfPreviewUrl.value) {
    window.open(pdfPreviewUrl.value, '_blank')
    mostrarAlertaBootstrap('Documento Abierto', `Se abrió el archivo PDF original en una nueva pestaña.`, 'success')
    return
  }

  if (rad && rad.archivoUrl) {
    window.open(rad.archivoUrl, '_blank')
    mostrarAlertaBootstrap('Documento Abierto', `Se abrió el archivo adjunto original.`, 'success')
    return
  }

  mostrarAlertaBootstrap('Aviso Documento', `No hay archivo PDF escaneado guardado para este registro anterior. Suba el PDF desde el visor para guardar copias completas.`, 'warning')
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

.ocr-resumen-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
}

.resumen-title {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.35rem;
}

.resumen-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
  font-size: 0.73rem;
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

</style>

