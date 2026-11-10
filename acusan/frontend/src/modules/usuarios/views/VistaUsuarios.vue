<template>
  <section class="vista-usuarios">
    <header class="cabecera-vista">
      <div>
        <h2>Usuarios</h2>
        <p class="vista-sub">
          {{ esLiderGeneral ? 'Cuentas de todas las áreas: crea, edita, activa o desactiva y restablece contraseñas.' : `Personas de tu área (${areaCodigo}): crea cuentas, desactívalas y restablece contraseñas.` }}
        </p>
      </div>
      <button type="button" class="btn-primario" @click="abrirNuevo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nuevo usuario
      </button>
    </header>

    <p v-if="!correoHabilitado && cargado" class="aviso-correo">
      El correo del sistema no está configurado: las contraseñas temporales se entregan en persona y las
      alertas no salen por correo. Ver README → “Correo”.
    </p>

    <!-- Solicitudes de autorregistro (solo gerencia) -->
    <section v-if="esLiderGeneral && solicitudes.length" class="panel panel--solicitudes" aria-label="Solicitudes de cuenta">
      <div class="panel-cabecera">
        <h3 class="panel-titulo">Solicitudes de cuenta por aprobar</h3>
        <span class="chip chip--ambar">{{ solicitudes.length }}</span>
      </div>
      <ul class="lista-solicitudes">
        <li v-for="u in solicitudes" :key="u.id" class="solicitud">
          <div>
            <strong>{{ u.nombre }}</strong>
            <span class="sutil">{{ u.email }} · pidió acceso el {{ fecha(u.creado) }}</span>
          </div>
          <div class="acciones-solicitud">
            <button type="button" class="btn-secundario" @click="abrirAprobar(u)">Aprobar…</button>
            <button type="button" class="btn-peligro-suave" @click="abrirRechazo(u)">Rechazar</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Filtros -->
    <div class="filtros">
      <input v-model="filtroTexto" type="search" placeholder="Buscar por nombre o correo…" aria-label="Buscar usuarios" />
      <select v-if="esLiderGeneral" v-model="filtroArea" aria-label="Filtrar por área">
        <option value="">Todas las áreas</option>
        <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
      </select>
      <select v-if="esLiderGeneral" v-model="filtroRol" aria-label="Filtrar por rol">
        <option value="">Todos los roles</option>
        <option v-for="(t, r) in ROLES" :key="r" :value="r">{{ t }}</option>
      </select>
      <select v-model="filtroEstado" aria-label="Filtrar por estado">
        <option value="">Activos e inactivos</option>
        <option value="activo">Solo activos</option>
        <option value="inactivo">Solo inactivos</option>
      </select>
    </div>

    <div class="conteos" aria-live="polite">
      <span class="chip">{{ filas.length }} persona(s)</span>
      <span class="chip chip--verde">{{ filas.filter((u) => u.estado === 'activo').length }} activas</span>
      <span class="chip chip--gris">{{ filas.filter((u) => u.estado === 'inactivo').length }} inactivas</span>
      <span v-if="filas.some((u) => u.debeCambiarPassword)" class="chip chip--azul">
        {{ filas.filter((u) => u.debeCambiarPassword).length }} con contraseña temporal
      </span>
    </div>

    <p v-if="error" class="vista-error" role="alert">{{ error }}</p>

    <div class="tabla-wrap">
      <table class="tabla-usuarios">
        <thead>
          <tr>
            <th scope="col">Persona</th>
            <th scope="col">Área</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col" class="num" title="Radicados pendientes a su cargo">Pendientes</th>
            <th scope="col">Último ingreso</th>
            <th scope="col" class="acciones">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando && !cargado">
            <td colspan="7" class="vacia">Cargando usuarios…</td>
          </tr>
          <tr v-else-if="!filas.length">
            <td colspan="7" class="vacia">No hay usuarios con estos filtros.</td>
          </tr>
          <tr v-for="u in filas" v-else :key="u.id" :class="{ 'fila-inactiva': u.estado === 'inactivo' }">
            <td>
              <div class="persona">
                <span class="avatar" aria-hidden="true">{{ iniciales(u.nombre) }}</span>
                <div>
                  <strong>{{ u.nombre }}</strong>
                  <span class="sutil">{{ u.email }}</span>
                </div>
              </div>
            </td>
            <td><span class="chip-area">{{ u.area?.codigo ?? '—' }}</span></td>
            <td>{{ ROLES[u.rol] ?? u.rol }}</td>
            <td>
              <span class="chip" :class="u.estado === 'activo' ? 'chip--verde' : 'chip--gris'">
                {{ u.estado === 'activo' ? 'Activo' : 'Inactivo' }}
              </span>
              <span v-if="u.bloqueado" class="chip chip--rojo" title="Bloqueado temporalmente por intentos fallidos">Bloqueado</span>
              <span v-else-if="u.debeCambiarPassword" class="chip chip--azul" title="Debe cambiar la contraseña temporal">Temporal</span>
            </td>
            <td class="num">
              <span :class="{ 'pendientes-alto': u.radicadosPendientes > 0 }">{{ u.radicadosPendientes }}</span>
            </td>
            <td class="sutil">{{ u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : 'Nunca' }}</td>
            <td class="acciones">
              <template v-if="u.id !== yoId">
                <button type="button" class="btn-icono" :title="`Editar ${u.nombre}`" :aria-label="`Editar ${u.nombre}`" @click="abrirEditar(u)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button
                  type="button"
                  class="btn-icono"
                  :title="`Restablecer contraseña de ${u.nombre}`"
                  :aria-label="`Restablecer contraseña de ${u.nombre}`"
                  @click="abrirReset(u)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                </button>
                <button
                  type="button"
                  class="btn-icono"
                  :class="u.activo ? 'btn-icono--peligro' : 'btn-icono--ok'"
                  :title="u.activo ? `Desactivar a ${u.nombre}` : `Activar a ${u.nombre}`"
                  :aria-label="u.activo ? `Desactivar a ${u.nombre}` : `Activar a ${u.nombre}`"
                  @click="u.activo ? abrirDesactivar(u) : activar(u)"
                >
                  <svg v-if="u.activo" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="4.9" y1="4.9" x2="19.1" y2="19.1" /></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
              </template>
              <span v-else class="sutil">Tú</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Crear / editar -->
    <Modal :model-value="modalUsuario" :titulo="editando ? `Editar a ${editando.nombre}` : 'Nuevo usuario'" ancho="md" @update:model-value="modalUsuario = $event">
      <form class="formulario" novalidate @submit.prevent="guardarUsuario">
        <div class="campo campo--ancho">
          <label for="u-nombre">Nombre completo *</label>
          <input id="u-nombre" v-model="form.nombre" type="text" maxlength="120" />
        </div>
        <div class="campo campo--ancho">
          <label for="u-email">Correo institucional *</label>
          <input id="u-email" v-model="form.email" type="email" maxlength="160" placeholder="nombre@acuasan.com" />
        </div>
        <template v-if="esLiderGeneral">
          <div class="campo">
            <label for="u-rol">Rol *</label>
            <select id="u-rol" v-model="form.rol">
              <option v-for="(t, r) in ROLES" :key="r" :value="r">{{ t }}</option>
            </select>
          </div>
          <div class="campo">
            <label for="u-area">Área *</label>
            <select id="u-area" v-model="form.areaId">
              <option value="" disabled>Selecciona…</option>
              <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
            </select>
          </div>
          <p class="ayuda campo--ancho">{{ AYUDA_ROL[form.rol] }}</p>
        </template>
        <p v-else class="ayuda campo--ancho">La cuenta se crea como Usuario de tu área ({{ areaCodigo }}).</p>
        <div v-if="!editando" class="campo campo--ancho">
          <label for="u-clave">Contraseña inicial (opcional)</label>
          <input id="u-clave" v-model="form.password" type="text" autocomplete="off" placeholder="Vacío = el sistema genera una temporal" />
          <p class="ayuda">Sea cual sea, la persona deberá cambiarla en su primer ingreso.</p>
        </div>
        <p v-if="errorForm" class="campo-error campo--ancho" role="alert">{{ errorForm }}</p>
      </form>
      <template #acciones>
        <button type="button" class="btn-secundario" @click="modalUsuario = false">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="guardando" @click="guardarUsuario">
          {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cuenta' }}
        </button>
      </template>
    </Modal>

    <!-- Credenciales recién generadas -->
    <Modal :model-value="Boolean(credenciales)" titulo="Contraseña temporal" ancho="sm" @update:model-value="credenciales = null">
      <template v-if="credenciales">
        <p class="texto">Entrega esta contraseña a <strong>{{ credenciales.nombre }}</strong> ({{ credenciales.email }}) por un medio seguro. El sistema le pedirá cambiarla en su primer ingreso.</p>
        <div class="clave-temporal">
          <code>{{ credenciales.password }}</code>
          <button type="button" class="btn-secundario" @click="copiar(credenciales.password)">Copiar</button>
        </div>
        <p v-if="credenciales.correo" class="texto ok">También le enviamos un correo con un enlace para crear su contraseña.</p>
        <p class="ayuda">Esta contraseña no se volverá a mostrar.</p>
      </template>
      <template #acciones>
        <button type="button" class="btn-primario" @click="credenciales = null">Listo</button>
      </template>
    </Modal>

    <!-- Confirmar restablecer -->
    <Modal :model-value="Boolean(reseteando)" titulo="Restablecer contraseña" ancho="sm" @update:model-value="reseteando = null">
      <p v-if="reseteando" class="texto">
        Se generará una contraseña temporal para <strong>{{ reseteando.nombre }}</strong>. Sus sesiones abiertas se cerrarán
        y deberá cambiarla al volver a ingresar{{ correoHabilitado ? '; además recibirá un enlace por correo' : '' }}.
      </p>
      <template #acciones>
        <button type="button" class="btn-secundario" @click="reseteando = null">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="guardando" @click="confirmarReset">Restablecer</button>
      </template>
    </Modal>

    <!-- Desactivar (con reasignación si tiene pendientes) -->
    <Modal :model-value="Boolean(desactivando)" :titulo="tituloDesactivar" ancho="sm" @update:model-value="desactivando = null">
      <template v-if="desactivando">
        <p v-if="!cambiosPendientes" class="texto">No podrá iniciar sesión y sus sesiones abiertas se cerrarán de inmediato. Su historial se conserva.</p>
        <p v-else class="texto">Al cambiar de área, sus radicados pendientes deben quedar con alguien de su área actual.</p>
        <template v-if="desactivando.radicadosPendientes > 0">
          <p class="texto alerta">
            Tiene <strong>{{ desactivando.radicadosPendientes }}</strong> radicado(s) pendiente(s). Elige quién los recibe (queda
            registrado en cada radicado y se le avisa).
          </p>
          <div class="campo">
            <label for="u-reasignar">Reasignar a *</label>
            <select id="u-reasignar" v-model="reasignarA">
              <option value="" disabled>Selecciona una persona del área…</option>
              <option v-for="c in candidatosReasignar" :key="c.id" :value="c.id">{{ c.nombre }} — {{ ROLES[c.rol] }}</option>
            </select>
            <p v-if="!candidatosReasignar.length" class="campo-error">No hay otra persona activa en el área para recibirlos.</p>
          </div>
        </template>
        <p v-if="errorForm" class="campo-error" role="alert">{{ errorForm }}</p>
      </template>
      <template #acciones>
        <button type="button" class="btn-secundario" @click="desactivando = null">Cancelar</button>
        <button
          type="button"
          class="btn-peligro"
          :disabled="guardando || (desactivando?.radicadosPendientes > 0 && !reasignarA)"
          @click="confirmarDesactivar"
        >
          {{ cambiosPendientes ? 'Guardar y reasignar' : 'Desactivar' }}
        </button>
      </template>
    </Modal>

    <!-- Aprobar solicitud -->
    <Modal :model-value="Boolean(aprobando)" :titulo="aprobando ? `Aprobar a ${aprobando.nombre}` : ''" ancho="sm" @update:model-value="aprobando = null">
      <form v-if="aprobando" class="formulario" novalidate @submit.prevent="confirmarAprobar">
        <div class="campo campo--ancho">
          <label for="a-area">Área *</label>
          <select id="a-area" v-model="formAprobar.areaId">
            <option value="" disabled>Selecciona…</option>
            <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
          </select>
        </div>
        <div class="campo campo--ancho">
          <label for="a-rol">Rol *</label>
          <select id="a-rol" v-model="formAprobar.rol">
            <option v-for="(t, r) in ROLES" :key="r" :value="r">{{ t }}</option>
          </select>
        </div>
        <p v-if="errorForm" class="campo-error campo--ancho" role="alert">{{ errorForm }}</p>
      </form>
      <template #acciones>
        <button type="button" class="btn-secundario" @click="aprobando = null">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="guardando || !formAprobar.areaId" @click="confirmarAprobar">Aprobar cuenta</button>
      </template>
    </Modal>

    <!-- Rechazar solicitud -->
    <Modal :model-value="Boolean(rechazando)" titulo="Rechazar solicitud" ancho="sm" @update:model-value="rechazando = null">
      <p v-if="rechazando" class="texto">Se eliminará la solicitud de <strong>{{ rechazando.nombre }}</strong> ({{ rechazando.email }}).</p>
      <template #acciones>
        <button type="button" class="btn-secundario" @click="rechazando = null">Cancelar</button>
        <button type="button" class="btn-peligro" :disabled="guardando" @click="confirmarRechazo">Rechazar</button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
// Administración de cuentas. Gerencia ve todas las áreas, cambia roles y
// áreas y aprueba solicitudes; el líder de área administra los usuarios de
// su área. El backend vuelve a validar cada permiso.

import { computed, onMounted, reactive, ref, watch } from 'vue'

import Modal from '@/components/Modal.vue'
import { UsuariosAPI } from '@/api/usuarios.js'
import { AreasAPI } from '@/api/areas.js'
import { useSesion } from '@/composables/useSesion.js'
import { useToast } from '@/composables/useToast.js'

const ROLES = { LIDER_GENERAL: 'Gerencia (líder general)', LIDER_AREA: 'Líder de área', USUARIO: 'Usuario' }
const AYUDA_ROL = {
  LIDER_GENERAL: 'Gerencia ve y administra todas las áreas, registra radicados y usuarios.',
  LIDER_AREA: 'El líder ve y responde los radicados de su área y administra a sus usuarios. Un área tiene un solo líder activo.',
  USUARIO: 'Ve los radicados de su área y responde los que tiene asignados.',
}

const sesion = useSesion()
const toast = useToast()
const esLiderGeneral = sesion.esLiderGeneral
const yoId = computed(() => sesion.usuario.value?.id)
const areaCodigo = computed(() => sesion.area.value?.codigo ?? '')

const usuarios = ref([])
const areas = ref([])
const correoHabilitado = ref(true)
const cargando = ref(false)
const cargado = ref(false)
const error = ref('')

const filtroTexto = ref('')
const filtroArea = ref('')
const filtroRol = ref('')
const filtroEstado = ref('')

const solicitudes = computed(() => usuarios.value.filter((u) => u.estado === 'pendiente'))
const filas = computed(() => {
  const q = filtroTexto.value.trim().toLowerCase()
  return usuarios.value.filter(
    (u) =>
      u.estado !== 'pendiente' &&
      (!q || u.nombre.toLowerCase().includes(q) || u.email.includes(q)) &&
      (!filtroArea.value || u.areaId === filtroArea.value) &&
      (!filtroRol.value || u.rol === filtroRol.value) &&
      (!filtroEstado.value || u.estado === filtroEstado.value),
  )
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const d = await UsuariosAPI.listar()
    usuarios.value = d.usuarios
    correoHabilitado.value = d.correoHabilitado
    cargado.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  cargar()
  try {
    areas.value = (await AreasAPI.listar()).filter((a) => a.activa !== false)
  } catch {
    areas.value = []
  }
})

const avisarSolicitudes = () => window.dispatchEvent(new Event('acuasan:solicitudes'))

// ── Utilidades de presentación ──
const iniciales = (n) =>
  String(n || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fechaHora = (d) =>
  new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.exito('Contraseña copiada.')
  } catch {
    toast.info('Selecciona la contraseña y cópiala manualmente.')
  }
}

// ── Crear / editar ──
const modalUsuario = ref(false)
const editando = ref(null)
const guardando = ref(false)
const errorForm = ref('')
const form = reactive({ nombre: '', email: '', rol: 'USUARIO', areaId: '', password: '' })
const credenciales = ref(null)

function abrirNuevo() {
  editando.value = null
  Object.assign(form, { nombre: '', email: '', rol: 'USUARIO', areaId: filtroArea.value || '', password: '' })
  errorForm.value = ''
  modalUsuario.value = true
}

function abrirEditar(u) {
  editando.value = u
  Object.assign(form, { nombre: u.nombre, email: u.email, rol: u.rol, areaId: u.areaId, password: '' })
  errorForm.value = ''
  modalUsuario.value = true
}

async function guardarUsuario() {
  errorForm.value = ''
  if (!form.nombre.trim() || !form.email.trim()) {
    errorForm.value = 'Nombre y correo son obligatorios.'
    return
  }
  if (esLiderGeneral.value && !form.areaId) {
    errorForm.value = 'Selecciona el área.'
    return
  }
  guardando.value = true
  try {
    if (editando.value) {
      const cambios = { nombre: form.nombre, email: form.email }
      if (esLiderGeneral.value) Object.assign(cambios, { rol: form.rol, areaId: form.areaId })
      const ok = await enviarActualizacion(editando.value, cambios)
      if (ok) modalUsuario.value = false
    } else {
      const datos = { nombre: form.nombre, email: form.email, password: form.password || undefined }
      if (esLiderGeneral.value) Object.assign(datos, { rol: form.rol, areaId: form.areaId })
      const r = await UsuariosAPI.crear(datos)
      modalUsuario.value = false
      credenciales.value = { nombre: r.usuario.nombre, email: r.usuario.email, password: r.passwordTemporal, correo: r.invitacionEnviada }
      toast.exito(`Cuenta de ${r.usuario.nombre} creada.`)
      await cargar()
    }
  } catch (e) {
    errorForm.value = e.message
  } finally {
    guardando.value = false
  }
}

// Si el cambio de área deja radicados pendientes atrás, el backend responde
// TIENE_PENDIENTES: se abre la reasignación con esos cambios guardados.
const cambiosPendientes = ref(null)
async function enviarActualizacion(u, cambios) {
  try {
    const r = await UsuariosAPI.actualizar(u.id, cambios)
    toast.exito(r.reasignados ? `Cuenta actualizada. ${r.reasignados} radicado(s) reasignado(s).` : 'Cuenta actualizada.')
    await cargar()
    return true
  } catch (e) {
    if (e.codigo === 'TIENE_PENDIENTES') {
      cambiosPendientes.value = cambios
      abrirDesactivar({ ...u, radicadosPendientes: e.respuesta?.pendientes ?? u.radicadosPendientes }, true)
      modalUsuario.value = false
      return false
    }
    throw e
  }
}

// ── Restablecer contraseña ──
const reseteando = ref(null)
function abrirReset(u) {
  reseteando.value = u
}
async function confirmarReset() {
  const u = reseteando.value
  guardando.value = true
  try {
    const r = await UsuariosAPI.restablecerPassword(u.id)
    reseteando.value = null
    credenciales.value = { nombre: u.nombre, email: u.email, password: r.passwordTemporal, correo: r.enlaceEnviado }
    await cargar()
  } catch (e) {
    toast.error(e.message)
  } finally {
    guardando.value = false
  }
}

// ── Activar / desactivar (con reasignación) ──
const desactivando = ref(null)
const reasignarA = ref('')
const candidatosReasignar = computed(() =>
  desactivando.value
    ? usuarios.value.filter((c) => c.areaId === desactivando.value.areaId && c.activo && c.id !== desactivando.value.id)
    : [],
)

const tituloDesactivar = computed(() => {
  if (!desactivando.value) return ''
  return cambiosPendientes.value
    ? `Reasignar pendientes de ${desactivando.value.nombre}`
    : `Desactivar a ${desactivando.value.nombre}`
})

function abrirDesactivar(u, porCambio = false) {
  desactivando.value = u
  reasignarA.value = ''
  errorForm.value = ''
  if (!porCambio) cambiosPendientes.value = null
}

watch(desactivando, (v) => {
  if (!v) cambiosPendientes.value = null
})

async function confirmarDesactivar() {
  const u = desactivando.value
  guardando.value = true
  errorForm.value = ''
  try {
    const cambios = cambiosPendientes.value ?? { activo: false }
    const r = await UsuariosAPI.actualizar(u.id, { ...cambios, ...(reasignarA.value ? { reasignarA: reasignarA.value } : {}) })
    toast.exito(
      `${cambiosPendientes.value ? 'Cuenta actualizada' : `${u.nombre} quedó inactivo`}.${r.reasignados ? ` ${r.reasignados} radicado(s) reasignado(s).` : ''}`,
    )
    desactivando.value = null
    await cargar()
  } catch (e) {
    if (e.codigo === 'TIENE_PENDIENTES') {
      desactivando.value = { ...u, radicadosPendientes: e.respuesta?.pendientes ?? 1 }
    }
    errorForm.value = e.message
  } finally {
    guardando.value = false
  }
}

async function activar(u) {
  try {
    await UsuariosAPI.actualizar(u.id, { activo: true })
    toast.exito(`${u.nombre} quedó activo.`)
    await cargar()
  } catch (e) {
    toast.error(e.message)
  }
}

// ── Solicitudes de autorregistro ──
const aprobando = ref(null)
const formAprobar = reactive({ areaId: '', rol: 'USUARIO' })
const rechazando = ref(null)

function abrirAprobar(u) {
  aprobando.value = u
  errorForm.value = ''
  Object.assign(formAprobar, { areaId: '', rol: 'USUARIO' })
}

async function confirmarAprobar() {
  guardando.value = true
  errorForm.value = ''
  try {
    const r = await UsuariosAPI.aprobar(aprobando.value.id, { ...formAprobar })
    toast.exito(`Cuenta de ${r.nombre} aprobada.`)
    aprobando.value = null
    await cargar()
    avisarSolicitudes()
  } catch (e) {
    errorForm.value = e.message
  } finally {
    guardando.value = false
  }
}

function abrirRechazo(u) {
  rechazando.value = u
}

async function confirmarRechazo() {
  guardando.value = true
  try {
    await UsuariosAPI.rechazar(rechazando.value.id)
    toast.exito('Solicitud rechazada.')
    rechazando.value = null
    await cargar()
    avisarSolicitudes()
  } catch (e) {
    toast.error(e.message)
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.cabecera-vista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
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
}

.aviso-correo {
  background: var(--acuasan-yellow-light);
  border: 1px solid #fde68a;
  border-left: 4px solid var(--acuasan-yellow);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 0.74rem;
  color: var(--acuasan-amber-text);
  font-weight: 600;
  margin-bottom: 12px;
}

.panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(2, 31, 58, 0.04);
}

.panel--solicitudes {
  border-left: 4px solid var(--acuasan-yellow);
}

.panel-cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.panel-titulo {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-main);
}

.lista-solicitudes {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.solicitud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.78rem;
}

.solicitud div:first-child {
  display: flex;
  flex-direction: column;
}

.acciones-solicitud {
  display: flex;
  gap: 6px;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.filtros input,
.filtros select {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 0.78rem;
  padding: 7px 10px;
  font-family: inherit;
  min-width: 170px;
}

.filtros input {
  flex: 1 1 220px;
}

.conteos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.68rem;
  font-weight: 700;
  background: #f1f5f9;
  color: var(--text-muted);
  white-space: nowrap;
}

.chip + .chip {
  margin-left: 4px;
}

.chip--verde {
  background: var(--acuasan-green-light);
  color: var(--acuasan-green-text);
}

.chip--gris {
  background: #f1f5f9;
  color: #475569;
}

.chip--azul {
  background: var(--acuasan-blue-light);
  color: var(--acuasan-blue);
}

.chip--rojo {
  background: var(--acuasan-red-light);
  color: var(--acuasan-red-dark);
}

.chip--ambar {
  background: var(--acuasan-yellow-light);
  color: var(--acuasan-amber-text);
}

.chip-area {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
  border-radius: 6px;
  padding: 2px 7px;
}

.vista-error {
  background: var(--acuasan-red-light);
  border-left: 4px solid var(--acuasan-red);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--acuasan-red-dark);
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.tabla-wrap {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: auto;
}

.tabla-usuarios {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
  min-width: 760px;
}

.tabla-usuarios thead th {
  background: #f1f5f9;
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 9px 10px;
  text-align: left;
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.tabla-usuarios tbody td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.tabla-usuarios tbody tr:hover {
  background: #f0f7ff;
}

.fila-inactiva {
  opacity: 0.62;
}

.num {
  text-align: center;
}

.acciones {
  text-align: right;
  white-space: nowrap;
}

.vacia {
  text-align: center;
  color: var(--text-muted);
  padding: 22px !important;
}

.persona {
  display: flex;
  align-items: center;
  gap: 9px;
}

.persona div {
  display: flex;
  flex-direction: column;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--acuasan-blue);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  font-weight: 800;
  flex: 0 0 30px;
}

.sutil {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.pendientes-alto {
  font-weight: 800;
  color: var(--acuasan-amber-text);
}

.btn-icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-color);
  background: #fff;
  color: var(--text-muted);
  cursor: pointer;
  margin-left: 4px;
}

.btn-icono:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.btn-icono--peligro:hover {
  color: var(--acuasan-red-dark);
  border-color: #fca5a5;
  background: var(--acuasan-red-light);
}

.btn-icono--ok:hover {
  color: var(--acuasan-green-text);
  border-color: var(--acuasan-green);
  background: var(--acuasan-green-light);
}

.btn-primario,
.btn-secundario,
.btn-peligro,
.btn-peligro-suave {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
}

.btn-primario {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #fff;
}

.btn-primario:hover:not(:disabled) {
  background: var(--acuasan-blue-dark);
}

.btn-secundario:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.btn-peligro {
  background: var(--acuasan-red);
  border-color: var(--acuasan-red);
  color: #fff;
}

.btn-peligro-suave {
  color: var(--acuasan-red-dark);
  border-color: #fca5a5;
}

.btn-primario:disabled,
.btn-peligro:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.formulario {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campo--ancho {
  grid-column: 1 / -1;
}

.campo label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-main);
}

.campo input,
.campo select {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 0.8rem;
  padding: 7px 10px;
  outline: none;
  font-family: inherit;
  width: 100%;
}

.campo input:focus,
.campo select:focus {
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

.ayuda {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.campo-error {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--acuasan-red-dark);
}

.texto {
  font-size: 0.8rem;
  color: var(--text-main);
  margin-bottom: 10px;
  line-height: 1.5;
}

.texto.alerta {
  background: var(--acuasan-yellow-light);
  border-radius: 8px;
  padding: 8px 10px;
}

.texto.ok {
  color: var(--acuasan-green-text);
  font-weight: 600;
}

.clave-temporal {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.clave-temporal code {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  background: #f1f5f9;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  padding: 8px 14px;
  user-select: all;
}

@media (max-width: 640px) {
  .formulario {
    grid-template-columns: 1fr;
  }

  .filtros select,
  .filtros input {
    min-width: 0;
    flex: 1 1 100%;
  }
}
</style>
