<template>
  <div class="gestion-pqr-view">
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
      titulo="Atención al Usuario & PQR"
      subtitulo="Gestión de peticiones, quejas, reclamos y recursos legales en tiempo límite"
      icono="📋"
    />

    <div class="header-actions" style="margin-bottom: 4px;">
      <button class="btn btn-primary" @click="nuevoPQR">+ Radicar Nueva PQR</button>
    </div>

    <div class="pqr-layout">
      <!-- Master List -->
      <div class="pqr-list-container">
        <div class="list-search">
          <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar por radicado, usuario o matrícula..."
            class="search-input"
          />
        </div>

        <div class="items-list">
          <div
            v-for="item in filteredPqrs"
            :key="item.id"
            class="pqr-list-item"
            :class="{ active: selectedPqr && selectedPqr.id === item.id }"
            @click="selectedPqr = item"
          >
            <div class="item-top">
              <span class="rad-tag">#{{ item.radicado }}</span>
              <span class="status-dot" :class="'status-' + item.estado.toLowerCase()"></span>
            </div>
            <div class="item-user">{{ item.usuario }}</div>
            <div class="item-motivo">{{ item.motivo }}</div>
            <div class="item-bottom">
              <span class="item-date">📅 {{ item.fechaRadicado }}</span>
              <span class="item-term text-amber-600">Vence: {{ item.fechaVencimiento }}</span>
            </div>
          </div>

          <div v-if="filteredPqrs.length === 0" class="no-items">
            No se encontraron registros.
          </div>
        </div>
      </div>

      <!-- Detail Panel -->
      <div class="pqr-detail-container">
        <PanelAtencionPQR
          :pqr="selectedPqr"
          @responder="procesarRespuesta"
          @escalar="escalarCuadrilla"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PanelAtencionPQR from '../components/PanelAtencionPQR.vue'
import PageHeader from '../../../components/PageHeader.vue'

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

const STORAGE_KEY_PQR = 'acuasan_pqr_v2'

const obtenerDbLocalPqr = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PQR)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {}
  return []
}

const guardarDbLocalPqr = (lista) => {
  try {
    localStorage.setItem(STORAGE_KEY_PQR, JSON.stringify(lista))
  } catch (e) {}
}

const pqrs = ref(obtenerDbLocalPqr())
const selectedPqr = ref(pqrs.value.length > 0 ? pqrs.value[0] : null)
const busqueda = ref('')

const filteredPqrs = computed(() => {
  return pqrs.value.filter(p =>
    p.radicado.toLowerCase().includes(busqueda.value.toLowerCase()) ||
    p.usuario.toLowerCase().includes(busqueda.value.toLowerCase()) ||
    (p.matricula && p.matricula.toLowerCase().includes(busqueda.value.toLowerCase()))
  )
})

const procesarRespuesta = (payload) => {
  if (selectedPqr.value) {
    selectedPqr.value.estado = 'RESUELTO'
    guardarDbLocalPqr(pqrs.value)
    lanzarAlertaBootstrap('success', 'Respuesta Registrada', `PQR ${selectedPqr.value.radicado} respondida con éxito y notificada al usuario.`)
  }
}

const escalarCuadrilla = (item) => {
  item.estado = 'EN_TRAMITE'
  guardarDbLocalPqr(pqrs.value)
  lanzarAlertaBootstrap('warning', 'PQR Escalada', `PQR ${item.radicado} asignada a cuadrilla técnica operativa para visita en campo.`)
}

const nuevoPQR = () => {
  const nuevoRad = `PQR-2026-${Math.floor(1000 + Math.random() * 9000)}`
  const nuevaPqr = {
    id: Date.now(),
    radicado: nuevoRad,
    usuario: 'Usuario Ciudadano San Gil',
    matricula: `ACU-${Math.floor(10000 + Math.random() * 90000)}`,
    direccion: 'Sector San Gil',
    motivo: 'Solicitud ciudadana ingresada vía ventanilla',
    descripcion: 'Petición formal para revisión por parte de la cuadrilla técnica.',
    fechaRadicado: new Date().toLocaleDateString('es-CO'),
    fechaVencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO'),
    estado: 'ABIERTO'
  }
  pqrs.value.unshift(nuevaPqr)
  selectedPqr.value = nuevaPqr
  guardarDbLocalPqr(pqrs.value)
  lanzarAlertaBootstrap('success', 'PQR Radicada', `Se radicó con éxito el expediente ${nuevoRad}.`)
}
</script>

<style scoped>
.gestion-pqr-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.view-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.view-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin: 4px 0 0 0;
}

.pqr-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
}

@media (max-width: 1024px) {
  .pqr-layout {
    grid-template-columns: 1fr;
  }
}

.pqr-list-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  max-height: 750px;
  overflow: hidden;
}

.list-search {
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  outline: none;
}

.items-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pqr-list-item {
  padding: 14px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pqr-list-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.pqr-list-item.active {
  background: #f0f9ff;
  border-color: #0284c7;
}

.item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rad-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0284c7;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-abierto { background: #ef4444; }
.status-en_tramite { background: #f59e0b; }
.status-resuelto { background: #10b981; }

.item-user {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.item-motivo {
  font-size: 0.8rem;
  color: #64748b;
  margin: 4px 0 8px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
}

.no-items {
  padding: 30px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}

.btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #0284c7;
  color: #ffffff;
}

.btn-primary:hover {
  background: #0369a1;
}
</style>
