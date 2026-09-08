<template>
  <span ref="rootRef" :class="['depth-text', className]" :style="rootStyle">
    <span ref="stageRef" class="depth-text__stage">
      <span
        v-for="layer in depthLayers"
        :key="layer.index"
        aria-hidden="true"
        class="depth-text__layer"
        :style="{ color: layer.color, transform: layer.transform }"
      >
        {{ text }}
      </span>
      <span class="depth-text__face">{{ text }}</span>
    </span>
  </span>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const MAX_LAYERS = 64

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getLayerColor = (faceColor, depthColor, index, total) => {
  const progress = total <= 1 ? 1 : index / total
  const eased = progress * progress
  const faceMix = Math.round((1 - eased) * 72 + 4)
  return `color-mix(in srgb, ${faceColor} ${faceMix}%, ${depthColor})`
}

const getTransform = (rotateX, rotateY) =>
  `rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg)`

const props = defineProps({
  text: {
    type: String,
    default: 'ACUASAN'
  },
  layers: {
    type: [Number, String],
    default: 26
  },
  depth: {
    type: [Number, String],
    default: 3.6
  },
  faceColor: {
    type: String,
    default: '#ffffff'
  },
  depthColor: {
    type: String,
    default: '#032fb4'
  },
  tilt: {
    type: [Number, String],
    default: 12
  },
  pointerTracking: {
    type: Boolean,
    default: true
  },
  smoothing: {
    type: [Number, String],
    default: 0.3
  },
  perspective: {
    type: [Number, String],
    default: 900
  },
  autoOrbit: {
    type: Boolean,
    default: false
  },
  orbitSpeed: {
    type: [Number, String],
    default: 0.75
  },
  fontSize: {
    type: String,
    default: 'clamp(2.2rem, 4.2vw, 3.4rem)'
  },
  fontWeight: {
    type: [Number, String],
    default: 800
  },
  letterSpacing: {
    type: String,
    default: '0.08em'
  },
  shadow: {
    type: Boolean,
    default: true
  },
  className: {
    type: String,
    default: ''
  }
})

const rootRef = ref(null)
const stageRef = ref(null)

const safeLayers = computed(() => clamp(Math.round(Number(props.layers) || 1), 2, MAX_LAYERS))
const safeDepth = computed(() => clamp(Number(props.depth) || 0, 0, 12))
const safeTilt = computed(() => clamp(Number(props.tilt) || 0, 0, 12))
const safeSmoothing = computed(() => clamp(Number(props.smoothing) || 0.14, 0.02, 0.35))
const safePerspective = computed(() => clamp(Number(props.perspective) || 900, 300, 2000))
const safeOrbitSpeed = computed(() => clamp(Number(props.orbitSpeed) || 0, 0, 2))

const baseRotation = computed(() => ({
  x: -safeTilt.value * 0.32,
  y: safeTilt.value * 0.42
}))

const depthLayers = computed(() => {
  const total = safeLayers.value
  const d = safeDepth.value
  return Array.from({ length: total }, (_, layerIndex) => {
    const index = total - layerIndex
    return {
      index,
      color: getLayerColor(props.faceColor, props.depthColor, index, total),
      transform: `translateZ(${-index * d}px)`
    }
  })
})

const rootStyle = computed(() => ({
  '--depth-text-perspective': `${safePerspective.value}px`,
  '--depth-text-font-size': props.fontSize,
  '--depth-text-font-weight': props.fontWeight,
  '--depth-text-face-color': props.faceColor,
  '--depth-text-depth-color': props.depthColor,
  '--depth-text-letter-spacing': props.letterSpacing,
  '--depth-text-shadow': props.shadow
    ? `0 22px 34px color-mix(in srgb, ${props.depthColor} 36%, transparent), 0 4px 8px rgba(0, 0, 0, 0.28)`
    : 'none'
}))

let cleanup = null

onMounted(() => {
  const root = rootRef.value
  const stage = stageRef.value
  if (!root || !stage || typeof window === 'undefined') return

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const canTrackPointer = props.pointerTracking && finePointer && !reducedMotion

  let frameId = 0
  let activePointer = false
  let startTime = performance.now()
  const current = { ...baseRotation.value }
  const target = { ...baseRotation.value }

  const applyTransform = () => {
    if (stage) {
      stage.style.transform = getTransform(current.x, current.y)
    }
  }

  if (reducedMotion) {
    stage.style.transform = getTransform(baseRotation.value.x, baseRotation.value.y)
    return
  }

  const handlePointerMove = (event) => {
    if (!root) return
    const rect = root.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    activePointer = true
    const x = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.8), -1, 1)
    const y = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.8), -1, 1)

    target.x = baseRotation.value.x - y * safeTilt.value
    target.y = baseRotation.value.y + x * safeTilt.value
  }

  const handlePointerLeave = () => {
    activePointer = false
    target.x = baseRotation.value.x
    target.y = baseRotation.value.y
  }

  if (canTrackPointer) {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('blur', handlePointerLeave)
  }

  const tick = (now) => {
    if ((!canTrackPointer || !activePointer) && props.autoOrbit) {
      const elapsed = (now - startTime) / 1000
      const orbit = elapsed * safeOrbitSpeed.value * Math.PI * 2
      const fallbackAmount = canTrackPointer ? 0.18 : 0.55
      target.x = baseRotation.value.x + Math.sin(orbit) * safeTilt.value * fallbackAmount
      target.y = baseRotation.value.y + Math.cos(orbit * 0.85) * safeTilt.value * fallbackAmount
    }

    current.x += (target.x - current.x) * safeSmoothing.value
    current.y += (target.y - current.y) * safeSmoothing.value
    applyTransform()
    frameId = requestAnimationFrame(tick)
  }

  applyTransform()
  frameId = requestAnimationFrame(tick)

  cleanup = () => {
    if (canTrackPointer) {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('blur', handlePointerLeave)
    }
    cancelAnimationFrame(frameId)
    startTime = 0
  }
})

onUnmounted(() => {
  if (cleanup) {
    cleanup()
  }
})
</script>

<style scoped>
.depth-text {
  display: inline-block;
  perspective: var(--depth-text-perspective);
  perspective-origin: 50% 48%;
  isolation: isolate;
  user-select: none;
}

.depth-text__stage {
  position: relative;
  display: inline-grid;
  place-items: center;
  transform-style: preserve-3d;
  transform: rotateX(-2.4deg) rotateY(3.15deg);
  transform-origin: 50% 50%;
  will-change: transform;
}

.depth-text__layer,
.depth-text__face {
  grid-area: 1 / 1;
  display: inline-block;
  font-size: var(--depth-text-font-size);
  font-weight: var(--depth-text-font-weight);
  line-height: 0.95;
  letter-spacing: var(--depth-text-letter-spacing, 0.08em);
  white-space: nowrap;
  user-select: none;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  font-kerning: normal;
  text-rendering: geometricPrecision;
  font-family: inherit;
}

.depth-text__layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  filter: saturate(0.95) brightness(0.92);
  pointer-events: none;
}

.depth-text__face {
  position: relative;
  z-index: 1;
  color: var(--depth-text-face-color);
  text-shadow: var(--depth-text-shadow);
  transform: translateZ(0.6px);
}

@media (hover: hover) and (pointer: fine) {
  .depth-text {
    cursor: default;
  }
}

@media (prefers-reduced-motion: reduce) {
  .depth-text__stage {
    will-change: auto;
  }
}
</style>
