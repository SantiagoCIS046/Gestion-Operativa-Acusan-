<template>
  <LayoutApp activo="registrar" :empleado="empleado">

    <!-- Alerta de resultado -->
    <div v-if="alerta.msg" :class="['alert', `alert--${alerta.tipo}`]">
      <span>{{ alerta.icono }}</span>
      <span>{{ alerta.msg }}</span>
    </div>

    <!-- Resumen de la jornada recién registrada -->
    <div v-if="resumen" class="card resumen-card">
      <div class="resumen-titulo">✅ Jornada registrada</div>
      <p class="resumen-sub">Quedó pendiente de aprobación por el Encargado. Así la clasificó el sistema:</p>

      <div class="resumen-grid">
        <div class="resumen-item">
          <span class="resumen-item__lbl">Duración trabajada</span>
          <span class="resumen-item__val">{{ resumen.duracion }}</span>
        </div>
        <div class="resumen-item">
          <span class="resumen-item__lbl">Horas extras</span>
          <span class="resumen-item__val">{{ resumen.horas }}</span>
        </div>
        <div class="resumen-item">
          <span class="resumen-item__lbl">Tipo principal</span>
          <span class="resumen-item__val">{{ resumen.tipo }}</span>
        </div>
        <div v-if="resumen.turno" class="resumen-item">
          <span class="resumen-item__lbl">Turno</span>
          <span class="resumen-item__val">{{ resumen.turno }}</span>
        </div>
      </div>

      <p v-if="resumen.aviso" class="resumen-aviso">ℹ️ {{ resumen.aviso }}</p>

      <div v-if="resumen.desglose.length" class="resumen-desglose">
        <div class="card__title" style="margin-bottom: 6px;"><span>📊</span> Desglose</div>
        <div v-for="d in resumen.desglose" :key="d.etiqueta" class="desglose-fila">
          <span>{{ d.etiqueta }}</span>
          <strong>{{ d.valor }}</strong>
        </div>
      </div>

      <button class="btn btn--primary" @click="cerrarResumen">Reportar otra jornada</button>
    </div>

    <!-- Enlace a evidencias (flujo de campo) -->
    <RouterLink to="/evidencias" class="link-campo">
      <span class="link-campo__icono">📷</span>
      <span class="link-campo__txt">
        <strong>¿Estás en campo ahora?</strong>
        <small>Usa Registrar Evidencia: foto al iniciar y al finalizar, con hora y GPS.</small>
      </span>
      <span class="link-campo__flecha">→</span>
    </RouterLink>

    <!-- KPI rápido -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-val">{{ empleado?.cedula }}</span>
        <span class="kpi-lbl">Cédula</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val kpi-val--cyan">{{ hoy }}</span>
        <span class="kpi-lbl">Fecha Hoy</span>
      </div>
    </div>

    <!-- Formulario de reporte (plantilla digital) -->
    <div class="card">
      <div class="card__title">
        <span>⏱️</span> Reportar Horas Extras
      </div>

      <p class="intro-evidencias">
        Registra la <strong>fecha</strong> en que trabajaste y tu <strong>hora de entrada y salida</strong>.
        El sistema calcula automáticamente cuántas horas fueron <strong>diurnas, nocturnas,
        dominicales o festivas</strong> — igual que la plantilla de papel, pero sin cuentas manuales.
      </p>

      <form @submit.prevent="enviar">
        <div class="field">
          <label for="cuadrilla">Cuadrilla / Área de Trabajo</label>
          <input
            id="cuadrilla"
            v-model="form.cuadrillaArea"
            type="text"
            placeholder="Ej: Cuadrilla Norte, Planta de Tratamiento..."
            required
          />
        </div>

        <div class="field">
          <label for="fecha">Fecha en que Trabajó</label>
          <input
            id="fecha"
            v-model="form.fechaOperacion"
            type="date"
            :max="hoyISO"
            required
          />
        </div>

        <div class="field-grid">
          <div class="field">
            <label for="horaInicio">Hora de Entrada</label>
            <input
              id="horaInicio"
              v-model="form.horaInicio"
              type="time"
              required
            />
          </div>
          <div class="field">
            <label for="horaFin">Hora de Salida</label>
            <input
              id="horaFin"
              v-model="form.horaFin"
              type="time"
              required
            />
          </div>
        </div>

        <span class="field-hint">
          Si terminaste después de medianoche, registra la hora en que saliste
          (ej: entrada 20:00, salida 02:00). ¿Trabajaste dos veces el mismo día?
          Envía un reporte por cada jornada.
        </span>

        <div v-if="duracionTexto" class="preview-duracion">
          ⏱ Duración de esta jornada: <strong>{{ duracionTexto }}</strong>
          <span v-if="cruzaMedianoche"> · termina al día siguiente</span>
        </div>

        <div class="field">
          <label for="justificacion">Justificación <span class="label-opcional">(opcional)</span></label>
          <textarea
            id="justificacion"
            v-model="form.justificacion"
            placeholder="Describe brevemente la actividad realizada..."
            rows="3"
          ></textarea>
        </div>

        <button type="submit" class="btn btn--primary" :disabled="enviando">
          <span v-if="enviando" class="spinner"></span>
          <span v-else>📤 Registrar Jornada</span>
        </button>
      </form>
    </div>
  </LayoutApp>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { authService, horasExtrasService } from '@/services/api.js'
import LayoutApp from '@/components/LayoutApp.vue'

const empleado = authService.getEmpleado()
const enviando = ref(false)
const alerta = ref({ msg: '', tipo: 'success', icono: '✅' })
const resumen = ref(null)

// Fecha local de Colombia (UTC−5 fijo): la fecha UTC correría el día a partir
// de las 19:00 local y fecharía los reportes nocturnos en el día siguiente
const hoyISO = new Date(Date.now() - 300 * 60000).toISOString().split('T')[0]
const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })

const form = ref({
  cuadrillaArea: '',
  fechaOperacion: hoyISO,
  horaInicio: '',
  horaFin: '',
  justificacion: ''
})

// ── Vista previa de duración (informativa; el cálculo real es del servidor) ──
const parsearHora = (texto) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((texto || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const duracionMin = computed(() => {
  const ini = parsearHora(form.value.horaInicio)
  const fin = parsearHora(form.value.horaFin)
  if (ini === null || fin === null) return null
  return fin < ini ? 1440 - ini + fin : fin - ini
})

const cruzaMedianoche = computed(() => {
  const ini = parsearHora(form.value.horaInicio)
  const fin = parsearHora(form.value.horaFin)
  return ini !== null && fin !== null && fin < ini
})

const duracionTexto = computed(() => {
  if (duracionMin.value === null || duracionMin.value <= 0) return ''
  const horas = Math.round((duracionMin.value / 60) * 4) / 4
  return `${horas} h`
})

// ── Resumen post-guardar (mismo patrón del resumen de evidencias) ──
const TIPOS_DESGLOSE = ['DIURNA', 'NOCTURNA', 'FESTIVA_DIURNA', 'FESTIVA_NOCTURNA']
const ETIQUETAS_DESGLOSE = {
  DIURNA: 'Extra diurna',
  NOCTURNA: 'Extra nocturna',
  FESTIVA_DIURNA: 'Dominical/Festiva diurna',
  FESTIVA_NOCTURNA: 'Dominical/Festiva nocturna'
}
const TIPOS_LABEL = {
  DIURNA: 'Extra diurna',
  NOCTURNA: 'Extra nocturna',
  FESTIVA_DIURNA: 'Dominical/Festiva diurna',
  FESTIVA_NOCTURNA: 'Dominical/Festiva nocturna'
}

// recargoDesglose llega como Json: acepta {tipo: horas} o [{tipo, horas}].
// Solo los 4 tipos de recargo son horas — el resto son metadatos del cálculo.
const parsearDesglose = (desglose) => {
  if (!desglose) return []
  const pares = []
  if (Array.isArray(desglose)) {
    for (const d of desglose) {
      if (d && d.tipo != null) pares.push([d.tipo, d.horas])
    }
  } else if (typeof desglose === 'object') {
    for (const k of TIPOS_DESGLOSE) {
      const v = desglose[k]
      if (v != null && Number(v) !== 0) pares.push([k, v])
    }
  }
  return pares
    .filter(([, v]) => Number(v) !== 0)
    .map(([k, v]) => ({ etiqueta: ETIQUETAS_DESGLOSE[k] || String(k), valor: `${Number(v)} h` }))
}

const cerrarResumen = () => {
  resumen.value = null
}

const mostrarAlerta = (tipo, msg) => {
  const iconos = { success: '✅', error: '⚠️', info: 'ℹ️' }
  alerta.value = { msg, tipo, icono: iconos[tipo] }
  setTimeout(() => { alerta.value.msg = '' }, 6000)
}

const enviar = async () => {
  const { horaInicio, horaFin } = form.value
  if (horaInicio && horaFin && horaInicio === horaFin) {
    mostrarAlerta('error', 'La hora de salida debe ser distinta de la hora de entrada.')
    return
  }

  enviando.value = true
  try {
    const data = await horasExtrasService.reportar(form.value)

    // Resumen con lo que dictaminó el servidor (horas, tipo y desglose)
    let duracionTextoGuardado = ''
    if (data?.fechaInicio && data?.fechaFin) {
      const horas = Math.round(((new Date(data.fechaFin) - new Date(data.fechaInicio)) / 3600000) * 4) / 4
      duracionTextoGuardado = `${horas} h`
    }
    resumen.value = {
      duracion: duracionTextoGuardado || duracionTexto.value,
      horas: `${data?.cantidadHoras ?? '—'} h`,
      tipo: TIPOS_LABEL[data?.tipoRecargo] || data?.tipoRecargo || '—',
      turno: data?.turnoNombre || '',
      aviso: data?.aviso || '',
      desglose: parsearDesglose(data?.recargoDesglose)
    }

    if (data?.aviso) {
      mostrarAlerta('info', data.aviso)
    } else {
      mostrarAlerta('success', '¡Jornada registrada correctamente! Queda pendiente de aprobación por el Encargado.')
    }

    // Se conservan cuadrilla y fecha: reportar la 2ª jornada del día es
    // solo escribir las nuevas horas
    form.value = {
      ...form.value,
      horaInicio: '',
      horaFin: '',
      justificacion: ''
    }
  } catch (e) {
    mostrarAlerta('error', e.message || 'No se pudo enviar el reporte. Intenta de nuevo.')
  } finally {
    enviando.value = false
  }
}
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.kpi-card {
  background: var(--card-bg);
  border: 1px solid var(--acuusan-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--sombra-card);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-val {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--acuusan-text);
  font-family: monospace;
}

.kpi-val--cyan { color: var(--acuusan-blue); }

.kpi-lbl {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--acuusan-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Entrada / salida lado a lado, como en la plantilla de papel */
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* Pista de ayuda del formulario (misma regla scoped de VistaIdentificacion) */
.field-hint {
  font-size: 0.72rem;
  color: var(--acuusan-muted);
  margin-top: 5px;
  display: block;
  line-height: 1.4;
}

@media (max-width: 360px) {
  .field-grid { grid-template-columns: 1fr; }
}

/* Vista previa informativa de la duración (el cálculo oficial es del servidor) */
.preview-duracion {
  background: var(--acuusan-blue-light);
  border: 1px solid #bae6fd;
  color: var(--acuusan-info-text);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 2px 0 12px;
}
</style>
