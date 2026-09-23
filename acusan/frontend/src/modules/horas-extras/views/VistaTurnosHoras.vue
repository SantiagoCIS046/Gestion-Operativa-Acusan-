<template>
  <div class="turnos-horas-view">

    <PageHeader
      titulo="Turnos y Festivos"
      subtitulo="Jornadas base para el cálculo automático de recargos y calendario de días festivos de Colombia"
      icono="🕒"
    />

    <!-- ══════════ TURNOS ══════════ -->
    <div class="card-modulo">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 class="titulo-seccion">Turnos de trabajo</h2>
          <p class="text-muted small mb-0">
            Define la jornada estándar de cada cuadrilla; el clasificador la usa para
            calcular horas extras y recargos desde las evidencias.
          </p>
        </div>
        <button type="button" class="btn-nuevo" @click="abrirNuevo">＋ Nuevo turno</button>
      </div>

      <!-- Formulario de creación / edición -->
      <div v-if="formularioVisible" class="form-turno">
        <div class="row g-2">
          <div class="col-12 col-md-4">
            <label class="form-label small fw-bold">Nombre del turno *</label>
            <input
              v-model="formulario.nombre"
              type="text"
              class="form-control form-control-sm"
              placeholder="Ej: Operación Acueducto - Diurno"
              maxlength="60"
            />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label small fw-bold">Cuadrilla / Área *</label>
            <input
              v-model="formulario.cuadrillaArea"
              type="text"
              class="form-control form-control-sm"
              placeholder="Ej: Cuadrilla Acueducto"
              maxlength="60"
            />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small fw-bold">Hora inicio *</label>
            <input v-model="formulario.horaInicio" type="time" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small fw-bold">Hora fin *</label>
            <input v-model="formulario.horaFin" type="time" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small fw-bold">Jornada estándar (h)</label>
            <input
              v-model.number="formulario.jornadaEstandar"
              type="number"
              class="form-control form-control-sm"
              min="1"
              max="24"
              step="0.5"
            />
          </div>
          <div v-if="editandoId" class="col-6 col-md-3 d-flex align-items-end">
            <div class="form-check form-switch">
              <input
                id="checkActivo"
                v-model="formulario.activo"
                class="form-check-input"
                type="checkbox"
                role="switch"
              />
              <label class="form-check-label small fw-bold" for="checkActivo">Turno activo</label>
            </div>
          </div>
          <div class="col-12 d-flex justify-content-end gap-2 mt-1">
            <button type="button" class="btn btn-sm btn-light border" @click="cerrarFormulario">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-sm btn-success fw-bold px-3"
              :disabled="guardando"
              @click="guardarTurno"
            >
              <span v-if="guardando" class="spinner-border spinner-border-sm me-1"></span>
              {{ editandoId ? 'Guardar cambios' : 'Crear turno' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de turnos -->
      <div v-if="cargando" class="text-center text-muted py-4">
        <span class="spinner-border spinner-border-sm me-2"></span> Cargando turnos...
      </div>
      <div v-else-if="turnos.length === 0" class="text-center text-muted py-4">
        No hay turnos configurados. Cree el primero con "＋ Nuevo turno".
      </div>
      <div v-else class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0 tabla-turnos">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Cuadrilla / Área</th>
              <th class="text-center">Horario</th>
              <th class="text-center">Jornada estándar</th>
              <th class="text-center">Estado</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in turnos" :key="t.id" :class="{ 'fila-inactiva': !t.activo }">
              <td class="fw-bold">{{ t.nombre }}</td>
              <td>{{ t.cuadrillaArea }}</td>
              <td class="text-center font-mono">{{ t.horaInicio }} — {{ t.horaFin }}</td>
              <td class="text-center font-mono fw-bold">{{ formatoHoras(t.jornadaEstandar) }}</td>
              <td class="text-center">
                <span class="badge-estado" :class="t.activo ? 'estado-activo' : 'estado-inactivo'">
                  {{ t.activo ? '✔ Activo' : '⊘ Inactivo' }}
                </span>
              </td>
              <td class="text-center">
                <div class="d-inline-flex gap-1">
                  <button type="button" class="btn-mini" title="Editar turno" @click="editarTurno(t)">
                    ✏️ Editar
                  </button>
                  <button
                    v-if="t.activo"
                    type="button"
                    class="btn-mini btn-mini-peligro"
                    title="Desactivar turno (los cálculos existentes se conservan)"
                    @click="desactivarTurno(t)"
                  >
                    ⊘ Desactivar
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn-mini btn-mini-exito"
                    title="Reactivar el turno para nuevos cálculos"
                    @click="reactivarTurno(t)"
                  >
                    ✔ Reactivar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══════════ FESTIVOS ══════════ -->
    <div class="card-modulo mt-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 class="titulo-seccion">Días festivos de Colombia</h2>
          <p class="text-muted small mb-0">
            Calendario usado por el clasificador para determinar recargos festivos.
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span v-if="totalFestivos > 0" class="badge-total">{{ totalFestivos }} festivos</span>
          <select v-model.number="anioFestivos" class="form-select form-select-sm selector-anio">
            <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
      </div>

      <div v-if="cargandoFestivos" class="text-center text-muted py-4">
        <span class="spinner-border spinner-border-sm me-2"></span> Consultando festivos...
      </div>
      <div v-else-if="festivos.length === 0" class="text-center text-muted py-4">
        No hay festivos para mostrar del año {{ anioFestivos }}.
      </div>
      <div v-else class="row g-2">
        <div v-for="f in festivos" :key="f.fecha" class="col-12 col-md-6 col-lg-4">
          <div class="festivo-item">
            <span class="festivo-fecha font-mono">{{ formatearFechaCorta(f.fecha) }}</span>
            <span class="festivo-desc">{{ f.descripcion }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import horasExtrasService from '../services/horasExtrasService.js'
import notificacionService from '../../../services/notificacionService.js'

const lanzarAlertaBootstrap = notificacionService.mostrar

// ── Turnos ──
const turnos = ref([])
const cargando = ref(false)
const formularioVisible = ref(false)
const editandoId = ref(null)
const guardando = ref(false)

const formTurnoVacio = () => ({
  nombre: '',
  cuadrillaArea: '',
  horaInicio: '',
  horaFin: '',
  jornadaEstandar: 8,
  activo: true
})
const formulario = ref(formTurnoVacio())

const cargarTurnos = async () => {
  cargando.value = true
  try {
    // La vista web es interna: pide también los desactivados para poder reactivarlos
    turnos.value = await horasExtrasService.listarTurnos({ inactivos: true })
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  } finally {
    cargando.value = false
  }
}

const abrirNuevo = () => {
  editandoId.value = null
  formulario.value = formTurnoVacio()
  formularioVisible.value = true
}

const editarTurno = (t) => {
  editandoId.value = t.id
  formulario.value = {
    nombre: t.nombre || '',
    cuadrillaArea: t.cuadrillaArea || '',
    horaInicio: t.horaInicio || '',
    horaFin: t.horaFin || '',
    jornadaEstandar: Number(t.jornadaEstandar) || 8,
    activo: t.activo !== false
  }
  formularioVisible.value = true
}

const cerrarFormulario = () => {
  formularioVisible.value = false
  editandoId.value = null
  formulario.value = formTurnoVacio()
}

const guardarTurno = async () => {
  const f = formulario.value
  if (!f.nombre.trim() || !f.cuadrillaArea.trim() || !f.horaInicio || !f.horaFin) {
    lanzarAlertaBootstrap('warning', 'Datos incompletos', 'Nombre, cuadrilla/área y horario (inicio y fin) son obligatorios.')
    return
  }
  guardando.value = true
  try {
    const payload = {
      nombre: f.nombre.trim(),
      cuadrillaArea: f.cuadrillaArea.trim(),
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      jornadaEstandar: Number(f.jornadaEstandar) || 8
    }
    if (editandoId.value) {
      await horasExtrasService.actualizarTurno(editandoId.value, { ...payload, activo: f.activo })
      lanzarAlertaBootstrap('success', 'Turno actualizado', `El turno "${payload.nombre}" quedó guardado correctamente.`)
    } else {
      await horasExtrasService.crearTurno(payload)
      lanzarAlertaBootstrap('success', 'Turno creado', `El turno "${payload.nombre}" quedó registrado.`)
    }
    cerrarFormulario()
    await cargarTurnos()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  } finally {
    guardando.value = false
  }
}

const desactivarTurno = async (t) => {
  if (!window.confirm(`¿Desactivar el turno "${t.nombre}"?\n\nDejará de usarse en nuevos cálculos; los registros ya calculados se conservan.`)) return
  try {
    await horasExtrasService.eliminarTurno(t.id)
    lanzarAlertaBootstrap('success', 'Turno desactivado', `"${t.nombre}" quedó inactivo.`)
    await cargarTurnos()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  }
}

const reactivarTurno = async (t) => {
  try {
    await horasExtrasService.actualizarTurno(t.id, { activo: true })
    lanzarAlertaBootstrap('success', 'Turno reactivado', `"${t.nombre}" vuelve a estar disponible para nuevos cálculos.`)
    await cargarTurnos()
  } catch (e) {
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  }
}

// ── Festivos ──
// Año actual en horario de Colombia ("en-CA" produce YYYY-MM-DD)
const anioColombiaActual = () =>
  Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).split('-')[0])

const anioActual = anioColombiaActual()
const aniosDisponibles = [anioActual - 1, anioActual, anioActual + 1]
const anioFestivos = ref(anioActual)
const festivos = ref([])
const totalFestivos = ref(0)
const cargandoFestivos = ref(false)

const cargarFestivos = async () => {
  cargandoFestivos.value = true
  try {
    const data = await horasExtrasService.festivos(anioFestivos.value)
    // Forma esperada: { anio, total, festivos: [{ fecha, descripcion }] }
    const lista = Array.isArray(data?.festivos) ? data.festivos : Array.isArray(data) ? data : []
    festivos.value = lista
    totalFestivos.value = Number(data?.total ?? lista.length) || 0
  } catch (e) {
    festivos.value = []
    totalFestivos.value = 0
    lanzarAlertaBootstrap('danger', 'Error', e.message)
  } finally {
    cargandoFestivos.value = false
  }
}

watch(anioFestivos, () => cargarFestivos())

onMounted(() => {
  cargarTurnos()
  cargarFestivos()
})

// ── Formatos ──
const formatoHoras = (valor) => `${Number(valor) || 0}h`

const formatearFechaCorta = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(`${fecha}T12:00:00`)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })
}
</script>

<style scoped>
.turnos-horas-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.font-mono {
  font-family: monospace, monospace;
}

.card-modulo {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.titulo-seccion {
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.btn-nuevo {
  background: #107c41;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.btn-nuevo:hover {
  background: #0b5a2f;
}

.form-turno {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.form-label {
  color: #475569;
  margin-bottom: 2px;
}

.tabla-turnos th {
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 2px solid #cbd5e1;
  padding: 6px 8px;
  white-space: nowrap;
}

.tabla-turnos td {
  font-size: 0.78rem;
  color: #334155;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
}

.fila-inactiva td {
  color: #94a3b8;
  background: #fafafa;
}

.badge-estado {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}
.estado-activo {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.estado-inactivo {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-mini {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  color: #334155;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-mini:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.btn-mini-peligro:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #b91c1c;
}
.btn-mini-exito:hover {
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
}

.selector-anio {
  width: 100px;
}

.badge-total {
  background: #e0f7ff;
  color: #004884;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 10px;
}

.festivo-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #fffdf5;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 12px;
}

.festivo-fecha {
  font-size: 0.76rem;
  font-weight: 700;
  color: #92400e;
  text-transform: capitalize;
}

.festivo-desc {
  font-size: 0.72rem;
  color: #64748b;
}
</style>
