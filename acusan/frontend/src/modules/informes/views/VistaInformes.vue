<template>
  <section class="vista-informes">
    <!-- Cabecera: periodo + los dos botones (cargar datos / informe con
         pestaña Semana|Mes) + navegador de mes y selector de semana -->
    <header class="cabecera-vista">
      <div class="cabecera-titulos">
        <h2>Informes</h2>
        <p class="subtitulo">{{ subtituloPeriodo }}</p>
      </div>

      <div class="cabecera-controles">
        <div class="nav-mes" aria-label="Mes del informe">
          <button type="button" :disabled="!puedeMesAnterior || cargando" title="Mes anterior" @click="mesAnterior">‹</button>
          <span class="nav-mes-etiqueta">{{ etiquetaMes }}</span>
          <button type="button" :disabled="!puedeMesSiguiente || cargando" title="Mes siguiente" @click="mesSiguiente">›</button>
        </div>

        <!-- Botón 1: recarga las cifras del periodo activo -->
        <button type="button" class="btn-datos" :disabled="cargando" @click="cargarTodo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {{ cargando ? 'Cargando…' : 'Cargar datos' }}
        </button>

        <!-- Botón 2: el informe de la semana, con la pestaña del mensual -->
        <div class="seg" role="group" aria-label="Tipo de informe">
          <button type="button" :class="{ activo: modo === 'semana' }" @click="ponModo('semana')">Semana</button>
          <button type="button" :class="{ activo: modo === 'mes' }" @click="ponModo('mes')">Mes</button>
        </div>

        <select
          v-if="modo === 'semana'"
          v-model="semanaNum"
          class="select-semana"
          aria-label="Semana del mes"
          @change="cargarSemana"
        >
          <option v-for="s in semanasElegibles" :key="s.numero" :value="s.numero">
            S{{ s.numero }} · {{ s.rango }}{{ s.estado === 'en_curso' ? ' (en curso)' : '' }}
          </option>
        </select>
      </div>
    </header>

    <p v-if="error" class="banner-error">
      {{ error }}
      <button type="button" @click="cargarTodo">Reintentar</button>
    </p>

    <!-- LÍNEA 1 · Cuadros de datos: el porcentaje del periodo día a día.
         Con Semana activa las cifras son de la semana; con Mes, del mes. -->
    <div class="linea linea-kpis" aria-label="Cuadros de datos del periodo">
      <template v-if="periodo">
        <article class="cuadro cuadro-principal">
          <span class="cuadro-etiqueta">Cumplimiento del periodo</span>
          <span class="cuadro-grande" :class="{ 'cuadro-grande--bien': cumplimientoBueno, 'cuadro-grande--mal': cumplimientoMalo }">
            {{ pct(periodo.kpis.cumplimiento) }}
          </span>
          <span class="barra-progreso" aria-hidden="true">
            <span :style="{ width: `${Math.round((periodo.kpis.cumplimiento ?? 0) * 100)}%` }"></span>
          </span>
          <span class="cuadro-nota">{{ periodo.kpis.aTiempo }} a tiempo de {{ periodo.kpis.contestados }} contestados</span>
        </article>

        <article class="cuadro">
          <span class="cuadro-etiqueta">Enviados</span>
          <span class="cuadro-cifra">{{ periodo.kpis.enviados }}</span>
          <span class="cuadro-nota">radicados en el periodo</span>
        </article>

        <article class="cuadro">
          <span class="cuadro-etiqueta">Contestados</span>
          <span class="cuadro-cifra">{{ periodo.kpis.contestados }}</span>
          <span class="cuadro-nota">{{ periodo.kpis.aTiempo }} a tiempo · {{ periodo.kpis.conRetraso }} con retraso</span>
        </article>

        <article class="cuadro">
          <span class="cuadro-etiqueta">En proceso</span>
          <span class="cuadro-cifra">{{ periodo.kpis.enProceso }}</span>
          <span class="cuadro-nota">sin respuesta al corte {{ fechaLarga(periodo.corte) }}</span>
        </article>

        <article class="cuadro">
          <span class="cuadro-etiqueta">Vencidos</span>
          <span class="cuadro-cifra" :class="{ 'cifra-roja': periodo.kpis.vencidos > 0 }">{{ periodo.kpis.vencidos }}</span>
          <span class="cuadro-nota">pasó su fecha límite</span>
        </article>

        <article class="cuadro">
          <span class="cuadro-etiqueta">Por vencer</span>
          <span class="cuadro-cifra">{{ periodo.kpis.porVencer }}</span>
          <span class="cuadro-nota">vencen en 7 días o menos</span>
        </article>
      </template>
      <p v-else-if="cargando" class="c-vacia">Calculando los cuadros del periodo…</p>
    </div>

    <!-- Gerencia ve aquí el porcentaje de cada área; el líder de área, el de
         sus encargados (el servidor fija el alcance) -->
    <section v-if="grupoRanking.length" class="linea franja-grupos" :aria-label="esLiderGeneral ? 'Cumplimiento por área' : 'Cumplimiento por encargado'">
      <h3 class="franja-titulo">{{ esLiderGeneral ? 'Cumplimiento por área' : 'Cumplimiento por encargado' }}</h3>
      <ul class="grupos">
        <li v-for="g in grupoRanking" :key="g.id" class="grupo">
          <span class="grupo-nombre" :title="g.nombre">{{ g.nombre }}</span>
          <span class="grupo-barra" aria-hidden="true"><span :style="{ width: `${Math.round((g.cumplimiento ?? 0) * 100)}%` }"></span></span>
          <span class="grupo-pct">{{ pct(g.cumplimiento) }}</span>
          <span class="grupo-datos">{{ g.contestados }} contestados · {{ g.enProceso }} en proceso · {{ g.vencidos }} vencidos</span>
        </li>
      </ul>
    </section>

    <!-- LÍNEA 2 · Gráfica del transcurso + su explicación -->
    <div class="linea linea-visual" aria-label="Gráfica y explicación del periodo">
      <article class="panel panel-grafica">
        <h3 class="panel-titulo">
          {{ modo === 'semana' ? 'Transcurso de la semana' : 'Transcurso del mes' }}
          <span class="panel-sub">{{ etiquetaPeriodoActivo }}</span>
        </h3>

        <div v-if="puntosGrafica.length" class="grafica">
          <div class="grafica-cuerpo">
            <div
              v-for="p in puntosGrafica"
              :key="p.etiqueta"
              class="punto"
              :class="{ inhabil: p.inhabil }"
              :title="p.titulo"
            >
              <div class="columnas">
                <span class="col col-enviados" :style="{ height: alturaCol(p.enviados) }"></span>
                <span class="col col-contestados" :style="{ height: alturaCol(p.contestados) }"></span>
              </div>
              <span class="punto-etiqueta">{{ p.etiqueta }}</span>
            </div>
          </div>
          <div class="leyenda">
            <span><i class="i-enviados"></i> Enviados</span>
            <span><i class="i-contestados"></i> Contestados</span>
            <span v-if="modo === 'semana'" class="leyenda-nota">Los días atenuados no son hábiles</span>
          </div>
        </div>
        <p v-else class="c-vacia">Aún no hay días medidos en este periodo.</p>
      </article>

      <article class="panel panel-explica">
        <h3 class="panel-titulo">Qué evalúa la gráfica</h3>
        <dl class="definiciones">
          <dt>Enviados</dt>
          <dd>Radicados cuya fecha de radicación cae dentro del periodo.</dd>
          <dt>Contestados</dt>
          <dd>Radicados con respuesta entregada dentro del periodo.</dd>
          <dt>A tiempo</dt>
          <dd>La respuesta llegó en la fecha límite o antes de ella.</dd>
          <dt>Cumplimiento</dt>
          <dd>Contestados a tiempo sobre el total de contestados.</dd>
          <dt>Corte</dt>
          <dd>El periodo cierra en su último día hábil; mientras avanza, se mide hasta hoy.</dd>
        </dl>

        <div v-if="periodo" class="lectura">
          <h4>Lectura del periodo</h4>
          <ul>
            <li>{{ lecturaPico }}</li>
            <li>
              En promedio una respuesta toma
              {{ periodo.kpis.diasPromedioRespuesta == null ? '—' : `${periodo.kpis.diasPromedioRespuesta} días` }}
              desde la radicación.
            </li>
            <li v-if="periodo.destacados.masActiva">
              Más activ{{ terminoGrupo }}: <strong>{{ periodo.destacados.masActiva.nombre }}</strong>
              ({{ periodo.destacados.masActiva.contestados }} contestados).
            </li>
            <li v-if="periodo.destacados.masAfectada">
              Más afectad{{ terminoGrupo }}: <strong>{{ periodo.destacados.masAfectada.nombre }}</strong>
              ({{ periodo.destacados.masAfectada.enProceso }} en proceso).
            </li>
          </ul>
        </div>

        <p class="nota-periodos">
          Sábados, domingos y festivos cuentan en la semana hábil que los mide: las semanas suman exactamente el mes.
        </p>
      </article>
    </div>

    <!-- LÍNEA 3 · Plantilla con sus tres selectores -->
    <section class="linea panel panel-tabla" aria-label="Plantilla de radicados del periodo">
      <div class="tabla-controles">
        <!-- Selector 1: área (gerencia; el líder de área ya viene fijado) -->
        <select v-if="esLiderGeneral" v-model="areaId" class="select-control" aria-label="Filtrar por área" @change="cargarTodo">
          <option value="">Todas las áreas</option>
          <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
        </select>
        <span v-else class="chip-area" title="El informe de un líder de área siempre cubre su propia área">
          {{ sesion.area.value?.codigo }} — {{ sesion.area.value?.nombre }}
        </span>

        <!-- Selector 2: contestados / no contestados -->
        <div class="seg" role="group" aria-label="Estado de los radicados">
          <button type="button" :class="{ activo: estadoTabla === 'pendientes' }" @click="ponEstado('pendientes')">No contestados</button>
          <button type="button" :class="{ activo: estadoTabla === 'contestados' }" @click="ponEstado('contestados')">Contestados</button>
        </div>

        <!-- Selector 3: foco — graves/por vencer en pendientes; en
             contestados el foco equivalente es el resultado de la respuesta -->
        <div class="seg" role="group" aria-label="Foco de la plantilla">
          <button
            v-for="o in opcionesFoco"
            :key="o.valor"
            type="button"
            :class="{ activo: foco === o.valor }"
            @click="foco = o.valor"
          >
            {{ o.texto }}
          </button>
        </div>
      </div>

      <p class="tabla-contexto">{{ contextoTabla }}</p>

      <!-- No contestados: al corte del periodo activo, más atrasados primero -->
      <table v-if="estadoTabla === 'pendientes'" class="tabla">
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Asunto</th>
            <th v-if="esLiderGeneral" scope="col">Área</th>
            <th scope="col">Encargado</th>
            <th scope="col">Radicado</th>
            <th scope="col">Vence</th>
            <th scope="col">Atraso</th>
            <th scope="col">Prioridad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargandoTabla">
            <td :colspan="columnas" class="c-vacia">Cargando plantilla…</td>
          </tr>
          <tr v-else-if="!filasPendientes.length">
            <td :colspan="columnas" class="c-vacia">{{ foco === 'todos' ? 'Sin radicados por contestar al corte.' : 'Ningún radicado entra en este foco.' }}</td>
          </tr>
          <tr v-for="f in filasPendientes" v-else :key="f.id">
            <td>
              <RouterLink class="enlace-radicado" :to="{ path: '/radicados', query: { q: f.numeroRadicado } }">
                {{ f.numeroRadicado }}
              </RouterLink>
            </td>
            <td class="td-asunto" :title="f.asunto">{{ f.asunto }}</td>
            <td v-if="esLiderGeneral" class="td-area">{{ f.area }}</td>
            <td class="td-encargado">{{ f.encargado ?? '—' }}</td>
            <td class="td-fecha">{{ fechaLarga(f.diaRadicacion) }}</td>
            <td class="td-fecha">{{ fechaLarga(f.diaVencimiento) }}</td>
            <td>
              <span v-if="f.atrasoDias > 0" class="chip-atraso">{{ f.atrasoDias }} d de atraso</span>
              <span v-else class="chip-plazo">en plazo</span>
            </td>
            <td><span class="chip-prioridad" :class="`chip-prioridad--${prioridadClase(f.prioridad)}`">{{ prioridadTexto(f.prioridad) }}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Contestados: respondidos dentro del periodo activo -->
      <table v-else class="tabla">
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Asunto</th>
            <th v-if="esLiderGeneral" scope="col">Área</th>
            <th scope="col">Encargado</th>
            <th scope="col">Radicado</th>
            <th scope="col">Respondido</th>
            <th scope="col">Resultado</th>
            <th scope="col">Prioridad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargandoTabla">
            <td :colspan="columnas" class="c-vacia">Cargando plantilla…</td>
          </tr>
          <tr v-else-if="!filasContestadas.length">
            <td :colspan="columnas" class="c-vacia">{{ foco === 'todos' ? 'Sin contestados en este periodo.' : 'Ningún contestado entra en este foco.' }}</td>
          </tr>
          <tr v-for="f in filasContestadas" v-else :key="f.id">
            <td>
              <RouterLink class="enlace-radicado" :to="{ path: '/radicados', query: { q: f.numeroRadicado } }">
                {{ f.numeroRadicado }}
              </RouterLink>
            </td>
            <td class="td-asunto" :title="f.asunto">{{ f.asunto }}</td>
            <td v-if="esLiderGeneral" class="td-area">{{ f.area ? `${f.area.codigo} — ${f.area.nombre}` : '—' }}</td>
            <td class="td-encargado">{{ f.encargado?.nombre ?? '—' }}</td>
            <td class="td-fecha">{{ fechaLarga(f.fechaRadicacion) }}</td>
            <td class="td-fecha">{{ fechaLarga(f.respondidoEn) }}</td>
            <td>
              <span class="chip-resultado" :class="f.resultadoRespuesta === 'con_retraso' ? 'chip-resultado--retraso' : ''">
                {{ f.resultadoRespuesta === 'con_retraso' ? 'Con retraso' : 'A tiempo' }}
              </span>
            </td>
            <td><span class="chip-prioridad" :class="`chip-prioridad--${prioridadClase(f.prioridad)}`">{{ prioridadTexto(f.prioridad) }}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Paginación del mes (la semana cerrada es una foto de 20 filas) -->
      <button
        v-if="estadoTabla === 'pendientes' && modo === 'mes' && pendientesMes.cursor"
        type="button"
        class="btn-mas"
        :disabled="cargandoTabla"
        @click="cargarPendientesMes(pendientesMes.cursor)"
      >
        {{ cargandoTabla ? 'Cargando…' : 'Cargar más' }}
      </button>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

import { InformesAPI } from '@/api/informes.js'
import { RadicadosAPI } from '@/api/radicados.js'
import { AreasAPI } from '@/api/areas.js'
import { useSesion } from '@/composables/useSesion.js'
import { fechaLarga, hoyISO } from '@/utils/fechas.js'

const sesion = useSesion()
const esLiderGeneral = computed(() => sesion.esLiderGeneral.value)

// Mes cargado (por defecto el actual) y modo del informe: la semana con su
// pestaña mensual — las cifras de las tres líneas siguen al modo activo
const [hoyA, hoyM] = hoyISO().split('-').map(Number)
const anio = ref(hoyA)
const mes = ref(hoyM)
const modo = ref('semana')
const semanaNum = ref(null)

// Selector de área (solo gerencia): rescopa KPIs, gráfica y plantilla
const areas = ref([])
const areaId = ref('')

const datosMes = ref(null)
const datosSemana = ref(null)
const cargando = ref(false)
const cargandoTabla = ref(false)
const error = ref('')

// Línea 3: estado de los radicados + foco + fuentes
const estadoTabla = ref('pendientes')
const foco = ref('todos')
const pendientesMes = ref({ filas: [], total: 0, cursor: null })
const contestadasTodas = ref(null)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const diaCorto = (iso) => `${DOW[new Date(`${iso}T00:00:00.000Z`).getUTCDay()]} ${Number(iso.slice(8, 10))}`

const pct = (v) => (v == null ? '—' : `${Math.round(v * 1000) / 10} %`)
const paramsArea = () => (areaId.value ? { areaId: areaId.value } : {})

// ── Periodo activo: la semana (S#, rango, kpis, porGrupo, pendientes al
// corte de la semana) o el mes completo — una sola vista para las 3 líneas
const periodo = computed(() => {
  if (modo.value === 'semana') {
    const s = datosSemana.value
    if (!s) return null
    return { etiqueta: `S${s.numero} · ${s.rango}`, kpis: s.kpis, porGrupo: s.porGrupo, corte: s.corte, destacados: destacadosDe(s.porGrupo) }
  }
  const m = datosMes.value
  if (!m) return null
  return { etiqueta: m.etiqueta, kpis: m.kpis, porGrupo: m.porGrupo, corte: m.corte, destacados: m.destacados }
})

// El /mes trae sus destacados; el /semana no, pero sí su porGrupo
function destacadosDe(grupos) {
  const conContestados = grupos.filter((g) => g.contestados > 0)
  const masActiva = conContestados.length
    ? conContestados.slice().sort((a, b) => b.contestados - a.contestados || (b.cumplimiento ?? -1) - (a.cumplimiento ?? -1))[0]
    : null
  const conProceso = grupos.filter((g) => g.enProceso > 0)
  const masAfectada = conProceso.length
    ? conProceso.slice().sort((a, b) => b.enProceso - a.enProceso || b.vencidos - a.vencidos)[0]
    : null
  return { masActiva, masAfectada }
}

const subtituloPeriodo = computed(() => {
  const p = periodo.value
  const tipo = modo.value === 'semana' ? 'Informe semanal' : 'Informe mensual'
  if (!p) return `${tipo} · ${MESES[mes.value - 1]} ${anio.value}`
  return `${tipo} · ${p.etiqueta} · ${fechaLarga(p.corte)} (${datosCerrado.value ? 'cerrado' : 'en curso'})`
})
const datosCerrado = computed(() => (modo.value === 'semana' ? datosSemana.value?.cerrada : datosMes.value?.cerrado))
const etiquetaMes = computed(() => `${MESES[mes.value - 1]} ${anio.value}`)
const etiquetaPeriodoActivo = computed(() => periodo.value?.etiqueta ?? '')

const cumplimientoBueno = computed(() => (periodo.value?.kpis.cumplimiento ?? 0) >= 0.9)
const cumplimientoMalo = computed(() => (periodo.value?.kpis.cumplimiento ?? 0) < 0.6)

// Ranking de la franja: ordenado por cumplimiento, los grupos sin
// contestados al final (su cumplimiento es null)
const grupoRanking = computed(() => {
  const grupos = periodo.value?.porGrupo ?? []
  return grupos.slice().sort((a, b) => (b.cumplimiento ?? -1) - (a.cumplimiento ?? -1) || b.contestados - a.contestados)
})
const terminoGrupo = computed(() => (esLiderGeneral.value ? 'a' : 'o'))

// ── Gráfica: día por día (semana) o semana a semana (mes) ──
const puntosGrafica = computed(() => {
  if (modo.value === 'semana') {
    return (datosSemana.value?.porDia ?? []).map((d) => ({
      etiqueta: diaCorto(d.fecha),
      enviados: d.enviados,
      contestados: d.contestados,
      inhabil: d.tipo !== 'habil',
      titulo: `${fechaLarga(d.fecha)}${d.nombreFestivo ? ` · ${d.nombreFestivo}` : ''} · ${d.enviados} enviados · ${d.contestados} contestados`,
    }))
  }
  return (datosMes.value?.semanas ?? []).filter((s) => s.kpis).map((s) => ({
    etiqueta: `S${s.numero}`,
    enviados: s.kpis.enviados,
    contestados: s.kpis.contestados,
    inhabil: false,
    titulo: `${s.rango} · ${s.kpis.enviados} enviados · ${s.kpis.contestados} contestados · cumplimiento ${pct(s.kpis.cumplimiento)}`,
  }))
})
const maxGrafica = computed(() => Math.max(1, ...puntosGrafica.value.map((p) => Math.max(p.enviados, p.contestados))))
const alturaCol = (n) => (n === 0 ? '0%' : `${Math.max(6, Math.round((n / maxGrafica.value) * 100))}%`)

const lecturaPico = computed(() => {
  const puntos = puntosGrafica.value.filter((p) => !p.inhabil)
  const pico = puntos.slice().sort((a, b) => b.enviados - a.enviados || b.contestados - a.contestados)[0]
  const unidad = modo.value === 'semana' ? 'día' : 'semana'
  if (!pico) return `Aún no hay movimiento medido en este periodo.`
  return `El ${unidad} con más movimiento es ${pico.etiqueta}: ${pico.enviados} enviados y ${pico.contestados} contestados.`
})

// ── Línea 3 ──
const opcionesFoco = computed(() =>
  estadoTabla.value === 'pendientes'
    ? [
        { valor: 'todos', texto: 'Todos' },
        { valor: 'graves', texto: 'Más graves' },
        { valor: 'vencer', texto: 'Por vencer' },
      ]
    : [
        { valor: 'todos', texto: 'Todos' },
        { valor: 'graves', texto: 'Con retraso' },
        { valor: 'vencer', texto: 'A tiempo' },
      ],
)

const columnas = computed(() => (esLiderGeneral.value ? 8 : 7))

const filasPendientes = computed(() => {
  const base = modo.value === 'semana'
    ? (datosSemana.value?.pendientes?.filas ?? [])
    : pendientesMes.value.filas
  if (foco.value === 'graves') return base.filter((f) => f.atrasoDias > 0 || String(f.prioridad ?? '').toLowerCase() === 'alta')
  if (foco.value === 'vencer') return base.filter((f) => f.atrasoDias === 0)
  return base
})

// Contestados del radicado más reciente al más antiguo dentro del periodo
const filasContestadas = computed(() => {
  const desde = modo.value === 'semana' ? datosSemana.value?.periodoDesde : datosMes.value?.desde
  const hasta = modo.value === 'semana' ? datosSemana.value?.periodoHasta : datosMes.value?.hasta
  if (!desde || !hasta || !contestadasTodas.value) return []
  return contestadasTodas.value
    .filter((r) => {
      const d = new Date(r.respondidoEn ?? 0)
      if (Number.isNaN(d.getTime())) return false
      const dia = d.toISOString().slice(0, 10)
      return dia >= desde && dia <= hasta
    })
    .filter((r) => {
      if (foco.value === 'graves') return r.resultadoRespuesta === 'con_retraso' || r.prioridad === 'alta'
      if (foco.value === 'vencer') return r.resultadoRespuesta === 'a_tiempo'
      return true
    })
    .sort((a, b) => new Date(b.respondidoEn ?? 0) - new Date(a.respondidoEn ?? 0))
})

const contextoTabla = computed(() => {
  if (estadoTabla.value === 'contestados') {
    const desde = modo.value === 'semana' ? datosSemana.value?.periodoDesde : datosMes.value?.desde
    const hasta = modo.value === 'semana' ? datosSemana.value?.periodoHasta : datosMes.value?.hasta
    if (!desde || !hasta) return ''
    return `Respondidos entre ${fechaLarga(desde)} y ${fechaLarga(hasta)} — ${filasContestadas.value.length} en este foco.`
  }
  if (modo.value === 'semana') {
    const s = datosSemana.value
    if (!s) return ''
    const extra = s.pendientes.filas.length < s.pendientes.total ? ` · se muestran las ${s.pendientes.filas.length} más atrasadas` : ''
    return `Por contestar al corte de la semana (${fechaLarga(s.corte)}) — ${s.pendientes.total} en total${extra}.`
  }
  return `Por contestar al corte del mes (${fechaLarga(datosMes.value?.corte)}) — ${pendientesMes.value.total} en total.`
})

const prioridadTexto = (p) => ({ ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', alta: 'Alta', media: 'Media', baja: 'Baja' }[p] ?? '—')
const prioridadClase = (p) => String(p ?? '').toLowerCase()

// ── Carga ──
const semanasElegibles = computed(() => (datosMes.value?.semanas ?? []).filter((s) => s.estado !== 'futura'))

async function cargarTodo() {
  cargando.value = true
  error.value = ''
  try {
    datosMes.value = await InformesAPI.mes(anio.value, mes.value, paramsArea())
    // Semana por defecto del mes cargado: la que va, o la última cerrada
    const actuales = semanasElegibles.value
    const objetivo = actuales.find((s) => s.estado === 'en_curso') ?? actuales.at(-1)
    semanaNum.value = objetivo ? objetivo.numero : null
    datosSemana.value = null
    pendientesMes.value = { filas: [], total: 0, cursor: null }
    contestadasTodas.value = null

    if (modo.value === 'semana') await cargarSemana()
    else await cargarPendientesMes()
    if (estadoTabla.value === 'contestados') await cargarContestados()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

async function cargarSemana() {
  if (semanaNum.value == null) return
  cargando.value = true
  error.value = ''
  try {
    datosSemana.value = await InformesAPI.semana(anio.value, mes.value, semanaNum.value, paramsArea())
  } catch (e) {
    error.value = e.message
    datosSemana.value = null
  } finally {
    cargando.value = false
  }
}

async function cargarPendientesMes(cursor = null) {
  cargandoTabla.value = true
  try {
    const pagina = await InformesAPI.pendientes(anio.value, mes.value, {
      ...paramsArea(),
      limite: 50,
      ...(cursor ? { cursor } : {}),
    })
    pendientesMes.value = cursor
      ? { filas: [...pendientesMes.value.filas, ...pagina.filas], total: pagina.total, cursor: pagina.cursor }
      : pagina
  } catch (e) {
    error.value = e.message
  } finally {
    cargandoTabla.value = false
  }
}

// Los contestados se piden al inventario de radicados (estado respondido) y
// el periodo los recorta en el cliente
async function cargarContestados() {
  cargandoTabla.value = true
  try {
    contestadasTodas.value = await RadicadosAPI.listar({
      estado: 'respondido',
      ...(areaId.value ? { area: areaId.value } : {}),
    })
  } catch (e) {
    error.value = e.message
  } finally {
    cargandoTabla.value = false
  }
}

function ponModo(m) {
  if (modo.value === m) return
  modo.value = m
  if (m === 'semana') {
    if (datosSemana.value || semanaNum.value != null) cargarSemana()
  } else if (!pendientesMes.value.filas.length && pendientesMes.value.total === 0) {
    cargarPendientesMes()
  }
}

function ponEstado(estado) {
  estadoTabla.value = estado
  foco.value = 'todos'
  if (estado === 'contestados' && contestadasTodas.value == null) cargarContestados()
  if (estado === 'pendientes' && modo.value === 'mes' && !pendientesMes.value.filas.length) cargarPendientesMes()
}

const puedeMesAnterior = computed(() => anio.value > 2020 || mes.value > 1)
const puedeMesSiguiente = computed(() => anio.value * 12 + mes.value < hoyA * 12 + hoyM)

function mesAnterior() {
  if (mes.value === 1) { anio.value -= 1; mes.value = 12 } else mes.value -= 1
  cargarTodo()
}
function mesSiguiente() {
  if (mes.value === 12) { anio.value += 1; mes.value = 1 } else mes.value += 1
  cargarTodo()
}

onMounted(() => {
  cargarTodo()
  if (esLiderGeneral.value) {
    AreasAPI.listar()
      .then((data) => { areas.value = data })
      .catch(() => {}) // sin áreas el selector queda en "Todas"; la vista sigue operativa
  }
})
</script>

<style scoped>
.vista-informes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Cabecera ── */
.cabecera-vista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.cabecera-titulos h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
}
.subtitulo {
  margin: 2px 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.cabecera-controles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nav-mes {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--card-bg);
  overflow: hidden;
}
.nav-mes button {
  border: none;
  background: transparent;
  color: var(--acuasan-blue);
  font-size: 0.95rem;
  font-weight: 800;
  padding: 5px 10px;
  cursor: pointer;
}
.nav-mes button:hover:not(:disabled) {
  background: var(--bg-main);
}
.nav-mes button:disabled {
  color: var(--text-muted);
  opacity: 0.45;
  cursor: default;
}
.nav-mes-etiqueta {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-main);
  padding: 0 8px;
  min-width: 118px;
  text-align: center;
}
.btn-datos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--acuasan-blue);
  border-radius: 9px;
  background: var(--acuasan-blue);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 7px 12px;
  cursor: pointer;
}
.btn-datos:hover:not(:disabled) {
  filter: brightness(1.08);
}
.btn-datos:disabled {
  opacity: 0.6;
  cursor: default;
}
.seg {
  display: inline-flex;
  gap: 3px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  padding: 3px;
}
.seg button {
  border: none;
  background: transparent;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 5px 11px;
  cursor: pointer;
  white-space: nowrap;
}
.seg button.activo {
  background: var(--card-bg);
  color: var(--acuasan-blue);
  box-shadow: 0 1px 4px rgba(2, 31, 58, 0.12);
}
.select-semana,
.select-control {
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 6px 8px;
  cursor: pointer;
  max-width: 220px;
}
.banner-error {
  margin: 0;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.banner-error button {
  border: 1px solid var(--acuasan-red-dark, #b91c1c);
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 10px;
  cursor: pointer;
}

/* ── Línea 1: cuadros ── */
.linea-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
  gap: 10px;
}
.cuadro {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cuadro-principal {
  border-left: 4px solid var(--acuasan-blue);
}
.cuadro-etiqueta {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.cuadro-cifra {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.1;
}
.cuadro-grande {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.1;
}
.cuadro-grande--bien {
  color: var(--acuasan-green-text, #166534);
}
.cuadro-grande--mal {
  color: var(--acuasan-red-dark, #b91c1c);
}
.cifra-roja {
  color: var(--acuasan-red-dark, #b91c1c);
}
.cuadro-nota {
  font-size: 0.66rem;
  color: var(--text-muted);
}
.barra-progreso {
  height: 5px;
  border-radius: 999px;
  background: var(--bg-main);
  overflow: hidden;
}
.barra-progreso span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--acuasan-blue);
}

/* ── Franja por área / encargado ── */
.franja-grupos {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  padding: 12px 14px;
}
.franja-titulo {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 8px;
}
.grupos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.grupo {
  display: grid;
  grid-template-columns: minmax(110px, 200px) 1fr 56px minmax(180px, auto);
  align-items: center;
  gap: 10px;
}
.grupo-nombre {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grupo-barra {
  height: 7px;
  border-radius: 999px;
  background: var(--bg-main);
  overflow: hidden;
}
.grupo-barra span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--acuasan-blue);
}
.grupo-pct {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--acuasan-blue);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.grupo-datos {
  font-size: 0.66rem;
  color: var(--text-muted);
  text-align: right;
}

/* ── Línea 2: gráfica + explicación ── */
.linea-visual {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}
.panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  padding: 14px 16px;
}
.panel-titulo {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 10px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.panel-sub {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--text-muted);
}
.grafica {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grafica-cuerpo {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 170px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0;
}
.punto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
}
.punto.inhabil {
  opacity: 0.4;
}
.columnas {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  flex: 1;
}
.col {
  width: 42%;
  max-width: 26px;
  border-radius: 4px 4px 0 0;
  transition: height 0.2s ease;
}
.col-enviados {
  background: var(--acuasan-blue);
}
.col-contestados {
  background: var(--acuasan-green, #059669);
}
.punto:hover .col {
  filter: brightness(1.12);
}
.punto-etiqueta {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: center;
  padding-top: 5px;
  white-space: nowrap;
}
.leyenda {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.leyenda i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
}
.i-enviados {
  background: var(--acuasan-blue);
}
.i-contestados {
  background: var(--acuasan-green, #059669);
}
.leyenda-nota {
  font-weight: 600;
  opacity: 0.85;
}
.definiciones {
  margin: 0 0 10px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
}
.definiciones dt {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--acuasan-blue);
}
.definiciones dd {
  margin: 0;
  font-size: 0.7rem;
  color: var(--text-muted);
}
.lectura h4 {
  margin: 0 0 6px;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-main);
}
.lectura ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lectura li {
  font-size: 0.7rem;
  color: var(--text-muted);
}
.nota-periodos {
  margin: 10px 0 0;
  border-top: 1px dashed var(--border-color);
  padding-top: 8px;
  font-size: 0.66rem;
  color: var(--text-muted);
}

/* ── Línea 3: plantilla ── */
.panel-tabla {
  overflow-x: auto;
}
.tabla-controles {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.chip-area {
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--bg-main);
  color: var(--text-main);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 6px 10px;
}
.tabla-contexto {
  margin: 0 0 8px;
  font-size: 0.68rem;
  color: var(--text-muted);
}
.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}
.tabla thead th {
  text-align: left;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  padding: 6px 8px;
  white-space: nowrap;
}
.tabla tbody td {
  border-bottom: 1px solid var(--border-color);
  padding: 7px 8px;
  color: var(--text-main);
  vertical-align: middle;
}
.tabla tbody tr:hover {
  background: var(--bg-main);
}
.td-asunto {
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.td-area,
.td-encargado {
  font-size: 0.68rem;
  color: var(--text-muted);
  white-space: nowrap;
}
.td-fecha {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.enlace-radicado {
  color: var(--acuasan-blue);
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}
.enlace-radicado:hover {
  text-decoration: underline;
}
.chip-atraso {
  display: inline-block;
  border-radius: 999px;
  background: var(--acuasan-red-light, #fef2f2);
  border: 1px solid #fca5a5;
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 8px;
  white-space: nowrap;
}
.chip-plazo {
  display: inline-block;
  border-radius: 999px;
  background: var(--acuasan-green-light, #f0fdf4);
  border: 1px solid #bbf7d0;
  color: var(--acuasan-green-text, #166534);
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 8px;
  white-space: nowrap;
}
.chip-resultado {
  display: inline-block;
  border-radius: 999px;
  background: var(--acuasan-green-light, #f0fdf4);
  border: 1px solid #bbf7d0;
  color: var(--acuasan-green-text, #166534);
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 8px;
  white-space: nowrap;
}
.chip-resultado--retraso {
  background: var(--acuasan-yellow-light, #fefce8);
  border-color: #fde68a;
  color: var(--acuasan-amber-text, #b45309);
}
.chip-prioridad {
  display: inline-block;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 7px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--bg-main);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}
.chip-prioridad--alta {
  background: var(--acuasan-red-light, #fef2f2);
  border-color: #fca5a5;
  color: var(--acuasan-red-dark, #b91c1c);
}
.chip-prioridad--media {
  background: var(--acuasan-yellow-light, #fefce8);
  border-color: #fde68a;
  color: var(--acuasan-amber-text, #b45309);
}
.c-vacia {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.75rem;
  padding: 16px 8px;
}
.btn-mas {
  display: block;
  margin: 10px auto 0;
  border: 1px solid var(--acuasan-blue);
  border-radius: 9px;
  background: transparent;
  color: var(--acuasan-blue);
  font-size: 0.7rem;
  font-weight: 800;
  padding: 6px 16px;
  cursor: pointer;
}
.btn-mas:hover:not(:disabled) {
  background: var(--bg-main);
}
.btn-mas:disabled {
  opacity: 0.6;
  cursor: default;
}

/* ── Responsive ── */
@media (max-width: 980px) {
  .linea-visual {
    grid-template-columns: 1fr;
  }
  .grupo {
    grid-template-columns: minmax(100px, 1fr) 56px;
  }
  .grupo-barra,
  .grupo-datos {
    display: none;
  }
}
</style>
