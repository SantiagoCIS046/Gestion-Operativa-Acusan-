<template>
  <div class="app-shell">
    <!-- ===== LAYOUT CON SIDEBAR: Solo visible cuando hay sesión activa ===== -->
    <template v-if="estaAutenticado">
      <!-- Dark Navy Corporate Sidebar -->
      <aside class="sidebar">
        <!-- Brand & Official Acuasan Logo -->
        <div class="sidebar-brand">
          <div class="acuasan-emblem-wrapper">
            <img src="/logo-acuasan.svg" alt="Acuasan 100% Sangileña" class="acuasan-logo-img" />
          </div>
          <div class="brand-info">
            <h2 class="brand-title">ACUASAN</h2>
            <span class="brand-sub">GESTIÓN OPERATIVA</span>
          </div>
        </div>

        <!-- Navigation Links (según el rol del usuario) -->
        <nav class="sidebar-nav">
          <!-- ENCARGADO: Permisos -->
          <router-link
            v-if="tieneAcceso(['ENCARGADO', 'ADMIN'])"
            to="/permisos/encargado"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">📄</span>
            <span class="nav-text">Permisos</span>
            <span class="active-indicator-dot"></span>
          </router-link>

          <!-- ENCARGADO y GERENCIA: Horas Extras -->
          <router-link
            v-if="tieneAcceso(['ENCARGADO', 'GERENCIA', 'ADMIN'])"
            to="/horas-extras/gerencia"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">⏱️</span>
            <span class="nav-text">Horas Extras</span>
            <span class="active-indicator-dot"></span>
          </router-link>

          <!-- GERENCIA: Consulta de Permisos -->
          <router-link
            v-if="tieneAcceso(['GERENCIA', 'ADMIN'])"
            to="/permisos/gerencia"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">📊</span>
            <span class="nav-text">Consulta Permisos</span>
            <span class="active-indicator-dot"></span>
          </router-link>

          <!-- GERENCIA y OPERATIVO: PQR -->
          <router-link
            v-if="tieneAcceso(['OPERATIVO', 'GERENCIA', 'ADMIN'])"
            to="/pqr/gestion"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">📋</span>
            <span class="nav-text">Gestión PQR</span>
            <span class="active-indicator-dot"></span>
          </router-link>

          <!-- RADICADOS: Eliana y Román (Gestión y Registro) -->
          <router-link
            v-if="tieneAcceso(['RADICADOS', 'ENCARGADO'])"
            to="/radicados/gestion"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">📑</span>
            <span class="nav-text">Radicados</span>
            <span class="active-indicator-dot"></span>
          </router-link>

          <!-- RADICADOS: Gerencia y Admin (Supervisión y Alertas de Subidas) -->
          <router-link
            v-if="tieneAcceso(['GERENCIA', 'ADMIN'])"
            to="/radicados/gerencia"
            class="nav-btn"
            active-class="active"
          >
            <span class="nav-icon">📑</span>
            <span class="nav-text">Radicados</span>
            <span class="active-indicator-dot"></span>
          </router-link>


        </nav>

        <!-- User Profile & Logout at bottom -->
        <div class="sidebar-footer">
          <div class="sidebar-footer-user">
            <div class="user-avatar-circle">{{ avatarIniciales }}</div>
            <div class="user-info">
              <span class="user-name">{{ usuario?.nombre || 'Usuario' }}</span>
              <span class="user-role">{{ usuario?.cargo || usuario?.rol }}</span>
            </div>
          </div>
          <button
            class="btn-logout"
            @click="abrirModalCerrarSesion"
            title="Cerrar sesión"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="main-wrapper">
        <!-- Acuasan Brand Top Stripe -->
        <div class="brand-color-stripe"></div>

        <!-- Dynamic Page View -->
        <main class="page-content">
          <div class="content-container">
            <router-view />
          </div>
        </main>
      </div>
    </template>

    <!-- ===== SOLO ROUTER-VIEW para el Login (sin sidebar) ===== -->
    <template v-else>
      <router-view />
    </template>

    <!-- ========================================== -->
    <!-- SISTEMA GLOBAL DE NOTIFICACIONES PROFESIONALES (TOASTS) -->
    <!-- ========================================== -->
    <NotificacionesToast />

    <!-- ========================================== -->
    <!-- MODAL BOOTSTRAP COMPACTO Y PROFESIONAL: CIERRE DE SESIÓN -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="modalCerrarSesionVisible" class="modal fade show d-block" tabindex="-1" style="background: rgba(2, 20, 38, 0.55); backdrop-filter: blur(3px); z-index: 1080;">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 360px;">
          <div class="modal-content border-0 shadow-lg rounded-3 overflow-hidden bg-white">
            <div class="modal-header border-bottom py-2 px-3 bg-light d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <h6 class="modal-title fw-bold text-dark m-0" style="font-size: 0.92rem; letter-spacing: 0.2px;">Confirmar Salida</h6>
              </div>
              <button type="button" class="btn-close btn-close-sm ms-auto" style="font-size: 0.75rem;" @click="modalCerrarSesionVisible = false"></button>
            </div>
            
            <div class="modal-body p-3">
              <p class="text-dark fw-semibold mb-1" style="font-size: 0.88rem;">¿Desea cerrar la sesión activa?</p>
              <p class="text-muted mb-0" style="font-size: 0.78rem; line-height: 1.35;">
                Saldrá del <strong>Sistema de Gestión Operativa Acuasan</strong>. Sus cambios guardados se mantendrán seguros.
              </p>
            </div>

            <div class="modal-footer border-0 bg-light py-2 px-3 d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-sm btn-light border text-secondary fw-semibold px-3 rounded-2" style="font-size: 0.8rem;" @click="modalCerrarSesionVisible = false">
                Cancelar
              </button>
              <button type="button" class="btn btn-sm btn-danger fw-bold px-3 rounded-2 d-inline-flex align-items-center gap-1 shadow-sm" style="font-size: 0.8rem;" @click="confirmarCerrarSesion">
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import authService from './modules/auth/services/authService.js'
import NotificacionesToast from './components/NotificacionesToast.vue'

const router = useRouter()
const route = useRoute()

const modalCerrarSesionVisible = ref(false)

const estaAutenticado = computed(() => authService.estaAutenticado())
const usuario = computed(() => authService.getUsuarioActual())

// Iniciales para el avatar (primeras letras del nombre)
const avatarIniciales = computed(() => {
  const nombre = usuario.value?.nombre || 'U'
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
})

// Verificar si el usuario tiene uno de los roles dados
const tieneAcceso = (roles) => {
  const rol = usuario.value?.rol
  return roles.includes(rol)
}

// Etiqueta y clase del rol para el header
const rolLabel = computed(() => {
  switch (usuario.value?.rol) {
    case 'ENCARGADO': return 'Encargado de RRHH'
    case 'GERENCIA':  return 'Gerencia General'
    case 'OPERATIVO': return 'Operativo PQR'
    case 'ADMIN':     return 'Administrador'
    default: return 'Sistema Activo'
  }
})

const rolClass = computed(() => {
  switch (usuario.value?.rol) {
    case 'ENCARGADO': return 'role-encargado'
    case 'GERENCIA':  return 'role-gerencia'
    case 'OPERATIVO': return 'role-operativo'
    default: return 'role-default'
  }
})

const abrirModalCerrarSesion = () => {
  modalCerrarSesionVisible.value = true
}

const confirmarCerrarSesion = () => {
  modalCerrarSesionVisible.value = false
  authService.logout()
  router.replace('/login')
}
</script>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background-color: #f0f4f8;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* === SIDEBAR === */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: #02203d;
  background: linear-gradient(180deg, #021f3a 0%, #011427 100%);
  display: flex;
  flex-direction: column;
  color: #ffffff;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(115, 190, 40, 0.15);
}

.sidebar-brand {
  padding: 20px 16px 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.acuasan-emblem-wrapper {
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
  transition: transform 0.2s ease;
}

.acuasan-emblem-wrapper:hover { transform: scale(1.05); }

.acuasan-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-title {
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 1px;
  color: #ffffff;
  margin: 0;
}

.brand-sub {
  font-size: 0.65rem;
  font-weight: 700;
  color: #73be28;
  letter-spacing: 0.8px;
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 18px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(115, 190, 40, 0.4);
  color: #ffffff;
}

.nav-btn.active {
  background: #004884;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 3px 10px rgba(0, 72, 132, 0.45);
  border: 1px solid #005fa8;
  border-left: 4px solid #73be28;
}

.active-indicator-dot {
  margin-left: auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #73be28;
  display: none;
}

.nav-btn.active .active-indicator-dot { display: block; }
.nav-icon { font-size: 1rem; }

/* Sidebar Footer & Logout */
.sidebar-footer {
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  background: rgba(0, 0, 0, 0.25);
}

.sidebar-footer-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #004884;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid #73be28;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.user-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.user-role {
  font-size: 0.65rem;
  color: #8fa7be;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.btn-logout {
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all 0.2s ease;
  letter-spacing: 0.2px;
}

.btn-logout:hover {
  background: rgba(239, 68, 68, 0.35);
  border-color: rgba(239, 68, 68, 0.6);
  color: #ffffff;
  transform: scale(1.03);
}

/* === MAIN WRAPPER === */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-color-stripe {
  height: 3px;
  width: 100%;
  background: linear-gradient(90deg, #73be28 0%, #00a3e0 50%, #f59e0b 100%);
}

/* === TOP HEADER === */
.top-header {
  height: 52px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

/* Role badges */
.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 700;
}

.role-encargado { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
.role-gerencia  { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
.role-operativo { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.role-default   { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

.role-badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}

.icon-btn:hover { background: #f1f5f9; }
.icon-btn .icon { font-size: 1rem; color: #475569; }

.notification-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  background: #73be28;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
}

/* === PAGE CONTENT === */
.page-content {
  flex: 1;
  padding: 12px 18px 24px 18px;
  box-sizing: border-box;
}

.content-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}
</style>
