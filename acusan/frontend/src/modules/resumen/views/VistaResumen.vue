<template>
  <section class="vista-resumen">
    <header class="cabecera-vista">
      <div>
        <h2>{{ esLiderGeneral ? 'Panel de control' : 'Panel de tu área' }}</h2>
        <p class="vista-sub">
          {{ esLiderGeneral
            ? 'Estado de los radicados en todas las áreas.'
            : `Rendimiento de ${areaPropia}: lo que recibes de gerencia y lo que entregas.` }}
        </p>
      </div>
      <div class="cabecera-acciones">
        <button type="button" class="btn-secundario" :disabled="cargando" @click="cargar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Actualizar
        </button>
        <button v-if="esLiderGeneral" type="button" class="btn-revision" @click="abrirRevision">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Revisar alertas
        </button>
      </div>
    </header>

    <div v-if="error" class="vista-error">
      <p>{{ error }}</p>
    </div>

    <!-- Avisos de cierre de periodo (informe semanal/mensual listo): gerencia -->
    <section v-if="esLiderGeneral && avisos.length" class="avisos-periodo" aria-label="Informes de periodo por revisar">
      <div v-for="a in avisos" :key="a.id" class="aviso-periodo">
        <div class="aviso-texto">
          <strong>{{ a.titulo }}</strong>
          <span>{{ a.mensaje }}</span>
        </div>
        <div class="aviso-acciones">
          <RouterLink to="/informes" class="aviso-ver">Ver informe</RouterLink>
          <button type="button" class="aviso-ok" :disabled="atendiendo === a.id" @click="atenderAviso(a)">Marcar revisado</button>
        </div>
      </div>
    </section>

    <template v-else>
      <!-- 6 indicadores: cada uno lleva al listado ya filtrado -->
      <nav class="kpis" aria-label="Indicadores del panel">
        <RouterLink class="kpi" :to="{ path: '/radicados', query: {} }">
          <span class="kpi-cifra">{{ kpis.total }}</span>
          <span class="kpi-etiqueta">{{ esLiderGeneral ? 'Radicados en total' : 'Radicados recibidos' }}</span>
          <span class="kpi-ver">Ver todos</span>
        </RouterLink>
        <RouterLink class="kpi kpi--rojo" :to="{ path: '/radicados', query: { estado: 'vencido' } }">
          <span class="kpi-cifra">{{ kpis.vencidos }}</span>
          <span class="kpi-etiqueta">Vencidos</span>
          <span class="kpi-ver">Ver vencidos</span>
        </RouterLink>
        <RouterLink class="kpi kpi--ambar" :to="{ path: '/radicados', query: { estado: 'por_vencer' } }">
          <span class="kpi-cifra">{{ kpis.porVencer }}</span>
          <span class="kpi-etiqueta">Por vencer (≤ 7 días)</span>
          <span class="kpi-ver">Ver por vencer</span>
        </RouterLink>
        <RouterLink class="kpi kpi--verde" :to="{ path: '/radicados', query: { estado: 'a_tiempo' } }">
          <span class="kpi-cifra">{{ kpis.respondidosATiempo }}</span>
          <span class="kpi-etiqueta">Entregados a tiempo</span>
          <span class="kpi-sub">{{ porcentaje(kpis.respondidosATiempo, kpis.total) }}% del total</span>
        </RouterLink>
        <RouterLink class="kpi kpi--cyan" :to="{ path: '/radicados', query: { estado: 'con_retraso' } }">
          <span class="kpi-cifra">{{ kpis.respondidosConRetraso }}</span>
          <span class="kpi-etiqueta">Entregados con retraso</span>
          <span class="kpi-ver">Ver con retraso</span>
        </RouterLink>
        <RouterLink class="kpi kpi--gris" :to="{ path: '/alertas' }">
          <span class="kpi-cifra">{{ kpis.alertasPendientes }}</span>
          <span class="kpi-etiqueta">Alertas sin atender</span>
          <span class="kpi-ver">Ir a alertas</span>
        </RouterLink>
      </nav>

      <div class="paneles">
        <!-- Próximos a vencer: ventanas de urgencia + los 8 más próximos -->
        <article class="panel">
          <h3 class="panel-titulo">Próximos a vencer</h3>
          <div class="ventanas">
            <NivelAlertaChip nivel="D1" />
            <span class="ventana-cifra">{{ ventanas.hasta1Dia }}</span>
            <NivelAlertaChip nivel="D3" />
            <span class="ventana-cifra">{{ ventanas.dias2a3 }}</span>
            <NivelAlertaChip nivel="D7" />
            <span class="ventana-cifra">{{ ventanas.dias4a7 }}</span>
          </div>

          <p v-if="!proximos.length" class="panel-vacio">
            No hay radicados por vencer en los próximos 7 días.
          </p>
          <RouterLink
            v-for="p in proximos"
            v-else
            :key="p.id"
            class="proximo"
            :to="{ path: '/radicados', query: { q: p.numeroRadicado } }"
            :title="`Ver ${p.asunto}`"
          >
            <span class="proximo-codigo">{{ p.numeroRadicado }}</span>
            <span class="proximo-nombre">
              {{ p.asunto }}
              <small v-if="p.categoria">· {{ p.categoria }}</small>
            </span>
            <span class="proximo-area">{{ p.area?.codigo }}</span>
            <span class="proximo-fecha">{{ fechaLarga(p.fechaLimite) }}</span>
            <RadicadoChip :estado="p.dias < 0 ? 'vencido' : 'por_vencer'" :dias-restantes="p.dias" />
          </RouterLink>
        </article>

        <!-- Categorías del alcance (conteo del backend) -->
        <article class="panel">
          <h3 class="panel-titulo">Categorías</h3>
          <p v-if="!categorias.length" class="panel-vacio">Aún no hay radicados en tu alcance.</p>
          <RouterLink
            v-for="c in categorias"
            v-else
            :key="c.categoria"
            class="categoria-fila"
            :to="{ path: '/radicados', query: { categoria: c.categoria } }"
          >
            <span class="categoria-etiqueta" :title="c.categoria">{{ c.categoria }}</span>
            <div class="categoria-barra">
              <div class="categoria-relleno" :style="{ width: porcentaje(c.total, maxCategoria) + '%' }"></div>
            </div>
            <span class="categoria-cifra">{{ c.total }}</span>
          </RouterLink>
        </article>
      </div>

      <!-- Ranking de áreas (solo lider_general): composición de plazos y
           respuestas, con reenvío de alertas por área -->
      <article v-if="esLiderGeneral" class="panel panel--ranking">
        <header class="ranking-cabecera">
          <h3 class="panel-titulo">Radicados por área</h3>
          <label class="orden-selector">
            Ordenar por:
            <select v-model="ordenRanking">
              <option value="total">Total</option>
              <option value="vencidos">Vencidos</option>
              <option value="porVencer">Por vencer</option>
              <option value="respondidosConRetraso">Con retraso</option>
            </select>
          </label>
        </header>

        <div class="leyenda">
          <span class="leyenda-item"><span class="punto punto--rojo"></span> Vencidos</span>
          <span class="leyenda-item"><span class="punto punto--ambar"></span> Por vencer</span>
          <span class="leyenda-item"><span class="punto punto--verde"></span> Pendientes en tiempo</span>
          <span class="leyenda-item"><span class="punto punto--cyan"></span> Respondidos</span>
          <span class="leyenda-nota">El largo de la barra es proporcional al total</span>
        </div>

        <div class="ranking-scroll">
          <div class="ranking-encabezados">
            <span>Área</span>
            <span>Composición</span>
            <span class="num">Total</span>
            <span class="num">Vencidos</span>
            <span class="num">Por vencer</span>
            <span class="num">A tiempo</span>
            <span class="num">Con retraso</span>
            <span class="acciones"></span>
          </div>

          <p v-if="!rankingOrdenado.length" class="panel-vacio">Aún no hay radicados.</p>

          <div v-for="fila in rankingOrdenado" v-else :key="fila.id" class="ranking-fila">
            <div class="ranking-nombre">
              <span class="ranking-codigo">{{ fila.codigo }}</span>
              <span class="ranking-titulo" :title="fila.nombre">{{ fila.nombre }}</span>
            </div>

            <div
              class="ranking-barra"
              :title="`${fila.total} en total: ${fila.vencidos} vencidos · ${fila.porVencer} por vencer · ${fila.enTiempo} pendientes en tiempo · ${fila.respondidos} respondidos`"
            >
              <div class="ranking-barra-interior" :style="{ width: pctBarra(fila.total) + '%' }">
                <span class="seg seg--rojo" :style="{ flexGrow: fila.vencidos || 0 }"></span>
                <span class="seg seg--ambar" :style="{ flexGrow: fila.porVencer || 0 }"></span>
                <span class="seg seg--verde" :style="{ flexGrow: fila.enTiempo || 0 }"></span>
                <span class="seg seg--cyan" :style="{ flexGrow: fila.respondidos || 0 }"></span>
              </div>
            </div>

            <span class="num num--fuerte">{{ fila.total }}</span>
            <span class="num num--rojo">{{ fila.vencidos }}</span>
            <span class="num num--ambar">{{ fila.porVencer }}</span>
            <span class="num">{{ fila.respondidosATiempo }}</span>
            <span class="num">{{ fila.respondidosConRetraso }}</span>

            <div class="ranking-acciones">
              <button
                type="button"
                class="btn-mini"
                :disabled="alertandoId === fila.id"
                :title="`Reenviar las alertas de ${fila.nombre}`"
                @click="alertarArea(fila)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {{ alertandoId === fila.id ? 'Alertando…' : 'Alertar' }}
              </button>
              <RouterLink class="btn-mini btn-mini--suave" :to="{ path: '/radicados', query: { area: fila.id } }">
                Ver radicados
              </RouterLink>
            </div>
          </div>
        </div>
      </article>

      <!-- Rendimiento del equipo (solo lider_area): qué lleva cada encargado
           del área — los radicados que recibió y los que entregó -->
      <article v-else-if="esLiderArea && equipoOrdenado.length" class="panel panel--ranking">
        <header class="ranking-cabecera">
          <h3 class="panel-titulo">Mi equipo — radicados por encargado</h3>
          <label class="orden-selector">
            Ordenar por:
            <select v-model="ordenEquipo">
              <option value="total">Total</option>
              <option value="vencidos">Vencidos</option>
              <option value="porVencer">Por vencer</option>
              <option value="entregadosConRetraso">Con retraso</option>
            </select>
          </label>
        </header>

        <div class="leyenda">
          <span class="leyenda-item"><span class="punto punto--rojo"></span> Vencidos</span>
          <span class="leyenda-item"><span class="punto punto--ambar"></span> Por vencer</span>
          <span class="leyenda-item"><span class="punto punto--verde"></span> Pendientes en tiempo</span>
          <span class="leyenda-item"><span class="punto punto--cyan"></span> Entregados</span>
          <span class="leyenda-nota">El largo de la barra es proporcional al total</span>
        </div>

        <div class="ranking-scroll">
          <div class="ranking-encabezados">
            <span>Encargado</span>
            <span>Composición</span>
            <span class="num">Total</span>
            <span class="num">Vencidos</span>
            <span class="num">Por vencer</span>
            <span class="num">A tiempo</span>
            <span class="num">Con retraso</span>
            <span class="acciones"></span>
          </div>

          <div v-for="fila in equipoOrdenado" :key="fila.id" class="ranking-fila">
            <div class="ranking-nombre">
              <span class="ranking-codigo" :class="{ 'ranking-codigo--inactivo': !fila.activo }">{{ fila.iniciales }}</span>
              <span class="ranking-titulo" :title="fila.nombre">
                {{ fila.nombre }}
                <small v-if="fila.rol === 'LIDER_AREA'" class="ranking-rol">líder</small>
                <small v-else-if="!fila.activo" class="ranking-rol ranking-rol--muted">inactivo</small>
              </span>
            </div>

            <div
              class="ranking-barra"
              :title="`${fila.total} en total: ${fila.vencidos} vencidos · ${fila.porVencer} por vencer · ${fila.enTiempo} pendientes en tiempo · ${fila.entregados} entregados`"
            >
              <div class="ranking-barra-interior" :style="{ width: pctBarraEquipo(fila.total) + '%' }">
                <span class="seg seg--rojo" :style="{ flexGrow: fila.vencidos || 0 }"></span>
                <span class="seg seg--ambar" :style="{ flexGrow: fila.porVencer || 0 }"></span>
                <span class="seg seg--verde" :style="{ flexGrow: fila.enTiempo || 0 }"></span>
                <span class="seg seg--cyan" :style="{ flexGrow: fila.entregados || 0 }"></span>
              </div>
            </div>

            <span class="num num--fuerte">{{ fila.total }}</span>
            <span class="num num--rojo">{{ fila.vencidos }}</span>
            <span class="num num--ambar">{{ fila.porVencer }}</span>
            <span class="num">{{ fila.entregadosATiempo }}</span>
            <span class="num">{{ fila.entregadosConRetraso }}</span>

            <div class="ranking-acciones">
              <RouterLink class="btn-mini btn-mini--suave" :to="{ path: '/radicados', query: { q: fila.nombre } }">
                Ver radicados
              </RouterLink>
            </div>
          </div>
        </div>
      </article>
    </template>

    <!-- Revisión global de alertas (solo lider_general; motor único) -->
    <Modal :model-value="modalRevision" ancho="lg" titulo="Revisar alertas" @update:model-value="modalRevision = $event">
      <div v-if="!resultadoRevision">
        <p class="revision-intro">
          Se revisan todos los radicados que vencen en 30 días o menos (incluidos los ya vencidos)
          y se crea una alerta por cada nivel nuevo (D30, D15, D7, D3, D1 y VENCIDO). Las alertas
          ya existentes no se duplican; los vencidos escalan a gerencia.
        </p>
        <p class="revision-nota">
          Para reenviar las de un área en particular, usa el botón «Alertar» de esa área en el ranking.
        </p>
      </div>

      <div v-else>
        <p class="revision-total">
          <strong>{{ resultadoRevision.nuevas }}</strong> alerta(s) nueva(s) ·
          <strong>{{ resultadoRevision.reenviadas }}</strong> reenviada(s)
        </p>
        <p v-if="!resultadoRevision.areas.length" class="panel-vacio">
          No hay radicados por vencer en ≤ 30 días: no se generaron alertas.
        </p>
        <div v-for="a in resultadoRevision.areas" :key="a.areaId" class="revision-area">
          <div class="revision-area-cabecera">
            <span class="ranking-codigo">{{ a.area.codigo }}</span>
            <strong class="revision-area-nombre">{{ a.area.nombre }}</strong>
            <span class="revision-cifras">
              {{ a.revisados }} revisados · {{ a.nuevas }} nuevas · {{ a.reenviadas }} reenviadas
            </span>
          </div>
          <p class="revision-notificados">
            Notificados — Líder: {{ a.notificados.lider ? a.notificados.lider.nombre : 'sin líder asignado' }}<template
              v-if="a.notificados.encargados?.length"
            > · Encargados: {{ a.notificados.encargados.map((u) => u.nombre).join(', ') }}</template><template
              v-if="a.notificados.gerencia"
            > · Gerencia notificada (vencidos)</template>
          </p>
        </div>
      </div>

      <template #acciones>
        <button type="button" class="btn-secundario" @click="cerrarRevision">Cerrar</button>
        <button v-if="!resultadoRevision" type="button" class="btn-primario" :disabled="ejecutando" @click="ejecutarRevision">
          {{ ejecutando ? 'Ejecutando…' : 'Ejecutar revisión' }}
        </button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

import { ResumenAPI } from '@/api/resumen.js'
import { AlertasAPI } from '@/api/alertas.js'
import { InformesAPI } from '@/api/informes.js'
import { useSesion } from '@/composables/useSesion.js'
import { useConteoAlertas } from '@/composables/useConteoAlertas.js'
import { useToast } from '@/composables/useToast.js'
import Modal from '@/components/Modal.vue'
import NivelAlertaChip from '@/components/NivelAlertaChip.vue'
import RadicadoChip from '@/components/RadicadoChip.vue'
import { fechaLarga } from '@/utils/fechas.js'

const sesion = useSesion()
const toast = useToast()
const conteo = useConteoAlertas()

const esLiderGeneral = computed(() => sesion.esLiderGeneral.value)
const esLiderArea = computed(() => sesion.esLiderArea.value)
// Nombre corto del área para los textos del líder ("Rendimiento de OPE…")
const areaPropia = computed(() => {
  const a = sesion.area.value
  return a ? `${a.nombre} (${a.codigo})` : 'tu área'
})

// Contrato de GET /api/resumen: { areas[], kpis{}, ventanas{},
// proximosAVencer[8], categorias[] } — el scope ya viene recortado por rol
const datos = ref(null)
const cargando = ref(false)
const error = ref('')
const ordenRanking = ref('total')

const EN_CERO = {
  total: 0, pendientes: 0, porVencer: 0, vencidos: 0,
  respondidosATiempo: 0, respondidosConRetraso: 0, alertasPendientes: 0,
}

const kpis = computed(() => ({ ...EN_CERO, ...(datos.value?.kpis || {}) }))

// Ventanas de urgencia: en cero mientras carga (datos parte en null)
const ventanas = computed(() => ({
  hasta1Dia: 0, dias2a3: 0, dias4a7: 0,
  ...(datos.value?.ventanas || {}),
}))

const proximos = computed(() => datos.value?.proximosAVencer || [])

const categorias = computed(() => datos.value?.categorias || [])
const maxCategoria = computed(() => Math.max(1, ...categorias.value.map((c) => c.total)))

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    datos.value = await ResumenAPI.obtener()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// Filas del ranking por área (solo lider_general); enTiempo son los
// pendientes que ni vencen pronto ni vencieron
const filasRanking = computed(() =>
  (datos.value?.areas || []).map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    total: a.total,
    vencidos: a.vencidos,
    porVencer: a.porVencer,
    enTiempo: Math.max(0, (a.pendientes || 0) - (a.vencidos || 0) - (a.porVencer || 0)),
    respondidos: (a.respondidosATiempo || 0) + (a.respondidosConRetraso || 0),
    respondidosATiempo: a.respondidosATiempo,
    respondidosConRetraso: a.respondidosConRetraso,
  })),
)

const rankingOrdenado = computed(() =>
  [...filasRanking.value].sort((a, b) => b[ordenRanking.value] - a[ordenRanking.value]),
)

const maxTotal = computed(() => Math.max(1, ...filasRanking.value.map((f) => f.total)))
const pctBarra = (n) => Math.round((n / maxTotal.value) * 100)

// ===== Mi equipo (solo lider_area): rendimiento por encargado =====
// El backend manda porEncargado con los conteos de cada encargado del área;
// enTiempo/entregados se derivan igual que en el ranking por áreas.
const INICIALES_DE = (nombre) =>
  (nombre || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '·'

const filasEquipo = computed(() =>
  (datos.value?.porEncargado || []).map((e) => ({
    ...e,
    iniciales: INICIALES_DE(e.nombre),
    enTiempo: Math.max(0, (e.pendientes || 0) - (e.vencidos || 0) - (e.porVencer || 0)),
    entregados: (e.entregadosATiempo || 0) + (e.entregadosConRetraso || 0),
  })),
)

const ordenEquipo = ref('total')
const equipoOrdenado = computed(() =>
  [...filasEquipo.value].sort(
    (a, b) => b[ordenEquipo.value] - a[ordenEquipo.value] || b.total - a.total,
  ),
)

const maxTotalEquipo = computed(() => Math.max(1, ...filasEquipo.value.map((f) => f.total)))
const pctBarraEquipo = (n) => Math.round((n / maxTotalEquipo.value) * 100)

// «Alertar» por área: reenvía con forzar (solo lider_general)
const alertandoId = ref('')
async function alertarArea(fila) {
  alertandoId.value = fila.id
  try {
    const r = await AlertasAPI.ejecutar({ areaId: fila.id, forzar: true })
    toast.exito(`${fila.codigo}: ${r.nuevas} alerta(s) nueva(s) y ${r.reenviadas} reenviada(s).`)
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    alertandoId.value = ''
  }
}

// Revisión global: modal con el resumen de la corrida del motor único
const modalRevision = ref(false)
const ejecutando = ref(false)
const resultadoRevision = ref(null)

function abrirRevision() {
  resultadoRevision.value = null
  modalRevision.value = true
}

async function ejecutarRevision() {
  ejecutando.value = true
  try {
    resultadoRevision.value = await AlertasAPI.ejecutar({})
    await conteo.cargar().catch(() => {})
  } catch (e) {
    toast.error(e.message)
  } finally {
    ejecutando.value = false
  }
}

function cerrarRevision() {
  if (resultadoRevision.value) cargar()
  modalRevision.value = false
}

// ── Avisos de cierre de periodo (solo gerencia) ──
const avisos = ref([])
const atendiendo = ref(null)
async function cargarAvisos() {
  if (!esLiderGeneral.value) return
  try {
    const d = await InformesAPI.avisos()
    avisos.value = (d.avisos || []).filter((a) => !a.atendido).slice(0, 4)
  } catch {
    avisos.value = []
  }
}
async function atenderAviso(a) {
  atendiendo.value = a.id
  try {
    await InformesAPI.atenderAviso(a.id)
    avisos.value = avisos.value.filter((x) => x.id !== a.id)
    toast.exito('Aviso marcado como revisado.')
  } catch (e) {
    toast.error(e.message)
  } finally {
    atendiendo.value = null
  }
}

onMounted(() => {
  cargar()
  cargarAvisos()
})
</script>

<style scoped>
.avisos-periodo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.aviso-periodo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--acuasan-blue-light);
  border: 1px solid #bae6fd;
  border-left: 4px solid var(--acuasan-blue);
  border-radius: 10px;
  padding: 10px 14px;
}

.aviso-texto {
  display: flex;
  flex-direction: column;
  font-size: 0.76rem;
  color: var(--acuasan-blue-dark);
}

.aviso-acciones {
  display: flex;
  gap: 6px;
}

.aviso-ver,
.aviso-ok {
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 6px 10px;
  cursor: pointer;
  text-decoration: none;
  border: 1px solid var(--acuasan-blue);
}

.aviso-ver {
  color: var(--acuasan-blue);
  background: #fff;
}

.aviso-ok {
  color: #fff;
  background: var(--acuasan-blue);
}

.aviso-ok:disabled {
  opacity: 0.6;
}

.cabecera-vista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.cabecera-vista h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 2px;
}

.vista-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

.cabecera-acciones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-secundario,
.btn-revision,
.btn-primario {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
}

.btn-secundario:hover:not(:disabled),
.btn-revision:hover:not(:disabled) {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.btn-secundario:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-revision {
  color: var(--acuasan-blue);
  border-color: #bae6fd;
  background: var(--acuasan-blue-light);
}

.btn-revision:hover:not(:disabled) {
  background: var(--acuasan-blue);
  color: #ffffff;
  border-color: var(--acuasan-blue);
}

.btn-primario {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #ffffff;
}

.btn-primario:hover:not(:disabled) {
  background: var(--acuasan-blue-dark);
  border-color: var(--acuasan-blue-dark);
}

.btn-primario:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.vista-error {
  background: var(--acuasan-red-light, #fef2f2);
  border: 1px solid #fca5a5;
  border-left: 4px solid var(--acuasan-red, #dc2626);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.8rem;
  font-weight: 600;
}

/* ===== Indicadores ===== */
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.kpi {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  position: relative;
  overflow: hidden;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: var(--border-color);
}

.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(2, 31, 58, 0.12);
}

.kpi--rojo::before { background: var(--acuasan-red, #dc2626); }
.kpi--ambar::before { background: var(--acuasan-yellow); }
.kpi--verde::before { background: var(--acuasan-green); }
.kpi--cyan::before { background: var(--acuasan-cyan); }
.kpi--gris::before { background: #94a3b8; }

.kpi-cifra {
  font-size: 1.7rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.1;
}

.kpi--rojo .kpi-cifra { color: var(--acuasan-red-dark, #b91c1c); }
.kpi--ambar .kpi-cifra { color: var(--acuasan-amber-text, #b45309); }
.kpi--verde .kpi-cifra { color: var(--acuasan-green-text, #166534); }
.kpi--gris .kpi-cifra { color: var(--text-muted); }

.kpi-etiqueta {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
}

.kpi-ver,
.kpi-sub {
  font-size: 0.66rem;
  font-weight: 700;
  margin-top: 2px;
}

.kpi-ver { color: var(--acuasan-blue); }
.kpi-sub { color: var(--acuasan-cyan); }

/* ===== Paneles ===== */
.paneles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
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
}

.panel-vacio {
  font-size: 0.76rem;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.ventanas {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px dashed var(--border-color);
}

.ventana-cifra {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text-main);
  margin-right: 4px;
}

.proximo {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr) 44px 84px auto;
  gap: 8px;
  align-items: center;
  padding: 6px 4px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.74rem;
  color: var(--text-main);
}

.proximo:hover {
  background: var(--acuasan-blue-light);
}

.proximo-codigo {
  font-weight: 800;
  color: var(--acuasan-blue);
  font-size: 0.7rem;
}

.proximo-nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proximo-nombre small {
  color: var(--text-muted);
  font-weight: 500;
}

.proximo-area {
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.68rem;
}

.proximo-fecha {
  color: var(--text-muted);
  font-size: 0.7rem;
  text-align: right;
}

/* Categorías */
.categoria-fila {
  display: grid;
  grid-template-columns: minmax(110px, auto) minmax(60px, 1fr) 34px;
  gap: 10px;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.74rem;
  color: var(--text-main);
}

.categoria-fila:hover {
  background: var(--acuasan-blue-light);
}

.categoria-etiqueta {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.categoria-barra {
  height: 8px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}

.categoria-relleno {
  height: 100%;
  border-radius: 999px;
  background: var(--acuasan-blue);
}

.categoria-cifra {
  font-weight: 800;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.punto {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.punto--rojo { background: var(--acuasan-red, #dc2626); }
.punto--ambar { background: var(--acuasan-yellow); }
.punto--verde { background: var(--acuasan-green); }
.punto--cyan { background: var(--acuasan-cyan); }

.seg--cyan { background: var(--acuasan-cyan); }

/* ===== Ranking ===== */
.panel--ranking {
  margin-bottom: 8px;
}

.ranking-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.orden-selector {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.orden-selector select {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 5px 8px;
  cursor: pointer;
}

.leyenda {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 8px 0 10px;
}

.leyenda-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
}

.leyenda-nota {
  font-size: 0.66rem;
  color: var(--text-muted);
  font-style: italic;
  margin-left: auto;
}

.ranking-scroll {
  overflow-x: auto;
}

.ranking-encabezados,
.ranking-fila {
  display: grid;
  grid-template-columns: minmax(150px, 1.25fr) minmax(140px, 1fr) 56px 68px 76px 72px 76px minmax(150px, auto);
  gap: 8px;
  align-items: center;
  min-width: 820px;
}

.ranking-encabezados {
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding: 6px 4px;
  border-bottom: 2px solid var(--border-color);
}

.ranking-fila {
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.74rem;
}

.ranking-fila:last-child {
  border-bottom: none;
}

.ranking-nombre {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.ranking-codigo {
  background: var(--acuasan-blue);
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  border-radius: 5px;
  padding: 2px 6px;
  white-space: nowrap;
}

/* Iniciales del encargado en "Mi equipo": gris cuando está inactivo */
.ranking-codigo--inactivo {
  background: #94a3b8;
}

/* Marca de rol junto al nombre del encargado */
.ranking-rol {
  font-size: 0.62rem;
  font-weight: 800;
  color: var(--acuasan-blue);
  text-transform: lowercase;
  margin-left: 4px;
}

.ranking-rol--muted {
  color: var(--text-muted);
}

.ranking-titulo {
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-barra {
  width: 100%;
  height: 12px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.ranking-barra-interior {
  height: 100%;
  display: flex;
  border-radius: 999px;
  overflow: hidden;
}

.seg {
  height: 100%;
}

.seg--rojo { background: var(--acuasan-red, #dc2626); }
.seg--ambar { background: var(--acuasan-yellow); }
.seg--verde { background: var(--acuasan-green); }

.num {
  text-align: center;
  font-weight: 700;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}

.num--fuerte { font-weight: 800; }
.num--rojo { color: var(--acuasan-red-dark, #b91c1c); }
.num--ambar { color: var(--acuasan-amber-text, #b45309); }

.ranking-acciones {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-mini {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #fca5a5;
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border-radius: 7px;
  font-size: 0.66rem;
  font-weight: 800;
  padding: 5px 9px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-mini:hover:not(:disabled) {
  background: var(--acuasan-red, #dc2626);
  border-color: var(--acuasan-red, #dc2626);
  color: #ffffff;
}

.btn-mini:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-mini--suave {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--acuasan-blue);
}

.btn-mini--suave:hover {
  background: var(--acuasan-blue-light);
  border-color: var(--acuasan-blue);
  color: var(--acuasan-blue);
}

/* ===== Modal de revisión ===== */
.revision-intro {
  font-size: 0.8rem;
  line-height: 1.55;
  margin: 0 0 8px;
}

.revision-nota {
  font-size: 0.74rem;
  color: var(--text-muted);
  margin: 0;
}

.revision-total {
  font-size: 0.86rem;
  margin: 0 0 12px;
  padding: 10px 12px;
  background: var(--acuasan-blue-light);
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.revision-area {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.revision-area-cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.revision-area-nombre {
  font-size: 0.78rem;
  color: var(--text-main);
}

.revision-cifras {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 700;
  margin-left: auto;
}

.revision-notificados {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 6px 0 0;
}
</style>
