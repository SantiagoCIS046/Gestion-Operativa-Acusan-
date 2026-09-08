<template>
  <div class="bloqueo-shell">
    <!-- Círculos de agua de fondo (mismo lenguaje visual del login) -->
    <div class="water-circle c1"></div>
    <div class="water-circle c2"></div>
    <div class="water-circle c3"></div>

    <div class="bloqueo-card">
      <div class="card-top-stripe"></div>

      <div class="brand-emblem-badge" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>

      <span class="portal-eyebrow">SISTEMA DE GESTIÓN OPERATIVA</span>

      <div class="candado-icono" aria-hidden="true">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>

      <h1 class="titulo">Módulo PQR no disponible</h1>
      <p class="mensaje">
        El módulo de Atención al Ciudadano (PQR) está <strong>temporalmente fuera de servicio</strong>
        mientras se realizan ajustes internos. Las conversaciones de WhatsApp continúan
        recibiendo respuesta automática; solo la gestión en pantalla está pausada.
      </p>
      <p class="nota">Para novedades sobre la reactivación, contacte a Gerencia General.</p>

      <div v-if="autenticado" class="acciones">
        <button
          v-if="inicioDisponible"
          class="btn-primario"
          @click="irAInicio"
        >
          Ir a mi módulo
        </button>
        <button class="btn-secundario" @click="cerrarSesion">Cerrar sesión</button>
      </div>

      <router-link v-else to="/login" class="enlace-login">Volver al inicio de sesión</router-link>

      <p class="marca">Acuasan E.S.P. — Gestión Operativa</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import authService from '../modules/auth/services/authService.js'

const router = useRouter()

const autenticado = computed(() => authService.estaAutenticado())
// El inicio del rol OPERATIVO/ATENCION_CIUDADANA es /pqr/* (bloqueado): no
// ofrecer ese botón o el guard devolvería a esta misma página (bucle).
const inicioDisponible = computed(() => {
  if (!autenticado.value) return false
  return !authService.getRutaInicioPorRol(authService.getRol()).startsWith('/pqr')
})

function irAInicio() {
  router.push(authService.getRutaInicioPorRol(authService.getRol()))
}

function cerrarSesion() {
  authService.logout()
  router.push('/login')
}
</script>

<style scoped>
.bloqueo-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  position: relative;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

/* Círculos decorativos de agua */
.water-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.c1 { width: 420px; height: 420px; top: -140px; right: -120px; background: radial-gradient(circle, rgba(0, 163, 224, 0.08), transparent 70%); }
.c2 { width: 360px; height: 360px; bottom: -120px; left: -100px; background: radial-gradient(circle, rgba(0, 72, 132, 0.08), transparent 70%); }
.c3 { width: 220px; height: 220px; bottom: 60px; right: 12%; background: radial-gradient(circle, rgba(115, 190, 40, 0.07), transparent 70%); }

.bloqueo-card {
  position: relative;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(1, 47, 90, 0.12);
  padding: 44px 48px 32px;
  max-width: 460px;
  width: calc(100% - 40px);
  text-align: center;
  overflow: hidden;
}

.card-top-stripe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, #73be28 0%, #004884 60%, #00a3e0 100%);
}

.brand-emblem-badge {
  width: 40px;
  height: 40px;
  margin: 0 auto 14px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: linear-gradient(135deg, #004884 0%, #012f5a 100%);
}

.portal-eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: 2.5px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 22px;
}

.candado-icono {
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #004884;
  background: #eff6ff;
  border: 2px solid #bfdbfe;
}

.titulo {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 14px;
}

.mensaje {
  font-size: 14.5px;
  line-height: 1.65;
  color: #334155;
  margin: 0 0 10px;
}

.nota {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 26px;
}

.acciones {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.btn-primario {
  padding: 11px 26px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #004884 0%, #012f5a 100%);
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primario:hover { opacity: 0.9; }

.btn-secundario {
  padding: 11px 26px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.2s;
}
.btn-secundario:hover { border-color: #004884; }

.enlace-login {
  display: inline-block;
  margin-bottom: 24px;
  font-size: 14px;
  font-weight: 600;
  color: #004884;
  text-decoration: none;
}
.enlace-login:hover { text-decoration: underline; }

.marca {
  font-size: 11.5px;
  color: #94a3b8;
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}
</style>
