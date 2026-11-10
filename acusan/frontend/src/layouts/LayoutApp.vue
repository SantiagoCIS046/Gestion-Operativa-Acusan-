<template>
  <div class="layout-app">
    <!-- Barra lateral institucional -->
    <aside class="sidebar" :class="{ 'sidebar--colapsada': sidebarColapsada }">
      <div class="sidebar-marca">
        <img src="/logo-acuasan.svg" alt="Acuasan" class="sidebar-logo" />
        <div class="sidebar-marca-texto">
          <span class="sidebar-marca-nombre">ACUASAN</span>
          <span class="sidebar-marca-modulo">Control de vencimientos</span>
        </div>
        <!-- Botón para ocultar/expandir la barra lateral -->
        <button
          type="button"
          class="btn-colapsar"
          :title="sidebarColapsada ? 'Expandir barra lateral' : 'Ocultar barra lateral'"
          :aria-label="sidebarColapsada ? 'Expandir barra lateral' : 'Ocultar barra lateral'"
          :aria-expanded="!sidebarColapsada"
          @click="alternarSidebar"
        >
          <svg v-if="sidebarColapsada" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in itemsVisibles"
          :key="item.ruta"
          :to="item.ruta"
          class="nav-item"
          :class="{ 'router-link-active': esActivo(item) }"
          :aria-label="item.etiqueta"
        >
          <span class="nav-icono" v-html="item.icono"></span>
          <span class="nav-texto">{{ item.etiqueta }}</span>
          <!-- Cuadro con el nombre del módulo (aparece al pasar el mouse en modo colapsado) -->
          <span class="nav-tooltip" aria-hidden="true">{{ item.etiqueta }}</span>
          <span
            v-if="item.ruta === '/alertas' && conteo.pendientes.value !== null"
            class="nav-badge"
            :class="conteo.pendientes.value > 0 ? 'nav-badge--rojo' : 'nav-badge--verde'"
          >
            {{ conteo.pendientes.value }}
          </span>
          <span
            v-if="item.ruta === '/usuarios' && solicitudes > 0"
            class="nav-badge nav-badge--rojo"
            :title="`${solicitudes} solicitud(es) de cuenta por aprobar`"
          >
            {{ solicitudes }}
          </span>
        </RouterLink>
      </nav>

      <div class="sidebar-pie">
        <span class="sidebar-pie-linea">Gestión Operativa</span>
        <span class="sidebar-pie-linea sutil">E.S.P.</span>
      </div>
    </aside>

    <!-- Zona principal -->
    <div class="principal">
      <header class="topbar">
        <div class="topbar-titulo">
          <h1>{{ tituloActual }}</h1>
          <span v-if="sesion.area.value" class="topbar-area">
            {{ sesion.esLiderGeneral.value ? 'Todas las áreas' : `${sesion.area.value.nombre} (${sesion.area.value.codigo})` }}
          </span>
        </div>

        <div class="topbar-usuario">
          <!-- Tira "Hoy": día de calendario con su clase (hábil/fin de
               semana/festivo) y el próximo festivo. Visible para TODOS los
               roles; en gerencia un clic lleva al calendario -->
          <div
            v-if="tira.hoy"
            class="tira-hoy"
            :class="{ 'tira-hoy--enlace': sesion.esLiderGeneral.value }"
            :title="tira.detalle"
            :role="sesion.esLiderGeneral.value ? 'button' : undefined"
            :tabindex="sesion.esLiderGeneral.value ? 0 : undefined"
            @click="irAlCalendario"
          >
            <span class="tira-hoy-fecha">{{ tira.fechaCorta }}</span>
            <span class="tira-hoy-tipo" :class="`tira-hoy-tipo--${tira.hoy.tipo}`">{{ tira.etiquetaTipo }}</span>
            <span v-if="tira.proximo" class="tira-hoy-proximo">Próx. festivo: {{ tira.proximo }}</span>
          </div>

          <!-- Campana de alertas pendientes: lleva a /alertas y se actualiza al atender -->
          <RouterLink to="/alertas" class="campana-topbar" :title="tituloCampana" :aria-label="tituloCampana">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span
              v-if="conteo.pendientes.value !== null"
              class="campana-conteo"
              :class="conteo.pendientes.value > 0 ? 'campana-conteo--rojo' : 'campana-conteo--ok'"
            >
              {{ conteo.pendientes.value }}
            </span>
          </RouterLink>
          <div class="sesion-pill" :title="sesion.usuario.value?.nombre">
            <div class="usuario-datos">
              <span class="usuario-nombre">{{ sesion.usuario.value?.nombre }}</span>
              <span class="usuario-rol">{{ sesion.etiquetaRol.value }}<template v-if="sesion.area.value && !sesion.esLiderGeneral.value"> · {{ sesion.area.value.codigo }}</template></span>
            </div>
            <div class="usuario-avatar" :aria-hidden="true">
              {{ iniciales }}
            </div>
          </div>
          <button
            type="button"
            class="btn-clave"
            title="Cambiar mi contraseña"
            aria-label="Cambiar mi contraseña"
            @click="modalClave = true"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </button>
          <button type="button" class="btn-salir" title="Cerrar sesión" @click="alSalir">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span class="btn-salir-texto">Salir</span>
          </button>
        </div>
      </header>

      <main class="contenido">
        <!-- vistaKey vuelve a montar la vista (p. ej. tras crear la contraseña
             personal, cuando antes el backend rechazaba sus consultas) -->
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="`${route.fullPath}#${vistaKey}`" />
        </router-view>
      </main>
    </div>

    <!-- Cambio de contraseña: voluntario (botón de la llave) u obligatorio
         cuando la cuenta entró con una contraseña temporal -->
    <CambiarPassword
      :model-value="modalClave || cambioObligatorio"
      :obligatorio="cambioObligatorio"
      @update:model-value="modalClave = $event"
      @cambiada="alCambiarClave"
      @salir="alSalir"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSesion } from '@/composables/useSesion.js'
import { useConteoAlertas } from '@/composables/useConteoAlertas.js'
import { CalendarioAPI } from '@/api/calendario.js'
import { UsuariosAPI } from '@/api/usuarios.js'
import CambiarPassword from '@/components/CambiarPassword.vue'

// Íconos inline (trazo, estilo del login) para no cargar una librería nueva
const ICONOS = {
  resumen:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  radicados:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  alertas:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  estructura:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendario:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  usuarios:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/><path d="M19 3l2 2-4 4"/></svg>',
  informes:
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
}

const route = useRoute()
const router = useRouter()
const sesion = useSesion()
const conteo = useConteoAlertas()

// Estado de la barra lateral: false = expandida (232px), true = colapsada (solo íconos)
const sidebarColapsada = ref(false)

function alternarSidebar() {
  sidebarColapsada.value = !sidebarColapsada.value
}

// Fusión: Radicados es el módulo único (absorbió a Archivos). El menú sigue
// al rol: gerencia lo ve todo; el líder de área arranca en su panel de
// rendimiento (Resumen) y trabaja con Radicados, Informes y Alertas; un
// usuario del área solo ve Radicados y Alertas. `roles` null = todos.
const NAV = [
  { ruta: '/resumen', etiqueta: 'Resumen', icono: ICONOS.resumen, roles: ['LIDER_GENERAL', 'LIDER_AREA'] },
  { ruta: '/radicados', etiqueta: 'Radicados', icono: ICONOS.radicados },
  { ruta: '/informes', etiqueta: 'Informes', icono: ICONOS.informes, roles: ['LIDER_GENERAL', 'LIDER_AREA'] },
  { ruta: '/alertas', etiqueta: 'Alertas', icono: ICONOS.alertas },
  { ruta: '/calendario', etiqueta: 'Calendario', icono: ICONOS.calendario, roles: ['LIDER_GENERAL'] },
  { ruta: '/estructura', etiqueta: 'Estructura', icono: ICONOS.estructura, roles: ['LIDER_GENERAL'] },
  { ruta: '/usuarios', etiqueta: 'Usuarios', icono: ICONOS.usuarios, roles: ['LIDER_GENERAL', 'LIDER_AREA'] },
]

const itemsVisibles = computed(() =>
  NAV.filter((i) => !i.roles || i.roles.includes(sesion.rol.value)),
)

const esActivo = (item) => route.path === item.ruta || route.path.startsWith(item.ruta + '/')

const tituloActual = computed(() => route.meta?.title || '')

const iniciales = computed(() => {
  const nombre = sesion.usuario.value?.nombre || ''
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '·'
  )
})

const tituloCampana = computed(() => {
  const n = conteo.pendientes.value
  if (n === null) return 'Alertas'
  return n === 1 ? '1 alerta pendiente — ver Alertas' : `${n} alertas pendientes — ver Alertas`
})

// ── Tira "Hoy" ──────────────────────────────────────────────
// Resumen del día bogotano (clase de día + próximo festivo) que vive en el
// topbar para todos los roles; un clic lleva al calendario.
const ETIQUETAS_TIPO = { habil: 'Día hábil', fin_de_semana: 'Fin de semana', festivo: 'Festivo' }
const hoy = ref(null)
const proximo = ref(null)

const tira = computed(() => {
  if (!hoy.value) return { hoy: null }
  const fecha = new Date(`${hoy.value.fecha}T12:00:00`)
  const fechaCorta = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(fecha).replace('.', '')
  const p = proximo.value
  return {
    hoy: hoy.value,
    fechaCorta,
    etiquetaTipo: ETIQUETAS_TIPO[hoy.value.tipo] || hoy.value.tipo,
    proximo: p ? `${p.nombre} (${p.faltanDias}d)` : '',
    detalle: hoy.value.nombreFestivo
      ? `${hoy.value.nombreFestivo}`
      : `Hoy: ${ETIQUETAS_TIPO[hoy.value.tipo] || hoy.value.tipo}`,
  }
})

function irAlCalendario() {
  if (sesion.esLiderGeneral.value) router.push('/calendario')
}

function alSalir() {
  sesion.salir()
  router.push('/login')
}

// ── Contraseña y solicitudes de cuenta ──────────────────────
const modalClave = ref(false)
const cambioObligatorio = computed(() => Boolean(sesion.usuario.value?.debeCambiarPassword))

const vistaKey = ref(0)

function alCambiarClave() {
  modalClave.value = false
  vistaKey.value++
  // Con la contraseña nueva, los datos del sistema ya se pueden cargar
  sesion.refrescar().catch(() => {})
  conteo.cargar()
  cargarSolicitudes()
}

// Solicitudes de autorregistro por aprobar (solo gerencia: badge del menú)
const solicitudes = ref(0)
function cargarSolicitudes() {
  if (!sesion.esLiderGeneral.value) return
  UsuariosAPI.listar({ estado: 'pendiente' })
    .then((d) => {
      solicitudes.value = d.solicitudesPendientes ?? 0
    })
    .catch(() => {})
}
// La vista Usuarios avisa cuando aprueba o rechaza una solicitud
onMounted(() => window.addEventListener('acuasan:solicitudes', cargarSolicitudes))
onUnmounted(() => window.removeEventListener('acuasan:solicitudes', cargarSolicitudes))

onMounted(() => {
  // Datos frescos del rol/área (best effort: si falla, seguimos con lo del login)
  sesion.refrescar().catch(() => {})
  conteo.cargar()

  // Tira "Hoy" (best effort: sin ella el topbar sigue normal)
  CalendarioAPI.hoy()
    .then((d) => {
      hoy.value = d
      proximo.value = d.proximoFestivo
    })
    .catch(() => {})
})
</script>

<style scoped>
.layout-app {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
}

/* ─────────────── Sidebar ─────────────── */
.sidebar {
  flex: 0 0 232px;
  width: 232px;
  background: linear-gradient(180deg, var(--acuasan-blue) 0%, var(--acuasan-blue-dark) 55%, #021f3a 100%);
  color: #d1e2f2;
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  min-height: 100vh;
  align-self: stretch;
  overflow-y: auto;
  overflow-x: hidden;
  /* Encima del contenido y del topbar: así los cuadros con el nombre del
     módulo no quedan tapados por el contenido al salir de la columna */
  z-index: 30;
  /* Al cambiar el ancho, la zona principal se amplía/encierra sola (flex) */
  transition: width 0.22s ease, flex-basis 0.22s ease;
}

/* ─────────────── Modo colapsado: solo íconos ─────────────── */
.sidebar--colapsada {
  flex-basis: 64px;
  width: 64px;
  /* deja salir los cuadros con el nombre del módulo */
  overflow: visible;
}

.sidebar-marca {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Misma altura que el topbar (12 + 36 + 12 + 1) para que ambas
     líneas divisorias queden al mismo nivel */
  min-height: 61px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition: padding 0.22s ease;
}

.sidebar--colapsada .sidebar-marca {
  flex-direction: column;
  gap: 8px;
  padding: 14px 8px 12px;
}

.sidebar--colapsada .sidebar-marca-texto {
  display: none;
}

/* Botón que oculta/expandir la columna lateral */
.btn-colapsar {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #c7dcf0;
  cursor: pointer;
  transition: all 0.16s ease;
}

.btn-colapsar:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.34);
  color: #ffffff;
}

.sidebar--colapsada .btn-colapsar {
  margin-left: 0;
}

.sidebar-logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}

.sidebar-marca-texto {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.sidebar-marca-nombre {
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #ffffff;
}

.sidebar-marca-modulo {
  font-size: 0.6rem;
  color: #9fc3e8;
  letter-spacing: 0.04em;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 10px;
}

.sidebar--colapsada .sidebar-nav {
  padding: 12px 8px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 9px;
  color: #c7dcf0;
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  border-left: 3px solid transparent;
  transition: all 0.16s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #ffffff;
}

.nav-item.router-link-active {
  background: rgba(115, 190, 40, 0.14);
  border-left-color: var(--acuasan-green);
  color: #ffffff;
}

/* Ítems en modo colapsado: ícono centrado, sin texto */
.sidebar--colapsada .nav-item {
  justify-content: center;
  gap: 0;
  padding: 11px 0;
}

.sidebar--colapsada .nav-item.router-link-active {
  border-left-color: transparent;
}

.sidebar--colapsada .nav-texto {
  display: none;
}

.nav-icono {
  display: flex;
  flex-shrink: 0;
}

.nav-texto {
  flex: 1;
  white-space: nowrap;
}

/* Cuadro pequeño con el nombre del módulo (solo visible en modo colapsado) */
.nav-tooltip {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%) translateX(-5px);
  background: #0d3a66;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 7px;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 60;
}

.nav-tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: #0d3a66;
}

.sidebar--colapsada .nav-item:hover .nav-tooltip,
.sidebar--colapsada .nav-item:focus-visible .nav-tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.nav-badge {
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 800;
}

.nav-badge--rojo {
  background: var(--acuasan-red, #dc2626);
  color: #ffffff;
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.55);
}

.nav-badge--verde {
  background: rgba(115, 190, 40, 0.25);
  color: #c9f2a4;
}

/* Insignia de alertas pegada al ícono cuando la columna está colapsada */
.sidebar--colapsada .nav-badge {
  position: absolute;
  top: 3px;
  right: 5px;
  min-width: 15px;
  height: 14px;
  padding: 0 3px;
  font-size: 0.56rem;
}

.sidebar-pie {
  margin-top: auto;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar--colapsada .sidebar-pie {
  display: none;
}

.sidebar-pie-linea {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9fc3e8;
}

.sidebar-pie-linea.sutil {
  color: #6f93b8;
  font-weight: 500;
}

/* ─────────────── Zona principal ─────────────── */
.principal {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 22px;
  /* Altura fija compartida con .sidebar-marca: sus líneas inferiores
     deben quedar al mismo nivel */
  min-height: 61px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  /* Si el ancho no alcanza, el grupo de sesión baja entero a una segunda
     fila en vez de recortarse contra el borde */
  flex-wrap: wrap;
  row-gap: 8px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.topbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--acuasan-green) 0%, var(--acuasan-blue) 60%, var(--acuasan-cyan) 100%);
}

.topbar-titulo {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.topbar-titulo h1 {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.2px;
  white-space: nowrap;
}

.topbar-area {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-usuario {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Tira "Hoy" del topbar (en gerencia es enlace al calendario) */
.tira-hoy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 11px;
  border-radius: 9px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
  transition: all 0.16s ease;
}

.tira-hoy--enlace {
  cursor: pointer;
}

.tira-hoy--enlace:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.tira-hoy-fecha {
  text-transform: capitalize;
  color: var(--text-main);
}

.tira-hoy-tipo {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;
}

.tira-hoy-tipo--habil {
  background: rgba(115, 190, 40, 0.16);
  color: #4d7c0f;
}

.tira-hoy-tipo--fin_de_semana {
  background: rgba(13, 58, 102, 0.12);
  color: var(--acuasan-blue);
}

.tira-hoy-tipo--festivo {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
}

.tira-hoy-proximo {
  font-weight: 600;
  font-size: 0.64rem;
}

@media (max-width: 1150px) {
  .tira-hoy-proximo {
    display: none;
  }
}

@media (max-width: 900px) {
  .tira-hoy {
    display: none;
  }
}

/* Campana de alertas del topbar */
.campana-topbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  transition: all 0.16s ease;
}

.campana-topbar:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.campana-conteo {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.campana-conteo--rojo {
  background: var(--acuasan-red, #dc2626);
  color: #ffffff;
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.55);
}

.campana-conteo--ok {
  background: rgba(115, 190, 40, 0.25);
  color: #4d7c0f;
}

/* Cápsula de sesión: agrupa nombre, rol y avatar en una sola pieza con
   fondo suave, para que el grupo no se vea como elementos sueltos */
.sesion-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 5px 8px 5px 12px;
  background: #f4f8fd;
  border: 1px solid var(--border-color);
  border-radius: 999px;
}

.usuario-datos {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  line-height: 1.25;
  min-width: 0;
}

.usuario-nombre {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usuario-rol {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--acuasan-blue);
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usuario-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--acuasan-blue) 0%, var(--acuasan-blue-dark) 100%);
  color: #a3e05c;
  font-size: 0.76rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgba(0, 72, 132, 0.25);
}

/* Pantallas muy angostas (o zoom alto): la cápsula queda solo en avatar */
@media (max-width: 640px) {
  .usuario-nombre,
  .usuario-rol {
    display: none;
  }

  .sesion-pill {
    padding: 4px;
    gap: 0;
  }
}

.btn-clave {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 11px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.btn-clave:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.btn-salir {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 11px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.btn-salir:hover {
  color: var(--acuasan-red-dark, #b91c1c);
  border-color: #fca5a5;
  background: var(--acuasan-red-light, #fef2f2);
}

.contenido {
  flex: 1;
  padding: 22px;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ─────────────── Responsive ─────────────── */
@media (max-width: 900px) {
  .layout-app {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .sidebar {
    width: 100%;
    flex: none;
    height: auto;
    min-height: auto;
    position: static;
  }

  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 8px 10px;
  }

  .nav-item {
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }

  .nav-item.router-link-active {
    border-bottom-color: var(--acuasan-green);
  }

  .sidebar-pie {
    display: none;
  }

  .topbar {
    flex-wrap: wrap;
  }

  /* En móvil la columna ya es una franja horizontal: se anula el colapso */
  .btn-colapsar {
    display: none;
  }

  .sidebar--colapsada {
    flex: none;
    width: 100%;
    overflow: visible;
  }

  .sidebar--colapsada .sidebar-marca {
    flex-direction: row;
    gap: 10px;
    padding: 18px 16px 14px;
  }

  .sidebar--colapsada .sidebar-marca-texto {
    display: flex;
  }

  .sidebar--colapsada .nav-item {
    justify-content: flex-start;
    gap: 10px;
    padding: 9px 12px;
  }

  .sidebar--colapsada .nav-texto {
    display: inline;
  }

  .sidebar--colapsada .nav-badge {
    position: static;
    min-width: 22px;
    height: 18px;
    padding: 0 6px;
    font-size: 0.66rem;
  }

  .btn-salir-texto {
    display: none;
  }

  .principal {
    height: auto;
    overflow: visible;
  }

  .contenido {
    padding: 16px;
    overflow: visible;
  }
}
</style>
