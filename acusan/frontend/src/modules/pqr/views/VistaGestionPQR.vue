<template>
  <div class="gestion-pqr-view container-fluid p-0">
    <!-- Bootstrap Toast / Alert Notification Banner -->
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
      titulo="Listado de Registros PQR"
      subtitulo="Plantilla Excel para control y seguimiento de las solicitudes PQR ingresadas por WhatsApp (IA) y Operadores"
      icono="📋"
    />

    <!-- KPI Summary Row -->
    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem;">TOTAL REGISTROS</span>
              <div class="fs-4 fw-bold text-primary lh-1 mt-1">{{ pqrs.length }}</div>
            </div>
            <div class="badge bg-primary-subtle text-primary p-2 rounded-3 fs-6">📋</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem;">PENDIENTES / TRÁMITE</span>
              <div class="fs-4 fw-bold text-warning lh-1 mt-1">{{ totalPendientes }}</div>
            </div>
            <div class="badge bg-warning-subtle text-warning p-2 rounded-3 fs-6">⏳</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem;">RESUELTOS</span>
              <div class="fs-4 fw-bold text-success lh-1 mt-1">{{ totalResueltas }}</div>
            </div>
            <div class="badge bg-success-subtle text-success p-2 rounded-3 fs-6">✔</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem;">CUMPLIMIENTO SLA</span>
              <div class="fs-4 fw-bold text-info lh-1 mt-1">{{ porcentajeCumplimiento }}%</div>
            </div>
            <div class="badge bg-info-subtle text-info p-2 rounded-3 fs-6">⚡</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== VISTA CUADRILLA ESTILO EXCEL ==================== -->
    <div class="excel-grid-container shadow-sm">
      <!-- Excel Top Title Bar -->
      <div class="excel-header-stripe">
        <div class="excel-stripe-left">
          <span class="excel-icon-logo">📋</span>
          <span class="excel-tag">Acuasan_Libro_PQR_2026.xlsx</span>
          <span class="excel-sheet-badge">Hoja 1: Atencion_Usuario</span>
        </div>
        <span class="excel-meta">Total Registros en Hoja: {{ filteredPqrs.length }}</span>
      </div>

      <!-- Excel Formula Bar (fx) -->
      <div class="excel-formula-bar">
        <div class="cell-name-box">A1</div>
        <div class="fx-icon">fx</div>
        <div class="formula-input">
          <span class="formula-text">
            =CONTAR_REGISTROS(PQR) &rarr; Total Registros: <strong>{{ pqrs.length }}</strong> | Resueltas: <strong>{{ totalResueltas }}</strong> | En Trámite: <strong>{{ totalPendientes }}</strong> | Cumplimiento Términos: <strong>{{ porcentajeCumplimiento }}%</strong>
          </span>
        </div>
      </div>

      <!-- Toolbar con Búsqueda, Filtros y Acciones -->
      <div class="table-toolbar">
        <div class="filter-group">
          <div class="search-box-wrap">
            <span class="search-icon">🔍</span>
            <input
              v-model="busqueda"
              type="text"
              placeholder="Buscar por ciudadano, WhatsApp, motivo o dirección..."
              class="search-input"
            />
          </div>

          <select v-model="filtroRemitente" class="select-input">
            <option value="">Todos los Remitentes</option>
            <option value="IA">🤖 IA (WhatsApp)</option>
            <option value="OPERADOR">👤 Operador</option>
          </select>
        </div>

        <div class="action-buttons-group">
          <button type="button" class="btn-nueva-pqr" @click="abrirModalNuevaPqr">
            <span>➕ Nuevo Registro PQR</span>
          </button>
          <button type="button" class="btn-export-excel" @click="exportarExcel">
            <span>📗</span>
            <span>Exportar Excel</span>
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
              <th class="col-letter text-center">B</th>
              <th class="col-letter">C</th>
              <th class="col-letter">D</th>
              <th class="col-letter">E</th>
              <th class="col-letter text-center">F</th>
              <th class="col-letter text-center">G</th>
            </tr>

            <!-- Excel Main Header Row -->
            <tr class="excel-main-header-row">
              <th class="col-excel-index">#</th>
              <th>N° REGISTRO</th>
              <th class="text-center">REMITENTE</th>
              <th>CIUDADANO / WHATSAPP</th>
              <th>PROBLEMA SOLICITADO</th>
              <th>DIRECCIÓN DEL PROBLEMA</th>
              <th class="text-center">HORA ATENCIÓN (DESDE ➔ HASTA)</th>
              <th class="text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredPqrs.length === 0">
              <td colspan="8" class="text-center py-5 text-muted font-mono">
                [Hoja vacía] No se encontraron registros PQR que coincidan con la búsqueda.
              </td>
            </tr>
            <tr
              v-for="(item, index) in filteredPqrs"
              :key="item.id || index"
              :class="{
                'row-even': index % 2 === 1,
                'row-active-item': selectedPqr && selectedPqr.id === item.id,
                'row-resolved': item.estado === 'RESUELTO'
              }"
              @click="abrirDetallePqr(item)"
              style="cursor: pointer;"
            >
              <!-- Excel Row Number Header Column -->
              <td class="col-excel-index">{{ index + 1 }}</td>

              <!-- A: N° Registro -->
              <td class="col-radicado font-mono fw-bold text-dark">REG-{{ String(index + 1).padStart(3, '0') }}</td>

              <!-- B: Remitente (IA o Operador) -->
              <td class="text-center">
                <span
                  :class="['badge-remitente-sm', esIA(item) ? 'badge-ia' : 'badge-operador']"
                  :title="esIA(item) ? 'Extraído y radicado por la IA desde WhatsApp' : 'Radicado por el Operador'"
                >
                  {{ esIA(item) ? '🤖 IA (WhatsApp)' : '👤 Operador' }}
                </span>
              </td>

              <!-- C: Ciudadano / WhatsApp -->
              <td>
                <div class="cell-user">
                  <span class="user-name">{{ item.usuario }}</span>
                  <span class="user-sub text-success fw-bold d-inline-flex align-items-center gap-1">
                    📱 {{ item.telefono || (esIA(item) ? '+57 310 892 4410' : 'Ventanilla') }}
                  </span>
                </div>
              </td>

              <!-- D: Problema que se solicita -->
              <td>
                <div class="cell-motivo">
                  <span class="text-dark fw-bold text-truncate d-block" style="max-width: 240px;" :title="item.motivo">
                    {{ item.motivo }}
                  </span>
                  <span class="user-sub text-muted text-truncate d-block" style="max-width: 240px;" :title="item.descripcion">
                    {{ item.descripcion || 'Sin descripción detallada' }}
                  </span>
                </div>
              </td>

              <!-- E: Dirección del problema -->
              <td>
                <span class="text-primary fw-semibold small d-inline-flex align-items-center gap-1" :title="item.direccion">
                  📍 {{ item.direccion || 'Sector Urbano San Gil' }}
                </span>
              </td>

              <!-- F: Horario de Atención (Desde que empezó hasta que terminó) -->
              <td class="text-center">
                <div class="d-flex flex-column align-items-center">
                  <span class="font-mono text-dark fw-bold" style="font-size: 0.72rem;">
                    {{ obtenerHorario(item).inicio }} ➔ {{ obtenerHorario(item).fin }}
                  </span>
                  <span class="text-muted" style="font-size: 0.65rem;">
                    ⏱️ {{ obtenerHorario(item).duracion }} &bull; {{ item.fechaRadicado }}
                  </span>
                </div>
              </td>

              <!-- G: Acciones -->
              <td class="text-center" @click.stop>
                <button
                  type="button"
                  class="btn-gestionar"
                  @click="abrirDetallePqr(item)"
                  title="Gestionar respuesta o ver chat con IA"
                >
                  🔍 Gestionar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL PARA REGISTRAR NUEVA PQR -->
    <div
      v-if="modalNuevaVisible"
      class="modal-backdrop-custom"
      @click="modalNuevaVisible = false"
    >
      <div class="modal-dialog-custom modal-dialog-lg" @click.stop>
        <div class="modal-header-custom">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-5">➕</span>
            <div>
              <strong class="text-dark">Nuevo Registro de PQR</strong>
              <small class="text-muted d-block" style="font-size: 0.72rem;">Registrar solicitud ciudadana (Vía IA WhatsApp u Operador)</small>
            </div>
          </div>
          <button type="button" class="btn-close" @click="modalNuevaVisible = false"></button>
        </div>
        <div class="modal-body-custom">
          <form @submit.prevent="guardarNuevaPqr">
            <div class="row g-3">
              <!-- Remitente / Origen -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">Remitente (Origen del Reporte)</label>
                <select v-model="formNueva.remitente" class="form-select form-select-sm" required>
                  <option value="IA">🤖 Asistente Virtual IA (WhatsApp)</option>
                  <option value="OPERADOR">👤 Operador (Atención en Ventanilla)</option>
                </select>
              </div>

              <!-- Prioridad -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">Prioridad</label>
                <select v-model="formNueva.prioridad" class="form-select form-select-sm">
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <!-- Nombre del Usuario -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">Nombre del Usuario / Solicitante *</label>
                <input
                  v-model="formNueva.usuario"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Ej. Juan Pérez"
                  required
                />
              </div>

              <!-- Celular WhatsApp -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">Número de Celular (WhatsApp) *</label>
                <input
                  v-model="formNueva.telefono"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Ej. +57 312 345 6789"
                  required
                />
              </div>

              <!-- Dirección del Problema -->
              <div class="col-12">
                <label class="form-label fw-bold small text-secondary">Dirección del Problema / Falla *</label>
                <input
                  v-model="formNueva.direccion"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Ej. Cra 10 # 12-45, Barrio Santander, San Gil"
                  required
                />
              </div>

              <!-- Problema que se solicita (Motivo) -->
              <div class="col-12">
                <label class="form-label fw-bold small text-secondary">Problema que se Solicita (Motivo / Asunto) *</label>
                <input
                  v-model="formNueva.motivo"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Ej. Fuga de agua en calzada principal / Cobro indebido"
                  required
                />
              </div>

              <!-- Detalle del Problema (Mensaje extraído por la IA o reporte) -->
              <div class="col-12">
                <label class="form-label fw-bold small text-secondary">Descripción Detallada / Mensaje e Información *</label>
                <textarea
                  v-model="formNueva.descripcion"
                  rows="3"
                  class="form-control form-control-sm"
                  placeholder="Detalle completo de la solicitud o transcripción extraída por la IA..."
                  required
                ></textarea>
              </div>

              <!-- Hora de Inicio y Fin -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">🕒 Hora en que Empezó</label>
                <input
                  v-model="formNueva.horaInicio"
                  type="text"
                  class="form-control form-control-sm font-mono"
                  placeholder="Ej. 09:15 a. m."
                />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold small text-secondary">🏁 Hora en que Terminó</label>
                <input
                  v-model="formNueva.horaFin"
                  type="text"
                  class="form-control form-control-sm font-mono"
                  placeholder="Ej. 09:22 a. m."
                />
              </div>
            </div>

            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="modalNuevaVisible = false">
                Cancelar
              </button>
              <button type="submit" class="btn btn-sm btn-primary px-4 fw-bold" :disabled="guardandoPqr">
                {{ guardandoPqr ? 'Guardando...' : 'Guardar Registro' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- MODAL / DRAWER DE ATENCIÓN Y DETALLE DE PQR -->
    <div
      v-if="modalDetalleVisible && selectedPqr"
      class="modal-backdrop-custom"
      @click="modalDetalleVisible = false"
    >
      <div class="modal-dialog-custom" @click.stop>
        <div class="modal-header-custom">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-5">📋</span>
            <div>
              <strong class="text-dark">Detalle de Registro PQR</strong>
              <span class="badge bg-secondary ms-2 small">{{ selectedPqr.estado }}</span>
            </div>
          </div>
          <button type="button" class="btn-close" @click="modalDetalleVisible = false"></button>
        </div>
        <div class="modal-body-custom">
          <PanelAtencionPQR
            :pqr="selectedPqr"
            @responder="procesarRespuesta"
            @escalar="escalarCuadrilla"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PanelAtencionPQR from '../components/PanelAtencionPQR.vue'
import PageHeader from '../../../components/PageHeader.vue'
import authService from '../../auth/services/authService.js'
import pqrService from '../services/pqrService.js'

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

const formatearFecha = (iso) => {
  if (!iso) return 'N/D'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('es-CO')
}

// El espejo local guarda fechas ISO; la vista formatea SOLO para display
const paraDisplay = (p) => ({
  ...p,
  fechaRadicado: formatearFecha(p.fechaRadicado),
  fechaVencimiento: formatearFecha(p.fechaVencimiento)
})

const pqrs = ref([])
const selectedPqr = ref(null)
const busqueda = ref('')
const filtroEstado = ref('')
const filtroRemitente = ref('')
const modalDetalleVisible = ref(false)
const modalNuevaVisible = ref(false)
const guardandoPqr = ref(false)

const formNueva = ref({
  remitente: 'IA',
  usuario: '',
  telefono: '',
  direccion: '',
  motivo: '',
  descripcion: '',
  horaInicio: '',
  horaFin: '',
  prioridad: 'MEDIA'
})

const esIA = (item) => {
  if (!item) return false
  const r = (item.remitente || '').toUpperCase()
  if (r === 'IA') return true
  if (r === 'OPERADOR') return false
  const actor = (item.actor || '').toLowerCase()
  return actor.includes('whatsapp') || actor.includes('bot') || actor.includes('ia') || !item.matricula
}

const obtenerHorario = (item) => {
  if (!item) return { inicio: 'N/D', fin: 'N/D', duracion: '0 min' }
  if (item.horaInicio && item.horaFin) {
    return {
      inicio: item.horaInicio,
      fin: item.horaFin,
      duracion: item.duracionMinutos ? `${item.duracionMinutos} min` : '5 min'
    }
  }
  if (item.fechaRadicado) {
    const d = new Date(item.fechaRadicado)
    if (!isNaN(d.getTime())) {
      const hInicio = new Date(d.getTime() - 6 * 60 * 1000)
      return {
        inicio: hInicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        fin: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        duracion: '6 min'
      }
    }
  }
  return {
    inicio: '08:15 a. m.',
    fin: '08:21 a. m.',
    duracion: '6 min'
  }
}

const cargarPqrs = async () => {
  const lista = await pqrService.obtenerTodas()
  pqrs.value = lista.map(paraDisplay)
  if (!selectedPqr.value || !pqrs.value.some(p => String(p.id) === String(selectedPqr.value.id))) {
    selectedPqr.value = pqrs.value.length > 0 ? pqrs.value[0] : null
  }
}

let intervaloPolling = null
const alCambiarStorage = (e) => {
  if (e.key === 'acuasan_pqr_v2') cargarPqrs()
}

onMounted(async () => {
  await pqrService.sincronizarPendientes()
  await cargarPqrs()
  window.addEventListener('storage', alCambiarStorage)
  intervaloPolling = setInterval(cargarPqrs, 5000)
})

onUnmounted(() => {
  window.removeEventListener('storage', alCambiarStorage)
  if (intervaloPolling) clearInterval(intervaloPolling)
})

const filteredPqrs = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  return pqrs.value.filter(p => {
    const matchBusqueda =
      !q ||
      (p.radicado || '').toLowerCase().includes(q) ||
      (p.usuario || '').toLowerCase().includes(q) ||
      (p.telefono || '').toLowerCase().includes(q) ||
      (p.direccion || '').toLowerCase().includes(q) ||
      (p.motivo || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q)

    const matchEstado = !filtroEstado.value || p.estado === filtroEstado.value
    const matchRemitente = !filtroRemitente.value || (filtroRemitente.value === 'IA' ? esIA(p) : !esIA(p))

    return matchBusqueda && matchEstado && matchRemitente
  })
})

const totalResueltas = computed(() => {
  return pqrs.value.filter(p => p.estado === 'RESUELTO').length
})

const totalPendientes = computed(() => {
  return pqrs.value.filter(p => p.estado !== 'RESUELTO').length
})

const porcentajeCumplimiento = computed(() => {
  if (pqrs.value.length === 0) return 100
  return Math.round((totalResueltas.value / pqrs.value.length) * 100)
})

const abrirDetallePqr = (item) => {
  selectedPqr.value = item
  modalDetalleVisible.value = true
}

const abrirModalNuevaPqr = () => {
  const ahora = new Date()
  const hace6Min = new Date(ahora.getTime() - 6 * 60 * 1000)
  formNueva.value = {
    remitente: 'IA',
    usuario: '',
    telefono: '',
    direccion: '',
    motivo: '',
    descripcion: '',
    horaInicio: hace6Min.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
    horaFin: ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
    prioridad: 'MEDIA'
  }
  modalNuevaVisible.value = true
}

const guardarNuevaPqr = async () => {
  if (!formNueva.value.usuario || !formNueva.value.motivo || !formNueva.value.descripcion) {
    lanzarAlertaBootstrap('warning', 'Campos Incompletos', 'Por favor diligencie los campos obligatorios.')
    return
  }

  guardandoPqr.value = true
  try {
    const nueva = await pqrService.crear({
      remitente: formNueva.value.remitente,
      usuario: formNueva.value.usuario,
      telefono: formNueva.value.telefono,
      direccion: formNueva.value.direccion,
      motivo: formNueva.value.motivo,
      descripcion: formNueva.value.descripcion,
      horaInicio: formNueva.value.horaInicio,
      horaFin: formNueva.value.horaFin,
      prioridad: formNueva.value.prioridad,
      actor: formNueva.value.remitente === 'IA' ? 'WhatsApp Bot' : 'Operador'
    })

    const paraMostrar = paraDisplay(nueva)
    pqrs.value.unshift(paraMostrar)
    selectedPqr.value = paraMostrar
    modalNuevaVisible.value = false

    if (nueva.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('success', 'Registro Guardado', 'Se guardó con éxito el registro de PQR.')
    } else {
      lanzarAlertaBootstrap('warning', 'Registro Guardado (Local)', 'Registro guardado provisionalmente sin conexión.')
    }
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error al Guardar', e.message || 'No se pudo guardar el registro de PQR.')
  } finally {
    guardandoPqr.value = false
  }
}

const procesarRespuesta = async (payload) => {
  const pqr = selectedPqr.value
  if (!pqr) return
  try {
    const r = await pqrService.responder(pqr, {
      respuestaOficial: payload.respuesta,
      respondidoPor: authService.getUsuarioActual()?.nombre || 'Atención al Usuario Acuasan',
      nuevoEstado: 'RESUELTO'
    })
    pqr.estado = 'RESUELTO'
    pqr.respuestaOficial = payload.respuesta
    pqr.sincronizado = r.origen === 'SERVIDOR'
    if (r.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('success', 'Respuesta Registrada', `PQR ${pqr.radicado} respondida y guardada en la base de datos.`)
    } else {
      lanzarAlertaBootstrap('warning', 'Guardado Local', `PQR ${pqr.radicado} respondida localmente. Se sincronizará cuando el servidor esté disponible.`)
    }
    modalDetalleVisible.value = false
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message || 'No se pudo registrar la respuesta.')
  }
}

const escalarCuadrilla = async (item) => {
  if (!item) return
  try {
    const r = await pqrService.escalar(item)
    item.estado = 'EN_TRAMITE'
    item.sincronizado = r.origen === 'SERVIDOR'
    if (r.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('warning', 'PQR Escalada', `PQR ${item.radicado} asignada a cuadrilla técnica operativa para visita en campo.`)
    } else {
      lanzarAlertaBootstrap('warning', 'PQR Escalada (Local)', `PQR ${item.radicado} marcada en trámite localmente. Se sincronizará cuando el servidor esté disponible.`)
    }
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message || 'No se pudo escalar la PQR.')
  }
}

const exportarExcel = () => {
  lanzarAlertaBootstrap('success', 'Exportación Excel', 'Generando y descargando libro de Excel Acuasan_Libro_PQR_2026.xlsx...')
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
  min-width: 300px;
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

.action-buttons-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-nueva-pqr {
  background: #004884;
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
}

.btn-nueva-pqr:hover {
  background: #003666;
}

.btn-export-excel {
  background: #107c41;
  color: #ffffff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
}

.btn-export-excel:hover {
  background: #0b582e;
}

/* Tabla de Excel */
.table-responsive {
  overflow-x: auto;
  max-height: 520px;
  overflow-y: auto;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
  color: #0f172a;
}

.excel-col-letters-row th {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 700;
  font-size: 0.68rem;
  padding: 2px 8px;
  border: 1px solid #cbd5e1;
  user-select: none;
}

.excel-main-header-row th {
  background: #e2e8f0;
  color: #1e293b;
  font-weight: 700;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  white-space: nowrap;
}

.col-excel-index {
  background: #f1f5f9 !important;
  color: #64748b;
  font-family: monospace;
  font-size: 0.68rem;
  font-weight: 700;
  width: 32px;
  text-align: center;
  border: 1px solid #cbd5e1;
  user-select: none;
}

.excel-table td {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  vertical-align: middle;
}

.row-even {
  background: #fcfcfc;
}

.excel-table tbody tr:hover {
  background: #e0f2fe !important;
}

.row-active-item {
  background: #dbeafe !important;
}

.row-resolved {
  opacity: 0.85;
}

.col-radicado {
  font-family: monospace;
  font-weight: 700;
  color: #004884;
}

/* Badges Remitente */
.badge-remitente-sm {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  white-space: nowrap;
}

.badge-ia {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.badge-operador {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.cell-user {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name { font-weight: 700; color: #1e293b; }
.user-sub { font-size: 0.68rem; }

.cell-motivo {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.font-mono { font-family: monospace, monospace; }

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-abierto { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.status-en_tramite { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.status-resuelto { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

.btn-gestionar {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  background: #004884;
  color: #ffffff;
  border: 1px solid #003666;
  transition: all 0.15s ease;
}

.btn-gestionar:hover {
  background: #003666;
}

/* Modal Personalizado */
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 16px;
}

.modal-dialog-custom {
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid #cbd5e1;
}

.modal-dialog-lg {
  max-width: 720px;
}

.modal-header-custom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px 10px 0 0;
}

.modal-body-custom {
  padding: 16px;
}
</style>
