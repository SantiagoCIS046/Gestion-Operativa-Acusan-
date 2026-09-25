<template>
  <div class="page">
    <!-- Top Bar compartida -->
    <header class="top-bar">
      <div class="top-bar__logo">
        <img src="/logo-acuasan.svg" alt="Acuasan E.S.P." />
        <span>Horas Extras</span>
      </div>
      <div class="top-bar__user">
        <span class="top-bar__nombre">{{ nombreEmpleado }}</span>
        <div class="top-bar__avatar">{{ iniciales }}</div>
      </div>
    </header>

    <!-- Contenido de la vista -->
    <main class="content">
      <slot />
    </main>

    <!-- Bottom Nav compartida -->
    <nav class="bottom-nav">
      <RouterLink to="/registrar" class="bottom-nav__item" :class="{ active: activo === 'registrar' }">
        <span class="nav-icon">➕</span>
        <span>Reportar</span>
      </RouterLink>
      <RouterLink to="/evidencias" class="bottom-nav__item" :class="{ active: activo === 'evidencias' }">
        <span class="nav-icon">📷</span>
        <span>Evidencias</span>
      </RouterLink>
      <RouterLink to="/historial" class="bottom-nav__item" :class="{ active: activo === 'historial' }">
        <span class="nav-icon">📋</span>
        <span>Mis Registros</span>
      </RouterLink>
      <button class="bottom-nav__item" @click="cerrarSesion">
        <span class="nav-icon">🚪</span>
        <span>Salir</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { authService } from '@/services/api.js'

const props = defineProps({
  /** Pestaña resaltada en la bottom nav: 'registrar' | 'evidencias' | 'historial' */
  activo: { type: String, default: 'registrar' },
  /** Empleado autenticado { nombre, cedula } */
  empleado: { type: Object, default: null }
})

const router = useRouter()

const nombreEmpleado = computed(() => props.empleado?.nombre?.split(' ')[0] || 'Empleado')

const iniciales = computed(() =>
  (props.empleado?.nombre || 'E')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const cerrarSesion = () => {
  authService.cerrarSesion()
  router.push({ name: 'identificacion' })
}
</script>
