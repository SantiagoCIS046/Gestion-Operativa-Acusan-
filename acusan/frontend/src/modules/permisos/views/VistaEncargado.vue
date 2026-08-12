<template>
  <div class="permisos-encargado-view">
    <div class="view-header">
      <div>
        <h1 class="view-title">Gestión de Permisos — Panel Encargado</h1>
        <p class="view-subtitle">Carga de solicitudes físicas, extracción OCR y registro preliminar</p>
      </div>
      <div class="view-actions">
        <label class="btn btn-primary upload-btn">
          <span>📁 Subir Documento Solicitud</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="handleFileUpload" hidden />
        </label>
      </div>
    </div>

    <!-- Workspace split: Visor PDF + Formulario OCR -->
    <div class="workspace-grid">
      <div class="visor-column">
        <VisorPDF :pdfUrl="selectedPdfUrl" :title="activeDocumentTitle" />
      </div>
      <div class="form-column">
        <FormularioValidacionOCR
          :initialData="extractedData"
          :confianzaOcr="ocrConfidence"
          @save="guardarPermiso"
          @cancel="limpiarFormulario"
          @re-scan="reprocesarOCR"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import VisorPDF from '../components/VisorPDF.vue'
import FormularioValidacionOCR from '../components/FormularioValidacionOCR.vue'

const selectedPdfUrl = ref('')
const activeDocumentTitle = ref('Sin documento seleccionado')
const ocrConfidence = ref(96)

const extractedData = ref({
  cedula: '1098765432',
  nombreFuncionario: 'Carlos Andrés Gómez Ortiz',
  tipoPermiso: 'CALAMIDAD',
  dependencia: 'Operaciones de Red / Acueducto',
  fechaInicio: '2026-08-15',
  fechaFin: '2026-08-16',
  justificacion: 'Solicitud por emergencia familiar debidamente certificada con soporte adjunto.'
})

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    activeDocumentTitle.value = file.name
    selectedPdfUrl.value = URL.createObjectURL(file)
  }
}

const guardarPermiso = (datos) => {
  console.log('Guardando solicitud de permiso:', datos)
  alert('Solicitud de permiso registrada con éxito. Pasa a revisión de Gerencia.')
}

const limpiarFormulario = () => {
  selectedPdfUrl.value = ''
  activeDocumentTitle.value = 'Sin documento seleccionado'
}

const reprocesarOCR = () => {
  console.log('Re-ejecutando OCR sobre el soporte...')
}
</script>

<style scoped>
.permisos-encargado-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.view-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.view-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin: 4px 0 0 0;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1024px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #0284c7;
  color: #ffffff;
}

.btn-primary:hover {
  background: #0369a1;
}
</style>
