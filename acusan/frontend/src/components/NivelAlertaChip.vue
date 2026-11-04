<template>
  <span class="nivel-chip" :class="[`nivel-chip--${clase}`, { 'nivel-chip--atendida': atendida }]" :title="titulo">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <template v-if="nivel === 'VENCIDO'">
        <path d="M7.86 2h8.28L21 7.86v8.28L16.14 21H7.86L3 16.14V7.86L7.86 2z" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </template>
      <template v-else-if="nivel === 'D7'">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </template>
      <template v-else-if="nivel === 'D15'">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </template>
      <template v-else-if="nivel === 'NUEVO'">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
      </template>
      <template v-else-if="nivel === 'D1' || nivel === 'D3'">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="7" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </template>
      <template v-else>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </template>
    </svg>
    <span>{{ texto }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // NivelAlerta del backend: archivos ('VENCIDO'|'D7'|'D15'|'D30') y
  // radicados ('NUEVO'|'D1'|'D3'|'VENCIDO'|'D7')
  nivel: { type: String, required: true },
  // Atendida: la alerta se muestra atenuada (cerrada)
  atendida: { type: Boolean, default: false },
})

const mapa = {
  VENCIDO: { clase: 'rojo', texto: 'Vencido', titulo: 'Ya venció (archivos y radicados)' },
  NUEVO: { clase: 'azul', texto: 'Nuevo', titulo: 'Radicado recién asignado al área' },
  D1: { clase: 'naranja', texto: 'Vence en ≤ 1 día', titulo: 'Vence mañana (o hoy)' },
  D3: { clase: 'naranja', texto: 'Vence en ≤ 3 días', titulo: 'Vence en 3 días o menos' },
  D7: { clase: 'naranja', texto: 'Vence en ≤ 7 días', titulo: 'Vence en 7 días o menos' },
  D15: { clase: 'ambar', texto: 'Vence en 8–15 días', titulo: 'Vence entre 8 y 15 días' },
  D30: { clase: 'amarillo', texto: 'Vence en 16–30 días', titulo: 'Vence entre 16 y 30 días' },
}

const definicion = computed(() => mapa[props.nivel] || mapa.D30)
const clase = computed(() => definicion.value.clase)
const texto = computed(() => definicion.value.texto)
const titulo = computed(() => (props.atendida ? 'Alerta atendida' : definicion.value.titulo))
</script>

<style scoped>
.nivel-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  line-height: 1.4;
}

.nivel-chip--rojo {
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border: 1px solid #fca5a5;
}

.nivel-chip--azul {
  background: var(--acuasan-blue-light, #eff6ff);
  color: var(--acuasan-blue, #1d4ed8);
  border: 1px solid #bfdbfe;
}

.nivel-chip--naranja {
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fed7aa;
}

.nivel-chip--ambar {
  background: var(--acuasan-yellow-light);
  color: var(--acuasan-amber-text, #b45309);
  border: 1px solid #fde68a;
}

.nivel-chip--amarillo {
  background: #fefce8;
  color: #854d0e;
  border: 1px solid #fef08a;
}

/* Atendida: el semáforo se conserva, pero atenuado (así no confunde con pendiente) */
.nivel-chip--atendida {
  opacity: 0.55;
  filter: saturate(0.6);
}

.nivel-chip svg {
  flex-shrink: 0;
}
</style>
