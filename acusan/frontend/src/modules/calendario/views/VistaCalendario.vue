<template>
  <div class="vista-calendario">
    <!-- ── Cabecera: título grande, estado y navegación del mes ── -->
    <header class="cal-cabecera-vista">
      <div class="cal-titulo-vista">
        <h2>Calendario de Radicados<br />Enviados</h2>
        <span class="cal-badge" :class="esMesActual ? 'cal-badge--verde' : 'cal-badge--indigo'">
          <i></i>{{ esMesActual ? 'Mes en curso' : 'Mes consultado' }}
        </span>
        <p class="cal-sub">
          Registro numérico de los radicados enviados y recibidos por día hábil, festivos de
          Colombia y días no laborales registrados por gerencia, con su registro detallado por
          fecha — {{ alcanceTexto }}.
        </p>
      </div>

      <div class="cal-nav-pagina" role="toolbar" aria-label="Navegación del mes">
        <div class="cal-nav-mes">
          <button type="button" class="cal-flecha" title="Mes anterior (RePág)" aria-label="Mes anterior" @click="moverMes(-1)">‹</button>
          <div class="cal-selects">
            <select :value="mes" aria-label="Mes" @change="cambiarAnioMes(anio, Number($event.target.value))">
              <option v-for="(nombre, i) in MESES_LARGOS" :key="nombre" :value="i + 1">{{ nombre }}</option>
            </select>
            <select :value="anio" aria-label="Año" @change="cambiarAnioMes(Number($event.target.value), mes)">
              <option v-for="a in aniosRango" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <button type="button" class="cal-flecha" title="Mes siguiente (AvPág)" aria-label="Mes siguiente" @click="moverMes(1)">›</button>
        </div>
        <div class="cal-nav-mes cal-filtro-area">
          <select v-model="filtroArea" aria-label="Filtrar por área">
            <option value="">Todas las áreas</option>
            <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
          </select>
        </div>
        <button type="button" class="cal-btn-hoy" @click="irAHoy">Hoy</button>
      </div>
    </header>

    <div v-if="cargando && !datos" class="cal-vacio">Cargando calendario…</div>

    <template v-else>
      <!-- ── KPIs del mes: cuatro cuadros con cifra grande ── -->
      <section class="cal-kpis">
        <article class="cal-tarjeta cal-kpi">
          <p class="cal-kpi-etiqueta">Radicados del mes</p>
          <p class="cal-kpi-cifra">{{ totalEnviados }}<small>rad.</small></p>
          <p class="cal-kpi-sub">enviados o recibidos a la fecha</p>
        </article>
        <article class="cal-tarjeta cal-kpi">
          <p class="cal-kpi-etiqueta">Días hábiles</p>
          <p class="cal-kpi-cifra">{{ datos?.diasHabiles ?? '—' }}<small>días</small></p>
          <p class="cal-kpi-sub">de {{ datos?.dias?.length ?? '—' }} días de calendario</p>
        </article>
        <article class="cal-tarjeta cal-kpi">
          <p class="cal-kpi-etiqueta">Festivos y no laborales</p>
          <p class="cal-kpi-cifra">{{ festivosDelMes.length }}<small>días</small></p>
          <p class="cal-kpi-sub cal-kpi-sub--ellipsis">
            {{ festivosDelMes.length ? festivosDelMes.map((f) => f.nombreFestivo).join(' · ') : 'sin festivos este mes' }}
          </p>
        </article>
        <article class="cal-tarjeta cal-kpi">
          <p class="cal-kpi-etiqueta">Días con envíos</p>
          <p class="cal-kpi-cifra">{{ diasConEnvios }}<small>días</small></p>
          <p class="cal-kpi-sub">días del mes con radicados enviados</p>
          <p class="cal-kpi-sub">de {{ totalEnviados }} radicados del mes</p>
        </article>
      </section>

      <div class="cal-rejilla">
        <!-- ── Columna izquierda: la matriz mensual ── -->
        <div class="cal-col-principal">
          <CalendarioMes
            :anio="anio"
            :mes="mes"
            :dias="datos?.dias || []"
            :enviados="enviadosVisibles"
            :seleccionada="fechaSel"
            :fecha-pico="picoEnviados.n ? picoEnviados.fecha : ''"
            :hasta-fecha="HOY"
            sin-navegacion
            titulo="Matriz Mensual de Radicados"
            :subtitulo="actualizadoA ? `Actualizado ${actualizadoA}` : ''"
            :nota="notaMes"
            @seleccionar="seleccionar"
            @mover="moverMes"
            @cambiar="cambiarAnioMes"
            @hoy="irAHoy"
          />
        </div>

        <!-- ── Columna derecha: el día seleccionado + administración ── -->
        <aside class="cal-col-lateral">
          <section class="cal-tarjeta cal-dia">
            <p class="cal-etiqueta-min">Fecha seleccionada •</p>
            <h3 class="cal-dia-fecha">{{ fechaTitulo }}</h3>
            <p v-if="panel?.nombreFestivo" class="cal-dia-tipo cal-dia-tipo--festivo">★ {{ panel.nombreFestivo }} — día no hábil</p>
            <p v-else-if="panel?.tipo === 'fin_de_semana'" class="cal-dia-tipo cal-dia-tipo--fin">{{ diaSemanaLargo(fechaSel) }} — fin de semana, no hábil</p>
            <p v-else-if="panel" class="cal-dia-tipo cal-dia-tipo--habil">{{ diaSemanaLargo(fechaSel) }} — día hábil del ciclo estándar</p>
            <p v-else class="cal-dia-tipo cal-dia-tipo--sutil">Seleccione un día de la matriz.</p>

            <div v-if="cargandoDia" class="cal-vacio cal-vacio--chico">Cargando…</div>
            <template v-else-if="panel">
              <div class="cal-dia-total">
                <p class="cal-etiqueta-min">Radicados enviados este día</p>
                <p class="cal-dia-cifra">{{ panel.enviados.length }}<small>rad.</small></p>
                <p class="cal-dia-sub">radicados enviados o recibidos esta fecha</p>
              </div>

              <!-- Registro numérico del día: un ítem por radicado enviado.
                   La lista se acota al alto de la matriz (scroll interno). -->
              <ol v-if="panel.enviados.length" class="cal-lista-dia">
                <li v-for="r in panel.enviados" :key="r.id" class="cal-item-dia">
                  <div class="cal-item-dia-cab">
                    <RouterLink class="enlace-rad" :to="{ path: '/radicados', query: { q: r.numeroRadicado } }">{{ r.numeroRadicado }}</RouterLink>
                    <span class="chip-prioridad" :class="`chip-prioridad--${(r.prioridad || '').toLowerCase()}`">{{ r.prioridad }}</span>
                  </div>
                  <p class="cal-item-dia-asunto" :title="r.asunto">{{ r.asunto }}</p>
                  <p class="cal-item-dia-area">
                    <span class="codigo-area">{{ r.area?.codigo }}</span>
                    <span class="cal-item-dia-area-nombre">{{ r.area?.nombre }}</span>
                  </p>
                  <p class="cal-item-dia-pie">
                    <span class="cal-item-dia-enc">Encargado: <b>{{ r.encargado || '—' }}</b></span>
                    <span class="cal-item-dia-plazo">Plazo {{ plazoDias(r) }}</span>
                  </p>
                </li>
              </ol>
              <p v-else class="cal-vacio cal-vacio--chico">Sin radicados enviados este día.</p>
            </template>
          </section>

          <!-- El registro numérico del día vive en la tarjeta de arriba; los
               agregados del mes (días hábiles, festivos, promedio) ya están
               en los KPIs y en la leyenda de la matriz. -->
        </aside>
      </div>

      <!-- ── Registro del día: tabla a todo ancho con paginación ── -->
      <section class="cal-tarjeta cal-registro">
        <div class="cal-registro-cab">
          <div>
            <h3>Registro de Radicados Enviados</h3>
            <p class="cal-registro-sub">Enviados del {{ fechaTitulo }}{{ areaSeleccionada ? ' · ' + areaSeleccionada.codigo : '' }}</p>
          </div>
          <div class="cal-registro-controles">
            <input
              v-model="filtroTexto"
              type="search"
              class="cal-filtro"
              placeholder="Filtrar por radicado o asunto…"
            />
            <select v-model="filtroPrioridad" class="cal-filtro-select" aria-label="Filtrar por prioridad">
              <option value="">Toda prioridad</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <span class="cal-registro-conteo">Mostrando {{ radicadosFiltrados.length }} de {{ panel?.enviados?.length ?? 0 }}</span>
          </div>
        </div>

        <div v-if="cargandoDia" class="cal-vacio cal-vacio--chico">Cargando…</div>
        <template v-else-if="panel">
          <div v-if="radicadosFiltrados.length" class="cal-tabla-wrap">
            <table class="cal-tabla">
              <thead>
                <tr>
                  <th>Radicado y asunto</th>
                  <th>Prioridad</th>
                  <th v-if="!filtroArea">Área</th>
                  <th>Encargado</th>
                  <th>Radicado el</th>
                  <th>Plazo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in radicadosPagina" :key="r.id">
                  <td class="celda-rad">
                    <RouterLink class="enlace-rad" :to="{ path: '/radicados', query: { q: r.numeroRadicado } }">{{ r.numeroRadicado }}</RouterLink>
                    <span class="celda-rad-asunto">{{ r.asunto }}</span>
                  </td>
                  <td>
                    <span class="chip-prioridad" :class="`chip-prioridad--${(r.prioridad || '').toLowerCase()}`">{{ r.prioridad }}</span>
                  </td>
                  <td v-if="!filtroArea"><span class="codigo-area">{{ r.area?.codigo }}</span> {{ r.area?.nombre }}</td>
                  <td>{{ r.encargado }}</td>
                  <td class="celda-fecha">{{ fechaLarga(r.fechaRadicacion) }}</td>
                  <td class="celda-plazo">{{ plazoDias(r) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else-if="panel.enviados.length" class="cal-vacio cal-vacio--chico">Ningún radicado coincide con el filtro.</p>
          <p v-else class="cal-vacio cal-vacio--chico">Sin radicados enviados este día.</p>

          <div v-if="radicadosFiltrados.length" class="cal-registro-pie">
            <p>Registros del {{ rangoPagina.desde }} al {{ rangoPagina.hasta }} de un total de {{ radicadosFiltrados.length }} radicados enviados el {{ fechaLarga(fechaSel) }}.</p>
            <div class="cal-paginacion">
              <button type="button" class="cal-pag-btn" :disabled="pag === 1" @click="pag--">‹ Anterior</button>
              <template v-for="(p, i) in paginas" :key="`${p}-${i}`">
                <span v-if="p === '…'" class="cal-pag-salto">…</span>
                <button v-else type="button" class="cal-pag-btn" :class="{ 'cal-pag-btn--activo': p === pag }" @click="pag = p">{{ p }}</button>
              </template>
              <button type="button" class="cal-pag-btn" :disabled="pag === totalPaginas" @click="pag++">Siguiente ›</button>
            </div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import CalendarioMes from '../CalendarioMes.vue'
import CalendarioAPI from '@/api/calendario.js'
import AreasAPI from '@/api/areas.js'
import useToast from '@/composables/useToast.js'
import { fechaLarga, hoyISO } from '@/utils/fechas.js'

const toast = useToast()

const HOY = hoyISO()
const [anioH, mesH] = HOY.split('-').map(Number)
const MS_DIA = 24 * 60 * 60 * 1000
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const POR_PAGINA = 6

const anio = ref(anioH)
const mes = ref(mesH)
const fechaSel = ref(HOY)
const datos = ref(null) // {diasHabiles, dias, enviados}
const panel = ref(null) // {fecha, tipo, nombreFestivo, enviados}
const cargando = ref(false)
const cargandoDia = ref(false)
const actualizadoA = ref('')

// Filtro de área (gerencia): '' = todas; el backend fuerza el token del resto.
const areas = ref([])
const filtroArea = ref('')
const areaSeleccionada = computed(() => areas.value.find((a) => a.id === filtroArea.value) || null)
const alcanceTexto = computed(() =>
  areaSeleccionada.value
    ? `el alcance es ${areaSeleccionada.value.codigo} — ${areaSeleccionada.value.nombre}`
    : 'el alcance es de todas las áreas de la empresa',
)

const filtroTexto = ref('')
const filtroPrioridad = ref('')
const pag = ref(1)

const aniosRango = computed(() => {
  const base = new Date().getFullYear()
  return Array.from({ length: 9 }, (_, i) => base - 4 + i)
})

const esMesActual = computed(() => anio.value === anioH && mes.value === mesH)

const festivosDelMes = computed(() => (datos.value?.dias || []).filter((d) => d.nombreFestivo))

// Regla del calendario: el futuro no existe — no puede haber radicados
// enviados ni recibidos después de hoy. Matriz, KPIs, PICO y promedio solo
// cuentan los días ya transcurridos (≤ HOY); los posteriores van grises.
const enviadosVisibles = computed(() =>
  Object.fromEntries(Object.entries(datos.value?.enviados || {}).filter(([fecha]) => fecha <= HOY))
)

// Días hábiles ya transcurridos del mes: denominador real del promedio
const habilesTranscurridos = computed(() =>
  (datos.value?.dias || []).filter((d) => d.fecha <= HOY && d.tipo === 'habil').length
)

const totalEnviados = computed(() =>
  Object.values(enviadosVisibles.value).reduce((suma, n) => suma + n, 0)
)

const picoEnviados = computed(() => {
  const fechas = Object.entries(enviadosVisibles.value).filter(([, n]) => n > 0)
  if (!fechas.length) return { fecha: '', n: 0 }
  return fechas.reduce((max, actual) => (actual[1] > max.n ? { fecha: actual[0], n: actual[1] } : max), { fecha: '', n: 0 })
})

// Días del mes (≤ HOY) con al menos un radicado enviado
const diasConEnvios = computed(() => Object.values(enviadosVisibles.value).filter((n) => n > 0).length)

const notaMes = computed(() => {
  const habiles = datos.value?.diasHabiles
  if (!habiles) return ''
  return `Promedio diario: ${promedioDia.value} radicados enviados por día hábil`
})

const promedioDia = computed(() => {
  // Con la regla «hasta HOY», el promedio divide por los hábiles ya
  // transcurridos (en meses pasados es el mes completo).
  const habiles = habilesTranscurridos.value || datos.value?.diasHabiles
  if (!habiles) return '—'
  return (totalEnviados.value / habiles).toFixed(1).replace('.', ',')
})

const fechaTitulo = computed(() => (fechaSel.value ? fechaDisplay(fechaSel.value) : ''))

const radicadosFiltrados = computed(() => {
  const lista = panel.value?.enviados ?? []
  const texto = filtroTexto.value.trim().toLowerCase()
  return lista.filter((r) => {
    if (filtroPrioridad.value && (r.prioridad || '').toLowerCase() !== filtroPrioridad.value) return false
    if (!texto) return true
    return (
      (r.numeroRadicado || '').toLowerCase().includes(texto) ||
      (r.asunto || '').toLowerCase().includes(texto)
    )
  })
})

// ── Paginación del registro (6 filas por página, como el diseño) ──
const totalPaginas = computed(() => Math.max(1, Math.ceil(radicadosFiltrados.value.length / POR_PAGINA)))

const radicadosPagina = computed(() => {
  const inicio = (pag.value - 1) * POR_PAGINA
  return radicadosFiltrados.value.slice(inicio, inicio + POR_PAGINA)
})

const rangoPagina = computed(() => {
  const total = radicadosFiltrados.value.length
  if (!total) return { desde: 0, hasta: 0 }
  return {
    desde: (pag.value - 1) * POR_PAGINA + 1,
    hasta: Math.min(pag.value * POR_PAGINA, total),
  }
})

const paginas = computed(() => {
  const t = totalPaginas.value
  const c = pag.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const conjunto = new Set([1, 2, c - 1, c, c + 1, t - 1, t].filter((p) => p >= 1 && p <= t))
  const ordenados = [...conjunto].sort((a, b) => a - b)
  const salida = []
  let previo = 0
  for (const p of ordenados) {
    if (p - previo > 1) salida.push('…')
    salida.push(p)
    previo = p
  }
  return salida
})

watch([filtroTexto, filtroPrioridad, fechaSel, filtroArea], () => {
  pag.value = 1
})

watch(totalPaginas, (t) => {
  if (pag.value > t) pag.value = t
})

function fechaDisplay(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES_LARGOS[Number(m) - 1].toLowerCase()} de ${a}`
}

function diaSemanaLargo(iso) {
  if (!iso) return ''
  return DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]
}

function plazoDias(r) {
  if (!r.fechaRadicacion || !r.fechaLimite) return '—'
  const dias = Math.round((Date.parse(r.fechaLimite) - Date.parse(r.fechaRadicacion)) / MS_DIA)
  return dias === 1 ? '1 día' : `${dias} días`
}

// ── Carga del mes ────────────────────────────────────────────
async function cargarMes() {
  cargando.value = true
  try {
    datos.value = await CalendarioAPI.mes(anio.value, mes.value, filtroArea.value || undefined)
    actualizadoA.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    toast.error(e.message)
  } finally {
    cargando.value = false
  }
}

async function cargarDia() {
  if (!fechaSel.value) return
  cargandoDia.value = true
  try {
    panel.value = await CalendarioAPI.dia(fechaSel.value, filtroArea.value || undefined)
  } catch (e) {
    toast.error(e.message)
  } finally {
    cargandoDia.value = false
  }
}

// ── Áreas del filtro (la vista es solo gerencia) ─────────────
async function cargarAreas() {
  try {
    areas.value = await AreasAPI.listar()
  } catch (e) {
    toast.error(e.message)
  }
}

watch([anio, mes, filtroArea], cargarMes)
watch([fechaSel, filtroArea], cargarDia)

onMounted(() => {
  cargarAreas()
  cargarMes()
  cargarDia()
})

// ── Eventos del calendario ───────────────────────────────────
function seleccionar(fecha) {
  fechaSel.value = fecha
}

function cambiarAnioMes(a, m) {
  // Clamp del mes; el año queda libre dentro del rango del selector
  anio.value = a
  mes.value = Math.min(12, Math.max(1, m))
}

function moverMes(delta) {
  let m = mes.value + delta
  let a = anio.value
  if (m < 1) {
    m = 12
    a -= 1
  } else if (m > 12) {
    m = 1
    a += 1
  }
  cambiarAnioMes(a, m)
}

function irAHoy() {
  cambiarAnioMes(anioH, mesH)
  fechaSel.value = HOY
}
</script>

<style scoped>
/* Paleta del diseño de referencia: tarjetas blancas, índigo, verde y ámbar */
.vista-calendario {
  --cx-primario: #3a2bd8;
  --cx-primario-medio: #5b4ee8;
  --cx-primario-suave: #f0f1fd;
  --cx-borde: #e4e6f4;
  --cx-texto: #17192b;
  --cx-secundario: #5c5e72;
  --cx-verde: #0b7a4b;
  --cx-verde-bg: #e7f7ee;
  --cx-ambar: #8a6410;
  --cx-ambar-bg: #fdf3dc;
  --cx-gris-bg: #f1f1f6;

  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Cabecera: título + navegación del mes ─────────────────── */
.cal-cabecera-vista {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.cal-titulo-vista h2 {
  margin: 0 0 6px;
  font-size: 1.42rem;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 1.12;
  color: var(--cx-texto);
}

.cal-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 5px 11px;
}

.cal-badge i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.cal-badge--verde {
  background: #d9f6e7;
  color: #067647;
}

.cal-badge--verde i {
  background: #12b76a;
}

.cal-badge--indigo {
  background: var(--cx-primario-suave);
  color: var(--cx-primario);
}

.cal-badge--indigo i {
  background: var(--cx-primario-medio);
}

.cal-sub {
  margin: 8px 0 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--cx-secundario);
  max-width: 620px;
}

.cal-nav-pagina {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cal-nav-mes {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--cx-borde);
  border-radius: 12px;
  background: #ffffff;
  padding: 4px;
}

.cal-selects {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cal-selects select,
.cal-filtro-area select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: transparent;
  color: var(--cx-texto);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cal-selects select:hover,
.cal-filtro-area select:hover {
  color: var(--cx-primario-medio);
  background: var(--cx-primario-suave);
}

.cal-selects select:focus-visible,
.cal-filtro-area select:focus-visible {
  outline: 2px solid var(--cx-primario-medio);
  outline-offset: -1px;
}

/* El select de área es más ancho: se acota para no romper la toolbar */
.cal-filtro-area select {
  font-size: 0.82rem;
  max-width: 220px;
}

.cal-flecha {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--cx-texto);
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0 2px;
  transition: all 0.15s ease;
}

.cal-flecha:hover {
  background: var(--cx-primario-suave);
  color: var(--cx-primario-medio);
}

.cal-btn-hoy {
  border: 1px solid var(--cx-borde);
  border-radius: 11px;
  background: #ffffff;
  color: var(--cx-primario);
  font-size: 0.74rem;
  font-weight: 800;
  padding: 9px 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cal-btn-hoy:hover {
  border-color: var(--cx-primario-medio);
  background: var(--cx-primario-suave);
}

/* ── Tarjetas ──────────────────────────────────────────────── */
.cal-tarjeta {
  background: #ffffff;
  border: 1px solid var(--cx-borde);
  border-radius: 14px;
  padding: 14px 16px;
}

/* ── KPIs del mes ──────────────────────────────────────────── */
.cal-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.cal-kpi {
  padding: 13px 15px;
}

.cal-kpi-etiqueta {
  margin: 0 0 7px;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--cx-secundario);
}

.cal-kpi-cifra {
  margin: 0 0 6px;
  font-size: 1.66rem;
  font-weight: 800;
  color: var(--cx-texto);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.cal-kpi-cifra small {
  margin-left: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cx-secundario);
}

.cal-kpi-sub {
  margin: 0;
  font-size: 0.67rem;
  line-height: 1.35;
  color: var(--cx-secundario);
}

.cal-kpi-sub--ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Rejilla principal ─────────────────────────────────────── */
.cal-rejilla {
  display: grid;
  grid-template-columns: minmax(0, 1.62fr) minmax(310px, 0.75fr);
  gap: 14px;
  align-items: start;
}

.cal-col-principal,
.cal-col-lateral {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* La columna del día nunca crece más que la matriz: aporta 0 al alto de la
   fila y luego se estira al 100% del track; si el día trae muchos
   radicados, la lista hace scroll interno dentro de ese alto. */
@media (min-width: 1081px) {
  .cal-col-lateral {
    height: 0;
    min-height: 100%;
  }
}

/* ── Panel del día ─────────────────────────────────────────── */
.cal-etiqueta-min {
  margin: 0 0 4px;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--cx-secundario);
}

.cal-dia-fecha {
  margin: 0 0 6px;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--cx-texto);
}

.cal-dia-tipo {
  margin: 0 0 12px;
  font-size: 0.72rem;
  font-weight: 700;
}

.cal-dia-tipo--habil {
  color: var(--cx-verde);
}

.cal-dia-tipo--festivo {
  color: #b26a00;
}

.cal-dia-tipo--fin {
  color: var(--cx-secundario);
}

.cal-dia-tipo--sutil {
  color: var(--cx-secundario);
  font-weight: 600;
}

.cal-dia-total {
  border: 1px solid var(--cx-borde);
  border-radius: 12px;
  background: #fbfbff;
  padding: 11px 13px;
  margin-bottom: 10px;
}

.cal-dia-cifra {
  margin: 0 0 4px;
  font-size: 1.62rem;
  font-weight: 800;
  color: var(--cx-texto);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.cal-dia-cifra small {
  margin-left: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cx-secundario);
}

.cal-dia-sub {
  margin: 0;
  font-size: 0.66rem;
  color: var(--cx-secundario);
}

/* ── Registro numérico del día: un ítem por radicado ──────── */
/* La tarjeta es una columna flexible: puede encoger hasta el alto de la
   matriz y la lista absorbe el resto con scroll interno. */
/* La tarjeta del día llena toda la columna: mide lo mismo que el cuadro de
   fechas aunque el día traiga pocos (o ningún) radicados. */
.cal-dia {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.cal-dia > * {
  flex-shrink: 0;
}

.cal-lista-dia {
  list-style: none;
  margin: 12px 0 0;
  padding: 0 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.cal-item-dia {
  border: 1px solid var(--cx-borde);
  border-radius: 11px;
  background: #fbfbff;
  padding: 9px 11px;
}

.cal-item-dia-cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cal-item-dia-cab .enlace-rad {
  font-size: 0.74rem;
}

.cal-item-dia-asunto {
  margin: 4px 0 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--cx-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Área y encargado visibles por radicado, como pide el registro del día */
.cal-item-dia-area {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cal-item-dia-area-nombre {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--cx-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-item-dia-pie {
  margin: 4px 0 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.64rem;
  color: var(--cx-secundario);
  min-width: 0;
}

.cal-item-dia-enc {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-item-dia-enc b {
  font-weight: 800;
  color: var(--cx-texto);
}

.cal-item-dia-plazo {
  font-weight: 800;
  color: var(--cx-primario);
  white-space: nowrap;
}

.cal-vacio {
  padding: 26px;
  text-align: center;
  color: var(--cx-secundario);
  font-size: 0.8rem;
  background: #ffffff;
  border: 1px dashed var(--cx-borde);
  border-radius: 12px;
}

.cal-vacio--chico {
  padding: 12px;
  font-size: 0.72rem;
  border: none;
  margin: 0;
}

/* ── Registro del día ──────────────────────────────────────── */
.cal-registro-cab {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.cal-registro-cab h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--cx-texto);
}

.cal-registro-sub {
  margin: 3px 0 0;
  font-size: 0.68rem;
  color: var(--cx-secundario);
}

.cal-registro-controles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cal-filtro {
  flex: 1;
  min-width: 190px;
  border: 1px solid var(--cx-borde);
  border-radius: 9px;
  padding: 7px 10px;
  font-size: 0.74rem;
  background: #ffffff;
  color: var(--cx-texto);
  font-family: inherit;
}

.cal-filtro::placeholder {
  color: #9a9cb0;
}

.cal-filtro:focus-visible {
  border-color: var(--cx-primario-medio);
  outline: none;
}

.cal-filtro-select {
  border: 1px solid var(--cx-borde);
  border-radius: 9px;
  padding: 7px 8px;
  font-size: 0.72rem;
  font-weight: 700;
  background: #ffffff;
  color: var(--cx-texto);
  font-family: inherit;
  cursor: pointer;
}

.cal-registro-conteo {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--cx-secundario);
  white-space: nowrap;
}

.cal-tabla-wrap {
  overflow-x: auto;
}

.cal-tabla {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.cal-tabla th {
  text-align: left;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--cx-secundario);
  padding: 8px 8px;
  background: #f2f3ff;
  white-space: nowrap;
}

.cal-tabla th:first-child {
  border-radius: 8px 0 0 8px;
}

.cal-tabla th:last-child {
  border-radius: 0 8px 8px 0;
}

.cal-tabla td {
  padding: 9px 8px;
  border-bottom: 1px solid var(--cx-borde);
  color: var(--cx-texto);
  vertical-align: middle;
}

.celda-rad {
  min-width: 220px;
}

.celda-rad-asunto {
  display: block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
  color: var(--cx-secundario);
  margin-top: 2px;
}

.celda-fecha {
  white-space: nowrap;
  color: var(--cx-secundario);
  font-variant-numeric: tabular-nums;
}

.celda-plazo {
  white-space: nowrap;
  font-weight: 800;
}

.codigo-area {
  display: inline-block;
  background: var(--cx-primario-suave);
  color: var(--cx-primario);
  font-weight: 800;
  font-size: 0.62rem;
  border-radius: 6px;
  padding: 1px 6px;
  margin-right: 4px;
}

.enlace-rad {
  color: var(--cx-primario);
  font-weight: 800;
  text-decoration: none;
}

.enlace-rad:hover {
  text-decoration: underline;
}

/* Chips de prioridad: ámbar / índigo / verde, como los estados del diseño */
.chip-prioridad {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 800;
}

.chip-prioridad--alta {
  background: var(--cx-ambar-bg);
  color: #b26a00;
}

.chip-prioridad--media {
  background: var(--cx-primario-suave);
  color: var(--cx-primario);
}

.chip-prioridad--baja {
  background: var(--cx-verde-bg);
  color: var(--cx-verde);
}

/* Pie del registro: conteo + paginación, como el diseño */
.cal-registro-pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.cal-registro-pie p {
  margin: 0;
  font-size: 0.66rem;
  color: var(--cx-secundario);
}

.cal-paginacion {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.cal-pag-btn {
  border: 1px solid var(--cx-borde);
  border-radius: 8px;
  background: #ffffff;
  color: var(--cx-texto);
  font-size: 0.66rem;
  font-weight: 800;
  padding: 5px 9px;
  cursor: pointer;
  min-width: 28px;
  font-variant-numeric: tabular-nums;
  transition: all 0.15s ease;
}

.cal-pag-btn:hover:not(:disabled) {
  border-color: var(--cx-primario-medio);
  color: var(--cx-primario-medio);
}

.cal-pag-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cal-pag-btn--activo {
  background: var(--cx-primario-medio);
  border-color: var(--cx-primario-medio);
  color: #ffffff;
}

.cal-pag-btn--activo:hover:not(:disabled) {
  color: #ffffff;
}

.cal-pag-salto {
  color: #9a9cb0;
  font-size: 0.66rem;
  padding: 0 2px;
}

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 1080px) {
  .cal-rejilla {
    grid-template-columns: 1fr;
  }

  .cal-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .cal-kpis {
    grid-template-columns: 1fr;
  }

  .cal-cabecera-vista {
    align-items: flex-start;
  }
}
</style>
