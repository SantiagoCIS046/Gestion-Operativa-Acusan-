<template>
  <button
    ref="btnRef"
    :type="type"
    :disabled="disabled"
    :class="[
      'specular-button',
      `specular-button--${size}`,
      variant ? `specular-button--${variant}` : '',
      className
    ]"
    :style="buttonStyle"
    @click="$emit('click', $event)"
  >
    <span ref="fxRef" class="specular-button__fx" aria-hidden="true" />
    <span class="specular-button__label">
      <slot>Get Started</slot>
    </span>
  </button>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl'

const PAD = 20

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`

const props = defineProps({
  size: {
    type: String,
    default: 'lg'
  },
  radius: {
    type: [Number, String],
    default: 40
  },
  tint: {
    type: String,
    default: '#ffffff'
  },
  tintOpacity: {
    type: [Number, String],
    default: 0
  },
  blur: {
    type: [Number, String],
    default: 14
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  lineColor: {
    type: String,
    default: '#ffffff'
  },
  baseColor: {
    type: String,
    default: '#525252'
  },
  intensity: {
    type: [Number, String],
    default: 1
  },
  shineSize: {
    type: [Number, String],
    default: 22
  },
  shineFade: {
    type: [Number, String],
    default: 30
  },
  thickness: {
    type: [Number, String],
    default: 2.3
  },
  speed: {
    type: [Number, String],
    default: 0.35
  },
  followMouse: {
    type: Boolean,
    default: true
  },
  proximity: {
    type: [Number, String],
    default: 190
  },
  autoAnimate: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  className: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'button'
  },
  backgroundColor: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: ''
  }
})

defineEmits(['click'])

const btnRef = ref(null)
const fxRef = ref(null)

const buttonStyle = computed(() => {
  const styles = {
    '--sb-radius': `${props.radius}px`,
    '--sb-tint': props.tint,
    '--sb-tint-opacity': props.tintOpacity,
    '--sb-blur': `${props.blur}px`,
    '--sb-text-color': props.textColor
  }
  if (props.backgroundColor) {
    styles['background'] = props.backgroundColor
  }
  return styles
})

let cleanup = null

onMounted(() => {
  const btn = btnRef.value
  const fx = fxRef.value
  if (!btn || !fx) return

  let renderer
  let gl
  try {
    const dpr = window.devicePixelRatio || 1
    renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr })
    gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  } catch (e) {
    console.warn('WebGL specular disabled:', e)
    return
  }

  const dpr = window.devicePixelRatio || 1
  const geometry = new Triangle(gl)
  if (geometry.attributes.uv) delete geometry.attributes.uv

  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uCenter: { value: [0, 0] },
      uHalfSize: { value: [1, 1] },
      uRadius: { value: 0 },
      uAngle: { value: 2.4 },
      uPx: { value: dpr },
      uLineColor: { value: [1, 1, 1] },
      uBaseColor: { value: [0.32, 0.32, 0.32] },
      uIntensity: { value: 1 },
      uShineSize: { value: 0.17 },
      uShineFade: { value: 0.7 },
      uThickness: { value: 1 },
      uBaseWidth: { value: dpr }
    }
  })

  const mesh = new Mesh(gl, { geometry, program })
  fx.appendChild(gl.canvas)

  const sizeRef = { w: 1, h: 1 }
  const resize = () => {
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    sizeRef.w = w
    sizeRef.h = h
    renderer.setSize(w + PAD * 2, h + PAD * 2)
    program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr]
    program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr]
  }

  const ro = new ResizeObserver(resize)
  ro.observe(btn)
  resize()

  let pointerAngle = null
  let proximityT = 0
  const onPointerMove = (e) => {
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right)
    const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom)
    const dist = Math.hypot(dx, dy)

    if (dist === 0) {
      const nx = (e.clientX - cx) / (rect.width / 2)
      const ny = (cy - e.clientY) / (rect.height / 2)
      pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15
    } else {
      pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx)
    }
    const t = Math.max(0, 1 - dist / Math.max(Number(props.proximity) || 1, 1))
    proximityT = t * t * (3 - 2 * t)
  }
  window.addEventListener('pointermove', onPointerMove)

  let angle = 2.4
  let idleAngle = 2.4
  let bright = 0
  let last = performance.now()
  let raf = 0

  const lineC = new Color()
  const baseC = new Color()

  const update = (now) => {
    raf = requestAnimationFrame(update)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    const speed = Number(props.speed) || 0.35
    idleAngle += speed * dt
    const steer = props.followMouse && pointerAngle != null && (!props.autoAnimate || proximityT > 0)
    const target = steer ? pointerAngle : idleAngle
    const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    angle += diff * (1 - Math.exp(-dt * 7))

    const brightTarget = props.autoAnimate ? 1 : proximityT
    bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8))

    lineC.set(props.lineColor)
    baseC.set(props.baseColor)
    program.uniforms.uAngle.value = angle
    program.uniforms.uRadius.value = Math.min(Number(props.radius) || 18, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr
    program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b]
    program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b]
    program.uniforms.uIntensity.value = (Number(props.intensity) || 1) * bright
    program.uniforms.uShineSize.value = ((Number(props.shineSize) || 22) * Math.PI) / 180
    program.uniforms.uShineFade.value = ((Number(props.shineFade) || 30) * Math.PI) / 180
    program.uniforms.uThickness.value = (Number(props.thickness) || 2.3) * dpr
    renderer.render({ scene: mesh })
  }
  raf = requestAnimationFrame(update)

  cleanup = () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    window.removeEventListener('pointermove', onPointerMove)
    if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<style scoped>
.specular-button {
  --sb-radius: 40px;
  --sb-tint: #ffffff;
  --sb-tint-opacity: 0;
  --sb-blur: 14px;
  --sb-text-color: #ffffff;

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin: 0;
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  color: var(--sb-text-color);
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent);
  border-radius: var(--sb-radius);
  backdrop-filter: blur(var(--sb-blur));
  -webkit-backdrop-filter: blur(var(--sb-blur));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  outline: none;
  transition: transform 0.18s ease, filter 0.2s ease, box-shadow 0.2s ease;
  overflow: visible;
  user-select: none;
}

.specular-button:hover {
  filter: brightness(1.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 10px 28px rgba(0, 0, 0, 0.35);
}

.specular-button:active {
  transform: scale(0.97);
}

.specular-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--sb-text-color) 60%, transparent);
  outline-offset: 3px;
}

.specular-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.specular-button:disabled:active {
  transform: none;
}

.specular-button--sm {
  font-size: 0.85rem;
  padding: 8px 18px;
}

.specular-button--md {
  font-size: 0.95rem;
  padding: 12px 26px;
}

.specular-button--lg {
  font-size: 1.05rem;
  padding: 16px 36px;
}

/* Pre-styled color variants that preserve branding */
.specular-button--primary {
  background: linear-gradient(135deg, #00589b 0%, #004884 100%);
  --sb-text-color: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 72, 132, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.specular-button--success {
  background: linear-gradient(135deg, #73be28 0%, #5a991b 100%);
  --sb-text-color: #ffffff;
  box-shadow: 0 8px 24px rgba(115, 190, 40, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.specular-button--danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  --sb-text-color: #ffffff;
  box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.specular-button--warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  --sb-text-color: #ffffff;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

/* Canvas extends past the button so the rim glow can bleed outside the edge */
.specular-button__fx {
  position: absolute;
  inset: -20px;
  pointer-events: none;
  z-index: 1;
}

.specular-button__fx canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.specular-button__label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
