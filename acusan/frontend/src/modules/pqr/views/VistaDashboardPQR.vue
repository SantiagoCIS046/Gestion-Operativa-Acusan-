<script setup>
/**
 * VistaDashboardPQR — Consola de operación del módulo PQR.
 *
 * Estructura semántica HTML5:
 *  <header>  título + badge de alertas en vivo (Socket.io → pqrStore)
 *  <section> 4 tarjetas de métricas en CSS Grid auto-fit
 *  <section> cola de alertas de handoff pendientes
 *  <section> listado + expediente en dos paneles (CSS Grid):
 *            izquierda la tabla compacta, derecha el expediente SIEMPRE
 *            visible con toda la info que la IA extrajo del WhatsApp
 *  <router-view> anida la vista de atención en vivo (ruta hija)
 *
 * El expediente no se esconde detrás de interacciones: al cargar queda
 * seleccionada la primera PQR y cada clic de fila actualiza el panel.
 * Los datos del ciudadano se completan con el perfil histórico
 * (UsuarioPQR) cuando el radicado propio no los trae.
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import { usePqrStore } from '../../../stores/pqrStore'
import pqrService from '../services/pqrService.js'

const route = useRoute()
const router = useRouter()
const pqrStore = usePqrStore()

const cargando = ref(true)
const errorCarga = ref(null)
const busqueda = ref('')
const filtroEstado = ref('')
const filtroMotivo = ref('')
const seleccionada = ref(null)
const panelDetalle = ref(null)
// True cuando obtenerTodas sirvió el espejo local (backend caído): la vista
// lo anuncia en lugar de presentar la caché como si fuera el estado actual
const modoCache = ref(false)

const mostrandoAtencion = computed(() => route.name === 'AtencionEnVivo')

const MOTIVOS_CANONICOS = ['ACUEDUCTO', 'ALCANTARILLADO', 'ASEO']

const pqrsFiltradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  const lista = pqrStore.pqrsRecientes.filter(p => {
    const coincideTexto =
      !q ||
      String(p.radicado || '').toLowerCase().includes(q) ||
      String(p.usuario || '').toLowerCase().includes(q) ||
      String(p.direccion || '').toLowerCase().includes(q) ||
      String(p.telefono || '').includes(q) ||
      String(p.motivo || '').toLowerCase().includes(q) ||
      String(p.descripcion || '').toLowerCase().includes(q)
    const coincideEstado = !filtroEstado.value || p.estado === filtroEstado.value
    const coincideMotivo = !filtroMotivo.value || p.motivo === filtroMotivo.value
    return coincideTexto && coincideEstado && coincideMotivo
  })

  // Orden defensivo: fechaRadicado (schema) con fallback createdAt (provisionales)
  return [...lista].sort(
    (a, b) => new Date(b.fechaRadicado || b.createdAt || 0) - new Date(a.fechaRadicado || a.createdAt || 0)
  )
})

// El filtro de motivo lista los canónicos + los que realmente existan en los datos
const motivosFiltro = computed(() => {
  const extra = [...new Set(
    pqrStore.pqrsRecientes
      .map(p => p.motivo)
      .filter(Boolean)
      .filter(m => !MOTIVOS_CANONICOS.includes(m))
  )]
  return [...MOTIVOS_CANONICOS, ...extra.slice(0, 5)]
})

// Selección siempre válida: si la fila seleccionada sale del filtro,
// la primera del listado toma su lugar (el expediente nunca queda en blanco)
watch(pqrsFiltradas, (lista) => {
  if (!lista.length) {
    seleccionada.value = null
    return
  }
  const clave = seleccionada.value?.id || seleccionada.value?.radicado
  if (!clave || !lista.some(p => (p.id || p.radicado) === clave)) {
    seleccionada.value = lista[0]
  }
})

const ESTADOS = [
  { valor: 'ABIERTO', clase: 'text-bg-warning' },
  { valor: 'EN_TRAMITE', clase: 'text-bg-info' },
  { valor: 'RESUELTO', clase: 'text-bg-success' },
  { valor: 'ANULADO', clase: 'text-bg-danger' }
]

const claseEstado = (estado) =>
  ESTADOS.find(e => e.valor === estado)?.clase || 'text-bg-secondary'

const esMotivoCanonico = (motivo) => MOTIVOS_CANONICOS.includes(motivo)

const claseMotivo = (motivo) => {
  if (motivo === 'ACUEDUCTO') return 'text-bg-primary'
  if (motivo === 'ALCANTARILLADO') return 'text-bg-dark'
  if (motivo === 'ASEO') return 'text-bg-success'
  return 'text-bg-secondary'
}

const clasePrioridad = (prioridad) => {
  if (prioridad === 'URGENTE') return 'text-bg-danger'
  if (prioridad === 'ALTA') return 'text-bg-warning'
  if (prioridad === 'BAJA') return 'text-bg-light border'
  return 'text-bg-secondary'
}

const formatearFecha = (f) => (f ? moment(f).format('DD/MM/YYYY HH:mm') : '—')

/** Días restantes del término legal (null si no aplica) */
const diasParaVencer = (pqr) => {
  if (!pqr.fechaVencimiento || pqr.estado === 'RESUELTO' || pqr.estado === 'ANULADO') return null
  return moment(pqr.fechaVencimiento).diff(moment(), 'days')
}

const claseVencimiento = (pqr) => {
  const dias = diasParaVencer(pqr)
  if (dias === null) return 'text-bg-secondary'
  if (dias < 0) return 'text-bg-danger'
  if (dias <= 3) return 'text-bg-warning'
  return 'text-bg-success'
}

const etiquetaVencimiento = (pqr) => {
  const dias = diasParaVencer(pqr)
  if (dias === null) return 'No aplica'
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} d`
  if (dias === 0) return 'Vence hoy'
  return `${dias} d restantes`
}

/**
 * Remitente del radicado: ¿lo registró la IA o un operador humano?
 * Se deduce del actor del primer evento del historial:
 *  - 'WhatsApp Bot' con teléfono/perfil → asistente de IA por WhatsApp
 *  - 'WhatsApp Bot' legado sin teléfono → radicado manual de ventanilla
 *    (antes de que el controlador enviara actor explícito, TODO nacía IA)
 *  - email del operador / 'Ventanilla' → radicado manual
 */
const remitentePQR = (pqr) => {
  const actor = pqr.historial?.[0]?.actor
  if (actor === 'WhatsApp Bot') {
    if (pqr.telefono || pqr.usuarioPqr) {
      return { corto: '🤖 IA', detalle: 'Asistente de IA por WhatsApp', clase: 'text-bg-primary' }
    }
    return { corto: '👤 Operador', detalle: 'Radicado manual (ventanilla)', clase: 'text-bg-secondary' }
  }
  if (actor && actor !== 'Ventanilla') {
    return { corto: '👤 Operador', detalle: `Operador: ${actor}`, clase: 'text-bg-secondary' }
  }
  return { corto: '👤 Operador', detalle: 'Radicado en ventanilla', clase: 'text-bg-secondary' }
}

/**
 * Dato del ciudadano: el del radicado manda; si falta, se completa con el
 * perfil histórico (UsuarioPQR acumula lo aprendido de PQRs anteriores).
 * Devuelve { valor, delPerfil } para marcar honestamente el origen del dato.
 */
const datoCiudadano = (pqr, campo, campoPerfil) => {
  const directo = pqr[campo]
  if (typeof directo === 'string' && directo.trim()) return { valor: directo, delPerfil: false }
  const perfil = pqr.usuarioPqr?.[campoPerfil]
  if (typeof perfil === 'string' && perfil.trim()) return { valor: perfil, delPerfil: true }
  return { valor: null, delPerfil: false }
}

const datosCiudadano = (pqr) => [
  { etiqueta: 'Nombre', ...datoCiudadano(pqr, 'usuario', 'nombre') },
  { etiqueta: 'Cédula / NIT', ...datoCiudadano(pqr, 'cedulaNit', 'cedulaNit') },
  { etiqueta: 'WhatsApp', ...datoCiudadano(pqr, 'telefono', 'telefono'), telefono: true },
  { etiqueta: 'Email', ...datoCiudadano(pqr, 'email', 'email') },
  { etiqueta: 'Dirección', ...datoCiudadano(pqr, 'direccion', 'direccion') },
  { etiqueta: 'Matrícula / Cuenta', valor: pqr.matricula || null, delPerfil: false }
]

/**
 * Validación de lo extraído: obligatorios = contrato del asistente de IA;
 * complementarios = mejoran la gestión pero no bloquean el radicado.
 * Se validan los datos efectivamente disponibles (radicado + perfil).
 */
const validacionDatos = (pqr) => {
  const tiene = (campo, campoPerfil) => {
    const { valor } = datoCiudadano(pqr, campo, campoPerfil)
    return !!valor
  }
  return [
    { campo: 'Nombre', obligatorio: true, presente: tiene('usuario', 'nombre') },
    { campo: 'WhatsApp', obligatorio: true, presente: tiene('telefono', 'telefono') },
    { campo: 'Dirección', obligatorio: true, presente: tiene('direccion', 'direccion') },
    { campo: 'Motivo', obligatorio: true, presente: !!pqr.motivo?.trim() },
    { campo: 'Descripción', obligatorio: true, presente: !!pqr.descripcion?.trim() },
    { campo: 'Email', obligatorio: false, presente: tiene('email', 'email') },
    { campo: 'Cédula/NIT', obligatorio: false, presente: tiene('cedulaNit', 'cedulaNit') },
    { campo: 'Matrícula', obligatorio: false, presente: !!pqr.matricula?.trim() }
  ]
}

const estaSeleccionada = (pqr) =>
  !!seleccionada.value &&
  (pqr.id || pqr.radicado) === (seleccionada.value.id || seleccionada.value.radicado)

/** Marca de provisional offline: aún no publicada en el servidor central */
const esLocal = (pqr) => pqr.origen === 'LOCAL' || pqr.sincronizado === false

const atenderAlerta = (alerta) => {
  router.push({ name: 'AtencionEnVivo', params: { telefono: alerta.telefono } })
}

/**
 * Selecciona una fila y, en pantallas estrechas (expediente apilado bajo la
 * tabla), lo trae a la vista: sin esto el toque en móvil no muestra cambio
 * visible alguno porque el panel queda fuera del viewport.
 */
const seleccionar = (pqr) => {
  seleccionada.value = pqr
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1199.98px)').matches) {
    nextTick(() => panelDetalle.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

const cargarPqrsDelServidor = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const pqrs = await pqrService.obtenerTodas()
    modoCache.value = pqrService.origenUltimaCarga === 'CACHE'
    pqrStore.cargarPqrs(pqrs)
  } catch (e) {
    errorCarga.value = 'No fue posible cargar las PQR del servidor. Verifique su conexión.'
    console.error('[DashboardPQR]', e.message)
  } finally {
    cargando.value = false
  }
}

// Al volver de la atención en vivo el listado puede haber quedado viejo (el
// bot pudo radicar PQRs nuevas mientras se atendía): recargar al regresar.
watch(() => route.name, (nombre, anterior) => {
  if (anterior === 'AtencionEnVivo' && nombre !== 'AtencionEnVivo' && !mostrandoAtencion.value) {
    cargarPqrsDelServidor()
  }
})

onMounted(cargarPqrsDelServidor)
</script>

<template>
  <main class="container-fluid p-4 dashboard-pqr">
    <header class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h1 class="h4 mb-1"><span aria-hidden="true">📢</span> Dashboard PQR — Acuasan</h1>
        <p class="text-secondary mb-0 small">
          Trazabilidad de radicados y atención en tiempo real por WhatsApp
        </p>
      </div>
      <span
        v-if="pqrStore.alertasPendientes.length"
        class="badge text-bg-danger fs-6 posicion-alerta"
      >
        🚨 {{ pqrStore.alertasPendientes.length }} en espera de operador
      </span>
    </header>

    <!-- Métricas: CSS Grid responsivo, una tarjeta por métrica -->
    <section aria-label="Métricas generales" class="metricas-grid mb-4">
      <article class="card text-center h-100">
        <div class="card-body">
          <p class="card-text text-secondary small mb-1">Total recibidos</p>
          <p class="card-title fs-2 fw-bold mb-0">{{ pqrStore.metricasDashboard.totalRecibidos }}</p>
        </div>
      </article>
      <article class="card text-center h-100 border-warning">
        <div class="card-body">
          <p class="card-text text-secondary small mb-1">Pendientes</p>
          <p class="card-title fs-2 fw-bold text-warning mb-0">{{ pqrStore.metricasDashboard.pendientes }}</p>
        </div>
      </article>
      <article class="card text-center h-100 border-info">
        <div class="card-body">
          <p class="card-text text-secondary small mb-1">En proceso</p>
          <p class="card-title fs-2 fw-bold text-info mb-0">{{ pqrStore.metricasDashboard.enProceso }}</p>
        </div>
      </article>
      <article class="card text-center h-100 border-success">
        <div class="card-body">
          <p class="card-text text-secondary small mb-1">Resueltos</p>
          <p class="card-title fs-2 fw-bold text-success mb-0">{{ pqrStore.metricasDashboard.resueltos }}</p>
        </div>
      </article>
    </section>

    <!-- Alertas de handoff entrantes por WebSocket -->
    <section v-if="pqrStore.alertasPendientes.length" aria-label="Alertas de atención humana" class="mb-4">
      <h2 class="h6 text-uppercase text-secondary mb-2">Ciudadanos pidiendo operador humano</h2>
      <div class="d-flex flex-column gap-2">
        <article
          v-for="alerta in pqrStore.alertasPendientes"
          :key="alerta.telefono"
          class="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2 mb-0 py-2"
        >
          <div>
            <strong>{{ alerta.perfil || 'Ciudadano' }}</strong>
            <span class="text-secondary ms-2">+{{ alerta.telefono }}</span>
            <span class="badge text-bg-dark ms-2">{{ alerta.historial?.length || 0 }} mensajes</span>
          </div>
          <button class="btn btn-sm btn-outline-dark" @click="atenderAlerta(alerta)">
            Atender ahora
          </button>
        </article>
      </div>
    </section>

    <!-- Vista hija: atención en vivo (oculta el listado mientras se atiende).
         :key por teléfono — sin él, atender una segunda alerta reutiliza la
         instancia con el teléfono ANTERIOR y las respuestas saldrían al
         ciudadano equivocado. -->
    <router-view v-if="mostrandoAtencion" :key="route.params.telefono" />

    <section v-else aria-label="Listado y expediente de PQR" class="listado-expediente">
      <!-- ── Panel izquierdo: tabla compacta ─────────────────────────────── -->
      <div class="panel-lista">
        <div
          v-if="modoCache && !cargando"
          class="alert alert-warning d-flex align-items-center gap-2 py-2 small"
          role="status"
        >
          <span aria-hidden="true">📡</span>
          <span>
            Sin conexión con el servidor: mostrando el espejo local — la información
            puede estar desactualizada.
          </span>
        </div>

        <div class="d-flex flex-wrap gap-2 align-items-center mb-3 barra-filtros">
          <input
            v-model="busqueda"
            type="search"
            class="form-control"
            style="max-width: 300px"
            placeholder="🔍 Radicado, ciudadano, dirección, WhatsApp…"
            aria-label="Buscar PQR"
          >
          <select v-model="filtroEstado" class="form-select" style="max-width: 180px" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option v-for="e in ESTADOS" :key="e.valor" :value="e.valor">{{ e.valor }}</option>
          </select>
          <select v-model="filtroMotivo" class="form-select" style="max-width: 200px" aria-label="Filtrar por motivo">
            <option value="">Todos los motivos</option>
            <option v-for="m in motivosFiltro" :key="m" :value="m">{{ m }}</option>
          </select>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="cargando"
            aria-label="Actualizar listado"
            title="Actualizar listado"
            @click="cargarPqrsDelServidor"
          >
            {{ cargando ? '⏳' : '↻' }}
          </button>
          <span class="text-secondary small ms-auto">{{ pqrsFiltradas.length }} registro(s)</span>
        </div>

        <div v-if="cargando" class="d-flex justify-content-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando…</span>
          </div>
        </div>

        <div v-else-if="errorCarga" class="alert alert-danger" role="alert">{{ errorCarga }}</div>

        <div v-else class="table-responsive">
          <table class="table table-hover table-sm align-middle bg-white tabla-pqr">
            <caption class="visually-hidden">PQR radicadas — clic en una fila para ver su expediente completo</caption>
            <thead class="table-light">
              <tr>
                <th scope="col" class="ps-3">Radicado</th>
                <th scope="col">Ciudadano</th>
                <th scope="col">Dirección</th>
                <th scope="col">Motivo</th>
                <th scope="col">Remitente</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Estado</th>
                <th scope="col">Vence</th>
                <th scope="col"><span class="visually-hidden">Expediente</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!pqrsFiltradas.length">
                <td colspan="9" class="text-center text-secondary py-4">Sin resultados</td>
              </tr>

              <tr
                v-for="pqr in pqrsFiltradas"
                :key="pqr.id || pqr.radicado"
                :class="{ 'table-active': estaSeleccionada(pqr) }"
                :aria-selected="estaSeleccionada(pqr)"
                class="fila-pqr"
                tabindex="0"
                @click="seleccionar(pqr)"
                @keydown.enter.prevent="seleccionar(pqr)"
                @keydown.space.prevent="seleccionar(pqr)"
              >
                <th scope="row" class="ps-3 fw-semibold text-nowrap">
                  {{ pqr.radicado }}
                  <span
                    v-if="esLocal(pqr)"
                    class="badge text-bg-warning ms-1"
                    title="Provisional offline: aún no publicada en el servidor central"
                  >⏳ local</span>
                </th>
                <td>
                  <div class="fw-semibold text-truncate" style="max-width: 180px" :title="pqr.usuario">
                    {{ pqr.usuario || '—' }}
                  </div>
                  <div v-if="pqr.telefono" class="small text-secondary text-nowrap">📱 +{{ pqr.telefono }}</div>
                </td>
                <td>
                  <div class="small text-truncate" style="max-width: 160px" :title="pqr.direccion">
                    {{ pqr.direccion || '—' }}
                  </div>
                </td>
                <td>
                  <span v-if="esMotivoCanonico(pqr.motivo)" class="badge" :class="claseMotivo(pqr.motivo)">
                    {{ pqr.motivo }}
                  </span>
                  <span
                    v-else
                    class="small text-truncate d-inline-block align-middle"
                    style="max-width: 170px"
                    :title="pqr.motivo"
                  >
                    {{ pqr.motivo || '—' }}
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="remitentePQR(pqr).clase"
                    :title="remitentePQR(pqr).detalle"
                  >{{ remitentePQR(pqr).corto }}</span>
                </td>
                <td><span class="badge" :class="clasePrioridad(pqr.prioridad || 'MEDIA')">{{ pqr.prioridad || 'MEDIA' }}</span></td>
                <td><span class="badge" :class="claseEstado(pqr.estado)">{{ pqr.estado }}</span></td>
                <td>
                  <span class="badge" :class="claseVencimiento(pqr)">{{ etiquetaVencimiento(pqr) }}</span>
                </td>
                <td class="pe-3" :class="estaSeleccionada(pqr) ? 'text-primary' : 'text-secondary'" aria-hidden="true">▸</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Panel derecho: expediente SIEMPRE visible ───────────────────── -->
      <aside ref="panelDetalle" class="panel-detalle" aria-label="Expediente de la PQR seleccionada">
        <div v-if="!seleccionada" class="card text-secondary">
          <div class="card-body text-center py-5">
            <p class="mb-0">Seleccione una PQR del listado para ver su expediente completo.</p>
          </div>
        </div>

        <template v-else>
          <header class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <div>
              <h2 class="h5 mb-0">
                <span aria-hidden="true">📁</span> {{ seleccionada.radicado }}
                <span
                  v-if="esLocal(seleccionada)"
                  class="badge text-bg-warning ms-1 align-middle"
                  title="Provisional offline: aún no publicada en el servidor central"
                >⏳ local</span>
              </h2>
              <p class="text-secondary small mb-0">
                Radicada {{ formatearFecha(seleccionada.fechaRadicado || seleccionada.createdAt) }}
                · {{ remitentePQR(seleccionada).detalle }}
              </p>
            </div>
            <span class="badge" :class="claseEstado(seleccionada.estado)">{{ seleccionada.estado }}</span>
          </header>

          <!-- Datos del ciudadano extraídos por la IA (+ perfil histórico) -->
          <section aria-label="Datos del ciudadano" class="card mb-2">
            <header class="card-header fw-semibold py-2"><span aria-hidden="true">👤</span> Ciudadano</header>
            <dl class="card-body mb-0 small dl-ficha">
              <template v-for="dato in datosCiudadano(seleccionada)" :key="dato.etiqueta">
                <dt>{{ dato.etiqueta }}</dt>
                <dd>
                  <template v-if="dato.valor">
                    {{ dato.telefono ? '+' : '' }}{{ dato.valor }}
                    <span v-if="dato.delPerfil" class="text-secondary fst-italic">(perfil histórico)</span>
                  </template>
                  <template v-else>—</template>
                </dd>
              </template>
            </dl>
          </section>

          <!-- Reporte y control legal -->
          <section aria-label="Reporte y control legal" class="card mb-2">
            <header class="card-header fw-semibold py-2"><span aria-hidden="true">📝</span> Reporte</header>
            <div class="card-body small">
              <p class="mb-2">
                <span v-if="esMotivoCanonico(seleccionada.motivo)" class="badge me-1" :class="claseMotivo(seleccionada.motivo)">{{ seleccionada.motivo }}</span>
                <span v-else class="text-secondary me-1">{{ seleccionada.motivo || 'Sin motivo' }}</span>
                <span class="badge me-1" :class="clasePrioridad(seleccionada.prioridad || 'MEDIA')">{{ seleccionada.prioridad || 'MEDIA' }}</span>
              </p>
              <p class="mb-2 texto-reporte">{{ seleccionada.descripcion || '— sin descripción —' }}</p>
              <dl class="row mb-0">
                <dt class="col-5 text-secondary fw-normal">Recibida</dt>
                <dd class="col-7">{{ formatearFecha(seleccionada.fechaRadicado || seleccionada.createdAt) }}</dd>
                <dt class="col-5 text-secondary fw-normal">Término legal</dt>
                <dd class="col-7">
                  {{ formatearFecha(seleccionada.fechaVencimiento) }}
                  <span class="badge ms-1" :class="claseVencimiento(seleccionada)">{{ etiquetaVencimiento(seleccionada) }}</span>
                </dd>
              </dl>
            </div>
          </section>

          <!-- Validación de los datos extraídos -->
          <section aria-label="Validación de datos" class="card mb-2">
            <header class="card-header fw-semibold py-2"><span aria-hidden="true">✅</span> Validación de datos</header>
            <div class="card-body small">
              <p class="fw-semibold mb-1">Esenciales</p>
              <div class="d-flex flex-wrap gap-1 mb-2">
                <span
                  v-for="v in validacionDatos(seleccionada).filter(v => v.obligatorio)"
                  :key="v.campo"
                  class="badge"
                  :class="v.presente ? 'text-bg-success' : 'text-bg-danger'"
                >
                  {{ v.presente ? '✓' : '✗' }} {{ v.campo }}
                </span>
              </div>
              <p class="fw-semibold mb-1">Complementarios</p>
              <div class="d-flex flex-wrap gap-1">
                <span
                  v-for="v in validacionDatos(seleccionada).filter(v => !v.obligatorio)"
                  :key="v.campo"
                  class="badge"
                  :class="v.presente ? 'text-bg-secondary' : 'text-bg-light border'"
                >
                  {{ v.presente ? '✓' : '—' }} {{ v.campo }}
                </span>
              </div>
              <p class="text-secondary mt-2 mb-0 fst-italic">
                Completitud de lo capturado al radicar. El asistente de IA exige los campos
                esenciales en WhatsApp; en un radicado de ventanilla pueden faltar y
                completarse al atender el caso.
              </p>
            </div>
          </section>

          <!-- Trazabilidad del historial de estados -->
          <section aria-label="Trazabilidad" class="card mb-0">
            <header class="card-header fw-semibold py-2"><span aria-hidden="true">🕓</span> Trazabilidad</header>
            <ol class="card-body mb-0 small list-unstyled linea-tiempo">
              <li v-for="(evento, i) in seleccionada.historial || []" :key="i" class="mb-2">
                <span class="badge text-bg-secondary me-1">{{ formatearFecha(evento.creadoEn) }}</span>
                <strong>{{ evento.actor }}</strong>:
                {{ evento.estadoAntes ? `${evento.estadoAntes} → ` : '' }}{{ evento.estadoDespues }}
                <!-- pre-wrap: la transcripción de la conversación con la IA
                     conserva sus saltos de línea -->
                <div v-if="evento.observaciones" class="text-secondary texto-reporte">{{ evento.observaciones }}</div>
              </li>
              <li v-if="!(seleccionada.historial || []).length" class="text-secondary">
                Sin eventos registrados.
              </li>
            </ol>
          </section>
        </template>
      </aside>
    </section>
  </main>
</template>

<style scoped>
/* Métricas: grid fluido — 4 tarjetas que se reacomodan solas en móvil */
.metricas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.posicion-alerta {
  animation: latido 1.6s ease-in-out infinite;
}

@keyframes latido {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

@media (prefers-reduced-motion: reduce) {
  .posicion-alerta {
    animation: none;
  }
}

/* Listado + expediente: dos paneles en escritorio, apilados en pantallas menores */
.listado-expediente {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(360px, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1199.98px) {
  .listado-expediente {
    grid-template-columns: 1fr;
  }

  .panel-detalle {
    position: static !important;
    max-height: none !important;
  }
}

.panel-detalle {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding-right: 0.25rem;
}

.barra-filtros {
  flex-wrap: wrap;
}

.fila-pqr {
  cursor: pointer;
}

/* Accesibilidad de teclado: la fila es seleccionable con Tab/Enter/Espacio */
.fila-pqr:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: -2px;
}

/* Fila seleccionada: barra lateral azul en las celdas (Bootstrap pinta las
   celdas con fondo opaco, así que un fondo en el tr no se vería) */
.tabla-pqr .table-active > * {
  box-shadow: inset 3px 0 0 #0d6efd;
}

.dl-ficha dt {
  float: left;
  clear: left;
  width: 8.5rem;
  color: #6c757d;
  font-weight: 600;
}

.dl-ficha dd {
  margin-left: 9rem;
  overflow-wrap: anywhere;
}

.texto-reporte {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
