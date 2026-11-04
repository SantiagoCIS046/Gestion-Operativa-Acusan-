<template>
  <Teleport to="body">
    <div class="toasts" aria-live="polite">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.tipo}`" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
            <template v-if="t.tipo === 'exito'">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </template>
            <template v-else-if="t.tipo === 'error'">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </template>
          </svg>
          <span class="toast-mensaje">{{ t.mensaje }}</span>
          <button type="button" class="toast-cerrar" aria-label="Cerrar aviso" @click="cerrar(t.id)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast.js'

const { toasts, cerrar } = useToast()
</script>

<style scoped>
.toasts {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(380px, calc(100vw - 36px));
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(2, 31, 58, 0.18);
  border: 1px solid;
  background: var(--card-bg);
}

.toast svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.toast--exito {
  color: var(--acuasan-green-text, #166534);
  border-color: #86efac;
  background: var(--acuasan-green-light);
}

.toast--error {
  color: var(--acuasan-red-dark, #b91c1c);
  border-color: #fca5a5;
  background: var(--acuasan-red-light, #fef2f2);
}

.toast--info {
  color: var(--acuasan-blue);
  border-color: #bae6fd;
  background: var(--acuasan-blue-light);
}

.toast-mensaje {
  flex: 1;
  line-height: 1.35;
}

.toast-cerrar {
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  padding: 2px;
  display: flex;
  border-radius: 4px;
}

.toast-cerrar:hover { opacity: 1; }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
