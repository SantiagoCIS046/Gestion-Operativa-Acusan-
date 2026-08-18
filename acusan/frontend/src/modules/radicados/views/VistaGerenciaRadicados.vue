<template>
  <div class="radicados-gerencia-container">
    <!-- ═══════════════ HEADER GERENCIAL CON IDENTIDAD ACUASAN ═══════════════ -->
    <div class="gerencia-header">
      <div class="header-left">
        <div class="header-badge-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <path d="M10 9H8"></path>
          </svg>
        </div>
        <div>
          <div class="d-flex align-items-center gap-2">
            <h2 class="header-title m-0">Supervisión Gerencial de Radicados</h2>
            <span class="badge bg-primary text-white px-2 py-1" style="font-size: 0.72rem;">
              Auditoría Oficial
            </span>
          </div>
          <p class="header-subtitle m-0">
            Control de correspondencia ingresada por la encargada <strong>Eliana</strong> y el ayudante <strong>Román</strong> — Acuasan E.S.P.
          </p>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN DEL HEADER -->
      <div class="header-right d-flex align-items-center gap-2 flex-wrap">
        <!-- BOTÓN PRINCIPAL DE ALERTAS DE RADICACIONES SUBIDAS -->
        <button 
          type="button"
          :class="['btn-alerta-radicados', modalAlertasVisible ? 'active' : '']"
          @click="abrirPanelAlertas"
          title="Ver registro de radicaciones subidas con fecha y hora"
        >
          <span class="bell-icon-wrapper">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span v-if="radicadosRecientes.length" class="bell-badge-count">{{ radicadosRecientes.length }}</span>
          </span>
          <span class="btn-text">Alertas de Subidas</span>
        </button>

        <button 
          type="button" 
          class="btn-refresh-gerencia" 
          @click="cargarDatos(false)" 
          :disabled="cargando"
          title="Recargar datos del servidor"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'spin-anim': cargando }">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Sincronizar</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════ KPIS DE CONTROL GERENCIAL ═══════════════ -->
    <div class="row g-2 mb-3">
      <!-- Total Radicados -->
      <div class="col-6 col-md-3">
        <div class="gerencia-kpi-card">
          <div class="kpi-top">
            <span class="kpi-name">TOTAL RADICACIONES</span>
            <div class="kpi-icon kpi-icon-blue">📁</div>
          </div>
          <div class="kpi-val">{{ listaRadicados.length }}</div>
          <div class="kpi-sub">Radicados en sistema</div>
          <div class="kpi-bar bar-blue"></div>
        </div>
      </div>

      <!-- Subidos por Eliana -->
      <div class="col-6 col-md-3">
        <div 
          class="gerencia-kpi-card card-interactive" 
          @click="filtroResponsable = filtroResponsable === 'Eliana' ? '' : 'Eliana'"
          :class="{ 'card-selected': filtroResponsable === 'Eliana' }"
          title="Clic para filtrar radicados de Eliana"
        >
          <div class="kpi-top">
            <span class="kpi-name">SUBIDOS POR ELIANA</span>
            <div class="kpi-icon kpi-icon-purple">👩‍💼</div>
          </div>
          <div class="kpi-val text-primary">{{ statsEliana }}</div>
          <div class="kpi-sub">Encargada de Ventanilla</div>
          <div class="kpi-bar bar-purple"></div>
        </div>
      </div>

      <!-- Subidos por Román -->
      <div class="col-6 col-md-3">
        <div 
          class="gerencia-kpi-card card-interactive" 
          @click="filtroResponsable = filtroResponsable === 'Román' ? '' : 'Román'"
          :class="{ 'card-selected': filtroResponsable === 'Román' }"
          title="Clic para filtrar radicados de Román"
        >
          <div class="kpi-top">
            <span class="kpi-name">SUBIDOS POR ROMÁN</span>
            <div class="kpi-icon kpi-icon-teal">👨‍💼</div>
          </div>
          <div class="kpi-val text-info-emphasis">{{ statsRoman }}</div>
          <div class="kpi-sub">Ayudante / Encargado</div>
          <div class="kpi-bar bar-teal"></div>
        </div>
      </div>

      <!-- Pendientes / Vencidos -->
      <div class="col-6 col-md-3">
        <div 
          class="gerencia-kpi-card card-interactive" 
          @click="filtroEstado = filtroEstado === 'Pendiente' ? '' : 'Pendiente'"
          :class="{ 'card-selected': filtroEstado === 'Pendiente' }"
          title="Clic para filtrar pendientes"
        >
          <div class="kpi-top">
            <span class="kpi-name">PENDIENTES EN TÉRMINO</span>
            <div class="kpi-icon kpi-icon-amber">⏳</div>
          </div>
          <div class="kpi-val text-warning-emphasis">{{ statsPendientes }}</div>
          <div class="kpi-sub">{{ statsVencidos }} con vencimiento crítico</div>
          <div class="kpi-bar bar-amber"></div>
        </div>
      </div>
    </div>

    <!-- ═══════════════ PANEL DE HISTORIAL GERENCIAL ═══════════════ -->
    <div class="gerencia-table-card">
      <!-- Toolbar y Filtros -->
      <div class="table-toolbar">
        <div class="toolbar-left d-flex align-items-center gap-2 flex-wrap">
          <div class="search-box-gerencia">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              v-model="busqueda" 
              placeholder="Buscar por N° radicado, remitente, asunto..."
              class="input-search"
            />
            <button v-if="busqueda" class="btn-clear" @click="busqueda = ''">✕</button>
          </div>

          <!-- Filtro por Funcionario Responsable -->
          <select v-model="filtroResponsable" class="form-select form-select-sm select-gerencia">
            <option value="">👤 Todos los Responsables</option>
            <option value="Eliana">👩‍💼 Solo Eliana</option>
            <option value="Román">👨‍💼 Solo Román</option>
          </select>

          <!-- Filtro por Estado -->
          <select v-model="filtroEstado" class="form-select form-select-sm select-gerencia">
            <option value="">📋 Todos los Estados</option>
            <option value="Pendiente">⏳ Pendientes</option>
            <option value="Resuelto">✅ Resueltos</option>
          </select>
        </div>

        <div class="toolbar-right d-flex align-items-center gap-2">
          <!-- Filtro de Semáforo Rápido -->
          <div class="d-flex align-items-center gap-1">
            <button 
              type="button" 
              :class="['filter-chip', filtroSla === '' ? 'active' : '']" 
              @click="filtroSla = ''"
            >
              Todos ({{ listaRadicados.length }})
            </button>
            <button 
              type="button" 
              :class="['filter-chip chip-critico', filtroSla === 'critico' ? 'active' : '']" 
              @click="filtroSla = filtroSla === 'critico' ? '' : 'critico'"
            >
              <span class="dot dot-red"></span> Críticos / Vencidos ({{ statsVencidos }})
            </button>
            <button 
              type="button" 
              :class="['filter-chip chip-resuelto', filtroSla === 'resuelto' ? 'active' : '']" 
              @click="filtroSla = filtroSla === 'resuelto' ? '' : 'resuelto'"
            >
              <span class="dot dot-green"></span> Resueltos ({{ statsResueltos }})
            </button>
          </div>
        </div>
      </div>

      <!-- TABLA GERENCIAL DE TRAZABILIDAD -->
      <div class="table-responsive-wrapper">
        <table class="gerencia-table">
          <thead>
            <tr>
              <th style="width: 140px;">N° RADICADO</th>
              <th style="width: 130px;">FECHA Y HORA REG.</th>
              <th style="width: 150px;">RADICADO POR</th>
              <th style="width: 240px;">REMITENTE / PETICIONARIO</th>
              <th>ASUNTO / DESTINATARIO</th>
              <th style="width: 110px; text-align: center;">ESTADO</th>
              <th style="width: 135px;">VENCIMIENTO / SLA</th>
              <th style="width: 90px; text-align: center;">DETALLE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargando && !listaRadicados.length">
              <td colspan="8" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                <span>Cargando auditoría de radicados de Acuasan...</span>
              </td>
            </tr>
            <tr v-else-if="!radicadosFiltrados.length">
              <td colspan="8" class="text-center py-5 text-muted">
                <div class="empty-state">
                  <span class="fs-2 d-block mb-1">🔍</span>
                  <strong>No se encontraron registros de radicación</strong>
                  <p class="small text-muted mb-0">Modifique los filtros de búsqueda para consultar otros periodos.</p>
                </div>
              </td>
            </tr>
            <tr 
              v-else 
              v-for="rad in radicadosFiltrados" 
              :key="rad.id"
              class="gerencia-row"
            >
              <!-- N° Radicado -->
              <td>
                <div class="d-flex flex-column gap-1">
                  <span class="radicado-id">{{ rad.numeroRadicado }}</span>
                  <span v-if="rad.numeroRadicadoPdf" class="pdf-pill" :title="'Sello PDF: ' + rad.numeroRadicadoPdf">
                    📄 {{ rad.numeroRadicadoPdf }}
                  </span>
                </div>
              </td>

              <!-- Fecha y Hora Exacta de Subida -->
              <td>
                <div class="time-block">
                  <span class="time-date">{{ formatearFecha(rad.fechaRadicacion) }}</span>
                  <span class="time-hour">🕒 {{ obtenerHoraFormateada(rad.fechaRadicacion) }}</span>
                </div>
              </td>

              <!-- Radicado Por (Eliana / Román / Otro) -->
              <td>
                <div class="responsable-badge-box">
                  <div :class="['avatar-circle', getAvatarClass(rad.registradoPor)]">
                    {{ getIniciales(rad.registradoPor) }}
                  </div>
                  <div class="responsable-info">
                    <span class="responsable-name text-truncate" :title="rad.registradoPor">{{ rad.registradoPor || 'Encargada' }}</span>
                    <span class="responsable-rol">{{ getRolTexto(rad.registradoPor) }}</span>
                  </div>
                </div>
              </td>

              <!-- Remitente / Peticionario -->
              <td>
                <div class="remitente-box">
                  <div class="remitente-title" :title="rad.peticionario">{{ formatNombre(rad.peticionario) }}</div>
                  <div class="remitente-sub text-truncate" :title="rad.dependencia">
                    🏢 {{ rad.dependencia || 'Acuasan E.S.P.' }}
                  </div>
                </div>
              </td>

              <!-- Asunto / Destinatario -->
              <td>
                <div class="asunto-box">
                  <div class="asunto-title" :title="rad.asunto">{{ rad.asunto || 'Sin asunto especificado' }}</div>
                  <div v-if="rad.destinatario" class="destinatario-badge text-truncate" :title="'Destino: ' + rad.destinatario">
                    <span class="fw-bold">Para:</span> {{ rad.destinatario }}
                  </div>
                </div>
              </td>

              <!-- Estado -->
              <td style="text-align: center;">
                <span :class="['estado-pill', rad.estado === 'Resuelto' ? 'estado-resuelto' : 'estado-pendiente']">
                  <span class="dot-status"></span>
                  {{ rad.estado }}
                </span>
              </td>

              <!-- Vencimiento / SLA -->
              <td>
                <div class="vencimiento-box">
                  <span class="vencimiento-date">{{ formatearFecha(rad.fechaVencimiento) }}</span>
                  <span :class="['vencimiento-tag', getSlaTagClass(rad)]">
                    {{ getDiasRestantesTexto(rad) }}
                  </span>
                </div>
              </td>

              <!-- Acciones -->
              <td style="text-align: center;">
                <button 
                  type="button" 
                  class="btn-ver-detalle" 
                  @click="abrirModalDetalle(rad)" 
                  title="Ver expediente y sello de radicación"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════ MODAL / PANEL DE ALERTAS DE RADICACIONES SUBIDAS ═══════════════ -->
    <div v-if="modalAlertasVisible" class="modal-backdrop-custom" @click.self="modalAlertasVisible = false">
      <div class="modal-alertas-card animate-zoom-in">
        <!-- Header del Modal -->
        <div class="modal-alertas-header">
          <div class="d-flex align-items-center gap-2">
            <div class="bell-badge-large">🔔</div>
            <div>
              <h5 class="modal-alertas-title m-0">Trazabilidad de Radicaciones Subidas</h5>
              <span class="modal-alertas-subtitle">Notificaciones cronológicas de correspondencia registrada</span>
            </div>
          </div>
          <button type="button" class="btn-close-custom" @click="modalAlertasVisible = false">✕</button>
        </div>

        <!-- Lista de Notificaciones de Subida -->
        <div class="modal-alertas-body">
          <div class="alertas-info-bar mb-3">
            <span>Se listan las radicaciones registradas en el sistema por <strong>Eliana</strong> y <strong>Román</strong> con marca de tiempo.</span>
          </div>

          <div v-if="!listaRadicados.length" class="text-center py-4 text-muted">
            No hay radicaciones registradas recientemente.
          </div>

          <div class="timeline-subidas">
            <div 
              v-for="(rad, idx) in radicadosOrdenadosPorSubida" 
              :key="rad.id || idx"
              class="timeline-item"
            >
              <div class="timeline-bullet" :class="rad.registradoPor && rad.registradoPor.toLowerCase().includes('eliana') ? 'bullet-eliana' : 'bullet-roman'">
                {{ getIniciales(rad.registradoPor) }}
              </div>
              <div class="timeline-content">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                  <div>
                    <strong class="timeline-rad-code">{{ rad.numeroRadicado }}</strong>
                    <span class="timeline-user ms-2">
                      Subido por <strong>{{ rad.registradoPor || 'Encargada' }}</strong>
                    </span>
                  </div>
                  <span class="timeline-timestamp">
                    📅 {{ formatearFecha(rad.fechaRadicacion) }} — 🕒 {{ obtenerHoraFormateada(rad.fechaRadicacion) }}
                  </span>
                </div>

                <div class="timeline-asunto mb-1">
                  <strong>Asunto:</strong> {{ rad.asunto || 'Sin asunto' }}
                </div>

                <div class="d-flex justify-content-between align-items-center flex-wrap gap-1 mt-2 pt-1 border-top border-light">
                  <small class="text-muted text-truncate" style="max-width: 280px;">
                    👤 {{ rad.peticionario }}
                  </small>
                  <div class="d-flex align-items-center gap-2">
                    <span :class="['badge-mini', rad.estado === 'Resuelto' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis']">
                      {{ rad.estado }}
                    </span>
                    <button class="btn-micro-view" @click="abrirDetalleDesdeAlerta(rad)">
                      Ver Detalles 👁️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-alertas-footer">
          <button type="button" class="btn btn-sm btn-secondary px-3" @click="modalAlertasVisible = false">Cerrar Notificaciones</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════ MODAL DETALLE DE EXPEDIENTE / SELLO DIGITAL ═══════════════ -->
    <div v-if="radicadoSeleccionado" class="modal-backdrop-custom" @click.self="radicadoSeleccionado = null">
      <div class="modal-detalle-card animate-zoom-in">
        <div class="modal-detalle-header">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-5">🏛️</span>
            <div>
              <strong class="text-dark fw-bold" style="font-size: 0.9rem;">Expediente de Radicación Oficial</strong>
              <div class="text-muted" style="font-size: 0.72rem;">ACUASAN E.S.P. — Control Gerencial</div>
            </div>
          </div>
          <button type="button" class="btn-close-custom" @click="radicadoSeleccionado = null">✕</button>
        </div>

        <div class="modal-detalle-body">
          <!-- Sello Digital Acuasan -->
          <div class="sello-digital-box mb-3">
            <div class="sello-top">SELLO DIGITAL INSTITUCIONAL — ACUASAN E.S.P.</div>
            <div class="sello-rad-code">{{ radicadoSeleccionado.numeroRadicado }}</div>
            <div class="sello-meta">
              <span>Registrado: {{ formatearFechaHora(radicadoSeleccionado.fechaRadicacion) }}</span>
              <span>•</span>
              <span>Responsable: {{ radicadoSeleccionado.registradoPor }}</span>
            </div>
          </div>

          <div class="row g-2 mb-3" style="font-size: 0.76rem;">
            <div class="col-6">
              <label class="text-muted d-block small">N° Radicado PDF:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.numeroRadicadoPdf || '—' }}</strong>
            </div>
            <div class="col-6">
              <label class="text-muted d-block small">Fecha / Hora del Sello:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.fechaDocumento || '—' }}</strong>
            </div>
            <div class="col-12">
              <label class="text-muted d-block small">Remitente / Peticionario:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.peticionario }}</strong>
            </div>
            <div class="col-12">
              <label class="text-muted d-block small">Empresa / Dependencia Destino:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.dependencia }}</strong>
            </div>
            <div class="col-12" v-if="radicadoSeleccionado.destinatario">
              <label class="text-muted d-block small">Funcionario Destinatario:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.destinatario }}</strong>
            </div>
            <div class="col-12">
              <label class="text-muted d-block small">Asunto:</label>
              <strong class="text-dark">{{ radicadoSeleccionado.asunto || '—' }}</strong>
            </div>
            <div class="col-6">
              <label class="text-muted d-block small">Fecha Vencimiento:</label>
              <strong class="text-dark">{{ formatearFecha(radicadoSeleccionado.fechaVencimiento) }}</strong>
            </div>
            <div class="col-6">
              <label class="text-muted d-block small">Estado del Trámite:</label>
              <span :class="['badge', radicadoSeleccionado.estado === 'Resuelto' ? 'bg-success' : 'bg-warning text-dark']">
                {{ radicadoSeleccionado.estado }}
              </span>
            </div>
          </div>

          <div v-if="radicadoSeleccionado.contexto" class="alert alert-light border p-2 mb-3" style="font-size: 0.74rem;">
            <strong class="d-block mb-1 text-secondary">Observaciones / Contexto:</strong>
            <p class="mb-0 text-dark">{{ radicadoSeleccionado.contexto }}</p>
          </div>

          <!-- Documento Adjunto PDF -->
          <div class="adjunto-box" @click="abrirDocumento(radicadoSeleccionado)">
            <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
              <span class="fs-5">📄</span>
              <div class="text-truncate">
                <span class="d-block text-muted" style="font-size: 0.65rem; font-weight: 700;">DOCUMENTO PDF OFICIAL</span>
                <strong class="text-dark text-truncate d-block" style="font-size: 0.75rem;">
                  {{ radicadoSeleccionado.archivoNombre || (radicadoSeleccionado.numeroRadicadoPdf ? radicadoSeleccionado.numeroRadicadoPdf + '.pdf' : 'Radicado.pdf') }}
                </strong>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-primary px-2 py-1 fw-bold" style="font-size: 0.72rem;">
              Abrir PDF 👁️
            </button>
          </div>
        </div>

        <div class="modal-detalle-footer">
          <button type="button" class="btn btn-sm btn-secondary" @click="radicadoSeleccionado = null">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import radicadosService from '../services/radicadosService.js'

// Estado
const listaRadicados = ref([])
const cargando = ref(false)
const busqueda = ref('')
const filtroResponsable = ref('')
const filtroEstado = ref('')
const filtroSla = ref('')
const modalAlertasVisible = ref(false)
const radicadoSeleccionado = ref(null)
let timerAutoRefresh = null

// Cargar datos
const cargarDatos = async (silencioso = false) => {
  try {
    if (!silencioso) cargando.value = true
    const datos = await radicadosService.obtenerTodos()
    listaRadicados.value = datos || []
  } catch (err) {
    console.error('Error al cargar radicados en gerencia:', err)
  } finally {
    if (!silencioso) cargando.value = false
  }
}

const onStorageChange = (e) => {
  if (e.key === 'acuasan_radicados_db' || !e.key) {
    cargarDatos(true)
  }
}

onMounted(() => {
  cargarDatos()
  window.addEventListener('storage', onStorageChange)
  // Actualización periódica silenciosa desde la base local reactiva
  timerAutoRefresh = setInterval(() => {
    cargarDatos(true)
  }, 5000)
})

onUnmounted(() => {
  if (timerAutoRefresh) clearInterval(timerAutoRefresh)
  window.removeEventListener('storage', onStorageChange)
})

// Helper para días restantes
const calcularDiasRestantes = (fechaVencimiento) => {
  if (!fechaVencimiento) return 0
  const fVenc = new Date(fechaVencimiento)
  const hoy = new Date()
  hoy.setHours(0,0,0,0)
  fVenc.setHours(0,0,0,0)
  return Math.ceil((fVenc - hoy) / (1000 * 60 * 60 * 24))
}

// Estadísticas de Resumen Gerencial
const statsEliana = computed(() => {
  return listaRadicados.value.filter(r => r.registradoPor && r.registradoPor.toLowerCase().includes('eliana')).length
})

const statsRoman = computed(() => {
  return listaRadicados.value.filter(r => r.registradoPor && (r.registradoPor.toLowerCase().includes('román') || r.registradoPor.toLowerCase().includes('roman'))).length
})

const statsPendientes = computed(() => {
  return listaRadicados.value.filter(r => r.estado !== 'Resuelto').length
})

const statsVencidos = computed(() => {
  return listaRadicados.value.filter(r => {
    if (r.estado === 'Resuelto') return false
    return calcularDiasRestantes(r.fechaVencimiento) <= 3
  }).length
})

const statsResueltos = computed(() => {
  return listaRadicados.value.filter(r => r.estado === 'Resuelto').length
})

// Radicados ordenados cronológicamente por subida (más recientes primero)
const radicadosOrdenadosPorSubida = computed(() => {
  return [...listaRadicados.value].sort((a, b) => {
    const dateA = a.fechaRadicacion ? new Date(a.fechaRadicacion).getTime() : 0
    const dateB = b.fechaRadicacion ? new Date(b.fechaRadicacion).getTime() : 0
    return dateB - dateA
  })
})

const radicadosRecientes = computed(() => {
  return listaRadicados.value.filter(r => r.estado !== 'Resuelto')
})

// Filtros combinados
const radicadosFiltrados = computed(() => {
  return listaRadicados.value.filter(r => {
    // Filtro de texto
    const txt = `${r.numeroRadicado} ${r.peticionario} ${r.asunto} ${r.numeroRadicadoPdf} ${r.dependencia} ${r.destinatario} ${r.registradoPor}`.toLowerCase()
    const matchBusqueda = !busqueda.value || txt.includes(busqueda.value.toLowerCase())

    // Filtro de responsable
    let matchResponsable = true
    if (filtroResponsable.value === 'Eliana') {
      matchResponsable = r.registradoPor && r.registradoPor.toLowerCase().includes('eliana')
    } else if (filtroResponsable.value === 'Román') {
      matchResponsable = r.registradoPor && (r.registradoPor.toLowerCase().includes('román') || r.registradoPor.toLowerCase().includes('roman'))
    }

    // Filtro de estado
    const matchEstado = !filtroEstado.value || r.estado === filtroEstado.value

    // Filtro SLA
    let matchSla = true
    if (filtroSla.value === 'critico') {
      matchSla = r.estado !== 'Resuelto' && calcularDiasRestantes(r.fechaVencimiento) <= 3
    } else if (filtroSla.value === 'resuelto') {
      matchSla = r.estado === 'Resuelto'
    }

    return matchBusqueda && matchResponsable && matchEstado && matchSla
  })
})

// Helpers
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
  if (!fecha) return '08:30 AM'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '08:30 AM'
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

const formatNombre = (nombre) => {
  if (!nombre) return 'No especificado'
  if (nombre === nombre.toUpperCase() && nombre.length > 4) {
    return nombre.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  return nombre
}

const getIniciales = (nombre) => {
  if (!nombre) return 'AC'
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

const getAvatarClass = (nombre) => {
  const n = (nombre || '').toLowerCase()
  if (n.includes('eliana')) return 'avatar-eliana'
  if (n.includes('roman') || n.includes('román')) return 'avatar-roman'
  return 'avatar-default'
}

const getRolTexto = (nombre) => {
  const n = (nombre || '').toLowerCase()
  if (n.includes('eliana')) return 'Encargada Radicaciones'
  if (n.includes('roman') || n.includes('román')) return 'Ayudante / Encargado'
  return 'Funcionario'
}

const getDiasRestantesTexto = (rad) => {
  if (rad.estado === 'Resuelto') return 'Resuelto'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return `Vencido (${Math.abs(dias)}d)`
  if (dias === 0) return 'Vence Hoy'
  return `${dias} días restantes`
}

const getSlaTagClass = (rad) => {
  if (rad.estado === 'Resuelto') return 'sla-resuelto'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return 'sla-vencido'
  if (dias <= 3) return 'sla-critico'
  if (dias <= 7) return 'sla-urgente'
  return 'sla-normal'
}

const abrirPanelAlertas = () => {
  modalAlertasVisible.value = true
}

const abrirModalDetalle = (rad) => {
  radicadoSeleccionado.value = rad
}

const abrirDetalleDesdeAlerta = (rad) => {
  modalAlertasVisible.value = false
  radicadoSeleccionado.value = rad
}

const abrirDocumento = (rad) => {
  if (rad && rad.archivoBase64) {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html style="margin:0;height:100%;">
        <head><title>Expediente Radicado - ${rad.numeroRadicado}</title></head>
        <body style="margin:0;height:100%;overflow:hidden;background:#525659;">
          <iframe src="${rad.archivoBase64}" width="100%" height="100%" frameborder="0"></iframe>
        </body>
        </html>
      `)
      win.document.close()
    }
  } else if (rad && rad.urlDocumento) {
    window.open(rad.urlDocumento, '_blank')
  } else {
    alert('Visualizando documento digital registrado en el sistema.')
  }
}
</script>

<style scoped>
.radicados-gerencia-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.gerencia-header {
  background: #ffffff;
  border-radius: 12px;
  padding: 1rem 1.35rem;
  border: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0, 72, 132, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-badge-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #004884 0%, #02203d 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 72, 132, 0.25);
  flex-shrink: 0;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.2px;
}

.header-subtitle {
  font-size: 0.78rem;
  color: #64748b;
}

/* Botón Alertas de Radicados */
.btn-alerta-radicados {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.45rem 1rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(217, 119, 6, 0.3);
  transition: all 0.2s ease;
}

.btn-alerta-radicados:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 14px rgba(217, 119, 6, 0.4);
  color: #ffffff;
}

.btn-alerta-radicados.active {
  background: #b45309;
}

.bell-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.bell-badge-count {
  position: absolute;
  top: -6px;
  right: -8px;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 10px;
  border: 1.5px solid #ffffff;
}

.btn-refresh-gerencia {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.45rem 0.85rem;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #004884;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh-gerencia:hover {
  background: #004884;
  color: #ffffff;
  border-color: #004884;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* KPI Cards */
.gerencia-kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease;
}

.card-interactive {
  cursor: pointer;
}

.card-interactive:hover {
  transform: translateY(-2px);
  border-color: #004884;
  box-shadow: 0 4px 12px rgba(0, 72, 132, 0.08);
}

.card-selected {
  border-color: #004884;
  background: #f0f7ff;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

.kpi-name {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.4px;
}

.kpi-icon {
  font-size: 1.1rem;
}

.kpi-val {
  font-size: 1.45rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.kpi-sub {
  font-size: 0.68rem;
  color: #94a3b8;
}

.kpi-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.bar-blue { background: #004884; }
.bar-purple { background: #8b5cf6; }
.bar-teal { background: #0d9488; }
.bar-amber { background: #f59e0b; }

/* Tabla Panel */
.gerencia-table-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 1.1rem 1.35rem;
  box-shadow: 0 4px 16px rgba(0, 72, 132, 0.06);
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid #f1f5f9;
}

.search-box-gerencia {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box-gerencia svg {
  position: absolute;
  left: 10px;
  pointer-events: none;
}

.input-search {
  padding: 0.4rem 1.6rem 0.4rem 2rem;
  font-size: 0.78rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  width: 270px;
  outline: none;
  transition: all 0.2s ease;
}

.input-search:focus {
  background: #ffffff;
  border-color: #004884;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
  width: 310px;
}

.btn-clear {
  position: absolute;
  right: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
}

.select-gerencia {
  font-size: 0.78rem;
  border-radius: 8px;
  border-color: #cbd5e1;
  background-color: #f8fafc;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  width: auto;
  font-weight: 500;
}

.filter-chip {
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

.filter-chip:hover {
  background: #f1f5f9;
}

.filter-chip.active {
  background: #02203d;
  color: #ffffff;
  border-color: #02203d;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot-red { background: #ef4444; }
.dot-green { background: #22c55e; }

/* Tabla */
.table-responsive-wrapper {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.gerencia-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.78rem;
}

.gerencia-table thead tr {
  background: linear-gradient(180deg, #02203d 0%, #01182e 100%);
  color: #ffffff;
}

.gerencia-table thead th {
  padding: 0.65rem 0.85rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #f1f5f9;
  border-bottom: none;
  white-space: nowrap;
}

.gerencia-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.gerencia-row:hover {
  background-color: #f8fafc;
}

.gerencia-row td {
  padding: 0.7rem 0.85rem;
  vertical-align: middle;
  border-bottom: 1px solid #edf2f7;
}

.radicado-id {
  font-size: 0.82rem;
  font-weight: 800;
  color: #004884;
}

.pdf-pill {
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  width: fit-content;
  border: 1px solid #e2e8f0;
}

.time-block {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.time-date {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.78rem;
}

.time-hour {
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 500;
}

/* Responsable Box */
.responsable-badge-box {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 150px;
}

.avatar-circle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-eliana { background: #8b5cf6; }
.avatar-roman  { background: #0d9488; }
.avatar-default { background: #004884; }

.responsable-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.responsable-name {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
}

.responsable-rol {
  font-size: 0.63rem;
  color: #64748b;
}

/* Remitente */
.remitente-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 240px;
}

.remitente-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.8rem;
  line-height: 1.25;
}

.remitente-sub {
  font-size: 0.67rem;
  color: #475569;
}

/* Asunto */
.asunto-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asunto-title {
  color: #1e293b;
  font-weight: 500;
  font-size: 0.78rem;
  line-height: 1.3;
}

.destinatario-badge {
  font-size: 0.68rem;
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

/* Estado Pill */
.estado-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
}

.dot-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.estado-resuelto {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.estado-resuelto .dot-status { background: #22c55e; }

.estado-pendiente {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}
.estado-pendiente .dot-status { background: #f59e0b; }

/* Vencimiento */
.vencimiento-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vencimiento-date {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.78rem;
}

.vencimiento-tag {
  font-size: 0.67rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

.sla-resuelto { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
.sla-normal   { background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
.sla-urgente  { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
.sla-critico  { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
.sla-vencido  { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }

.btn-ver-detalle {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-ver-detalle:hover {
  background: #004884;
  border-color: #004884;
  color: #ffffff;
  transform: scale(1.08);
}

/* Modales */
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(2, 32, 61, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1rem;
}

.modal-alertas-card {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 580px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-alertas-header {
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #02203d 0%, #004884 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bell-badge-large {
  font-size: 1.4rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 8px;
  border-radius: 8px;
}

.modal-alertas-title {
  font-size: 1rem;
  font-weight: 800;
  color: #ffffff;
}

.modal-alertas-subtitle {
  font-size: 0.72rem;
  color: #cbd5e1;
}

.btn-close-custom {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.8;
}

.btn-close-custom:hover { opacity: 1; }

.modal-alertas-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.alertas-info-bar {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #92400e;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
}

.timeline-subidas {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: flex;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.15s ease;
}

.timeline-item:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.timeline-bullet {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bullet-eliana { background: #8b5cf6; }
.bullet-roman  { background: #0d9488; }

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-rad-code {
  font-size: 0.84rem;
  color: #004884;
  font-weight: 800;
}

.timeline-user {
  font-size: 0.76rem;
  color: #334155;
}

.timeline-timestamp {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.timeline-asunto {
  font-size: 0.76rem;
  color: #1e293b;
}

.badge-mini {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-micro-view {
  font-size: 0.7rem;
  font-weight: 700;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-micro-view:hover {
  background: #1d4ed8;
  color: #ffffff;
}

.modal-alertas-footer {
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

/* Modal Detalle Expediente */
.modal-detalle-card {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  max-height: 85vh;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-detalle-header {
  padding: 0.85rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-detalle-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  max-height: calc(85vh - 110px);
}

.sello-digital-box {
  background: #f0f7ff;
  border: 1.5px dashed #004884;
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  text-align: center;
}

.sello-top {
  font-size: 0.62rem;
  font-weight: 800;
  color: #004884;
  letter-spacing: 0.5px;
}

.sello-rad-code {
  font-size: 1.15rem;
  font-weight: 900;
  color: #02203d;
  margin: 2px 0;
}

.sello-meta {
  font-size: 0.68rem;
  color: #475569;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.adjunto-box {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
}

.adjunto-box:hover {
  background: #ffffff;
  border-color: #004884;
  box-shadow: 0 2px 8px rgba(0, 72, 132, 0.1);
}

.modal-detalle-footer {
  padding: 0.65rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.animate-zoom-in {
  animation: zoomIn 0.25s ease;
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
