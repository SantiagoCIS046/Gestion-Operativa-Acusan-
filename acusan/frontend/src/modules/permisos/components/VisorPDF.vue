<template>
  <div class="visor-pdf-container">
    <div class="visor-header">
      <div class="doc-info">
        <span class="icon">📄</span>
        <span class="doc-title">{{ title || 'Documento de Solicitud de Permiso' }}</span>
      </div>
      <div class="visor-actions">
        <button class="btn btn-sm btn-secondary" @click="zoomOut" :disabled="zoom <= 50">-</button>
        <span class="zoom-level">{{ zoom }}%</span>
        <button class="btn btn-sm btn-secondary" @click="zoomIn" :disabled="zoom >= 200">+</button>
        <a v-if="pdfUrl" :href="pdfUrl" target="_blank" class="btn btn-sm btn-outline">Abrir Externo</a>
      </div>
    </div>

    <div class="visor-body">
      <div v-if="!pdfUrl" class="visor-placeholder">
        <div class="placeholder-icon">📋</div>
        <p class="placeholder-text">Seleccione un permiso para visualizar el soporte documental</p>
      </div>
      <div v-else class="pdf-viewer-frame" :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }">
        <iframe :src="pdfUrl" frameborder="0" class="pdf-iframe"></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  pdfUrl: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  }
})

const zoom = ref(100)

const zoomIn = () => {
  if (zoom.value < 200) zoom.value += 10
}

const zoomOut = () => {
  if (zoom.value > 50) zoom.value -= 10
}
</script>

<style scoped>
.visor-pdf-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 520px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.visor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.doc-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #1e293b;
}

.visor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  min-width: 45px;
  text-align: center;
}

.visor-body {
  flex: 1;
  background: #f1f5f9;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 16px;
  position: relative;
}

.visor-placeholder {
  margin: auto;
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.placeholder-text {
  font-size: 0.95rem;
}

.pdf-viewer-frame {
  width: 100%;
  height: 100%;
  min-height: 480px;
  transition: transform 0.2s ease-in-out;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 8px;
  background: #fff;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #e2e8f0;
  color: #334155;
}

.btn-secondary:hover:not(:disabled) {
  background: #cbd5e1;
}

.btn-outline {
  border-color: #0284c7;
  color: #0284c7;
  background: transparent;
  text-decoration: none;
}

.btn-outline:hover {
  background: #0284c7;
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
