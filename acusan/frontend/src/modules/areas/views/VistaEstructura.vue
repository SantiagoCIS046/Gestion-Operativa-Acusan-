<template>
  <section class="vista-estructura">
    <header class="cabecera-vista">
      <div>
        <h2>Mapa de estructura</h2>
        <p class="vista-sub">
          Estructura organizacional de Acuusan E.S.P.: gerencia al frente, sus
          áreas dependientes y sus subáreas. Línea verde continua = área activa
          y funcionando; línea roja discontinua = área inactiva o bloqueada por
          un área superior.
        </p>
        <p v-if="corte" class="vista-corte" data-testid="corte-estructura">
          Corte al {{ corte }} · solo gerencia puede modificar la estructura
        </p>
      </div>
      <div class="cabecera-acciones">
        <button type="button" class="btn-nueva-area" @click="abrirNueva()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva área
        </button>
        <button type="button" class="btn-reintentar" :disabled="cargando" @click="cargar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Actualizar
        </button>
      </div>
    </header>

    <div v-if="error" class="vista-error">
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <!-- Resumen del mapa + leyenda de líneas -->
      <div class="estructura-kpis" data-testid="estructura-kpis">
        <div class="conteo-caja conteo-caja--total">
          <span class="conteo-num">{{ kpis.total }}</span>
          <span class="conteo-etiqueta">áreas dependientes</span>
        </div>
        <div class="conteo-caja conteo-caja--verde" data-testid="kpi-activas">
          <span class="conteo-num">{{ kpis.activas }}</span>
          <span class="conteo-etiqueta">activas y funcionando</span>
        </div>
        <div class="conteo-caja conteo-caja--roja" data-testid="kpi-inactivas">
          <span class="conteo-num">{{ kpis.inactivas }}</span>
          <span class="conteo-etiqueta">inactivas</span>
        </div>
        <div class="conteo-caja conteo-caja--azul" data-testid="kpi-subareas">
          <span class="conteo-num">{{ kpis.subareas }}</span>
          <span class="conteo-etiqueta">subáreas anidadas</span>
        </div>
        <div class="conteo-caja" data-testid="kpi-personas">
          <span class="conteo-num">{{ kpis.personas }}</span>
          <span class="conteo-etiqueta">personas asignadas</span>
        </div>
        <div class="leyenda-lineas">
          <span class="leyenda-item"><i class="swatch swatch--verde"></i> Verde: activa y funcionando</span>
          <span class="leyenda-item"><i class="swatch swatch--roja"></i> Roja: inactiva o bloqueada</span>
        </div>
      </div>

      <!-- ===== Mapa conceptual ===== -->
      <div class="mapa-panel">
        <div class="mapa-controles">
          <button type="button" class="mapa-btn" :class="{ 'mapa-btn--activo': modoAjuste }" @click="ajustarAMedida">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            Ajustar a pantalla
          </button>
          <button type="button" class="mapa-btn" @click="expandirTodo">Expandir todo</button>
          <button type="button" class="mapa-btn" @click="colapsarRamas">Solo primer nivel</button>
          <span class="mapa-zoom" data-testid="mapa-zoom">
            <button type="button" title="Reducir" aria-label="Reducir" @click="zoomPor(-0.1)">−</button>
            <span class="mapa-zoom-valor">{{ porcentajeEscala }}%</span>
            <button type="button" title="Ampliar" aria-label="Ampliar" @click="zoomPor(0.1)">+</button>
          </span>
        </div>

        <div
          ref="lienzo"
          class="mapa-lienzo"
          :class="{ 'mapa-lienzo--agarrando': arrastrando }"
          data-testid="mapa-estructura"
          @pointerdown="alPresionar"
          @pointermove="alMover"
          @pointerup="alSoltar"
          @pointerleave="alSoltar"
        >
          <div v-if="cargando && !areas.length" class="cargando-arbol">Cargando el mapa de estructura…</div>
          <div v-else-if="!raiz" class="cargando-arbol">
            No hay área líder definida: siembre la base de datos o créela desde gerencia.
          </div>
          <div
            v-else
            class="mapa-sizer"
            :style="{ width: `${layout.ancho * escala}px`, height: `${layout.alto * escala}px` }"
          >
            <div
              class="mapa-capa"
              :style="{
                width: `${layout.ancho}px`,
                height: `${layout.alto}px`,
                transform: `scale(${escala})`,
              }"
            >
              <!-- Líneas conceptuales verde/rojo -->
              <svg class="mapa-svg" :width="layout.ancho" :height="layout.alto" aria-hidden="true">
                <path
                  v-for="arista in layout.aristas"
                  :key="arista.id"
                  :d="arista.ruta"
                  class="linea"
                  :class="arista.estado === 'activa' ? 'linea--activa' : 'linea--inactiva'"
                  :data-testid="`linea-${arista.estado}`"
                />
              </svg>

              <!-- Nodos del árbol -->
              <article
                v-for="nodo in layout.nodos"
                :key="nodo.id"
                class="nodo"
                :class="{
                  'nodo--raiz': !nodo.area.parentId,
                  'nodo--detenida': nodo.estado !== 'activa',
                }"
                :style="{ left: `${nodo.x}px`, top: `${nodo.y}px` }"
                :data-testid="`nodo-${nodo.area.codigo}`"
              >
                <header class="nodo-cab">
                  <span class="nodo-codigo">{{ nodo.area.codigo }}</span>
                  <span v-if="!nodo.area.parentId" class="nodo-etiqueta-lider">Área líder</span>
                  <span
                    v-else
                    class="nodo-estado"
                    :class="nodo.estado === 'activa' ? 'nodo-estado--verde' : 'nodo-estado--roja'"
                    :title="nodo.notaEstado"
                  >
                    <i class="nodo-farol" :class="nodo.estado === 'activa' ? 'nodo-farol--verde' : 'nodo-farol--roja'"></i>
                    {{ nodo.estadoTexto }}
                  </span>
                </header>

                <p class="nodo-nombre" :title="nodo.area.nombre">{{ nodo.area.nombre }}</p>

                <p
                  class="nodo-lider"
                  :title="nodo.area.lider
                    ? `Encargado: ${nodo.area.lider.nombre} · ${nodo.area.lider.email}`
                    : (nodo.area.parentId ? 'Sin encargado asignado' : 'Gerencia de la empresa')"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  {{ nodo.area.lider ? nodo.area.lider.nombre : (nodo.area.parentId ? 'Sin encargado' : 'Dirección general') }}
                </p>

                <div class="nodo-meta">
                  <span class="nodo-meta-item" :title="nodo.personasTitulo">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    {{ nodo.personasTexto }}
                  </span>
                  <span
                    v-if="nodo.area.creada"
                    class="nodo-meta-item"
                    title="Fecha de creación del área"
                  >
                    Desde {{ mesAnio(nodo.area.creada) }}
                  </span>
                  <a
                    v-if="nodo.area.lider"
                    class="nodo-meta-mail"
                    :href="`mailto:${nodo.area.lider.email}`"
                    :title="`Contactar a ${nodo.area.lider.nombre} (${nodo.area.lider.email})`"
                    :aria-label="`Contactar al encargado de ${nodo.area.nombre}`"
                    @click.stop
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
                    </svg>
                    Contactar
                  </a>
                </div>

                <div class="nodo-acciones">
                  <button type="button" class="nodo-btn" title="Agregar subárea" :aria-label="`Agregar subárea a ${nodo.area.nombre}`" @click.stop="abrirNueva(nodo.area)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button type="button" class="nodo-btn" title="Editar área" :aria-label="`Editar ${nodo.area.nombre}`" @click.stop="abrirEdicion(nodo.area)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    v-if="nodo.area.parentId"
                    type="button"
                    class="nodo-btn"
                    :class="nodo.area.activa ? 'nodo-btn--apagar' : 'nodo-btn--prender'"
                    :title="nodo.area.activa ? 'Desactivar área (línea roja)' : 'Activar área (línea verde)'"
                    :aria-label="`${nodo.area.activa ? 'Desactivar' : 'Activar'} ${nodo.area.nombre}`"
                    :disabled="cambiandoEstado.has(nodo.id)"
                    @click.stop="alternarEstado(nodo.area)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                  </button>
                  <button
                    v-if="nodo.area.parentId"
                    type="button"
                    class="nodo-btn nodo-btn--rojo"
                    title="Eliminar área"
                    :aria-label="`Eliminar ${nodo.area.nombre}`"
                    @click.stop="pedirEliminacion(nodo.area)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                <!-- Plegado de la rama: +N subáreas ocultas / ▾ -->
                <button
                  v-if="nodo.tieneHijos"
                  type="button"
                  class="nodo-chevron"
                  :data-testid="`chevron-${nodo.area.codigo}`"
                  :title="colapsados.has(nodo.id) ? `Expandir ${nodo.ocultas} subárea(s)` : 'Colapsar rama'"
                  @click.stop="alternarColapso(nodo.id)"
                >
                  <template v-if="colapsados.has(nodo.id)">+{{ nodo.ocultas }}</template>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </article>
            </div>
          </div>
        </div>
        <p class="mapa-ayuda">
          El mapa se ajusta solo a la pantalla · arrastre el lienzo para moverse · cada área puede
          crecer con subáreas (botón <strong>+</strong> de la tarjeta).
        </p>
      </div>

      <!-- ===== Gobernanza de la estructura ===== -->
      <section class="gobernanza" data-testid="gobernanza-estructura">
        <header class="gobernanza-cab">
          <h3>Gobernanza de la estructura</h3>
          <p>
            Principios con los que opera este módulo: transparencia, trazabilidad
            y manejo responsable de la información institucional.
          </p>
        </header>
        <div class="gobernanza-grid">
          <article class="gobernanza-item">
            <h4>Trazabilidad completa</h4>
            <p>
              Cada área que se crea, edita, activa, desactiva o elimina queda
              registrada con su fecha y su responsable en el registro de movimiento.
            </p>
          </article>
          <article class="gobernanza-item">
            <h4>Sin borrado silencioso</h4>
            <p>
              Desactivar un área no borra información: los radicados y las cuentas
              se conservan; solo se detiene su funcionamiento.
            </p>
          </article>
          <article class="gobernanza-item">
            <h4>Autoridad restringida</h4>
            <p>
              Solo gerencia puede estructurar el mapa. El área líder no se
              desactiva ni se elimina, y las áreas con contenido quedan protegidas.
            </p>
          </article>
          <article class="gobernanza-item">
            <h4>Historia que sobrevive</h4>
            <p>
              El registro conserva el nombre y la trayectoria de cada área aunque
              cambie de nombre o se elimine del mapa.
            </p>
          </article>
        </div>
      </section>

      <!-- ===== Registro de movimiento ===== -->
      <section class="registro" data-testid="registro-movimientos">
        <header class="registro-cab">
          <div>
            <h3>Registro de movimiento de las áreas</h3>
            <p class="registro-sub">
              Auditoría de la estructura: cada movimiento queda asociado a su
              responsable y se conserva aunque el área cambie o se elimine.
            </p>
          </div>
          <span class="registro-conteo">{{ movimientos.length }} movimiento(s)</span>
        </header>

        <p v-if="!movimientos.length" class="registro-vacio">
          Todavía no hay movimientos: cada área que cree, active, desactive, edite o elimine
          quedará registrada aquí con su fecha y su responsable.
        </p>

        <div v-else class="registro-tabla">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Área</th>
                <th>Detalle</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mov in movimientos" :key="mov.id" data-testid="mov-fila">
                <td class="c-fecha">{{ fechaCorta(mov.fecha) }}</td>
                <td>
                  <span class="mov-chip" :class="`mov-chip--${chipDe(mov.tipo)}`" :data-testid="`mov-chip-${mov.tipo}`">
                    {{ ETIQUETA_MOV[mov.tipo] || mov.tipo }}
                  </span>
                </td>
                <td class="c-area">
                  <span class="c-codigo">{{ mov.areaCodigo }}</span>
                  <span class="c-nombre" :title="mov.areaNombre">{{ mov.areaNombre }}</span>
                </td>
                <td class="c-detalle">
                  {{ mov.detalle || '—' }}
                  <span v-if="mov.padreNombre" class="c-padre">bajo {{ mov.padreNombre }}</span>
                </td>
                <td class="c-usuario">{{ mov.usuarioNombre }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="nota-institucional">
        Información institucional de Acuusan E.S.P. — documento de uso interno:
        no está autorizada su divulgación fuera de la empresa.
        <span v-if="corte">Corte al {{ corte }}.</span>
      </p>
    </template>

    <!-- Modal crear/editar área (solo gerencia) -->
    <Modal
      v-model="modalFormulario"
      :titulo="areaEditando ? `Editar área ${areaEditando.codigo}` : 'Nueva área'"
      ancho="md"
    >
      <form class="form-area" @submit.prevent="guardarArea">
        <p v-if="!areaEditando && areaPadre" class="form-area-nota">
          Se creará como <strong>{{ areaPadre.parentId ? 'subárea de' : 'área dependiente de' }}</strong>
          {{ areaPadre.nombre }} ({{ areaPadre.codigo }}).
        </p>
        <div class="campo">
          <label for="area-codigo">Código</label>
          <input
            id="area-codigo"
            v-model="formCodigo"
            type="text"
            maxlength="8"
            placeholder="p. ej. OPE"
            autocomplete="off"
          />
        </div>
        <div class="campo">
          <label for="area-nombre">Nombre</label>
          <input
            id="area-nombre"
            v-model="formNombre"
            type="text"
            maxlength="60"
            placeholder="Nombre del área"
            autocomplete="off"
          />
        </div>

        <!-- Encargado: obligatorio si cuelga de gerencia; opcional en subáreas -->
        <template v-if="!areaEditando">
          <label v-if="!padreEsRaiz" class="campo-switch">
            <input v-model="formCrearEncargado" type="checkbox" data-testid="check-encargado" />
            <span>Crear cuenta de encargado para la subárea (opcional)</span>
          </label>

          <template v-if="padreEsRaiz || formCrearEncargado">
            <div class="form-separador">Encargado del área</div>
            <div class="campo">
              <label for="area-encargado-nombre">Nombre del encargado</label>
              <input
                id="area-encargado-nombre"
                v-model="formEncargadoNombre"
                type="text"
                maxlength="60"
                placeholder="Nombre completo"
                autocomplete="off"
              />
            </div>
            <div class="campo">
              <label for="area-encargado-email">Correo electrónico</label>
              <input
                id="area-encargado-email"
                v-model="formEncargadoEmail"
                type="email"
                maxlength="80"
                placeholder="correo@acuasan.com"
                autocomplete="off"
              />
            </div>
            <div class="campo">
              <label for="area-encargado-password">Contraseña</label>
              <input
                id="area-encargado-password"
                v-model="formEncargadoPassword"
                type="password"
                maxlength="60"
                placeholder="Contraseña inicial de la cuenta"
                autocomplete="new-password"
              />
            </div>
            <label class="campo-switch">
              <input v-model="formEncargadoActivo" type="checkbox" />
              <span>Cuenta activa (puede iniciar sesión)</span>
            </label>
          </template>
        </template>

        <p v-if="formError" class="form-area-error">{{ formError }}</p>
        <div class="form-area-botones">
          <button
            type="button"
            class="btn-modal btn-modal--secundario"
            :disabled="guardando"
            @click="modalFormulario = false"
          >
            Cancelar
          </button>
          <button type="submit" class="btn-modal btn-modal--primario" :disabled="guardando">
            {{ guardando ? 'Guardando…' : areaEditando ? 'Guardar cambios' : 'Crear área' }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Modal confirmar eliminación (solo gerencia) -->
    <Modal v-model="modalEliminar" titulo="Eliminar área" ancho="sm">
      <div class="form-eliminar">
        <p>
          ¿Eliminar el área <strong>{{ areaEliminar ? areaEliminar.nombre : '' }}</strong>
          <template v-if="areaEliminar"> ({{ areaEliminar.codigo }})</template>?
        </p>
        <p class="form-eliminar-nota">
          Solo se puede eliminar un área sin usuarios, radicados ni subáreas.
          La eliminación queda registrada en el registro de movimiento.
        </p>
        <div class="form-area-botones">
          <button
            type="button"
            class="btn-modal btn-modal--secundario"
            :disabled="eliminando"
            @click="modalEliminar = false"
          >
            Cancelar
          </button>
          <button type="button" class="btn-modal btn-modal--rojo" :disabled="eliminando" @click="confirmarEliminacion">
            {{ eliminando ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </Modal>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { AreasAPI } from '@/api/areas.js'
import Modal from '@/components/Modal.vue'
import { useSesion } from '@/composables/useSesion.js'
import { useToast } from '@/composables/useToast.js'

// El mapa de estructura se gestiona solo desde gerencia (la ruta ya exige
// LIDER_GENERAL); esLiderGeneral vuelve a decidir qué controles se dibujan.
const { esLiderGeneral } = useSesion()
const toast = useToast()

// ── Datos ────────────────────────────────────────────────────────────────────
const areas = ref([])
const movimientos = ref([])
const cargando = ref(false)
const error = ref('')
const cargadoEl = ref(null) // fecha del último corte de información cargado

// "Corte al …": momento de la última carga OK (información verificada)
const corte = computed(() => {
  if (!cargadoEl.value) return ''
  const d = new Date(cargadoEl.value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const raiz = computed(() => areas.value.find((a) => !a.parentId) || null)
const areasPorId = computed(() => new Map(areas.value.map((a) => [a.id, a])))

// Hijos por padre, ordenados por código: el árbol del mapa
const hijosDe = computed(() => {
  const mapa = new Map()
  for (const area of areas.value) {
    if (!area.parentId) continue
    const lista = mapa.get(area.parentId) || []
    lista.push(area)
    mapa.set(area.parentId, lista)
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.codigo.localeCompare(b.codigo))
  }
  return mapa
})

// Profundidad de cada área (independiente del plegado): 0 = gerencia
const profundidades = computed(() => {
  const mapa = new Map()
  if (!raiz.value) return mapa
  function recorrer(id, profundidad) {
    mapa.set(id, profundidad)
    for (const hijo of hijosDe.value.get(id) || []) recorrer(hijo.id, profundidad + 1)
  }
  recorrer(raiz.value.id, 0)
  return mapa
})

// ¿El área está activa Y funcionando? Una área con un ancestro inactivo no
// funciona: su línea (y la de sus subáreas) se pinta en rojo.
const efectivaDe = computed(() => {
  const mapa = new Map()
  if (!raiz.value) return mapa
  function recorrer(id, padreActivo) {
    const area = areasPorId.value.get(id)
    const activa = padreActivo && (area.activa !== false)
    mapa.set(id, activa)
    for (const hijo of hijosDe.value.get(id) || []) recorrer(hijo.id, activa)
  }
  recorrer(raiz.value.id, true)
  return mapa
})

function contarDescendientes(id) {
  let total = 0
  for (const hijo of hijosDe.value.get(id) || []) total += 1 + contarDescendientes(hijo.id)
  return total
}

const kpis = computed(() => {
  const dependientes = areas.value.filter((a) => a.parentId)
  const activas = dependientes.filter((a) => a.activa !== false).length
  const subareas = dependientes.filter((a) => (profundidades.value.get(a.id) || 0) >= 2).length
  const personas = areas.value.reduce(
    (total, a) => total + (a.lider ? 1 : 0) + (a.miembros?.length || 0),
    0,
  )
  return { total: dependientes.length, activas, inactivas: dependientes.length - activas, subareas, personas }
})

// ── Carga ────────────────────────────────────────────────────────────────────
async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [areasData, movsData] = await Promise.all([
      AreasAPI.listar(),
      AreasAPI.movimientos({ limite: 150 }),
    ])
    areas.value = areasData
    movimientos.value = movsData
    cargadoEl.value = new Date().toISOString()
  } catch (e) {
    error.value = e.message
    areas.value = []
    movimientos.value = []
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  await cargar()
  await nextTick()
  ajustarAMedida()
})

// ── Layout del mapa (árbol ordenado, de hoja a raíz) ─────────────────────────
const ANCHO_NODO = 210
const ALTO_NODO = 124
const SEP_H = 26
const SEP_V = 66

const colapsados = ref(new Set())

const layout = computed(() => {
  const posiciones = new Map()
  const nodos = []
  const aristas = []
  if (!raiz.value) return { posiciones, nodos, aristas, ancho: 0, alto: 0 }

  let siguienteX = 0
  function colocar(id, profundidad) {
    const plegada = colapsados.value.has(id)
    const hijos = plegada ? [] : hijosDe.value.get(id) || []
    if (!hijos.length) {
      posiciones.set(id, { x: siguienteX, y: profundidad * (ALTO_NODO + SEP_V) })
      siguienteX += ANCHO_NODO + SEP_H
    } else {
      for (const hijo of hijos) colocar(hijo.id, profundidad + 1)
      const primero = posiciones.get(hijos[0].id)
      const ultimo = posiciones.get(hijos[hijos.length - 1].id)
      posiciones.set(id, { x: (primero.x + ultimo.x) / 2, y: profundidad * (ALTO_NODO + SEP_V) })
    }
  }
  colocar(raiz.value.id, 0)

  let ancho = 0
  let alto = 0
  for (const [id, pos] of posiciones) {
    const area = areasPorId.value.get(id)
    if (!area) continue
    ancho = Math.max(ancho, pos.x + ANCHO_NODO)
    alto = Math.max(alto, pos.y + ALTO_NODO)

    const propia = area.activa !== false
    const efectiva = efectivaDe.value.get(id) !== false
    const nPersonas = (area.miembros?.length || 0) + (area.lider ? 1 : 0)
    nodos.push({
      id,
      area,
      x: pos.x,
      y: pos.y,
      estado: efectiva ? 'activa' : 'inactiva',
      estadoTexto: propia ? (efectiva ? 'Activa' : 'Bloqueada') : 'Inactiva',
      notaEstado: !propia
        ? 'Área inactiva: no está funcionando'
        : efectiva
          ? 'Área activa y funcionando'
          : 'Un área superior está inactiva: esta área no funciona',
      tieneHijos: (hijosDe.value.get(id) || []).length > 0,
      ocultas: contarDescendientes(id),
      personasTexto: !area.parentId
        ? 'Equipo de gerencia'
        : nPersonas === 1
          ? '1 persona asignada'
          : `${nPersonas} personas asignadas`,
      personasTitulo: !area.parentId
        ? 'Equipo de gerencia de la empresa'
        : `${nPersonas} persona(s) entre encargado y miembros del área`,
    })

    // Línea conceptual padre → hija, del color del estado de la hija
    if (area.parentId && posiciones.has(area.parentId)) {
      const posPadre = posiciones.get(area.parentId)
      const x1 = posPadre.x + ANCHO_NODO / 2
      const y1 = posPadre.y + ALTO_NODO
      const x2 = pos.x + ANCHO_NODO / 2
      const y2 = pos.y
      const curva = (y2 - y1) / 2
      aristas.push({
        id: `${area.parentId}-${id}`,
        estado: efectiva ? 'activa' : 'inactiva',
        ruta: `M ${x1} ${y1} C ${x1} ${y1 + curva}, ${x2} ${y2 - curva}, ${x2} ${y2}`,
      })
    }
  }

  return { posiciones, nodos, aristas, ancho, alto }
})

function alternarColapso(id) {
  const nuevo = new Set(colapsados.value)
  if (nuevo.has(id)) nuevo.delete(id)
  else nuevo.add(id)
  colapsados.value = nuevo
}

function expandirTodo() {
  colapsados.value = new Set()
}

function colapsarRamas() {
  // Todas las áreas con hijos se pliegan: queda gerencia y su primer nivel
  const nuevo = new Set()
  for (const [id] of hijosDe.value) {
    if (id !== raiz.value?.id) nuevo.add(id)
  }
  colapsados.value = nuevo
}

// ── Ajuste a pantalla y zoom ─────────────────────────────────────────────────
const lienzo = ref(null)
const escala = ref(1)
const modoAjuste = ref(true)
const K_MIN = 0.3
const K_MAX = 1.5

const porcentajeEscala = computed(() => Math.round(escala.value * 100))

function ajustarAMedida() {
  modoAjuste.value = true
  const el = lienzo.value
  if (!el || !layout.value.ancho) return
  const k = Math.min(
    (el.clientWidth - 30) / layout.value.ancho,
    (el.clientHeight - 30) / layout.value.alto,
    1,
  )
  escala.value = Math.min(Math.max(k, K_MIN), 1)
}

function zoomPor(delta) {
  modoAjuste.value = false
  escala.value = Math.min(Math.max(escala.value + delta, K_MIN), K_MAX)
}

let observador = null
onMounted(() => {
  observador = new ResizeObserver(() => {
    if (modoAjuste.value) ajustarAMedida()
  })
  if (lienzo.value) observador.observe(lienzo.value)
})
onBeforeUnmount(() => {
  if (observador) observador.disconnect()
})

watch(
  () => [layout.value.ancho, layout.value.alto],
  () => {
    if (modoAjuste.value) ajustarAMedida()
  },
)

// ── Arrastre del lienzo (pan) ────────────────────────────────────────────────
const arrastrando = ref(false)
let arrastre = null

function alPresionar(e) {
  if (e.button !== 0) return
  if (e.target.closest('button, a, input')) return
  arrastre = {
    x: e.clientX,
    y: e.clientY,
    izquierda: lienzo.value.scrollLeft,
    arriba: lienzo.value.scrollTop,
  }
  arrastrando.value = true
}

function alMover(e) {
  if (!arrastre || !lienzo.value) return
  lienzo.value.scrollLeft = arrastre.izquierda - (e.clientX - arrastre.x)
  lienzo.value.scrollTop = arrastre.arriba - (e.clientY - arrastre.y)
}

function alSoltar() {
  arrastre = null
  arrastrando.value = false
}

// ── Gestión de la estructura (solo gerencia) ─────────────────────────────────
const modalFormulario = ref(false)
const areaEditando = ref(null) // null = crear; área = editar
const areaPadre = ref(null) // área bajo la cual se crea (raíz por defecto)
const formCodigo = ref('')
const formNombre = ref('')
const formError = ref('')
const guardando = ref(false)

// Encargado del área: obligatorio bajo gerencia, opcional en subáreas
const formCrearEncargado = ref(false)
const formEncargadoNombre = ref('')
const formEncargadoEmail = ref('')
const formEncargadoPassword = ref('')
const formEncargadoActivo = ref(true)

const padreEsRaiz = computed(() => !areaPadre.value || !areaPadre.value.parentId)

const modalEliminar = ref(false)
const areaEliminar = ref(null)
const eliminando = ref(false)

const cambiandoEstado = ref(new Set())

function abrirNueva(padre = null) {
  areaEditando.value = null
  areaPadre.value = padre || raiz.value
  formCodigo.value = ''
  formNombre.value = ''
  formCrearEncargado.value = false
  formEncargadoNombre.value = ''
  formEncargadoEmail.value = ''
  formEncargadoPassword.value = ''
  formEncargadoActivo.value = true
  formError.value = ''
  modalFormulario.value = true
}

function abrirEdicion(area) {
  areaEditando.value = area
  areaPadre.value = null
  formCodigo.value = area.codigo
  formNombre.value = area.nombre
  formError.value = ''
  modalFormulario.value = true
}

async function guardarArea() {
  const codigo = formCodigo.value.trim().toUpperCase()
  const nombre = formNombre.value.trim()
  if (!codigo || !nombre) {
    formError.value = 'El código y el nombre del área son obligatorios.'
    return
  }

  const quiereEncargado = !areaEditando.value && (padreEsRaiz.value || formCrearEncargado.value)
  let encargado = null
  if (quiereEncargado) {
    const eNombre = formEncargadoNombre.value.trim()
    const eEmail = formEncargadoEmail.value.trim().toLowerCase()
    const ePassword = formEncargadoPassword.value
    if (!eNombre || !eEmail || !ePassword) {
      formError.value = 'Nombre, correo y contraseña del encargado son obligatorios.'
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eEmail)) {
      formError.value = 'El correo electrónico del encargado no es válido.'
      return
    }
    encargado = { nombre: eNombre, email: eEmail, password: ePassword, activo: formEncargadoActivo.value }
  }

  guardando.value = true
  formError.value = ''
  try {
    if (areaEditando.value) {
      await AreasAPI.actualizar(areaEditando.value.id, { codigo, nombre })
      toast.exito(`Área ${codigo} actualizada.`)
    } else {
      await AreasAPI.crear({ codigo, nombre, parentId: areaPadre.value?.id, encargado })
      toast.exito(`Área ${codigo} creada${areaPadre.value?.parentId ? ' como subárea' : ''}.`)
      // La rama donde nace queda expandida para verla en el mapa
      if (areaPadre.value) {
        const nuevo = new Set(colapsados.value)
        nuevo.delete(areaPadre.value.id)
        colapsados.value = nuevo
      }
    }
    modalFormulario.value = false
    await cargar()
  } catch (e) {
    formError.value = e.message
  } finally {
    guardando.value = false
  }
}

async function alternarEstado(area) {
  const objetivo = !(area.activa !== false)
  const enCurso = new Set(cambiandoEstado.value)
  enCurso.add(area.id)
  cambiandoEstado.value = enCurso
  try {
    await AreasAPI.cambiarEstado(area.id, objetivo)
    toast.exito(`Área ${area.codigo} ${objetivo ? 'activada' : 'desactivada'}.`)
    await cargar()
  } catch (e) {
    toast.error(e.message)
  } finally {
    const fin = new Set(cambiandoEstado.value)
    fin.delete(area.id)
    cambiandoEstado.value = fin
  }
}

function pedirEliminacion(area) {
  areaEliminar.value = area
  modalEliminar.value = true
}

async function confirmarEliminacion() {
  if (!areaEliminar.value) return
  eliminando.value = true
  try {
    await AreasAPI.eliminar(areaEliminar.value.id)
    toast.exito(`Área ${areaEliminar.value.nombre} eliminada.`)
    modalEliminar.value = false
    await cargar()
  } catch (e) {
    // El backend explica por qué no se puede eliminar (usuarios/radicados/subáreas)
    toast.error(e.message)
  } finally {
    eliminando.value = false
  }
}

// ── Registro de movimientos ──────────────────────────────────────────────────
const ETIQUETA_MOV = {
  CREADA: 'Creada',
  ACTIVADA: 'Activada',
  DESACTIVADA: 'Desactivada',
  ACTUALIZADA: 'Actualizada',
  ELIMINADA: 'Eliminada',
}

function chipDe(tipo) {
  return {
    CREADA: 'azul',
    ACTIVADA: 'verde',
    DESACTIVADA: 'roja',
    ACTUALIZADA: 'ambar',
    ELIMINADA: 'gris',
  }[tipo] || 'gris'
}

function fechaCorta(fecha) {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mesAnio(fecha) {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
}
</script>

<style scoped>
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
  max-width: 560px;
}

.vista-corte {
  margin: 4px 0 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--acuasan-blue);
}

.cabecera-acciones {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-nueva-area {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: var(--acuasan-green-dark, #5a991b);
  color: #ffffff;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-nueva-area:hover {
  background: var(--acuasan-green, #73be28);
}

.btn-reintentar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reintentar:hover:not(:disabled) {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
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

/* ===== KPIs + leyenda ===== */
.estructura-kpis {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.conteo-caja {
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
}

.conteo-caja--verde {
  background: var(--acuasan-green-light, #dcfce7);
  border-color: #bbf7d0;
}

.conteo-caja--roja {
  background: var(--acuasan-red-light, #fef2f2);
  border-color: #fecaca;
}

.conteo-caja--azul {
  background: var(--acuasan-blue-light);
}

.conteo-num {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--text-main);
}

.conteo-caja--verde .conteo-num {
  color: var(--acuasan-green-text, #166534);
}

.conteo-caja--roja .conteo-num {
  color: var(--acuasan-red-dark, #b91c1c);
}

.conteo-caja--azul .conteo-num {
  color: var(--acuasan-blue);
}

.conteo-etiqueta {
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--text-muted);
}

.leyenda-lineas {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  margin-left: auto;
  padding: 6px 4px;
}

.leyenda-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
}

.swatch {
  width: 22px;
  height: 0;
  border-top: 3px solid;
  border-radius: 2px;
}

.swatch--verde {
  border-color: var(--acuasan-green-dark, #5a991b);
}

.swatch--roja {
  border-color: var(--acuasan-red, #dc2626);
  border-top-style: dashed;
}

/* ===== Panel del mapa ===== */
.mapa-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  overflow: hidden;
  margin-bottom: 18px;
}

.mapa-controles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-main);
}

.mapa-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mapa-btn:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.mapa-btn--activo {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.mapa-zoom {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  overflow: hidden;
}

.mapa-zoom button {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 800;
  width: 28px;
  height: 26px;
  cursor: pointer;
  font-family: inherit;
}

.mapa-zoom button:hover {
  color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.mapa-zoom-valor {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-main);
  min-width: 42px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.mapa-lienzo {
  position: relative;
  overflow: auto;
  height: clamp(420px, 58vh, 720px);
  background:
    radial-gradient(circle, rgba(2, 31, 58, 0.05) 1px, transparent 1px) 0 0 / 22px 22px,
    var(--bg-main);
  cursor: grab;
  touch-action: pan-x pan-y;
  -webkit-user-select: none;
  user-select: none;
}

.mapa-lienzo--agarrando {
  cursor: grabbing;
}

.cargando-arbol {
  color: var(--text-muted);
  font-size: 0.8rem;
  background: var(--card-bg);
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  padding: 16px;
  margin: 16px;
  text-align: center;
  max-width: 420px;
}

/* El sizer reserva el área escalada; la capa interior se escala desde 0,0 */
.mapa-sizer {
  position: relative;
}

.mapa-capa {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.mapa-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.linea {
  fill: none;
  stroke-width: 2.4;
}

.linea--activa {
  stroke: var(--acuasan-green-dark, #5a991b);
}

.linea--inactiva {
  stroke: var(--acuasan-red, #dc2626);
  stroke-dasharray: 7 5;
}

/* ===== Nodos ===== */
.nodo {
  position: absolute;
  width: 210px;
  height: 124px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--acuasan-green-dark, #5a991b);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(2, 31, 58, 0.08);
  padding: 9px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nodo--detenida {
  border-left-color: var(--acuasan-red, #dc2626);
  background: linear-gradient(180deg, var(--acuasan-red-light, #fef2f2) 0%, var(--card-bg) 55%);
}

.nodo--raiz {
  border-left-color: var(--acuasan-blue);
  background: linear-gradient(180deg, var(--acuasan-blue-light) 0%, var(--card-bg) 60%);
}

.nodo-cab {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}

.nodo-codigo {
  background: var(--acuasan-blue);
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  border-radius: 5px;
  padding: 2px 6px;
}

.nodo-etiqueta-lider {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--acuasan-blue);
}

.nodo-estado {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.62rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.nodo-estado--verde {
  color: var(--acuasan-green-text, #166534);
  background: var(--acuasan-green-light, #dcfce7);
}

.nodo-estado--roja {
  color: var(--acuasan-red-dark, #b91c1c);
  background: var(--acuasan-red-light, #fef2f2);
}

.nodo-farol {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.nodo-farol--verde {
  background: var(--acuasan-green-dark, #5a991b);
}

.nodo-farol--roja {
  background: var(--acuasan-red, #dc2626);
}

.nodo-nombre {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nodo-lider {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nodo-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.62rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
}

.nodo-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.nodo-meta-mail {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--acuasan-blue);
  font-weight: 700;
  text-decoration: none;
}

.nodo-meta-mail:hover {
  text-decoration: underline;
}

.nodo-acciones {
  display: flex;
  gap: 4px;
  margin-top: auto;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.nodo:hover .nodo-acciones,
.nodo:focus-within .nodo-acciones {
  opacity: 1;
}

.nodo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
}

.nodo-btn:hover:not(:disabled) {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.nodo-btn--rojo:hover:not(:disabled) {
  color: var(--acuasan-red, #dc2626);
  border-color: var(--acuasan-red, #dc2626);
  background: var(--acuasan-red-light, #fef2f2);
}

.nodo-btn--apagar:hover:not(:disabled) {
  color: var(--acuasan-red-dark, #b91c1c);
  border-color: var(--acuasan-red, #dc2626);
}

.nodo-btn--prender:hover:not(:disabled) {
  color: var(--acuasan-green-text, #166534);
  border-color: var(--acuasan-green-dark, #5a991b);
}

.nodo-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* Plegado de rama: pastilla sobre la línea hacia los hijos */
.nodo-chevron {
  position: absolute;
  left: 50%;
  bottom: -13px;
  transform: translateX(-50%);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  font-size: 0.62rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.12s ease;
}

.nodo-chevron:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

.mapa-ayuda {
  margin: 0;
  padding: 8px 14px;
  font-size: 0.68rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  background: var(--bg-main);
}

/* ===== Gobernanza de la estructura ===== */
.gobernanza {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  overflow: hidden;
  margin-bottom: 18px;
}

.gobernanza-cab {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.gobernanza-cab h3 {
  margin: 0 0 2px;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--text-main);
}

.gobernanza-cab p {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.gobernanza-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1px;
  background: var(--border-color);
}

.gobernanza-item {
  background: var(--card-bg);
  padding: 12px 16px;
}

.gobernanza-item h4 {
  margin: 0 0 4px;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--acuasan-blue);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gobernanza-item p {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.45;
  color: var(--text-muted);
}

/* ===== Registro de movimientos ===== */
.registro {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  overflow: hidden;
}

.registro-cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.registro-cab h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--text-main);
}

.registro-conteo {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--text-muted);
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 3px 10px;
}

.registro-vacio {
  margin: 0;
  padding: 18px 16px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.registro-tabla {
  overflow-x: auto;
}

.registro-tabla table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.registro-tabla th {
  text-align: left;
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-main);
}

.registro-tabla td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.74rem;
  color: var(--text-main);
  vertical-align: top;
}

.registro-tabla tr:last-child td {
  border-bottom: none;
}

.c-fecha {
  white-space: nowrap;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.mov-chip {
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
}

.mov-chip--verde {
  color: var(--acuasan-green-text, #166534);
  background: var(--acuasan-green-light, #dcfce7);
}

.mov-chip--roja {
  color: var(--acuasan-red-dark, #b91c1c);
  background: var(--acuasan-red-light, #fef2f2);
}

.mov-chip--azul {
  color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.mov-chip--ambar {
  color: var(--acuasan-amber-text, #b45309);
  background: var(--acuasan-yellow-light, #fef9c3);
}

.mov-chip--gris {
  color: var(--text-muted);
  background: var(--bg-main);
  border: 1px solid var(--border-color);
}

.c-area {
  white-space: nowrap;
}

.c-codigo {
  display: inline-block;
  background: var(--acuasan-blue);
  color: #ffffff;
  font-size: 0.6rem;
  font-weight: 800;
  border-radius: 5px;
  padding: 1px 6px;
  margin-right: 6px;
}

.c-nombre {
  font-weight: 700;
}

.c-detalle {
  color: var(--text-muted);
  max-width: 340px;
}

.c-padre {
  display: block;
  font-size: 0.66rem;
  font-style: italic;
  color: var(--text-muted);
}

.c-usuario {
  white-space: nowrap;
  color: var(--text-muted);
}

.registro-sub {
  margin: 2px 0 0;
  font-size: 0.68rem;
  color: var(--text-muted);
  max-width: 620px;
}

.nota-institucional {
  margin: 14px 2px 0;
  font-size: 0.66rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
}

/* ===== Formularios de los modales ===== */
.form-area,
.form-eliminar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-area-nota,
.form-eliminar-nota {
  font-size: 0.76rem;
  color: var(--text-muted);
  margin: 0;
}

.form-separador {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--acuasan-blue);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.campo-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
}

.campo-switch input {
  width: 16px;
  height: 16px;
  accent-color: var(--acuasan-green-dark, #5a991b);
  cursor: pointer;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campo label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
}

.campo input {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-main);
  background: var(--card-bg);
}

.campo input:focus {
  outline: none;
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

#area-codigo {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-area-error {
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.76rem;
  font-weight: 600;
  margin: 0;
}

.form-area-botones {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-modal {
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 8px 14px;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
}

.btn-modal--primario {
  background: var(--acuasan-blue);
  color: #ffffff;
}

.btn-modal--primario:hover:not(:disabled) {
  background: var(--acuasan-blue-dark);
}

.btn-modal--rojo {
  background: var(--acuasan-red, #dc2626);
  color: #ffffff;
}

.btn-modal--rojo:hover:not(:disabled) {
  background: var(--acuasan-red-dark, #b91c1c);
}

.btn-modal--secundario {
  background: var(--card-bg);
  color: var(--text-muted);
  border-color: var(--border-color);
}

.btn-modal--secundario:hover:not(:disabled) {
  color: var(--text-main);
}

.btn-modal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .leyenda-lineas {
    margin-left: 0;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .mapa-lienzo {
    height: clamp(340px, 48vh, 520px);
  }

  .nodo-acciones {
    opacity: 1;
  }
}
</style>
