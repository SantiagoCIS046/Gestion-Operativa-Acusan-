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

    <!-- ══════════ FESTIVOS: CALENDARIO MENSUAL ══════════ -->
    <div class="card-modulo mt-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 class="titulo-seccion">Calendario de días festivos de Colombia</h2>
          <p class="text-muted small mb-0">
            Mes a mes, con el día de hoy y cada festivo señalado; es el calendario
            que usa el clasificador para determinar recargos festivos.
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span v-if="totalFestivos > 0" class="badge-total">{{ totalFestivos }} festivos en {{ anioFestivos }}</span>
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
      <template v-else>
        <!-- Navegación del mes -->
        <div class="cal-mes-nav">
          <button class="cal-mes-btn" type="button" aria-label="Mes anterior" @click="cambiarMesVista(-1)">‹</button>
          <div class="cal-mes-etiqueta">
            <span class="cal-mes-nombre">{{ MESES_CAL[mesVista - 1] }} {{ anioFestivos }}</span>
            <span class="cal-mes-sub">{{ festivosDelMes.length }} festivo{{ festivosDelMes.length === 1 ? '' : 's' }} en el mes</span>
          </div>
          <button class="cal-mes-btn" type="button" aria-label="Mes siguiente" @click="cambiarMesVista(1)">›</button>
        </div>

        <!-- Leyenda -->
        <div class="cal-leyenda">
          <span class="cal-leyenda-item"><span class="cal-dot cal-dot--hoy"></span> Día de hoy</span>
          <span class="cal-leyenda-item"><span class="cal-dot cal-dot--festivo"></span> Día festivo</span>
        </div>

        <!-- Malla calendario Lun → Dom -->
        <div class="cal-grid">
          <div v-for="d in DIAS_SEMANA" :key="d" class="cal-head">{{ d }}</div>
          <template v-for="(semana, i) in matrizCalendario" :key="i">
            <div
              v-for="(celda, j) in semana"
              :key="j"
              class="cal-celda"
              :class="{
                'cal-celda--vacia': !celda.dia,
                'cal-celda--festivo': celda.festivo,
                'cal-celda--hoy': celda.esHoy
              }"
              :title="celda.festivo
                ? `Festivo: ${celda.descripcion}`
                : (celda.dia ? `${celda.dia} de ${MESES_CAL[mesVista - 1]} de ${anioFestivos}` : '')"
            >
              <template v-if="celda.dia">
                <div class="cal-celda-top">
                  <span class="cal-dia">{{ celda.dia }}</span>
                  <span v-if="celda.esHoy" class="cal-tag-hoy">HOY</span>
                </div>
                <span v-if="celda.festivo" class="cal-nombre-festivo">{{ celda.descripcion }}</span>
              </template>
            </div>
          </template>
        </div>

        <!-- Flujo completo de festivos del mes -->
        <div v-if="festivosDelMes.length" class="cal-lista">
          <div v-for="f in festivosDelMes" :key="f.fecha" class="cal-lista-item">
            <span class="cal-lista-fecha font-mono">{{ formatearFechaCorta(f.fecha) }}</span>
            <span class="cal-lista-desc">{{ f.descripcion }}</span>
          </div>
        </div>
        <div v-else class="text-center text-muted py-3 small">
          {{ MESES_CAL[mesVista - 1] }} de {{ anioFestivos }} no tiene días festivos.
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
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

// ── Festivos: calendario mensual ──
const MESES_CAL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Fecha local de Colombia en YYYY-MM-DD ("en-CA" produce ese formato)
const hoyColombia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const [anioHoy, mesHoy] = hoyColombia.split('-').map(Number)

// Años consecutivos alrededor del actual: el calendario fluye sin saltos
const aniosDisponibles = [anioHoy - 1, anioHoy, anioHoy + 1]
const anioFestivos = ref(anioHoy)
const mesVista = ref(mesHoy)
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

const cambiarMesVista = (delta) => {
  let mes = mesVista.value + delta
  if (mes < 1) mes = 12
  if (mes > 12) mes = 1
  mesVista.value = mes
}

// Festivos del mes visible, en orden cronológico (alimenta lista y celdas)
const festivosDelMes = computed(() => {
  const prefijo = `${anioFestivos.value}-${String(mesVista.value).padStart(2, '0')}`
  return festivos.value
    .filter((f) => String(f.fecha || '').startsWith(prefijo))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
})

// Malla Lun→Dom del mes: celdas vacías en el desfase inicial y final.
// "esHoy" solo enciende en el mes/año en curso (comparación plana YYYY-MM-DD).
const matrizCalendario = computed(() => {
  const anio = anioFestivos.value
  const mes = mesVista.value
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  // getUTCDay(): 0=domingo…6=sábado → desplazar a lunes=0
  const desfase = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7
  const mapaFestivos = new Map(festivosDelMes.value.map((f) => [String(f.fecha), f.descripcion]))

  const semanas = []
  let semana = new Array(desfase).fill({})
  for (let dia = 1; dia <= diasDelMes; dia++) {
    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    semana.push({
      dia,
      fechaISO,
      festivo: mapaFestivos.has(fechaISO),
      descripcion: mapaFestivos.get(fechaISO) || '',
      esHoy: fechaISO === hoyColombia
    })
    if (semana.length === 7) {
      semanas.push(semana)
      semana = []
    }
  }
  if (semana.length) {
    while (semana.length < 7) semana.push({})
    semanas.push(semana)
  }
  return semanas
})

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
  white-space: nowrap;
}

/* ── Calendario de festivos ── */
.cal-mes-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.cal-mes-btn {
  width: 34px;
  height: 30px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #004884;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
}
.cal-mes-btn:hover {
  background: #f0f9ff;
  border-color: #004884;
}

.cal-mes-etiqueta {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.cal-mes-nombre {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.cal-mes-sub {
  font-size: 0.64rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.cal-leyenda {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 6px;
}

.cal-leyenda-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #475569;
}

.cal-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}
.cal-dot--hoy {
  background: #ffffff;
  border: 2px solid #004884;
}
.cal-dot--festivo {
  background: #fde68a;
  border: 1px solid #f59e0b;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 14px;
}

.cal-head {
  text-align: center;
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #64748b;
  padding: 4px 0 5px;
  border-bottom: 2px solid #e2e8f0;
}

.cal-celda {
  min-height: 62px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 6px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.cal-celda--vacia {
  background: #f8fafc;
  border-style: dashed;
  border-color: #edf2f7;
}

.cal-celda--festivo {
  background: #fffbeb;
  border-color: #fde68a;
}
.cal-celda--festivo:hover {
  border-color: #f59e0b;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.2);
}

.cal-celda--hoy {
  border: 2px solid #004884;
  box-shadow: 0 2px 8px rgba(0, 72, 132, 0.18);
}
.cal-celda--hoy .cal-dia {
  color: #004884;
}

.cal-celda-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.cal-dia {
  font-size: 0.8rem;
  font-weight: 800;
  color: #0f172a;
  font-family: monospace, monospace;
}
.cal-celda--festivo .cal-dia {
  color: #b45309;
}

.cal-tag-hoy {
  background: #004884;
  color: #ffffff;
  font-size: 0.54rem;
  font-weight: 800;
  letter-spacing: 0.4px;
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}

.cal-nombre-festivo {
  font-size: 0.62rem;
  font-weight: 600;
  color: #92400e;
  line-height: 1.15;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Listado completo de festivos del mes */
.cal-lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
}

.cal-lista-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #fffdf5;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 6px 10px;
}

.cal-lista-fecha {
  font-size: 0.74rem;
  font-weight: 700;
  color: #92400e;
  text-transform: capitalize;
}

.cal-lista-desc {
  font-size: 0.72rem;
  color: #64748b;
}

/* Móvil: celdas compactas; el nombre del festivo vive en el listado inferior */
@media (max-width: 576px) {
  .cal-celda {
    min-height: 42px;
    padding: 3px 4px;
  }
  .cal-nombre-festivo {
    display: none;
  }
  .cal-dia {
    font-size: 0.72rem;
  }
  .cal-tag-hoy {
    font-size: 0.48rem;
    padding: 1px 3px;
  }
}
</style>
