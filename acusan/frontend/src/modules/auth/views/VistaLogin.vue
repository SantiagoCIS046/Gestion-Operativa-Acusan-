<template>
  <div class="login-shell">
    <!-- Left login form panel (35%) -->
    <div class="form-panel">
      <div class="form-card">
        <!-- Top Institutional Color Accent Stripe -->
        <div class="card-top-stripe"></div>

        <!-- ==================== MODO 1: INICIAR SESIÓN ==================== -->
        <template v-if="modo === 'login'">
          <div class="form-header">
            <div class="brand-emblem-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <span class="portal-eyebrow">SISTEMA DE GESTIÓN OPERATIVA</span>
            <h2 class="form-title">Iniciar Sesión</h2>
            <p class="form-subtitle">Ingrese sus credenciales para acceder al sistema</p>
          </div>

          <!-- Alerts -->
          <transition name="shake-fade">
            <div v-if="successMsg" class="success-alert" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ successMsg }}</span>
            </div>
          </transition>

          <transition name="shake-fade">
            <div v-if="errorMsg" class="error-alert" role="alert">
              <svg class="error-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>{{ errorMsg }}</span>
            </div>
          </transition>

          <!-- Form -->
          <form @submit.prevent="handleLogin" class="login-form" novalidate>
            <!-- Email -->
            <div class="field-group" :class="{ 'field-error': errores.email }">
              <label class="field-label" for="login-email">Correo Electrónico Institucional</label>
              <div class="field-input-wrapper">
                <span class="field-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input
                  id="login-email"
                  v-model="formLogin.email"
                  type="email"
                  class="field-input"
                  placeholder="ejemplo@acuasan.com"
                  autocomplete="email"
                  :disabled="cargando"
                  @input="errores.email = ''"
                />
              </div>
              <span v-if="errores.email" class="field-error-msg">{{ errores.email }}</span>
            </div>

            <!-- Password -->
            <div class="field-group" :class="{ 'field-error': errores.password }">
              <div class="d-flex justify-content-between align-items-center">
                <label class="field-label" for="login-password">Contraseña de Acceso</label>
                <button type="button" class="link-btn-subtle" @click="cambiarModo('recuperar')">
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div class="field-input-wrapper">
                <span class="field-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="login-password"
                  v-model="formLogin.password"
                  :type="mostrarPassword ? 'text' : 'password'"
                  class="field-input"
                  placeholder="••••••••••••"
                  autocomplete="current-password"
                  :disabled="cargando"
                  @input="errores.password = ''"
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="mostrarPassword = !mostrarPassword"
                  title="Mostrar / Ocultar contraseña"
                >
                  <svg v-if="!mostrarPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>

              </div>
              <span v-if="errores.password" class="field-error-msg">{{ errores.password }}</span>
            </div>

            <!-- Submit button -->
            <button type="submit" class="btn-login" :disabled="cargando">
              <span v-if="cargando" class="spinner"></span>
              <template v-else>
                <span>Ingresar al Sistema</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </template>
            </button>
          </form>

          <!-- Register link -->
          <div class="bottom-action-container">
            <span class="action-text">¿Es un nuevo funcionario?</span>
            <button type="button" class="action-link-highlight" @click="cambiarModo('registro')">
              Crear Nuevo Usuario
            </button>
          </div>
        </template>

        <!-- ==================== MODO 2: REGISTRO DE NUEVO USUARIO ==================== -->
        <template v-else-if="modo === 'registro'">
          <div class="form-header">
            <div class="brand-emblem-badge bg-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
            <span class="portal-eyebrow">NUEVO FUNCIONARIO</span>
            <h2 class="form-title">Registrar Usuario</h2>
            <p class="form-subtitle">Crear cuenta e integrar a la BD de Acuasan</p>
          </div>

          <!-- Error Alert -->
          <transition name="shake-fade">
            <div v-if="errorMsg" class="error-alert" role="alert">
              <span>{{ errorMsg }}</span>
            </div>
          </transition>

          <form @submit.prevent="handleRegistro" class="login-form compact" novalidate>
            <!-- Nombre -->
            <div class="field-group">
              <label class="field-label">Nombre Completo del Funcionario</label>
              <input v-model="formRegistro.nombre" type="text" class="field-input" placeholder="Nombre y Apellidos del Funcionario" required />
            </div>

            <!-- Cédula -->
            <div class="field-group">
              <label class="field-label">Cédula de Ciudadanía</label>
              <input v-model="formRegistro.cedula" type="text" class="field-input" placeholder="Número de cédula" required />
            </div>

            <!-- Email -->
            <div class="field-group">
              <label class="field-label">Correo Electrónico Institucional</label>
              <input v-model="formRegistro.email" type="email" class="field-input" placeholder="usuario@acuasan.com" required />
            </div>

            <!-- Contraseña -->
            <div class="field-group">
              <label class="field-label">Contraseña de Acceso</label>
              <div class="field-input-wrapper">
                <input
                  v-model="formRegistro.password"
                  :type="mostrarPassword ? 'text' : 'password'"
                  class="field-input"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="mostrarPassword = !mostrarPassword"
                  title="Mostrar / Ocultar contraseña"
                >
                  <svg v-if="!mostrarPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
            </div>


            <!-- Security note -->
            <div class="security-notice">
              <span>🛡️ Por seguridad institucional, los nuevos registros se asignan como Funcionario Operativo. Los cargos gerenciales son administrados por la entidad.</span>
            </div>

            <button type="submit" class="btn-login btn-success" :disabled="cargando">
              <span v-if="cargando" class="spinner"></span>
              <span v-else>Guardar e Ingresar al Sistema</span>
            </button>
          </form>

          <div class="bottom-action-container">
            <button type="button" class="action-link-subtle" @click="cambiarModo('login')">
              ← Volver a Iniciar Sesión
            </button>
          </div>
        </template>

        <!-- ==================== MODO 3: SOLICITAR RECUPERACIÓN DE CONTRASEÑA ==================== -->
        <template v-else-if="modo === 'recuperar'">
          <div class="form-header">
            <div class="brand-emblem-badge bg-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
            </div>
            <span class="portal-eyebrow">RECUPERACIÓN DE CUENTA</span>
            <h2 class="form-title">¿Olvidó su Contraseña?</h2>
            <p class="form-subtitle">Ingrese su correo institucional para recibir el código</p>
          </div>

          <transition name="shake-fade">
            <div v-if="errorMsg" class="error-alert" role="alert">
              <span>{{ errorMsg }}</span>
            </div>
          </transition>

          <form @submit.prevent="handleSolicitarRecuperacion" class="login-form" novalidate>
            <div class="field-group">
              <label class="field-label">Correo Electrónico Registrado</label>
              <div class="field-input-wrapper">
                <span class="field-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input v-model="formRecuperar.email" type="email" class="field-input" placeholder="ejemplo@acuasan.com" required />
              </div>
            </div>

            <button type="submit" class="btn-login btn-amber" :disabled="cargando">
              <span v-if="cargando" class="spinner"></span>
              <span v-else>Enviar Código al Correo</span>
            </button>
          </form>

          <div class="bottom-action-container">
            <button type="button" class="action-link-subtle" @click="cambiarModo('login')">
              ← Cancelar y regresar al Login
            </button>
          </div>
        </template>

        <!-- ==================== MODO 4: ACTUALIZAR CONTRASEÑA E INTEGRAR A BD ==================== -->
        <template v-else-if="modo === 'reset-password'">
          <div class="form-header">
            <div class="brand-emblem-badge bg-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <span class="portal-eyebrow">ACTUALIZACIÓN DE CLAVE</span>
            <h2 class="form-title">Nueva Contraseña</h2>
            <p class="form-subtitle">Establezca su nueva clave para <strong>{{ formReset.email }}</strong></p>
          </div>

          <transition name="shake-fade">
            <div v-if="errorMsg" class="error-alert" role="alert">
              <span>{{ errorMsg }}</span>
            </div>
          </transition>

          <form @submit.prevent="handleResetearPassword" class="login-form" novalidate>
            <!-- Código simulado enviándolo al correo -->
            <div class="field-group">
              <label class="field-label">Código de Verificación (Enviado al correo)</label>
              <input v-model="formReset.codigo" type="text" class="field-input" placeholder="ej. 849201" required />
            </div>

            <!-- Nueva Contraseña -->
            <div class="field-group">
              <label class="field-label">Nueva Contraseña</label>
              <div class="field-input-wrapper">
                <input
                  v-model="formReset.nuevaPassword"
                  :type="mostrarPassword ? 'text' : 'password'"
                  class="field-input"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="mostrarPassword = !mostrarPassword"
                  title="Mostrar / Ocultar contraseña"
                >
                  <svg v-if="!mostrarPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Confirmar Contraseña -->
            <div class="field-group">
              <label class="field-label">Confirmar Nueva Contraseña</label>
              <div class="field-input-wrapper">
                <input
                  v-model="formReset.confirmarPassword"
                  :type="mostrarPassword ? 'text' : 'password'"
                  class="field-input"
                  placeholder="Repita la clave"
                  required
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="mostrarPassword = !mostrarPassword"
                  title="Mostrar / Ocultar contraseña"
                >
                  <svg v-if="!mostrarPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
            </div>


            <button type="submit" class="btn-login" :disabled="cargando">
              <span v-if="cargando" class="spinner"></span>
              <span v-else>Guardar Nueva Contraseña en BD</span>
            </button>
          </form>

          <div class="bottom-action-container">
            <button type="button" class="action-link-subtle" @click="cambiarModo('login')">
              ← Cancelar y volver al Login
            </button>
          </div>
        </template>

        <!-- Footer -->
        <div class="form-footer">
          <div class="ssl-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Conexión Segura SSL · Acuasan &copy; {{ currentYear }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right brand panel (65%) -->
    <div class="brand-panel">
      <!-- Gradient Waves Background Effect -->
      <div class="waves-bg-wrapper">
        <GradientWaves
          horizon-color="#0076ff"
          wave-color="#00e5ff"
          crest-color="#ffffff"
          :speed="0.6"
          :amplitude="1.75"
          :wave-scale="1.35"
          :wave-ratio="0.3"
          :swell="27.5"
          :turbulence="41"
          :tilt="1.3"
          :zoom="1"
          :height="3.2"
          :fog-depth="29"
          detail="low"
          :brightness="1"
          :opacity="1"
          :mouse-interaction="false"
          :parallax-strength="0.8"
          :grain="true"
          :grain-intensity="0"
        />
      </div>

      <div class="brand-panel-inner">
        <!-- Executive Logo Stage with Creative Ambient Animations -->
        <div class="brand-logo-stage">
          <div class="logo-ambient-aura"></div>
          <div class="logo-ripple-ring ring-1"></div>
          <div class="logo-ripple-ring ring-2"></div>
          <div class="logo-orbit-ring"></div>
          
          <div class="brand-logo-glass">
            <img src="/logo-acuasan.svg" alt="Acuasan Institucional" class="brand-logo" />
            <div class="logo-shimmer-sweep"></div>
          </div>
        </div>

        <!-- Executive Tagline Pill -->
        <div class="executive-tag-pill">
          <span class="pill-pulse-dot"></span>
          <span class="pill-title">SISTEMA INTEGRAL DE GESTIÓN OPERATIVA</span>
        </div>

        <h1 class="brand-title-wrap">
          <DepthText
            text="ACUASAN"
            :layers="11"
            :depth="3.6"
            face-color="#ffffff"
            depth-color="#032fb4"
            :tilt="12"
            pointer-tracking
            :smoothing="0.11"
            :perspective="900"
            :auto-orbit="false"
            :orbit-speed="0.75"
            font-size="clamp(2.5rem, 4.6vw, 4rem)"
            :font-weight="700"
            letter-spacing="0.08em"
            :shadow="false"
          />
        </h1>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import authService from '../services/authService.js'
import DepthText from '@/components/DepthText.vue'
import GradientWaves from '@/components/GradientWaves.vue'

const router = useRouter()
const currentYear = new Date().getFullYear()

// Modos: 'login' | 'registro' | 'recuperar' | 'reset-password'
const modo = ref('login')

const cargando = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const mostrarPassword = ref(false)

// Modifica el modo activo limpiando errores y avisos
const cambiarModo = (nuevoModo) => {
  modo.value = nuevoModo
  errorMsg.value = ''
  successMsg.value = ''
}

// Modelos de datos
const formLogin = reactive({
  email: '',
  password: ''
})

const formRegistro = reactive({
  nombre: '',
  cedula: '',
  cargo: '',
  rol: 'ENCARGADO',
  email: '',
  password: ''
})

const formRecuperar = reactive({
  email: ''
})

const formReset = reactive({
  email: '',
  codigo: '',
  nuevaPassword: '',
  confirmarPassword: ''
})

const errores = reactive({
  email: '',
  password: ''
})

// Validation helper for Login
const validarLogin = () => {
  let valido = true
  errores.email = ''
  errores.password = ''

  if (!formLogin.email.trim()) {
    errores.email = 'El correo electrónico es obligatorio.'
    valido = false
  }
  if (!formLogin.password) {
    errores.password = 'La contraseña es obligatoria.'
    valido = false
  }

  return valido
}

// 1. Manejo de Inicio de Sesión
const handleLogin = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  if (!validarLogin()) return

  cargando.value = true
  try {
    const resultado = await authService.login(formLogin.email, formLogin.password)
    const rutaInicio = authService.getRutaInicioPorRol(resultado.usuario.rol)
    await router.replace(rutaInicio)
  } catch (error) {
    errorMsg.value = error.message || 'Credenciales inválidas. Verifique su correo o contraseña.'
  } finally {
    cargando.value = false
  }
}

// 2. Manejo de Registro de Nuevo Usuario
const handleRegistro = async () => {
  errorMsg.value = ''
  if (!formRegistro.nombre.trim() || !formRegistro.email.trim() || !formRegistro.password) {
    errorMsg.value = 'Por favor complete todos los campos obligatorios.'
    return
  }

  cargando.value = true
  try {
    const res = await authService.registro(formRegistro)
    // Tras registrar con éxito, iniciar sesión automáticamente con su nuevo usuario
    const loginRes = await authService.login(formRegistro.email, formRegistro.password)
    const rutaInicio = authService.getRutaInicioPorRol(loginRes.usuario.rol)
    await router.replace(rutaInicio)
  } catch (error) {
    errorMsg.value = error.message || 'Error al registrar el usuario en el sistema.'
  } finally {
    cargando.value = false
  }
}

// 3. Manejo de Solicitud de Recuperación por Correo
const handleSolicitarRecuperacion = async () => {
  errorMsg.value = ''
  if (!formRecuperar.email.trim()) {
    errorMsg.value = 'Ingrese su correo electrónico institucional.'
    return
  }

  cargando.value = true
  try {
    const res = await authService.solicitarRecuperacion(formRecuperar.email)
    formReset.email = formRecuperar.email
    formReset.codigo = res.codigoVerificacion || '849201'
    cambiarModo('reset-password')
    successMsg.value = `Código de verificación enviado al correo ${formRecuperar.email}. Ingrese su nueva clave.`
  } catch (error) {
    errorMsg.value = error.message || 'No se encontró ninguna cuenta con ese correo.'
  } finally {
    cargando.value = false
  }
}

// 4. Manejo de Reseteo y Actualización de Contraseña en BD
const handleResetearPassword = async () => {
  errorMsg.value = ''
  if (!formReset.nuevaPassword || formReset.nuevaPassword.length < 6) {
    errorMsg.value = 'La nueva contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (formReset.nuevaPassword !== formReset.confirmarPassword) {
    errorMsg.value = 'Las contraseñas no coinciden.'
    return
  }

  cargando.value = true
  try {
    await authService.resetearPassword(formReset.email, formReset.nuevaPassword)
    // Redirigir al modo Login con aviso de éxito
    formLogin.email = formReset.email
    formLogin.password = ''
    cambiarModo('login')
    successMsg.value = '✔ Contraseña actualizada correctamente en la BD de Acuasan. Ya puede ingresar con su nueva clave.'
  } catch (error) {
    errorMsg.value = error.message || 'Error al actualizar la contraseña.'
  } finally {
    cargando.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.login-shell {
  display: flex;
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: #ffffff;
}

/* ==================== FORM PANEL (LEFT SIDE - 35%) ==================== */
.form-panel {
  flex: 0 0 35%;
  width: 35%;
  min-width: 340px;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

.form-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(2, 31, 58, 0.08);
  border: 1px solid #e2e8f0;
  padding: 24px 26px;
  width: 100%;
  max-width: 390px;
  position: relative;
  overflow: hidden;
}

.card-top-stripe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #73be28 0%, #004884 60%, #00a3e0 100%);
}

.form-header {
  text-align: center;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-emblem-badge {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #004884 0%, #012f5a 100%);
  color: #73be28;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  box-shadow: 0 3px 10px rgba(0, 72, 132, 0.25);
}

.brand-emblem-badge.bg-green {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #ffffff;
}

.brand-emblem-badge.bg-amber {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: #ffffff;
}

.brand-emblem-badge.bg-blue {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
}

.portal-eyebrow {
  font-size: 0.62rem;
  font-weight: 800;
  color: #004884;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.form-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 2px 0;
  letter-spacing: -0.3px;
}

.form-subtitle {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}

/* Alerts */
.error-alert {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-left: 4px solid #ef4444;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #991b1b;
  font-weight: 500;
}

.success-alert {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-left: 4px solid #16a34a;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #166534;
  font-weight: 600;
}

.error-icon { flex-shrink: 0; color: #ef4444; }

.shake-fade-enter-active {
  animation: shake 0.4s ease, fadeIn 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Forms */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.login-form.compact {
  gap: 8px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field-label {
  font-size: 0.74rem;
  font-weight: 600;
  color: #334155;
}

.field-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 10px;
  color: #64748b;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 1;
}

.field-input {
  width: 100%;
  padding: 8px 34px 8px 34px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.84rem;
  color: #0f172a;
  background: #ffffff;
  transition: all 0.2s ease;
  outline: none;
}

.select-input {
  padding: 8px 10px;
  cursor: pointer;
}

.security-notice {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.68rem;
  color: #166534;
  line-height: 1.3;
}

.field-input:focus {
  border-color: #004884;
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

.field-input:disabled { opacity: 0.6; cursor: not-allowed; }

.field-group.field-error .field-input {
  border-color: #ef4444;
  background: #fff5f5;
}

.field-error-msg {
  font-size: 0.7rem;
  color: #ef4444;
  font-weight: 500;
}

.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  z-index: 10;
  transition: all 0.15s ease;
}

.toggle-password:hover {
  color: #004884;
  background: #e2e8f0;
}


.link-btn-subtle {
  background: none;
  border: none;
  color: #0284c7;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.link-btn-subtle:hover { text-decoration: underline; color: #0369a1; }

/* Login button */
.btn-login {
  --sb-radius: 40px;
  width: 100%;
  padding: 12px 20px;
  background: linear-gradient(135deg, #004884 0%, #002d57 100%);
  color: #ffffff;
  border: none;
  border-radius: 40px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  margin-top: 6px;
}

.btn-success {
  background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
  box-shadow: 0 3px 12px rgba(5, 150, 105, 0.25) !important;
}

.btn-amber {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
  box-shadow: 0 3px 12px rgba(217, 119, 6, 0.25) !important;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-login:disabled { opacity: 0.75; cursor: not-allowed; transform: none; }

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Bottom action links */
.bottom-action-container {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-text {
  font-size: 0.74rem;
  color: #64748b;
}

.action-link-highlight {
  background: none;
  border: none;
  color: #004884;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.action-link-highlight:hover { text-decoration: underline; color: #002d57; }

.action-link-subtle {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.action-link-subtle:hover { color: #0f172a; text-decoration: underline; }

/* Footer */
.form-footer {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

.ssl-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 500;
}

/* ==================== BRAND PANEL (RIGHT SIDE - 65%) ==================== */
.brand-panel {
  flex: 1;
  width: 65%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(160deg, #021f3a 0%, #012f5a 50%, #01693a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 30px;
}

.waves-bg-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.brand-panel-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 20px;
  user-select: none;
}

/* ==================== EXECUTIVE LOGO STAGE ==================== */
.brand-logo-stage {
  position: relative;
  width: clamp(210px, 17vw, 250px);
  height: clamp(210px, 17vw, 250px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

/* Dynamic Ambient Color Aura */
.logo-ambient-aura {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, rgba(115, 190, 40, 0.28) 45%, transparent 72%);
  filter: blur(32px);
  animation: aura-breathe 5s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes aura-breathe {
  0% { transform: scale(0.92); opacity: 0.5; filter: blur(24px); }
  50% { transform: scale(1.18); opacity: 0.9; filter: blur(36px); }
  100% { transform: scale(1.04); opacity: 0.7; filter: blur(28px); }
}

/* Expanding Water Ripples */
.logo-ripple-ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 229, 255, 0.45);
  pointer-events: none;
  animation: ripple-pulse 4.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.ring-1 {
  width: clamp(170px, 13vw, 205px);
  height: clamp(170px, 13vw, 205px);
  animation-delay: 0s;
}

.ring-2 {
  width: clamp(170px, 13vw, 205px);
  height: clamp(170px, 13vw, 205px);
  border-color: rgba(115, 190, 40, 0.45);
  animation-delay: 2.4s;
}

@keyframes ripple-pulse {
  0% { transform: scale(0.9); opacity: 0.8; }
  70% { opacity: 0.25; }
  100% { transform: scale(1.48); opacity: 0; }
}

/* Rotating Executive Orbit Halo */
.logo-orbit-ring {
  position: absolute;
  width: clamp(190px, 15vw, 225px);
  height: clamp(190px, 15vw, 225px);
  border-radius: 50%;
  padding: 2px;
  background: conic-gradient(from 0deg, transparent 0%, #00e5ff 25%, transparent 50%, #73be28 75%, transparent 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #fff calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #fff calc(100% - 2px));
  animation: orbit-rotate 14s linear infinite;
  pointer-events: none;
  opacity: 0.75;
}

@keyframes orbit-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Glass pedestal holder */
.brand-logo-glass {
  position: relative;
  width: clamp(155px, 12vw, 185px);
  height: clamp(155px, 12vw, 185px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.14) 0%, rgba(0, 36, 76, 0.55) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.5),
    0 0 35px rgba(0, 118, 255, 0.3),
    inset 0 1px 3px rgba(255, 255, 255, 0.45);
  animation: logo-levitate 5s ease-in-out infinite;
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
  cursor: pointer;
}

.brand-logo-glass:hover {
  transform: translateY(-8px) scale(1.05);
  box-shadow: 
    0 28px 60px rgba(0, 0, 0, 0.6),
    0 0 50px rgba(0, 229, 255, 0.45),
    inset 0 1px 4px rgba(255, 255, 255, 0.7);
}

@keyframes logo-levitate {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12px) scale(1.025);
  }
}

/* Main emblem SVG - Large & crisp */
.brand-logo {
  width: clamp(145px, 11.5vw, 175px);
  height: clamp(145px, 11.5vw, 175px);
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4));
  transition: transform 0.3s ease;
}

/* Specular Crystal Shimmer Sweep */
.logo-shimmer-sweep {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 35%,
    rgba(255, 255, 255, 0.4) 48%,
    rgba(255, 255, 255, 0.75) 50%,
    rgba(255, 255, 255, 0.4) 52%,
    transparent 65%
  );
  transform: rotate(25deg) translateY(-120%);
  animation: shimmer-sweep 6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shimmer-sweep {
  0%, 55% { transform: rotate(25deg) translateY(-130%); opacity: 0; }
  60% { opacity: 0.85; }
  80% { transform: rotate(25deg) translateY(130%); opacity: 0.85; }
  85%, 100% { transform: rotate(25deg) translateY(130%); opacity: 0; }
}

/* ==================== EXECUTIVE PILL BADGE ==================== */
.executive-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 6px 18px;
  background: rgba(1, 26, 50, 0.7);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.executive-tag-pill:hover {
  background: rgba(1, 35, 68, 0.85);
  border-color: rgba(115, 190, 40, 0.5);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(115, 190, 40, 0.3);
}

.pill-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #73be28;
  box-shadow: 0 0 10px #73be28;
  animation: dot-glow 2s ease-in-out infinite alternate;
}

@keyframes dot-glow {
  0% { opacity: 0.55; transform: scale(0.85); box-shadow: 0 0 4px #73be28; }
  100% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 12px #73be28, 0 0 20px rgba(115, 190, 40, 0.6); }
}

.pill-title {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 2.2px;
  color: #d1e2f2;
  text-transform: uppercase;
}

.brand-title-wrap {
  margin: 0;
  padding: 2px 0;
  line-height: 1;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

@media (max-width: 850px) {
  .login-shell { flex-direction: column-reverse; height: auto; max-height: none; overflow: auto; }
  .form-panel { width: 100%; height: auto; min-width: 0; padding: 24px 16px; }
  .brand-panel { width: 100%; height: 240px; }
  .brand-description { display: none; }
}
</style>
