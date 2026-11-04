<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div
        v-if="modelValue"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="titulo"
        @click.self="cerrar"
      >
        <div class="modal-caja" :class="`modal-caja--${ancho}`">
          <div class="modal-encabezado">
            <h3 class="modal-titulo">{{ titulo }}</h3>
            <button type="button" class="modal-cerrar" aria-label="Cerrar" @click="cerrar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="modal-cuerpo">
            <slot />
          </div>

          <div v-if="$slots.acciones" class="modal-acciones">
            <slot name="acciones" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  titulo: { type: String, default: '' },
  ancho: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})

const emit = defineEmits(['update:modelValue'])

function cerrar() {
  emit('update:modelValue', false)
}

function alTeclado(evento) {
  if (evento.key === 'Escape') cerrar()
}

watch(
  () => props.modelValue,
  (abierto) => {
    if (abierto) window.addEventListener('keydown', alTeclado)
    else window.removeEventListener('keydown', alTeclado)
  },
)

onUnmounted(() => window.removeEventListener('keydown', alTeclado))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(2, 21, 42, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-caja {
  background: var(--card-bg);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(2, 31, 58, 0.35);
  border: 1px solid var(--border-color);
  width: 100%;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
  overflow: hidden;
  position: relative;
}

.modal-caja::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--acuasan-green) 0%, var(--acuasan-blue) 60%, var(--acuasan-cyan) 100%);
}

.modal-caja--sm { max-width: 420px; }
.modal-caja--md { max-width: 560px; }
.modal-caja--lg { max-width: 780px; }

.modal-encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.modal-titulo {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.2px;
}

.modal-cerrar {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  transition: all 0.15s ease;
}

.modal-cerrar:hover {
  color: var(--acuasan-red-dark, #b91c1c);
  background: #fef2f2;
}

.modal-cuerpo {
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 0.86rem;
  color: var(--text-main);
}

.modal-acciones {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-color);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-active .modal-caja,
.modal-fade-leave-active .modal-caja {
  transition: transform 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-caja,
.modal-fade-leave-to .modal-caja {
  transform: translateY(10px) scale(0.98);
}
</style>
