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

    <!-- ═══════════════ HISTORIAL DE RADICADOS ═══════════════ -->
    <div v-if="verHistorial" class="card-panel historial-panel animate-fade-in">
      <div class="card-header flex-header">
        <div>
          <h3>📑 Historial de Radicados Registrados</h3>
          <p>Lista oficial de correspondencia y seguimiento de vencimientos</p>
        </div>
        <div class="table-controls">
          <div class="search-box">
            <span>🔍</span>
            <input type="text" v-model="filtroBusqueda" placeholder="Buscar radicado, remitente...">
          </div>
          <select v-model="filtroEstado" class="form-select form-select-sm" style="width: auto;">
            <option value="">Todos los Estados</option>
            <option value="Pendiente">Pendientes</option>
            <option value="Resuelto">Resueltos</option>
          </select>
        </div>
      </div>

      <!-- Leyenda de colores Bootstrap Badges -->
      <div class="d-flex flex-wrap gap-2 my-2">
        <span class="badge bg-danger">🔴 Vencido</span>
        <span class="badge bg-warning text-dark">🟠 Crítico (&lt;3d)</span>
        <span class="badge bg-info text-dark">🟡 Urgente (&lt;7d)</span>
        <span class="badge bg-primary">🔵 Atención (&lt;15d)</span>
        <span class="badge bg-secondary">🟢 Normal (&gt;15d)</span>
        <span class="badge bg-success">✅ Resuelto</span>
      </div>

      <div class="table-responsive mt-3">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>N° RADICADO</th>
              <th>REGISTRO</th>
              <th>REMITENTE</th>
              <th>ASUNTO / DESTINATARIO</th>
              <th>REGISTRADO POR</th>
              <th>ESTADO</th>
              <th>VENCIMIENTO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargandoTabla">
              <td colspan="8" class="text-center py-4 text-muted">Cargando registros del sistema...</td>
            </tr>
            <tr v-else-if="!radicadosFiltrados.length">
              <td colspan="8" class="text-center py-4 text-muted">No se encontraron radicados registrados.</td>
            </tr>
            <tr 
              v-else 
              v-for="rad in radicadosFiltrados" 
              :key="rad.id"
              :class="getClaseFilaTable(rad)"
            >
              <td>
                <strong class="text-primary">{{ rad.numeroRadicado }}</strong>
                <div v-if="rad.numeroRadicadoPdf" class="small text-muted">PDF: {{ rad.numeroRadicadoPdf }}</div>
              </td>
              <td>{{ formatearFecha(rad.fechaRadicacion) }}</td>
              <td>
                <strong class="d-block text-dark">{{ rad.peticionario }}</strong>
                <small class="text-muted d-block text-truncate" style="max-width: 200px;">{{ rad.dependencia }}</small>
              </td>
              <td>
                <div>{{ rad.asunto || 'Sin asunto' }}</div>
                <small class="text-muted d-block" v-if="rad.destinatario">Para: {{ rad.destinatario }}</small>
              </td>
              <td>{{ rad.registradoPor || 'Encargada' }}</td>
              <td>
                <span :class="['badge', rad.estado === 'Resuelto' ? 'bg-success' : 'bg-warning text-dark']">
                  {{ rad.estado }}
                </span>
              </td>
              <td>
                <strong class="d-block">{{ formatearFecha(rad.fechaVencimiento) }}</strong>
                <small class="text-muted">{{ getDiasRestantesTexto(rad) }}</small>
              </td>
              <td>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-secondary" @click="abrirModal(rad)" title="Ver Detalle">👁️</button>
                  <button 
                    v-if="rad.estado !== 'Resuelto'"
                    class="btn btn-outline-success" 
                    @click="confirmarMarcarResuelto(rad)" 
                    title="Marcar como Resuelto"
                  >
                    ✅
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
    const texto = `${r.numeroRadicado} ${r.peticionario} ${r.asunto} ${r.numeroRadicadoPdf}`.toLowerCase()
    const cumpleTexto = !filtroBusqueda.value || texto.includes(filtroBusqueda.value.toLowerCase())
    const cumpleEstado = !filtroEstado.value || r.estado === filtroEstado.value
    return cumpleTexto && cumpleEstado
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




// Helpers de formato y estado Bootstrap
const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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

const getDiasRestantesTexto = (rad) => {
  if (rad.estado === 'Resuelto') return 'Resuelto'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return `Vencido hace ${Math.abs(dias)}d`
  if (dias === 0) return 'Vence Hoy'
  return `${dias} días restantes`
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

const getClaseFilaTable = (rad) => {
  if (rad.estado === 'Resuelto') return 'table-success'
  const dias = calcularDiasRestantes(rad.fechaVencimiento)
  if (dias < 0) return 'table-danger'
  if (dias <= 3) return 'table-warning'
  return ''
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

.table-controls {
  display: flex;
  gap: 0.5rem;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 0.78rem;
}

.search-box input {
  border: none;
  background: transparent;
  outline: none;
  padding-left: 0.3rem;
  font-size: 0.78rem;
}

.border-dashed {
  border-style: dashed !important;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background: #ffffff;
  border-radius: 10px;
  width: 92%;
  max-width: 360px;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
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
