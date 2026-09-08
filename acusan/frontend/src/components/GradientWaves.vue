<template>
  <div ref="containerRef" :class="['gradient-waves-container', className]" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Renderer, Program, Mesh, Triangle } from 'ogl'

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ]
}

const detailToSteps = (detail) => {
  if (detail === 'low') return 40.0
  if (detail === 'high') return 110.0
  return 70.0
}

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
out vec4 fragColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;

  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = mix(uHorizonColor, body, t);
  col *= uBrightness;
  col = clamp(col, 0.0, 1.0);

  float alpha = clamp(t, 0.0, 1.0) * uOpacity;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`

const props = defineProps({
  horizonColor: {
    type: String,
    default: '#0076ff'
  },
  waveColor: {
    type: String,
    default: '#00e5ff'
  },
  crestColor: {
    type: String,
    default: '#ffffff'
  },
  speed: {
    type: Number,
    default: 0.6
  },
  amplitude: {
    type: Number,
    default: 1.75
  },
  waveScale: {
    type: Number,
    default: 1.35
  },
  waveRatio: {
    type: Number,
    default: 0.3
  },
  swell: {
    type: Number,
    default: 27.5
  },
  turbulence: {
    type: Number,
    default: 41
  },
  tilt: {
    type: Number,
    default: 1.3
  },
  zoom: {
    type: Number,
    default: 1.0
  },
  height: {
    type: Number,
    default: 3.2
  },
  fogDepth: {
    type: Number,
    default: 29
  },
  detail: {
    type: String,
    default: 'low'
  },
  brightness: {
    type: Number,
    default: 1.0
  },
  opacity: {
    type: Number,
    default: 1.0
  },
  mouseInteraction: {
    type: Boolean,
    default: false
  },
  parallaxStrength: {
    type: Number,
    default: 0.8
  },
  grain: {
    type: Boolean,
    default: true
  },
  grainIntensity: {
    type: Number,
    default: 0
  },
  className: {
    type: String,
    default: ''
  }
})

const containerRef = ref(null)
let programRef = null
let enableMouseRef = props.mouseInteraction

const updateUniforms = () => {
  if (!programRef) return
  const u = programRef.uniforms
  enableMouseRef = props.mouseInteraction

  u.uSpeed.value = props.speed
  u.uAmplitude.value = props.amplitude
  u.uWaveScale.value = props.waveScale
  u.uWaveRatio.value = props.waveRatio
  u.uSwell.value = props.swell
  u.uTurbulence.value = props.turbulence
  u.uTilt.value = props.tilt
  u.uZoom.value = props.zoom
  u.uHeight.value = props.height
  u.uFogDepth.value = props.fogDepth
  u.uSteps.value = detailToSteps(props.detail)
  u.uBrightness.value = props.brightness
  u.uOpacity.value = props.opacity
  u.uGrain.value = props.grain ? 1.0 : 0.0
  u.uGrainIntensity.value = props.grainIntensity
  u.uParallax.value = props.parallaxStrength
  u.uEnableMouse.value = props.mouseInteraction

  const hc = u.uHorizonColor.value
  const wc = u.uWaveColor.value
  const cc = u.uCrestColor.value
  const h = hexToRgb(props.horizonColor)
  const w = hexToRgb(props.waveColor)
  const cr = hexToRgb(props.crestColor)
  hc[0] = h[0]
  hc[1] = h[1]
  hc[2] = h[2]
  wc[0] = w[0]
  wc[1] = w[1]
  wc[2] = w[2]
  cc[0] = cr[0]
  cc[1] = cr[1]
  cc[2] = cr[2]
}

watch(
  () => [
    props.horizonColor,
    props.waveColor,
    props.crestColor,
    props.speed,
    props.amplitude,
    props.waveScale,
    props.waveRatio,
    props.swell,
    props.turbulence,
    props.tilt,
    props.zoom,
    props.height,
    props.fogDepth,
    props.detail,
    props.brightness,
    props.opacity,
    props.grain,
    props.grainIntensity,
    props.mouseInteraction,
    props.parallaxStrength
  ],
  () => {
    updateUniforms()
  }
)

let cleanup = null

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  let renderer
  try {
    renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    })
  } catch (err) {
    console.error('WebGL2 is not supported:', err)
    return
  }

  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  const canvas = gl.canvas
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  container.appendChild(canvas)

  const geometry = new Triangle(gl)
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uSpeed: { value: 0.6 },
      uAmplitude: { value: 1.75 },
      uWaveScale: { value: 1.35 },
      uWaveRatio: { value: 0.3 },
      uSwell: { value: 27.5 },
      uTurbulence: { value: 41 },
      uTilt: { value: 1.3 },
      uZoom: { value: 1.0 },
      uHeight: { value: 3.2 },
      uFogDepth: { value: 29 },
      uSteps: { value: 40.0 },
      uBrightness: { value: 1.0 },
      uOpacity: { value: 1.0 },
      uGrain: { value: 1.0 },
      uGrainIntensity: { value: 0.0 },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uParallax: { value: 0.8 },
      uEnableMouse: { value: false },
      uHorizonColor: { value: new Float32Array([1, 1, 1]) },
      uWaveColor: { value: new Float32Array([1, 1, 1]) },
      uCrestColor: { value: new Float32Array([1, 1, 1]) }
    }
  })

  programRef = program
  updateUniforms()

  const mesh = new Mesh(gl, { geometry, program })

  const setSize = () => {
    const rect = container.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    renderer.setSize(w, h)
    const res = program.uniforms.iResolution.value
    res[0] = gl.drawingBufferWidth
    res[1] = gl.drawingBufferHeight
    renderer.render({ scene: mesh })
  }

  const ro = new ResizeObserver(setSize)
  ro.observe(container)
  setSize()

  const currentMouse = [0.5, 0.5]
  const targetMouse = [0.5, 0.5]

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect()
    targetMouse[0] = (e.clientX - rect.left) / rect.width
    targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height
  }

  const onPointerLeave = () => {
    targetMouse[0] = 0.5
    targetMouse[1] = 0.5
  }

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)

  let raf = 0
  let isVisible = true
  let isPageVisible = !document.hidden
  const t0 = performance.now()

  const loop = (t) => {
    program.uniforms.iTime.value = (t - t0) * 0.001
    const tx = enableMouseRef ? targetMouse[0] : 0.5
    const ty = enableMouseRef ? targetMouse[1] : 0.5
    currentMouse[0] += 0.05 * (tx - currentMouse[0])
    currentMouse[1] += 0.05 * (ty - currentMouse[1])
    program.uniforms.uMouse.value[0] = currentMouse[0]
    program.uniforms.uMouse.value[1] = currentMouse[1]
    renderer.render({ scene: mesh })
    raf = requestAnimationFrame(loop)
  }

  const tryStart = () => {
    if (isVisible && isPageVisible && raf === 0) {
      raf = requestAnimationFrame(loop)
    }
  }

  const tryStop = () => {
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting
      if (isVisible) tryStart()
      else tryStop()
    },
    { threshold: 0 }
  )
  io.observe(container)

  const onVisibility = () => {
    isPageVisible = !document.hidden
    if (isPageVisible) tryStart()
    else tryStop()
  }
  document.addEventListener('visibilitychange', onVisibility)

  tryStart()

  cleanup = () => {
    tryStop()
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    try {
      container.removeChild(canvas)
    } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    programRef = null
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<style scoped>
.gradient-waves-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
