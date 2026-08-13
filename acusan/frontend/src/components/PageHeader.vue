<template>
  <div class="page-header-container">
    <!-- Left: page title -->
    <div class="page-title-block">
      <div class="page-icon">{{ icono }}</div>
      <div class="page-title-info">
        <h1 class="page-title">{{ titulo }}</h1>
        <p class="page-subtitle">{{ subtitulo }}</p>
      </div>
    </div>

    <!-- Right: user identity card -->
    <div class="user-identity-card">
      <div class="identity-avatar">{{ avatarIniciales }}</div>
      <div class="identity-info">
        <div class="identity-name">{{ usuario?.nombre || '—' }}</div>
        <div class="identity-meta">
          <span class="identity-cargo">{{ usuario?.cargo || usuario?.rol }}</span>
          <span class="identity-sep">·</span>
          <span class="identity-date">{{ fechaFormateada }}</span>
        </div>
      </div>
      <div class="identity-badge" :class="rolClass">
        <span class="badge-dot"></span>
        {{ rolLabel }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import authService from '../modules/auth/services/authService.js'

defineProps({
  titulo:    { type: String, required: true },
  subtitulo: { type: String, default: '' },
  icono:     { type: String, default: '📋' }
})

const usuario = computed(() => authService.getUsuarioActual())

const avatarIniciales = computed(() => {
  const nombre = usuario.value?.nombre || 'U'
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
})

const rolLabel = computed(() => {
  switch (usuario.value?.rol) {
    case 'ENCARGADO': return 'ENCARGADO'
    case 'GERENCIA':  return 'GERENCIA'
    case 'OPERATIVO': return 'OPERATIVO'
    case 'ADMIN':     return 'ADMIN'
    default: return usuario.value?.rol || 'USUARIO'
  }
})

const rolClass = computed(() => {
  switch (usuario.value?.rol) {
    case 'ENCARGADO': return 'badge-encargado'
    case 'GERENCIA':  return 'badge-gerencia'
    case 'OPERATIVO': return 'badge-operativo'
    default: return 'badge-default'
  }
})

// Formato: Miércoles, 13 de agosto de 2026 — 08:51 a.m.
const fechaFormateada = computed(() => {
  return new Date().toLocaleString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>

<style scoped>
.page-header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  gap: 12px;
  flex-wrap: wrap;
}

/* Left: title */
.page-title-block {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.page-title-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.page-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 0.74rem;
  color: #64748b;
  margin: 0;
  font-weight: 400;
}

/* Right: user identity card */
.user-identity-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
}

.identity-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #004884 0%, #002d57 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid #73be28;
  box-shadow: 0 2px 8px rgba(0, 72, 132, 0.25);
}

.identity-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.identity-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.identity-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: #64748b;
  white-space: nowrap;
}

.identity-sep {
  color: #cbd5e1;
}

.identity-cargo {
  font-weight: 500;
}

/* Role badge */
.identity-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.8px;
  white-space: nowrap;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
  flex-shrink: 0;
}

.badge-encargado { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
.badge-gerencia  { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
.badge-operativo { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.badge-default   { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

@media (max-width: 768px) {
  .page-header-container { flex-direction: column; align-items: flex-start; }
  .user-identity-card { width: 100%; }
  .identity-meta { flex-wrap: wrap; }
}
</style>
