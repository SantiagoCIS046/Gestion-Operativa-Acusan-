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
      titulo="Historial de PQR"
      subtitulo="Plantilla Excel y gestión de peticiones, quejas, reclamos y recursos legales en tiempo límite"
      icono="📋"
    />

    <!-- KPI Summary Row -->
    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="text-uppercase fw-bold text-muted small" style="font-size: 0.68rem;">TOTAL EXPEDIENTES</span>
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
            =CONTAR_ESTADO(PQR) &rarr; Total Radicados: <strong>{{ pqrs.length }}</strong> | Resueltas: <strong>{{ totalResueltas }}</strong> | En Trámite: <strong>{{ totalPendientes }}</strong> | Cumplimiento Términos: <strong>{{ porcentajeCumplimiento }}%</strong>
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
              placeholder="Buscar por radicado, usuario o matrícula..."
              class="search-input"
            />
          </div>

          <select v-model="filtroEstado" class="select-input">
            <option value="">Todos los Estados</option>
            <option value="ABIERTO">🔴 Abierto</option>
            <option value="EN_TRAMITE">🟡 En Trámite</option>
            <option value="RESUELTO">🟢 Resuelto</option>
          </select>
        </div>

        <div class="action-buttons-group">
          <button type="button" class="btn-nueva-pqr" @click="nuevoPQR">
            <span>➕ Radicar Nueva PQR</span>
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
              <th class="col-letter">B</th>
              <th class="col-letter">C</th>
              <th class="col-letter">D</th>
              <th class="col-letter text-center">E</th>
              <th class="col-letter text-center">F</th>
              <th class="col-letter text-center">G</th>
              <th class="col-letter text-center">H</th>
            </tr>

            <!-- Excel Main Header Row -->
            <tr class="excel-main-header-row">
              <th class="col-excel-index">#</th>
              <th>N° RADICADO</th>
              <th>USUARIO / SUSCRIPTOR</th>
              <th>MATRÍCULA / CUENTA</th>
              <th>MOTIVO / ASUNTO</th>
              <th class="text-center">FECHA RADICADO</th>
              <th class="text-center">FECHA VENCIMIENTO</th>
              <th class="text-center">ESTADO</th>
              <th class="text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredPqrs.length === 0">
              <td colspan="9" class="text-center py-5 text-muted font-mono">
                [Hoja vacía] No se encontraron expedientes PQR que coincidan con la búsqueda.
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

              <!-- A: Radicado -->
              <td class="col-radicado">#{{ item.radicado }}</td>

              <!-- B: Usuario -->
              <td>
                <div class="cell-user">
                  <span class="user-name">{{ item.usuario }}</span>
                  <span class="user-sub">{{ item.direccion || 'Sector Urbano San Gil' }}</span>
                </div>
              </td>

              <!-- C: Matrícula -->
              <td>
                <span class="font-mono text-dark fw-bold" style="font-size: 0.76rem;">{{ item.matricula || 'N/A' }}</span>
              </td>

              <!-- D: Motivo / Asunto -->
              <td>
                <span class="text-dark fw-semibold text-truncate d-inline-block" style="max-width: 280px;" :title="item.motivo">
                  {{ item.motivo }}
                </span>
              </td>

              <!-- E: Fecha Radicado -->
              <td class="text-center font-mono small">
                {{ item.fechaRadicado }}
              </td>

              <!-- F: Fecha Vencimiento -->
              <td class="text-center font-mono small text-amber-700 fw-bold">
                {{ item.fechaVencimiento }}
              </td>

              <!-- G: Estado -->
              <td class="text-center">
                <span class="status-badge" :class="'status-' + (item.estado || '').toLowerCase()">
                  {{ item.estado }}
                </span>
              </td>

              <!-- H: Acciones -->
              <td class="text-center" @click.stop>
                <button
                  type="button"
                  class="btn-gestionar"
                  @click="abrirDetallePqr(item)"
                  title="Gestionar respuesta o escalar"
                >
                  🔍 Gestionar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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
              <strong class="text-dark">Expediente PQR #{{ selectedPqr.radicado }}</strong>
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
const modalDetalleVisible = ref(false)

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
  // Primero publicar pendientes offline, después refrescar desde la fuente de verdad
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
  const q = busqueda.value.toLowerCase()
  return pqrs.value.filter(p => {
    const matchBusqueda =
      (p.radicado || '').toLowerCase().includes(q) ||
      (p.usuario || '').toLowerCase().includes(q) ||
      (p.matricula || '').toLowerCase().includes(q) ||
      (p.motivo || '').toLowerCase().includes(q)

    const matchEstado = !filtroEstado.value || p.estado === filtroEstado.value

    return matchBusqueda && matchEstado
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

const nuevoPQR = async () => {
  try {
    const nueva = await pqrService.crear({
      usuario: 'Usuario Ciudadano San Gil',
      matricula: `ACU-${Math.floor(10000 + Math.random() * 90000)}`,
      direccion: 'Sector San Gil',
      motivo: 'Solicitud ciudadana ingresada vía ventanilla',
      descripcion: 'Petición formal para revisión por parte de la cuadrilla técnica.',
      prioridad: 'MEDIA'
    })
    const paraMostrar = paraDisplay(nueva)
    pqrs.value.unshift(paraMostrar)
    selectedPqr.value = paraMostrar
    if (nueva.origen === 'SERVIDOR') {
      lanzarAlertaBootstrap('success', 'PQR Radicada', `Se radicó con éxito el expediente ${nueva.radicado} en la base de datos.`)
    } else {
      lanzarAlertaBootstrap('warning', 'PQR Radicada (Local)', `Servidor no disponible: expediente ${nueva.radicado} guardado localmente. Se sincronizará con la base de datos cuando el servidor esté disponible.`)
    }
    modalDetalleVisible.value = true
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message || 'No se pudo radicar la PQR.')
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
  min-width: 280px;
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
  align-items: center;
  gap: 8px;
}

.btn-nueva-pqr {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #004884;
  border: 1px solid #003666;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.76rem;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-nueva-pqr:hover {
  background: #003666;
}

.btn-export-excel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #107c41;
  color: #107c41;
  font-weight: 700;
  font-size: 0.76rem;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-export-excel:hover {
  background: #107c41;
  color: #ffffff;
}

/* Tabla Estilo Excel Grid con Scroll Automático */
.table-responsive {
  width: 100%;
  overflow-x: auto !important;
  overflow-y: auto !important;
  max-height: calc(100vh - 300px);
  min-height: 280px;
  -webkit-overflow-scrolling: touch;
}

.excel-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 0.76rem;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
.row-active-item td { background: #e0f2fe !important; }
.row-resolved td { opacity: 0.92; }

.col-radicado { font-family: monospace; font-weight: 700; color: #0284c7; font-size: 0.76rem; }

.cell-user { display: flex; flex-direction: column; }
.user-name { font-weight: 700; color: #0f172a; font-size: 0.78rem; }
.user-sub { font-size: 0.68rem; color: #64748b; }

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
