<template>
  <div class="app-shell">
    <router-view />
  </div>
</template>

<script setup>
// Sistema reducido al módulo de login (2026-10-16): sin sidebar ni módulos.
</script>

<style scoped>
.app-shell {
  width: 100%;
  min-height: 100vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
