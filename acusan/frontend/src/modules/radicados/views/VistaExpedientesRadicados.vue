<template>
  <div class="expedientes-container">
    <!-- ═══════════════ HEADER EJECUTIVO ═══════════════ -->
    <div class="expedientes-header">
      <div class="header-left">
        <div class="header-badge-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </div>
        <div>
          <div class="d-flex align-items-center gap-2">
            <h2 class="header-title m-0">Radicado ↔ Respuesta de Radicado</h2>
            <span class="badge bg-primary text-white px-2 py-1" style="font-size: 0.7rem;">Expediente Vinculado</span>
          </div>
          <p class="header-subtitle m-0">
            Cada radicado queda unido automáticamente a su oficio de respuesta por <strong>número de radicado</strong> —
            entrada y salida en un solo expediente — Acuasan E.S.P.
          </p>
        </div>
      </div>

      <div class="header-right d-flex align-items-center gap-2 flex-wrap">

        <button
          type="button"
          class="btn-refresh"
          @click="cargarDatos(false)"
          title="Actualizar expedientes"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'spin-anim': cargando }">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Actualizar</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════ KPIS DEL EXPEDIENTE ═══════════════ -->
    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-name">TOTAL EXPEDIENTES</span>
            <div class="kpi-icon">📁</div>
          </div>
          <div class="kpi-val">{{ listaExpedientes.length }}</div>
          <div class="kpi-sub">Radicados en sistema</div>
          <div class="kpi-bar bar-blue"></div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div
          class="kpi-card card-interactive"
          :class="{ 'card-selected': filtroVinculo === 'con' }"
          @click="filtroVinculo = filtroVinculo === 'con' ? '' : 'con'"
          title="Clic para filtrar expedientes con respuesta archivada"
        >
          <div class="kpi-top">
            <span class="kpi-name">CON RESPUESTA</span>
            <div class="kpi-icon">📤</div>
          </div>
          <div class="kpi-val text-success">{{ statsConRespuesta }}</div>
          <div class="kpi-sub">Oficio de salida archivado</div>
          <div class="kpi-bar bar-green"></div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div
          class="kpi-card card-interactive"
          :class="{ 'card-selected': filtroVinculo === 'sin' }"
          @click="filtroVinculo = filtroVinculo === 'sin' ? '' : 'sin'"
          title="Clic para filtrar radicados pendientes de respuesta"
        >
          <div class="kpi-top">
            <span class="kpi-name">SIN RESPUESTA</span>
            <div class="kpi-icon">⏳</div>
          </div>
          <div class="kpi-val text-warning-emphasis">{{ statsSinRespuesta }}</div>
          <div class="kpi-sub">Esperando oficio de salida</div>
          <div class="kpi-bar bar-amber"></div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-name">VENCIDOS / CRÍTICOS</span>
            <div class="kpi-icon">⚠️</div>
          </div>
          <div class="kpi-val text-danger">{{ statsVencidos }}</div>
          <div class="kpi-sub">Pendientes por vencer o vencidos</div>
          <div class="kpi-bar bar-red"></div>
        </div>
      </div>
    </div>

    <!-- ═══════════════ TABLA EMPAREJADA RADICADO ↔ RESPUESTA ═══════════════ -->
    <div class="tabla-card shadow-sm">
      <!-- Toolbar -->
      <div class="tabla-toolbar">
        <div class="toolbar-left d-flex align-items-center gap-2 flex-wrap">
          <div class="search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              v-model="busqueda"
              placeholder="Buscar por N° radicado, oficio, remitente, asunto, destinatario..."
              class="input-search"
            />
            <button v-if="busqueda" class="btn-clear" @click="busqueda = ''">✕</button>
          </div>

          <select v-model="filtroVinculo" class="form-select form-select-sm select-filtro">
            <option value="">🔗 Todos los vínculos</option>
            <option value="con">📤 Con respuesta</option>
            <option value="sin">⏳ Sin respuesta</option>
          </select>

          <select v-model="filtroEstado" class="form-select form-select-sm select-filtro">
            <option value="">📋 Todos los estados</option>
            <option value="Pendiente">⏳ Pendientes</option>
            <option value="Resuelto">✅ Resueltos</option>
          </select>
        </div>

        <div class="toolbar-right d-flex align-items-center gap-2">
          <span class="text-muted" style="font-size: 0.73rem;">
            Mostrando <strong>{{ expedientesFiltrados.length }}</strong> de <strong>{{ listaExpedientes.length }}</strong> expedientes
          </span>
        </div>
      </div>

      <!-- Tabla -->
      <div class="table-responsive-wrapper">
        <table class="expediente-table">
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th style="width: 145px;">N° RADICADO</th>
              <th style="width: 300px;">📥 RADICADO DE ENTRADA</th>
              <th style="width: 300px;">📤 RESPUESTA ARCHIVADA</th>
              <th style="width: 150px;">ESTADO / SLA</th>
              <th style="width: 105px; text-align: center;">EXPEDIENTE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargando && !listaExpedientes.length">
              <td colspan="6" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                <span>Cargando expedientes de Acuasan...</span>
              </td>
            </tr>
            <tr v-else-if="!expedientesFiltrados.length">
              <td colspan="6" class="text-center py-5 text-muted">
                <div class="empty-state">
                  <span class="fs-2 d-block mb-1">🔗</span>
                  <strong>No se encontraron expedientes</strong>
                  <p class="small text-muted mb-0">Modifique los filtros o radique correspondencia para verla aquí emparejada.</p>
                </div>
              </td>
            </tr>
            <tr
              v-else
              v-for="(exp, index) in expedientesFiltrados"
              :key="exp.id"
              :class="{ 'row-even': index % 2 === 1 }"
            >
              <td class="col-index">{{ index + 1 }}</td>

              <!-- N° Radicado (llave del vínculo) -->
              <td>
                <div class="d-flex flex-column gap-1">
                  <span class="radicado-id">{{ exp.numeroRadicado }}</span>
                  <span v-if="exp.numeroRadicadoPdf" class="pdf-pill" :title="'Sello PDF: ' + exp.numeroRadicadoPdf">
                    📄 {{ exp.numeroRadicadoPdf }}
                  </span>
                </div>
              </td>

              <!-- Radicado de entrada -->
              <td>
                <div class="entrada-box">
                  <div class="entrada-remitente text-truncate" :title="exp.peticionario">{{ exp.peticionario }}</div>
                  <div class="entrada-asunto text-truncate" :title="exp.asunto">{{ exp.asunto || 'Sin asunto registrado' }}</div>
                  <div class="entrada-meta">
                    🗓 {{ formatearFecha(exp.fechaRadicacion) }}
                    <span v-if="exp.fechaDocumento"> · 📅 {{ exp.fechaDocumento }}</span>
                  </div>
                </div>
              </td>

              <!-- Respuesta archivada (vinculada por el mismo número) -->
              <td>
                <div v-if="exp.respuestas.length" class="respuesta-box">
                  <div class="d-flex align-items-center gap-1 flex-wrap">
                    <span class="oficio-badge">{{ exp.respuestas[exp.respuestas.length - 1].numeroOficio || 'Oficio s/n' }}</span>
                    <span v-if="exp.respuestas.length > 1" class="badge bg-light text-dark border" style="font-size: 0.6rem;">
                      +{{ exp.respuestas.length - 1 }} más
                    </span>
                  </div>
                  <div class="respuesta-destinatario text-truncate" :title="exp.respuestas[exp.respuestas.length - 1].destinatario || ''">
                    👤 {{ exp.respuestas[exp.respuestas.length - 1].destinatario || 'Destinatario no registrado' }}
                  </div>
                  <div class="respuesta-meta">
                    🗓 Archivada: {{ formatearFecha(exp.respuestas[exp.respuestas.length - 1].fechaRespuesta) }}
                  </div>
                </div>
                <div v-else class="sin-respuesta-box">
                  <span>— Sin respuesta archivada —</span>
                  <small>El oficio de salida se archivará bajo este mismo número</small>
                </div>
              </td>

              <!-- Estado / SLA -->
              <td>
                <div class="d-flex flex-column gap-1 align-items-start">
                  <span :class="['estado-pill', exp.respuestas.length ? 'estado-respondido' : (exp.estado === 'Resuelto' ? 'estado-resuelto' : 'estado-pendiente')]">
                    <span class="dot-status"></span>
                    {{ exp.respuestas.length ? 'Respondido' : exp.estado }}
                  </span>
                  <span v-if="exp.estado !== 'Resuelto'" :class="['sla-tag', getSlaTagClass(exp)]">
                    {{ getDiasRestantesTexto(exp) }}
                  </span>
                </div>
              </td>

              <!-- Acción -->
              <td style="text-align: center;">
                <button type="button" class="btn-ver-expediente" @click="abrirExpediente(exp)" title="Ver expediente: radicado y respuesta con sus documentos">
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

    <!-- ═══════════════ MODAL EXPEDIENTE VINCULADO (AMBOS PDFs) ═══════════════ -->
    <div v-if="expedienteAbierto" class="modal-backdrop-custom" @click.self="cerrarExpediente()">
      <div class="modal-expediente-card animate-zoom-in">
        <!-- Header -->
        <div class="modal-expediente-header">
          <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
            <span class="fs-5">🔗</span>
            <div class="text-truncate">
              <strong class="text-dark d-block text-truncate" style="font-size: 0.92rem;">
                Expediente {{ expedienteAbierto.numeroRadicado }}
              </strong>
              <div class="text-muted text-truncate" style="font-size: 0.7rem;">
                Radicado y respuesta unidos por número · Acuusan E.S.P. — Control Documental
              </div>
            </div>
          </div>
          <button type="button" class="btn-close-custom-dark" @click="cerrarExpediente()">✕</button>
        </div>

        <!-- Pestañas Radicado / Respuesta -->
        <div class="expediente-tabs">
          <button
            type="button"
            :class="['expediente-tab', pestanaActiva === 'radicado' ? 'tab-activa' : '']"
            @click="pestanaActiva = 'radicado'"
          >
            📥 Radicado de Entrada
          </button>
          <button
            type="button"
            :class="['expediente-tab', pestanaActiva === 'respuesta' ? 'tab-activa-respuesta' : '']"
            :disabled="!expedienteAbierto.respuestas.length"
            :title="expedienteAbierto.respuestas.length ? 'Oficio de respuesta archivado bajo este radicado' : 'Este radicado aún no tiene respuesta archivada'"
            @click="pestanaActiva = 'respuesta'"
          >
            📤 Respuesta de Radicado
            <span v-if="expedienteAbierto.respuestas.length" class="tab-count">{{ expedienteAbierto.respuestas.length }}</span>
          </button>

          <!-- Selector cuando hay varias respuestas bajo el mismo radicado -->
          <select
            v-if="pestanaActiva === 'respuesta' && expedienteAbierto.respuestas.length > 1"
            v-model="respuestaSeleccionadaId"
            class="form-select form-select-sm select-respuesta ms-auto"
            style="font-size: 0.7rem;"
          >
            <option v-for="r in expedienteAbierto.respuestas" :key="r.id" :value="r.id">
              {{ r.numeroOficio || 'Oficio s/n' }} — {{ formatearFecha(r.fechaRespuesta) }}
            </option>
          </select>
        </div>

        <!-- Cuerpo: ficha + documento -->
        <div class="modal-expediente-body">
          <!-- Ficha del radicado -->
          <div v-if="pestanaActiva === 'radicado'" class="ficha-box">
            <div class="row g-2" style="font-size: 0.74rem;">
              <div class="col-6 col-md-4"><label class="ficha-label">N° Radicado PDF:</label> <strong>{{ expedienteAbierto.numeroRadicadoPdf || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Fecha / Hora Sello:</label> <strong>{{ expedienteAbierto.fechaDocumento || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Lugar y Fecha Carta:</label> <strong>{{ expedienteAbierto.lugarFecha || '—' }}</strong></div>
              <div class="col-12 col-md-8"><label class="ficha-label">Remitente / Peticionario:</label> <strong>{{ expedienteAbierto.peticionario }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Destinatario (Funcionario / Área):</label> <strong>{{ expedienteAbierto.destinatario || '—' }}</strong></div>
              <div class="col-12 col-md-8"><label class="ficha-label">Asunto:</label> <strong>{{ expedienteAbierto.asunto || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Vencimiento:</label> <strong>{{ formatearFecha(expedienteAbierto.fechaVencimiento) }}</strong></div>
            </div>
            <div v-if="expedienteAbierto.contexto" class="contexto-linea">
              <strong>Contexto / Observaciones:</strong> {{ expedienteAbierto.contexto }}
            </div>
          </div>

          <!-- Ficha de la respuesta -->
          <div v-else-if="respuestaActiva" class="ficha-box">
            <div class="row g-2" style="font-size: 0.74rem;">
              <div class="col-6 col-md-4"><label class="ficha-label">N° de Oficio:</label> <strong>{{ respuestaActiva.numeroOficio || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Fecha del Oficio:</label> <strong>{{ respuestaActiva.fechaDocumento || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Lugar y Fecha:</label> <strong>{{ respuestaActiva.lugarFecha || '—' }}</strong></div>
              <div class="col-12 col-md-8"><label class="ficha-label">Destinatario (Peticionario):</label> <strong>{{ respuestaActiva.destinatario || '—' }}</strong></div>
              <div class="col-6 col-md-4"><label class="ficha-label">Archivada:</label> <strong>{{ formatearFechaHora(respuestaActiva.fechaRespuesta) }}</strong></div>
              <div class="col-12"><label class="ficha-label">Asunto de la Respuesta:</label> <strong>{{ respuestaActiva.asunto || '—' }}</strong></div>
            </div>
            <div v-if="respuestaActiva.observaciones" class="contexto-linea">
              <strong>Observaciones / Síntesis:</strong> {{ respuestaActiva.observaciones }}
            </div>
          </div>

          <!-- Visor del documento de la pestaña activa -->
          <div class="documento-vista">
            <div class="documento-header">
              <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                <span class="fs-5">{{ pestanaActiva === 'radicado' ? '📥' : '📤' }}</span>
                <div class="text-truncate">
                  <span class="d-block text-muted" style="font-size: 0.62rem; font-weight: 700;">
                    {{ pestanaActiva === 'radicado' ? 'DOCUMENTO ORIGINAL DEL RADICADO' : 'OFICIO DE RESPUESTA ARCHIVADO' }}
                  </span>
                  <strong class="text-dark text-truncate d-block" style="font-size: 0.74rem;">{{ nombreDocumentoActivo }}</strong>
                </div>
              </div>
              <a
                v-if="visor.url"
                :href="visor.url"
                target="_blank"
                class="btn btn-sm btn-outline-primary px-2 py-1 fw-bold flex-shrink-0"
                style="font-size: 0.7rem;"
                title="Abrir en una pestaña nueva a pantalla completa"
              >↗️ Abrir Archivo</a>
            </div>

            <div class="pdf-container rounded-3 border bg-dark bg-opacity-75 position-relative p-2" style="min-height: 720px; height: 82vh;">
              <div v-if="visor.cargando" class="d-flex align-items-center justify-content-center text-white-50" style="font-size: 0.78rem; min-height: 480px;">
                ⏳ Cargando documento...
              </div>

              <!-- PDF (visor embebido con respaldo iframe) -->
              <object
                v-else-if="visor.url && !esImagen"
                :data="visor.url"
                type="application/pdf"
                class="w-100 rounded-3 border-0 bg-white"
                style="min-height: 700px; height: 100%;"
              >
                <iframe :src="visor.url" class="w-100 h-100 rounded-3 border-0 bg-white" style="min-height: 700px; height: 100%;" title="Visor PDF del expediente"></iframe>
              </object>

              <!-- Imagen escaneada -->
              <div v-else-if="visor.url" class="w-100 text-center">
                <div class="badge bg-info text-dark mb-2 shadow-sm px-3 py-1 fw-bold">IMAGEN ADJUNTA ORIGINAL</div>
                <img :src="visor.url" class="img-fluid rounded shadow bg-white border w-100" style="max-width: 720px; object-fit: contain;" alt="Documento del expediente" />
              </div>

              <!-- Error de carga (reintentable) -->
              <div v-else-if="visor.error" class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 300px;">
                <div style="font-size: 2rem;">⚠️</div>
                <p class="text-warning mb-2" style="font-size: 0.8rem;">{{ visor.error }}</p>
                <button class="btn btn-outline-light btn-sm px-3" style="font-size: 0.72rem;" @click="cargarDocumentoActivo()">🔄 Reintentar</button>
              </div>

              <!-- Sin documento (estado honesto) -->
              <div v-else class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 300px;">
                <div style="font-size: 2rem;">📄</div>
                <p class="text-white-50 mb-0" style="font-size: 0.8rem;">
                  {{ pestanaActiva === 'radicado'
                    ? 'Este radicado no tiene documento adjunto en la base de datos.'
                    : 'Esta respuesta no tiene documento adjunto en la base de datos.' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-expediente-footer">
          <button type="button" class="btn btn-sm btn-secondary" @click="cerrarExpediente()">Cerrar Expediente</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import radicadosService from '../services/radicadosService.js'
import respuestasService from '../services/respuestasService.js'

/**
 * Módulo Radicado ↔ Respuesta de Radicado — expediente emparejado.
 *
 * El servidor entrega cada radicado ya unido a sus oficios de respuesta por
 * radicadoId (el vínculo lo valida al archivar: el número del radicado y el
 * de la respuesta coinciden por construcción). Aquí solo se presenta el par
 * y se sirven ambos documentos (entrada y salida) en un mismo visor.
 */
const listaExpedientes = ref([])
const cargando = ref(false)
const busqueda = ref('')
const filtroVinculo = ref('') // '' | 'con' | 'sin'
const filtroEstado = ref('')  // '' | 'Pendiente' | 'Resuelto'
const ultimaActualizacion = ref(null)
const origenDatos = ref(null)
let timerAutoRefresh = null
let desuscribirCambios = null
let cargaEnCurso = false

const horaUltimaActualizacion = computed(() =>
  ultimaActualizacion.value
    ? ultimaActualizacion.value.toLocaleTimeString('es-CO', { hour12: false })
    : ''
)

// ── Carga y refresco (mismo patrón de sondeo de las vistas del módulo) ──────
const cargarDatos = async (silencioso = false) => {
  if (cargaEnCurso && silencioso) return
  cargaEnCurso = true
  try {
    if (!silencioso) cargando.value = true
    const datos = await radicadosService.obtenerExpedientes()
    listaExpedientes.value = datos || []

    // El modal abierto guarda una instantánea del expediente: al recargar se
    // resincroniza (archivaron una respuesta desde otro equipo → aparece sin
    // cerrar y reabrir), conservando la pestaña y la respuesta elegidas.
    if (expedienteAbierto.value) {
      const fresco = listaExpedientes.value.find((e) => e.id === expedienteAbierto.value.id)
      if (fresco) expedienteAbierto.value = fresco
    }

    ultimaActualizacion.value = new Date()
    origenDatos.value = radicadosService.ultimoOrigen
  } catch (err) {
    console.error('Error al cargar expedientes:', err)
    origenDatos.value = null
  } finally {
    cargaEnCurso = false
    if (!silencioso) cargando.value = false
  }
}

// Una pestaña de fondo ve su intervalo congelado por el navegador: al volver
// a mirar el tablero se refresca al instante en vez de mostrar datos viejos.
const onVisibilidadCambio = () => {
  if (document.visibilityState === 'visible') cargarDatos(true)
}

onMounted(() => {
  cargarDatos()

  // Aviso inmediato dentro de la pestaña: radicados y respuestas avisan por
  // el mismo evento (respuestasService redispara acuusan-radicados-cambio).
  // El sondeo cada 5s cubre otras pestañas y otros equipos.
  desuscribirCambios = radicadosService.suscribirCambios(() => {
    cargarDatos(true)
  })

  document.addEventListener('visibilitychange', onVisibilidadCambio)
  timerAutoRefresh = setInterval(() => {
    cargarDatos(true)
  }, 5000)
})

onUnmounted(() => {
  if (timerAutoRefresh) clearInterval(timerAutoRefresh)
  if (desuscribirCambios) desuscribirCambios()
  document.removeEventListener('visibilitychange', onVisibilidadCambio)
  liberarVisorUrl()
})

// ── Estadísticas ─────────────────────────────────────────────────────────────
const statsConRespuesta = computed(() =>
  listaExpedientes.value.filter((e) => e.respuestas.length).length
)
const statsSinRespuesta = computed(() =>
  listaExpedientes.value.filter((e) => !e.respuestas.length).length
)
const statsVencidos = computed(() =>
  listaExpedientes.value.filter((e) => {
    if (e.estado === 'Resuelto') return false
    return calcularDiasRestantes(e.fechaVencimiento) <= 3
  }).length
)

// ── Filtros combinados ───────────────────────────────────────────────────────
const expedientesFiltrados = computed(() => {
  return listaExpedientes.value.filter((exp) => {
    // Búsqueda libre: campos del radicado Y de sus respuestas (n° de oficio,
    // destinatario de la respuesta) — buscar "OF-2026-104" encuentra el par.
    const camposRespuestas = exp.respuestas
      .map((r) => `${r.numeroOficio || ''} ${r.destinatario || ''} ${r.asunto || ''}`)
      .join(' ')
    const txt = `${exp.numeroRadicado} ${exp.numeroRadicadoPdf || ''} ${exp.peticionario} ${exp.asunto || ''} ${exp.destinatario || ''} ${camposRespuestas}`.toLowerCase()
    const matchBusqueda = !busqueda.value || txt.includes(busqueda.value.toLowerCase())

    const matchVinculo =
      !filtroVinculo.value ||
      (filtroVinculo.value === 'con' ? exp.respuestas.length > 0 : exp.respuestas.length === 0)

    const matchEstado = !filtroEstado.value || exp.estado === filtroEstado.value

    return matchBusqueda && matchVinculo && matchEstado
  })
})

// ── Modal del expediente: pestañas y visor de ambos documentos ──────────────
const expedienteAbierto = ref(null)
const pestanaActiva = ref('radicado') // 'radicado' | 'respuesta'
const respuestaSeleccionadaId = ref(null)

const respuestaActiva = computed(() => {
  if (!expedienteAbierto.value) return null
  const lista = expedienteAbierto.value.respuestas || []
  return lista.find((r) => r.id === respuestaSeleccionadaId.value) || lista[0] || null
})

const nombreDocumentoActivo = computed(() => {
  if (pestanaActiva.value === 'radicado') {
    const exp = expedienteAbierto.value
    return exp?.archivoNombre || (exp?.numeroRadicadoPdf ? exp.numeroRadicadoPdf + '.pdf' : 'Radicado.pdf')
  }
  const r = respuestaActiva.value
  return r?.archivoNombre || (r?.numeroOficio ? r.numeroOficio + '.pdf' : 'Respuesta.pdf')
})

// Visor compartido por ambas pestañas: una carga a la vez, token anti-carrera
// (cambiar de pestaña con una carga en vuelo no pisa el documento nuevo).
const visor = reactive({ url: null, mime: '', cargando: false, error: null })
let visorToken = 0

const esImagen = computed(() => (visor.mime || '').startsWith('image/'))

const liberarVisorUrl = () => {
  if (visor.url && visor.url.startsWith('blob:')) URL.revokeObjectURL(visor.url)
  visor.url = null
}

const cargarDocumentoActivo = async () => {
  const token = ++visorToken
  liberarVisorUrl()
  visor.error = null
  visor.mime = ''

  const exp = expedienteAbierto.value
  if (!exp) return

  if (pestanaActiva.value === 'radicado') {
    if (!exp.id) return
    visor.cargando = true
    try {
      const { url, mime } = await radicadosService.obtenerArchivoRadicado(exp.id)
      if (token !== visorToken) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return }
      visor.url = url
      visor.mime = mime
    } catch (e) {
      if (token !== visorToken) return
      if (e && e.status === 404) return // sin documento: estado honesto
      visor.error = (e && e.message) || 'No se pudo cargar el documento del radicado.'
    } finally {
      if (token === visorToken) visor.cargando = false
    }
  } else {
    const respuesta = respuestaActiva.value
    if (!respuesta) return
    visor.cargando = true
    try {
      const { url, mime } = await respuestasService.obtenerArchivoRespuesta(respuesta.id)
      if (token !== visorToken) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return }
      visor.url = url
      visor.mime = mime
    } catch (e) {
      if (token !== visorToken) return
      if (e && e.status === 404) return
      visor.error = (e && e.message) || 'No se pudo cargar el documento de la respuesta.'
    } finally {
      if (token === visorToken) visor.cargando = false
    }
  }
}

// Al abrir: siempre en la pestaña del radicado, con la primera respuesta
// preseleccionada. suprimirWatch evita la doble carga cuando la pestaña o la
// respuesta previas ya estaban en otros valores (el watch salta dos veces).
let suprimirWatch = false
const abrirExpediente = (exp) => {
  suprimirWatch = true
  expedienteAbierto.value = exp
  pestanaActiva.value = 'radicado'
  respuestaSeleccionadaId.value = exp.respuestas?.[0]?.id || null
  suprimirWatch = false
  cargarDocumentoActivo()
}

watch([pestanaActiva, respuestaSeleccionadaId], () => {
  if (!suprimirWatch) cargarDocumentoActivo()
})

const cerrarExpediente = () => {
  visorToken++
  liberarVisorUrl()
  expedienteAbierto.value = null
  visor.error = null
  visor.cargando = false
  visor.mime = ''
}

// ── Helpers de formato y SLA (mismos criterios del módulo) ──────────────────
const calcularDiasRestantes = (fechaVencimiento) => {
  if (!fechaVencimiento) return 0
  const fVenc = new Date(fechaVencimiento)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fVenc.setHours(0, 0, 0, 0)
  return Math.ceil((fVenc - hoy) / (1000 * 60 * 60 * 24))
}

const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

const formatearFechaHora = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()} ${hours}:${minutes}`
}

const getDiasRestantesTexto = (exp) => {
  if (exp.estado === 'Resuelto') return 'Resuelto'
  const dias = calcularDiasRestantes(exp.fechaVencimiento)
  if (dias < 0) return `Vencido (${Math.abs(dias)}d)`
  if (dias === 0) return 'Vence Hoy'
  return `${dias} días restantes`
}

const getSlaTagClass = (exp) => {
  if (exp.estado === 'Resuelto') return 'sla-resuelto'
  const dias = calcularDiasRestantes(exp.fechaVencimiento)
  if (dias < 0) return 'sla-vencido'
  if (dias <= 3) return 'sla-critico'
  if (dias <= 7) return 'sla-urgente'
  return 'sla-normal'
}
</script>

<style scoped>
.expedientes-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* ═══ Header ═══ */
.expedientes-header {
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

.btn-refresh {
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

.btn-refresh:hover {
  background: #004884;
  color: #ffffff;
  border-color: #004884;
}

.spin-anim { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ═══ KPIs ═══ */
.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease;
}

.card-interactive { cursor: pointer; }

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

.kpi-icon { font-size: 1.1rem; }

.kpi-val {
  font-size: 1.45rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.kpi-sub { font-size: 0.68rem; color: #94a3b8; }

.kpi-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.bar-blue { background: #004884; }
.bar-green { background: #16a34a; }
.bar-amber { background: #f59e0b; }
.bar-red { background: #ef4444; }

/* ═══ Tabla ═══ */
.tabla-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 1.1rem 1.35rem;
  box-shadow: 0 4px 16px rgba(0, 72, 132, 0.06);
}

.tabla-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid #f1f5f9;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box svg {
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
  width: 290px;
  outline: none;
  transition: all 0.2s ease;
}

.input-search:focus {
  background: #ffffff;
  border-color: #004884;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
  width: 330px;
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

.select-filtro {
  font-size: 0.78rem;
  border-radius: 8px;
  border-color: #cbd5e1;
  background-color: #f8fafc;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  width: auto;
  font-weight: 500;
}

.table-responsive-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 66vh;
  -webkit-overflow-scrolling: touch;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  scrollbar-width: thin;
}

.table-responsive-wrapper::-webkit-scrollbar { height: 9px; width: 9px; }
.table-responsive-wrapper::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
.table-responsive-wrapper::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; border: 2px solid #f1f5f9; }
.table-responsive-wrapper::-webkit-scrollbar-thumb:hover { background: #004884; }

.expediente-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.78rem;
}

.expediente-table thead tr {
  background: linear-gradient(180deg, #02203d 0%, #01182e 100%);
  color: #ffffff;
}

.expediente-table thead th {
  padding: 0.65rem 0.85rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #f1f5f9;
  white-space: nowrap;
}

.expediente-table tbody tr {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.expediente-table tbody tr:hover { background-color: #f0f9ff; }

.expediente-table tbody td {
  padding: 0.7rem 0.85rem;
  vertical-align: middle;
  border-bottom: 1px solid #edf2f7;
}

.row-even td { background: #f8fafc; }

.col-index {
  width: 34px;
  background: #e2e8f0 !important;
  color: #475569 !important;
  font-weight: 700;
  text-align: center;
  font-family: monospace;
  border-right: 2px solid #cbd5e1 !important;
  user-select: none;
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

/* Columna radicado de entrada */
.entrada-box { display: flex; flex-direction: column; gap: 2px; max-width: 300px; }

.entrada-remitente {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.8rem;
  line-height: 1.25;
}

.entrada-asunto {
  color: #1e293b;
  font-size: 0.75rem;
  line-height: 1.3;
}

.entrada-meta {
  font-size: 0.66rem;
  color: #64748b;
}

/* Columna respuesta */
.respuesta-box { display: flex; flex-direction: column; gap: 3px; max-width: 300px; }

.oficio-badge {
  background: linear-gradient(135deg, #15803d, #166534);
  color: #fff;
  font-size: 0.64rem;
  font-weight: 700;
  border-radius: 5px;
  padding: 0.14rem 0.5rem;
  width: fit-content;
}

.respuesta-destinatario {
  font-size: 0.72rem;
  color: #334155;
  font-weight: 600;
}

.respuesta-meta { font-size: 0.66rem; color: #64748b; }

.sin-respuesta-box {
  display: flex;
  flex-direction: column;
  gap: 1px;
  color: #94a3b8;
  font-size: 0.72rem;
  font-style: italic;
  padding: 0.2rem 0;
}

.sin-respuesta-box small {
  font-size: 0.62rem;
  color: #cbd5e1;
  font-style: normal;
}

/* Estado */
.estado-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
}

.dot-status { width: 6px; height: 6px; border-radius: 50%; }

.estado-respondido {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.estado-respondido .dot-status { background: #22c55e; }

.estado-resuelto {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #dbeafe;
}
.estado-resuelto .dot-status { background: #3b82f6; }

.estado-pendiente {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}
.estado-pendiente .dot-status { background: #f59e0b; }

.sla-tag {
  font-size: 0.66rem;
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

.btn-ver-expediente {
  width: 30px;
  height: 30px;
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

.btn-ver-expediente:hover {
  background: #004884;
  border-color: #004884;
  color: #ffffff;
  transform: scale(1.08);
}

.empty-state {
  padding: 1rem;
}

/* ═══ Modal Expediente ═══ */
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(2, 32, 61, 0.65);
  backdrop-filter: blur(3px);
  display: block;
  z-index: 1050;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 1.5rem 1rem 3.5rem;
  scrollbar-width: thin;
  scrollbar-color: #38bdf8 rgba(2, 32, 61, 0.4);
}

.modal-backdrop-custom::-webkit-scrollbar {
  width: 10px;
}
.modal-backdrop-custom::-webkit-scrollbar-track {
  background: rgba(2, 32, 61, 0.35);
}
.modal-backdrop-custom::-webkit-scrollbar-thumb {
  background: #38bdf8;
  border-radius: 5px;
}
.modal-backdrop-custom::-webkit-scrollbar-thumb:hover {
  background: #0ea5e9;
}

.modal-expediente-card {
  background: #ffffff;
  border-radius: 12px;
  width: 95vw;
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-expediente-header {
  padding: 0.85rem 1.25rem;
  background: linear-gradient(135deg, #02203d 0%, #004884 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-expediente-header .text-muted { color: #cbd5e1 !important; }
.modal-expediente-header .text-dark { color: #ffffff !important; }

.btn-close-custom-dark {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.85;
  flex-shrink: 0;
}

.btn-close-custom-dark:hover { opacity: 1; }

/* Pestañas */
.expediente-tabs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.25rem 0;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.expediente-tab {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.4rem 0.9rem;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  border-bottom: none;
}

.expediente-tab:disabled {
  color: #b6c2d2;
  background: #f1f5f9;
  cursor: not-allowed;
}

.expediente-tab:not(:disabled):hover { background: #f0f7ff; color: #004884; }

.tab-activa {
  background: #004884;
  color: #ffffff;
  border-color: #004884;
}

.tab-activa-respuesta {
  background: #15803d;
  color: #ffffff;
  border-color: #15803d;
}

.tab-count {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  font-size: 0.6rem;
  padding: 0 6px;
}

.select-respuesta {
  max-width: 280px;
  border-radius: 8px;
  border-color: #cbd5e1;
}

/* Cuerpo */
.modal-expediente-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pdf-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.pdf-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.pdf-container::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 4px;
}

.pdf-container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.ficha-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.7rem 0.9rem;
}

.ficha-label {
  display: block;
  color: #64748b;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.contexto-linea {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.72rem;
  color: #475569;
  line-height: 1.4;
}

.contexto-linea strong { color: #334155; }

/* Visor del documento */
.documento-vista {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
}

.documento-header {
  padding: 0.6rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.modal-expediente-footer {
  padding: 0.65rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.animate-zoom-in { animation: zoomIn 0.25s ease; }

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
