<template>
  <div class="ocr-form-card">
    <div class="ocr-header">
      <div class="title-wrap">
        <span class="ocr-badge">OCR Smart Sync</span>
        <h3 class="card-title">Validación de Datos Extraídos</h3>
      </div>
      <span class="accuracy-indicator" :class="confianzaClass">
        Precisión: {{ confianzaOcr }}%
      </span>
    </div>

    <form @submit.prevent="handleSubmit" class="ocr-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Cédula del Funcionario</label>
          <input
            v-model="formData.cedula"
            type="text"
            class="form-control"
            placeholder="Número de identificación"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">Nombre Completo</label>
          <input
            v-model="formData.nombreFuncionario"
            type="text"
            class="form-control"
            placeholder="Nombre del solicitante"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de Permiso</label>
          <select v-model="formData.tipoPermiso" class="form-control" required>
            <option value="">Seleccione tipo...</option>
            <option value="CALAMIDAD">Calamidad Doméstica</option>
            <option value="MEDICO">Cita / Incapacidad Médica</option>
            <option value="PERSONAL">Asunto Personal</option>
            <option value="COMPENSATORIO">Compensatorio</option>
            <option value="ESTUDIO">Permiso de Estudio</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Área / Dependencia</label>
          <input
            v-model="formData.dependencia"
            type="text"
            class="form-control"
            placeholder="Dependencia u operativa"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Fecha de Inicio</label>
          <input
            v-model="formData.fechaInicio"
            type="date"
            class="form-control"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">Fecha de Finalización</label>
          <input
            v-model="formData.fechaFin"
            type="date"
            class="form-control"
            required
          />
        </div>
      </div>

      <div class="form-group full-width">
        <label class="form-label">Motivo o Justificación Detectada</label>
        <textarea
          v-model="formData.justificacion"
          rows="3"
          class="form-control"
          placeholder="Descripción extraída o anotaciones del encargado..."
        ></textarea>
      </div>

      <div class="ocr-actions">
        <button type="button" class="btn btn-outline" @click="$emit('cancel')">
          Descartar
        </button>
        <button type="button" class="btn btn-warning" @click="reanalizarOCR" :disabled="isAnalyzing">
          <span v-if="isAnalyzing">Re-analizando...</span>
          <span v-else>⚡ Re-escanear OCR</span>
        </button>
        <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
          <span v-if="isSubmitting">Guardando...</span>
          <span v-else>✔ Confirmar y Registrar</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({})
  },
  confianzaOcr: {
    type: Number,
    default: 95
  }
})

const emit = defineEmits(['save', 'cancel', 're-scan'])

const formData = ref({
  cedula: '',
  nombreFuncionario: '',
  tipoPermiso: '',
  dependencia: '',
  fechaInicio: '',
  fechaFin: '',
  justificacion: '',
  ...props.initialData
})

watch(() => props.initialData, (newVal) => {
  if (newVal) {
    formData.value = { ...formData.value, ...newVal }
  }
}, { deep: true })

const isAnalyzing = ref(false)
const isSubmitting = ref(false)

const confianzaClass = computed(() => {
  if (props.confianzaOcr >= 90) return 'accuracy-high'
  if (props.confianzaOcr >= 70) return 'accuracy-medium'
  return 'accuracy-low'
})

const reanalizarOCR = () => {
  isAnalyzing.value = true
  emit('re-scan')
  setTimeout(() => {
    isAnalyzing.value = false
  }, 1200)
}

const handleSubmit = () => {
  isSubmitting.value = true
  emit('save', { ...formData.value })
  setTimeout(() => {
    isSubmitting.value = false
  }, 600)
}
</script>

<style scoped>
.ocr-form-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.ocr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px;
}

.ocr-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #0284c7;
  background: #e0f2fe;
  padding: 2px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
}

.card-title {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
  font-weight: 600;
}

.accuracy-indicator {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.accuracy-high {
  background: #dcfce7;
  color: #15803d;
}

.accuracy-medium {
  background: #fef9c3;
  color: #a16207;
}

.accuracy-low {
  background: #fee2e2;
  color: #b91c1c;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  grid-column: 1 / -1;
  margin-top: 12px;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.form-control {
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  background: #f8fafc;
  transition: all 0.2s ease;
  outline: none;
}

.form-control:focus {
  background: #fff;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.ocr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.btn {
  padding: 9px 18px;
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

.btn-warning {
  background: #f59e0b;
  color: #ffffff;
}

.btn-warning:hover {
  background: #d97706;
}

.btn-outline {
  background: transparent;
  border-color: #cbd5e1;
  color: #64748b;
}

.btn-outline:hover {
  background: #f1f5f9;
  color: #334155;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
