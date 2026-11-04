<template>
  <!-- SIEMPRE color + ícono + texto: el color nunca carga el significado solo -->
  <span class="radicado-chip" :class="`radicado-chip--${clase}`" :title="titulo">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <template v-if="clase === 'rojo'">
        <path d="M7.86 2h8.28L21 7.86v8.28L16.14 21H7.86L3 16.14V7.86L7.86 2z" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </template>
      <template v-else-if="clase === 'ambar'">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </template>
      <template v-else>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </template>
    </svg>
    <span>{{ texto }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Estado calculado del backend: 'vencido' | 'por_vencer' | 'sano' | 'respondido'
  estado: { type: String, required: true },
  // Solo con estado 'respondido': 'a_tiempo' | 'con_retraso' | null
  resultadoRespuesta: { type: String, default: null },
  // Días para la fecha límite (afina el texto de "por vencer")
  diasRestantes: { type: Number, default: null },
})

const clase = computed(() => {
  if (props.estado === 'vencido') return 'rojo'
  if (props.estado === 'respondido') {
    return props.resultadoRespuesta === 'con_retraso' ? 'ambar' : 'verde'
  }
  if (props.estado === 'por_vencer') return 'ambar'
  return 'verde'
})

const texto = computed(() => {
  if (props.estado === 'vencido') {
    if (props.diasRestantes !== null && props.diasRestantes !== undefined && props.diasRestantes < 0) {
      return `Vencido · ${-props.diasRestantes}d`
    }
    return 'Vencido'
  }
  if (props.estado === 'respondido') {
    return props.resultadoRespuesta === 'con_retraso' ? 'Con retraso' : 'A tiempo'
  }
  if (props.estado === 'por_vencer') {
    if (props.diasRestantes !== null && props.diasRestantes !== undefined) {
      return props.diasRestantes === 0 ? 'Vence hoy' : `Por vencer · ${props.diasRestantes}d`
    }
    return 'Por vencer'
  }
  return 'En tiempo'
})

const titulo = computed(() => {
  const mapa = {
    vencido: 'La fecha límite ya pasó y no hay respuesta',
    por_vencer: 'Vence en 7 días o menos',
    sano: 'Más de 7 días de plazo',
    respondido:
      props.resultadoRespuesta === 'con_retraso'
        ? 'Respuesta entregada después de la fecha límite'
        : 'Respuesta entregada dentro del plazo',
  }
  return mapa[props.estado] || texto.value
})
</script>

<style scoped>
.radicado-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  white-space: nowrap;
  line-height: 1.3;
}

.radicado-chip--rojo {
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border: 1px solid #fca5a5;
}

.radicado-chip--ambar {
  background: var(--acuasan-yellow-light);
  color: var(--acuasan-amber-text, #b45309);
  border: 1px solid #fde68a;
}

.radicado-chip--verde {
  background: var(--acuasan-green-light);
  color: var(--acuasan-green-text, #166534);
  border: 1px solid #bbf7d0;
}

.radicado-chip svg {
  flex-shrink: 0;
}
</style>
