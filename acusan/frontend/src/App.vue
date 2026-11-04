<template>
  <div class="app-shell">
    <router-view />
    <ToastContenedor />
  </div>
</template>

<script setup>
// Los avisos (toasts) viven aquí: flotan sobre cualquier vista del sistema.
import ToastContenedor from '@/components/ToastContenedor.vue'
</script>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
