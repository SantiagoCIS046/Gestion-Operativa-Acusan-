<template>
  <div class="pdf-visor-caja">
    <div class="pdf-visor-barra">
      <p class="pdf-visor-meta">
        {{ nombre }}
        <template v-if="pesoLegible"> · {{ pesoLegible }}</template>
      </p>
      <div class="pdf-visor-botones">
        <button type="button" class="btn-pdf" :disabled="!url" title="Abrir en una pestaña nueva" @click="abrirPestana">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Abrir en pestaña
        </button>
        <button type="button" class="btn-pdf" :disabled="!url" title="Descargar el PDF" @click="descargar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar
        </button>
      </div>
    </div>

    <p v-if="cargando" class="pdf-visor-estado">Cargando PDF…</p>

    <div v-else-if="error" class="pdf-visor-fallo" role="alert">
      <p>No se pudo cargar el PDF.</p>
      <p class="pdf-visor-fallo-detalle">{{ error }}</p>
      <button type="button" class="btn-pdf" @click="cargar">Reintentar</button>
    </div>

    <iframe
      v-else-if="url"
      :src="url"
      class="pdf-visor"
      :title="titulo || nombre || 'Documento PDF'"
    ></iframe>
  </div>
</template>

<script setup>
// Visor de PDFs protegidos por JWT: como el token va en el header, el
// documento no puede ir en un src directo — se descarga con la función
// `fuente` (que ya viaja autenticada), se convierte a Blob y se expone con
// URL.createObjectURL. La URL se revoca al recargar y al desmontar.

import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  // async () => ({ blob, nombre }) | Blob — p. ej. () => RadicadosAPI.verPdf(id, 'radicado')
  fuente: { type: Function, required: true },
  // Nombre preferido del archivo (el de la respuesta si la fuente lo trae)
  nombre: { type: String, default: 'documento.pdf' },
  // Descripción accesible del documento
  titulo: { type: String, default: '' },
})

const cargando = ref(false)
const error = ref('')
const url = ref('')
const tamano = ref(0)
const nombreReal = ref('')

const nombreFinal = computed(() => nombreReal.value || props.nombre || 'documento.pdf')

const pesoLegible = computed(() => {
  if (!Number.isFinite(tamano.value) || tamano.value <= 0) return ''
  if (tamano.value < 1024) return `${tamano.value} B`
  if (tamano.value < 1024 * 1024) return `${(tamano.value / 1024).toFixed(1)} KB`
  return `${(tamano.value / (1024 * 1024)).toFixed(1)} MB`
})

function revocar() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

async function cargar() {
  revocar()
  error.value = ''
  cargando.value = true
  try {
    const resultado = await props.fuente()
    const blob = resultado?.blob ?? resultado
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('La respuesta no contiene un PDF.')
    }
    tamano.value = blob.size
    if (resultado?.nombre) nombreReal.value = resultado.nombre
    url.value = URL.createObjectURL(blob)
  } catch (e) {
    error.value = e?.message || ''
  } finally {
    cargando.value = false
  }
}

// La fuente cambia (otro radicado / otro tipo) → se recarga
watch(() => props.fuente, cargar, { immediate: true })

function abrirPestana() {
  if (url.value) window.open(url.value, '_blank', 'noopener')
}

function descargar() {
  if (!url.value) return
  const enlace = document.createElement('a')
  enlace.href = url.value
  enlace.download = nombreFinal.value
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}

onBeforeUnmount(revocar)
</script>

<style scoped>
.pdf-visor-caja {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pdf-visor-barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.pdf-visor-meta {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-muted);
  overflow-wrap: anywhere;
  min-width: 0;
}

.pdf-visor-botones {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-pdf {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 5px 9px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-pdf:hover:not(:disabled) {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.btn-pdf:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pdf-visor-estado {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  padding: 26px 10px;
  text-align: center;
}

.pdf-visor-fallo {
  margin: 0;
  border: 1px solid #fca5a5;
  border-left: 4px solid var(--acuasan-red, #dc2626);
  border-radius: 10px;
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.76rem;
  font-weight: 700;
  padding: 12px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.pdf-visor-fallo p {
  margin: 0;
}

.pdf-visor-fallo-detalle {
  font-weight: 500;
  font-size: 0.7rem;
}

.pdf-visor-fallo .btn-pdf {
  background: #ffffff;
}

.pdf-visor {
  width: 100%;
  height: min(48vh, 460px);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: #f8fafc;
}
</style>
