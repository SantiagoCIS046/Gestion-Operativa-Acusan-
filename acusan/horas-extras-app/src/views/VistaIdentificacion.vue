<template>
  <div class="page page--center">
    <div class="ident-wrap">

      <!-- Logo & Branding -->
      <div class="ident-hero">
        <div class="ident-logo-ring">
          <span class="ident-logo-icon">💧</span>
        </div>
        <h1 class="ident-title">Acuasan</h1>
        <p class="ident-subtitle">Portal de Horas Extras<br/>Para Empleados de Campo</p>
      </div>

      <!-- Formulario -->
      <div class="card" style="margin-top: 0;">
        <div class="card__title">
          <span>🪪</span> Identificación del Empleado
        </div>

        <div v-if="error" class="alert alert--error">
          <span>⚠️</span> {{ error }}
        </div>

        <form @submit.prevent="identificar">
          <div class="field">
            <label for="cedula">Número de Cédula</label>
            <input
              id="cedula"
              v-model="cedula"
              type="tel"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="Ej: 1234567890"
              autocomplete="off"
              required
            />
          </div>
          <div class="field">
            <label for="nombre">Nombre Completo</label>
            <input
              id="nombre"
              v-model="nombre"
              type="text"
              placeholder="Ej: Carlos Ramírez"
              autocomplete="name"
              required
            />
            <span class="field-hint">Si tu cédula está registrada, el sistema verificará tu nombre automáticamente.</span>
          </div>
          <button type="submit" class="btn btn--primary" :disabled="cargando">
            <span v-if="cargando" class="spinner"></span>
            <span v-else>Ingresar al Portal →</span>
          </button>
        </form>
      </div>

      <p class="ident-footer">Acuasan · Sistema de Gestión Operativa</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/api.js'

const router = useRouter()
const cedula = ref('')
const nombre = ref('')
const cargando = ref(false)
const error = ref('')

const identificar = async () => {
  error.value = ''
  cargando.value = true
  try {
    await authService.identificar({ cedula: cedula.value, nombre: nombre.value })
    router.push({ name: 'registrar' })
  } catch (e) {
    error.value = e.message || 'No se pudo ingresar. Intenta de nuevo.'
  } finally {
    cargando.value = false
  }
}
</script>

<style scoped>
.page--center {
  align-items: center;
  justify-content: flex-start;
  background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(14,165,233,0.12) 0%, transparent 60%),
              var(--acuasan-navy);
}

.ident-wrap {
  width: 100%;
  max-width: 420px;
  padding: 40px 16px 32px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;
}

.ident-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.ident-logo-ring {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.05));
  border: 2px solid rgba(14,165,233,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.2rem;
  box-shadow: 0 0 40px rgba(14,165,233,0.15), inset 0 1px 0 rgba(255,255,255,0.05);
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 30px rgba(14,165,233,0.15), inset 0 1px 0 rgba(255,255,255,0.05); }
  50%       { box-shadow: 0 0 55px rgba(14,165,233,0.3),  inset 0 1px 0 rgba(255,255,255,0.05); }
}

.ident-title {
  font-size: 1.8rem;
  font-weight: 900;
  background: linear-gradient(135deg, #e2e8f0, var(--acuasan-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.ident-subtitle {
  font-size: 0.88rem;
  color: var(--acuasan-muted);
  line-height: 1.5;
}

.field-hint {
  font-size: 0.72rem;
  color: var(--acuasan-muted);
  margin-top: 5px;
  display: block;
  line-height: 1.4;
}

.ident-footer {
  text-align: center;
  font-size: 0.72rem;
  color: var(--acuasan-muted);
  opacity: 0.6;
}
</style>