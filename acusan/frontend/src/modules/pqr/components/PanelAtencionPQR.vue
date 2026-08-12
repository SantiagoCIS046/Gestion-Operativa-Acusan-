<template>
  <div class="panel-atencion-card">
    <div v-if="!pqr" class="empty-state">
      <div class="empty-icon">📂</div>
      <p class="empty-text">Seleccione un radicado PQR de la lista para ver el expediente y gestionar la respuesta.</p>
    </div>

    <div v-else class="pqr-detail">
      <div class="detail-header">
        <div>
          <span class="radicado-pill">Radicado #{{ pqr.radicado }}</span>
          <h3 class="subject-title">{{ pqr.motivo }}</h3>
        </div>
        <span class="status-badge" :class="'status-' + pqr.estado.toLowerCase()">
          {{ pqr.estado }}
        </span>
      </div>

      <div class="citizen-card">
        <div class="citizen-item">
          <span class="label">Usuario / Suscriptor:</span>
          <span class="value">{{ pqr.usuario }} (Matrícula: {{ pqr.matricula || 'N/A' }})</span>
        </div>
        <div class="citizen-item">
          <span class="label">Dirección del Predio:</span>
          <span class="value">{{ pqr.direccion }}</span>
        </div>
        <div class="citizen-item">
          <span class="label">Fecha de Recepción:</span>
          <span class="value">{{ pqr.fechaRadicado }}</span>
        </div>
        <div class="citizen-item">
          <span class="label">Vencimiento Legal (Término):</span>
          <span class="value font-bold text-amber-700">{{ pqr.fechaVencimiento }}</span>
        </div>
      </div>

      <div class="pqr-description">
        <h4 class="section-subtitle">Detalle de la Solicitud / Reclamo</h4>
        <p class="desc-text">{{ pqr.descripcion }}</p>
      </div>

      <div class="response-section">
        <h4 class="section-subtitle">Redactar Respuesta Oficial Acuasan</h4>
        <textarea
          v-model="respuestaTexto"
          rows="4"
          class="response-textarea"
          placeholder="Escriba la respuesta técnica o administrativa para notificación al usuario..."
        ></textarea>

        <div class="action-bar">
          <button class="btn btn-secondary" @click="$emit('escalar', pqr)">
            ⚙ Escalar a Cuadrilla Técnica
          </button>
          <button
            class="btn btn-primary"
            :disabled="!respuestaTexto.trim()"
            @click="enviarRespuesta"
          >
            ✉ Notificar y Cerrar PQR
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  pqr: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['responder', 'escalar'])

const respuestaTexto = ref('')

watch(() => props.pqr, () => {
  respuestaTexto.value = ''
})

const enviarRespuesta = () => {
  emit('responder', {
    pqrId: props.pqr.id,
    respuesta: respuestaTexto.value
  })
  respuestaTexto.value = ''
}
</script>

<style scoped>
.panel-atencion-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  min-height: 500px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #94a3b8;
  text-align: center;
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.radicado-pill {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0284c7;
  background: #e0f2fe;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-block;
  margin-bottom: 4px;
}

.subject-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin: 4px 0 0 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-abierto {
  background: #fee2e2;
  color: #b91c1c;
}

.status-en_tramite {
  background: #fef3c7;
  color: #b45309;
}

.status-resuelto {
  background: #dcfce7;
  color: #15803d;
}

.citizen-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.citizen-item {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e293b;
}

.section-subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: #334155;
  margin: 0 0 8px 0;
}

.desc-text {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.5;
  background: #ffffff;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
}

.response-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  outline: none;
  resize: vertical;
  margin-bottom: 16px;
}

.response-textarea:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: #0284c7;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #0369a1;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
