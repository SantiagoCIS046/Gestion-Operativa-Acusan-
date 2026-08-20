<template>
  <Teleport to="body">
    <div class="acuasan-toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast" tag="div" class="toast-stack">
        <div
          v-for="noti in notificaciones"
          :key="noti.id"
          :class="['acuasan-toast', `toast-${noti.tipo}`]"
          role="alert"
          @mouseenter="pausar(noti)"
          @mouseleave="reanudar(noti)"
        >
          <!-- Icono según tipo (SVG institucional, sin emojis) -->
          <div :class="['toast-icon', `icon-${noti.tipo}`]">
            <!-- ÉXITO -->
            <svg
              v-if="noti.tipo === 'success'"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <!-- ERROR -->
            <svg
              v-else-if="noti.tipo === 'danger'"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <!-- ADVERTENCIA -->
            <svg
              v-else-if="noti.tipo === 'warning'"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              ></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <!-- INFO -->
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>

          <!-- Contenido -->
          <div class="toast-content">
            <p class="toast-title">{{ noti.titulo }}</p>
            <p v-if="noti.mensaje" class="toast-message">{{ noti.mensaje }}</p>
          </div>

          <!-- Cierre manual -->
          <button
            type="button"
            class="toast-close"
            aria-label="Cerrar notificación"
            @click="cerrar(noti.id)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Barra de progreso de auto-cierre -->
          <div
            v-if="noti.duracion > 0"
            :class="['toast-progress', `progress-${noti.tipo}`]"
            :style="{ width: noti.progreso + '%' }"
          ></div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import notificacionService from "../services/notificacionService.js";

const { notificaciones } = notificacionService;
const cerrar = notificacionService.cerrar;

/**
 * Pausa el auto-cierre al pasar el mouse (mejora de UX).
 * Detiene la cuenta restando el tiempo ya consumido.
 */
const pausar = (noti) => {
  noti.duracion = 0;
  noti.progreso = 100;
};

/** El auto-cierre no se reanuda tras pausa; el usuario lee con calma y cierra manualmente. */
const reanudar = () => {};
</script>

<style scoped>
/* ==================== CONTENEDOR GLOBAL ==================== */
.acuasan-toast-container {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 2000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
}

/* ==================== TARJETA DE NOTIFICACIÓN ==================== */
.acuasan-toast {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 14px 15px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(2, 31, 58, 0.14), 0 2px 8px rgba(2, 31, 58, 0.06);
  overflow: hidden;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif;
}

/* Bordes laterales por severidad */
.toast-success {
  border-left: 4px solid #16a34a;
}
.toast-danger {
  border-left: 4px solid #dc2626;
}
.toast-warning {
  border-left: 4px solid #d97706;
}
.toast-info {
  border-left: 4px solid #004884;
}

/* ==================== ICONOS ==================== */
.toast-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.icon-success {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}
.icon-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.icon-warning {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.icon-info {
  background: #eff6ff;
  color: #004884;
  border: 1px solid #bfdbfe;
}

/* ==================== CONTENIDO ==================== */
.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  margin: 0 0 2px 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.25;
  letter-spacing: 0.1px;
}

.toast-message {
  margin: 0;
  font-size: 0.78rem;
  color: #475569;
  line-height: 1.4;
  word-wrap: break-word;
}

/* ==================== BOTÓN CERRAR ==================== */
.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}

.toast-close:hover {
  background: #f1f5f9;
  color: #334155;
}

/* ==================== BARRA DE PROGRESO ==================== */
.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  transition: width 0.06s linear;
  border-radius: 0 2px 0 0;
}

.progress-success {
  background: linear-gradient(90deg, #16a34a, #4ade80);
}
.progress-danger {
  background: linear-gradient(90deg, #dc2626, #f87171);
}
.progress-warning {
  background: linear-gradient(90deg, #d97706, #fbbf24);
}
.progress-info {
  background: linear-gradient(90deg, #004884, #38bdf8);
}

/* ==================== ANIMACIONES ==================== */
.toast-enter-active {
  animation: toastIn 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
}

.toast-leave-active {
  animation: toastOut 0.3s ease forwards;
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(60px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
    max-height: 120px;
  }
  to {
    opacity: 0;
    transform: translateX(60px) scale(0.95);
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-bottom: -10px;
  }
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 576px) {
  .acuasan-toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }

  .toast-stack {
    max-width: 100%;
  }
}
</style>
