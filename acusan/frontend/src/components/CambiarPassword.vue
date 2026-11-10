<template>
  <Modal
    :model-value="modelValue"
    :titulo="obligatorio ? 'Crea tu contraseña personal' : 'Cambiar mi contraseña'"
    ancho="sm"
    :cerrable="!obligatorio"
    @update:model-value="alCerrar"
  >
    <form class="form-clave" novalidate @submit.prevent="guardar">
      <p v-if="obligatorio" class="aviso-obligatorio" role="status">
        Entraste con una contraseña temporal. Por seguridad, crea una propia para continuar.
      </p>

      <div class="campo">
        <label for="clave-actual">{{ obligatorio ? 'Contraseña temporal' : 'Contraseña actual' }}</label>
        <input id="clave-actual" v-model="actual" :type="ver ? 'text' : 'password'" autocomplete="current-password" />
      </div>
      <div class="campo">
        <label for="clave-nueva">Nueva contraseña</label>
        <input id="clave-nueva" v-model="nueva" :type="ver ? 'text' : 'password'" autocomplete="new-password" />
        <p class="ayuda" :class="{ 'ayuda--ok': cumple }">Mínimo 8 caracteres, con letras y números.</p>
      </div>
      <div class="campo">
        <label for="clave-confirmar">Confirmar nueva contraseña</label>
        <input id="clave-confirmar" v-model="confirmar" :type="ver ? 'text' : 'password'" autocomplete="new-password" />
      </div>
      <label class="ver">
        <input v-model="ver" type="checkbox" /> Mostrar contraseñas
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>

    <template #acciones>
      <button v-if="!obligatorio" type="button" class="btn-secundario" @click="alCerrar(false)">Cancelar</button>
      <button v-else type="button" class="btn-secundario" @click="$emit('salir')">Cerrar sesión</button>
      <button type="button" class="btn-primario" :disabled="guardando" @click="guardar">
        {{ guardando ? 'Guardando…' : 'Guardar contraseña' }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
// Cambio de la contraseña propia. En modo `obligatorio` (contraseña temporal
// asignada por un administrador) no se puede cerrar: solo guardar o salir.

import { computed, ref, watch } from 'vue'

import Modal from '@/components/Modal.vue'
import authService from '@/modules/auth/services/authService.js'
import { useToast } from '@/composables/useToast.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  obligatorio: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'cambiada', 'salir'])
const toast = useToast()

const actual = ref('')
const nueva = ref('')
const confirmar = ref('')
const ver = ref(false)
const error = ref('')
const guardando = ref(false)

const cumple = computed(() => nueva.value.length >= 8 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva.value) && /\d/.test(nueva.value))

watch(
  () => props.modelValue,
  (abierto) => {
    if (abierto) {
      actual.value = ''
      nueva.value = ''
      confirmar.value = ''
      error.value = ''
    }
  },
)

function alCerrar(valor) {
  if (props.obligatorio && !valor) return
  emit('update:modelValue', valor)
}

async function guardar() {
  error.value = ''
  if (!actual.value || !nueva.value) {
    error.value = 'Completa los campos.'
    return
  }
  if (!cumple.value) {
    error.value = 'La nueva contraseña debe tener al menos 8 caracteres y combinar letras y números.'
    return
  }
  if (nueva.value !== confirmar.value) {
    error.value = 'La confirmación no coincide con la nueva contraseña.'
    return
  }
  guardando.value = true
  try {
    await authService.cambiarPassword(actual.value, nueva.value)
    toast.exito('Contraseña actualizada. Tus otras sesiones se cerraron.')
    emit('cambiada')
    emit('update:modelValue', false)
  } catch (e) {
    error.value = e.message
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.form-clave {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.aviso-obligatorio {
  background: var(--acuasan-blue-light);
  border-left: 4px solid var(--acuasan-blue);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.78rem;
  color: var(--acuasan-blue-dark);
  font-weight: 600;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campo label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-main);
}

.campo input {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.8rem;
  padding: 8px 10px;
  outline: none;
  font-family: inherit;
}

.campo input:focus {
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

.ayuda {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.ayuda--ok {
  color: var(--acuasan-green-text);
  font-weight: 700;
}

.ver {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--text-muted);
  cursor: pointer;
}

.error {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--acuasan-red-dark);
  background: var(--acuasan-red-light);
  border-radius: 8px;
  padding: 8px 10px;
}

.btn-primario,
.btn-secundario {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 8px 14px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
}

.btn-primario {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #fff;
}

.btn-primario:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
