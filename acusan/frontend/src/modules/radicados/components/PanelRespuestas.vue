<template>
  <div class="respuestas-panel">
    <!-- Input permanente (fuera de todo v-if): la ref existe desde el montaje,
         así iniciarArchivar puede abrir el selector en el mismo clic. -->
    <input ref="inputArchivo" type="file" accept=".pdf,image/*" class="d-none" @change="onArchivo" />

    <!-- ═══════════ HEADER DEL PANEL ═══════════ -->
    <div class="respuestas-header">
      <div class="d-flex align-items-center gap-2 me-auto overflow-hidden">
        <span class="fs-6">📨</span>
        <div class="text-truncate">
          <strong class="d-block text-dark" style="font-size: 0.78rem;">
            {{ modoGlobal ? 'Archivo de Respuestas de Radicados' : 'Oficios de Respuesta' }}
          </strong>
          <small class="text-muted d-block" style="font-size: 0.62rem;">
            {{ modoGlobal
              ? 'Todas las respuestas archivadas, de todos los radicados'
              : 'Respuestas archivadas del radicado ' + (radicado?.numeroRadicado || '') }}
          </small>
        </div>
        <span v-if="!cargando" class="badge rounded-pill" :class="lista.length ? 'bg-primary' : 'bg-secondary'" style="font-size: 0.62rem;">
          {{ lista.length }}
        </span>
      </div>
      <button
        v-if="puedeArchivar"
        type="button"
        class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 flex-shrink-0 px-2 py-1 fw-semibold shadow-sm"
        style="font-size: 0.68rem;"
        :disabled="guardando"
        @click="iniciarArchivar"
        title="Escanear y archivar el oficio de respuesta de este radicado"
      >
        📎 Archivar respuesta
      </button>
    </div>

    <!-- ═══════════ FORMULARIO DE ARCHIVO (escaneo + OCR) ═══════════ -->
    <div v-if="formAbierto" class="archivar-caja animate-fade-in">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <strong class="text-dark" style="font-size: 0.72rem;">📎 Nuevo oficio de respuesta</strong>
        <button type="button" class="btn-close btn-close-sm" @click="cerrarForm" aria-label="Cerrar"></button>
      </div>

      <!-- Documento seleccionado + progreso de compresión -->
      <div class="documento-fila">
        <div class="text-truncate me-auto">
          <small class="text-muted d-block fw-bold" style="font-size: 0.58rem;">DOCUMENTO ESCANEADO</small>
          <strong class="text-dark text-truncate d-block" style="font-size: 0.68rem;">{{ archivoNombre || 'Ningún documento seleccionado' }}</strong>
        </div>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm py-0 px-2 flex-shrink-0"
          style="font-size: 0.64rem;"
          @click="inputArchivo && inputArchivo.click()"
        >
          {{ archivoNombre ? '🔄 Cambiar' : '📎 Seleccionar' }}
        </button>
      </div>

      <div v-if="archivoVistaUrl" class="text-center mb-2">
        <img v-if="esImagen(vistaMime)" :src="archivoVistaUrl" class="img-fluid rounded border bg-white" style="max-height: 140px; object-fit: contain;" alt="Oficio de respuesta" />
        <div v-else class="badge bg-dark px-3 py-2" style="font-size: 0.66rem;">📄 Documento PDF listo para archivar</div>
      </div>

      <div v-if="compresionEstado === 'comprimiendo'" class="progreso-caja">
        <div class="d-flex justify-content-between" style="font-size: 0.62rem;">
          <span class="text-muted">🗜️ {{ compresionEtapa || 'Comprimiendo documento…' }}</span>
          <span class="text-muted">{{ Math.round(compresionProgreso * 100) }}%</span>
        </div>
        <div class="progress" style="height: 4px;">
          <div class="progress-bar bg-success" :style="{ width: (compresionProgreso * 100) + '%' }"></div>
        </div>
      </div>
      <div v-else-if="compresionEstado === 'listo'" class="text-success mb-1" style="font-size: 0.62rem;">✔ Documento optimizado para guardar</div>

      <div v-if="lecturaEstado === 'leyendo'" class="progreso-caja">
        <div class="d-flex justify-content-between" style="font-size: 0.62rem;">
          <span class="text-muted">🔍 {{ lecturaEtapa || 'Leyendo el oficio…' }}</span>
          <span class="text-muted">{{ Math.round(lecturaProgreso * 100) }}%</span>
        </div>
        <div class="progress" style="height: 4px;">
          <div class="progress-bar bg-info" :style="{ width: (lecturaProgreso * 100) + '%' }"></div>
        </div>
      </div>
      <div v-else-if="lecturaEstado === 'exito' && resumenLectura" class="alert alert-info py-1 px-2 mb-2" style="font-size: 0.62rem;">
        <strong>📋 Lectura {{ resumenLectura.metodo }}:</strong>
        <span v-if="resumenLectura.leidos.length"> leído: {{ resumenLectura.leidos.join(', ') }}.</span>
        <span v-if="resumenLectura.faltantes.length"> Por completar a mano: {{ resumenLectura.faltantes.join(', ') }}.</span>
        <span v-if="!resumenLectura.leidos.length"> No se leyeron campos con certeza: complételos a mano.</span>
      </div>
      <div v-else-if="lecturaEstado === 'error'" class="alert alert-warning py-1 px-2 mb-2" style="font-size: 0.62rem;">
        <strong>⚠️ No se pudo leer el documento:</strong> {{ lecturaError }} — puede archivar de todas formas completando los campos a mano.
      </div>

      <!-- Campos del oficio (dato estricto del documento o vacío) -->
      <div class="row g-2 mb-2">
        <div class="col-6 col-md-3">
          <label class="etiqueta-campo">N° de Oficio</label>
          <input v-model.trim="form.numeroOficio" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Del documento" />
        </div>
        <div class="col-6 col-md-3">
          <label class="etiqueta-campo">Fecha del Oficio</label>
          <input v-model.trim="form.fechaDocumento" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Del documento" />
        </div>
        <div class="col-12 col-md-6">
          <label class="etiqueta-campo">Destinatario (a quién se responde)</label>
          <input v-model.trim="form.destinatario" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Peticionario original" />
        </div>
        <div class="col-12 col-md-6">
          <label class="etiqueta-campo">Firmante / Remitente oficial</label>
          <input v-model.trim="form.firmante" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Quien suscribe el oficio" />
        </div>
        <div class="col-12">
          <label class="etiqueta-campo">Asunto</label>
          <input v-model.trim="form.asunto" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Asunto del oficio de respuesta" />
        </div>
        <div class="col-12 col-md-8">
          <label class="etiqueta-campo">Lugar y Fecha</label>
          <input v-model.trim="form.lugarFecha" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Ej: San Gil, 5 de septiembre de 2026" />
        </div>
        <div class="col-12 col-md-4">
          <label class="etiqueta-campo">Observaciones</label>
          <input v-model.trim="form.observaciones" type="text" class="form-control form-control-sm" style="font-size: 0.68rem;" placeholder="Opcional" />
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-sm btn-light border px-3" style="font-size: 0.7rem;" @click="cerrarForm">Cancelar</button>
        <button
          type="button"
          class="btn btn-sm btn-primary fw-bold px-3 d-inline-flex align-items-center gap-1"
          style="font-size: 0.7rem;"
          :disabled="guardando"
          @click="archivar"
        >
          <span v-if="guardando" class="spinner-border spinner-border-sm" role="status"></span>
          {{ guardando ? '⏳ Archivando…' : '💾 Archivar respuesta' }}
        </button>
      </div>
      <small class="text-muted d-block mt-1" style="font-size: 0.6rem;">
        Al archivar, el radicado {{ radicado?.numeroRadicado }} queda marcado como <strong>Resuelto</strong>.
      </small>
    </div>

    <!-- ═══════════ ALERTA LOCAL ═══════════ -->
    <div v-if="alerta.mensaje" :class="['alert', `alert-${alerta.tipo}`, 'alert-dismissible', 'fade', 'show', 'py-1', 'px-2', 'mb-2']" role="alert" style="font-size: 0.68rem;">
      <strong>{{ alerta.titulo }}: </strong>{{ alerta.mensaje }}
      <button type="button" class="btn-close btn-close-sm" style="padding: 0.15rem;" @click="alerta.mensaje = ''" aria-label="Cerrar"></button>
    </div>

    <!-- ═══════════ LISTA DE RESPUESTAS ═══════════ -->
    <div v-if="cargando" class="text-center text-muted py-3" style="font-size: 0.72rem;">⏳ Cargando respuestas…</div>

    <div v-else-if="!lista.length" class="sin-respuestas text-center py-3">
      <div style="font-size: 1.4rem;">📭</div>
      <p class="mb-0 text-muted" style="font-size: 0.72rem;">
        {{ sinConexion
          ? '⚠️ Sin conexión con el servidor — no fue posible cargar las respuestas.'
          : modoGlobal
            ? 'Aún no hay respuestas archivadas. Ábrala desde un radicado para archivar su oficio de respuesta.'
            : 'Este radicado aún no tiene respuestas archivadas.' }}
      </p>
    </div>

    <div v-else class="respuestas-lista">
      <div
        v-for="r in lista"
        :key="r.id"
        :class="['respuesta-card', { activa: visor.abierta && visor.abierta.id === r.id }]"
      >
        <div class="fila-superior">
          <span class="oficio-badge">{{ r.numeroOficio || 'Oficio s/n' }}</span>
          <span v-if="modoGlobal" class="rad-ref" :title="'Radicado padre'">🗂 {{ r.numeroRadicado }}</span>
          <span class="text-muted ms-auto fecha-archivado" title="Archivada">🕘 {{ formatearFecha(r.fechaRespuesta) }}</span>
        </div>
        <div v-if="r.asunto" class="asunto-linea">{{ r.asunto }}</div>
        <div class="meta-linea">
          <span v-if="r.destinatario" title="Destinatario">👤 {{ r.destinatario }}</span>
          <span v-if="r.firmante" title="Firmante / Remitente oficial">✍️ {{ r.firmante }}</span>
          <span v-if="r.fechaDocumento" title="Fecha del oficio">📅 {{ r.fechaDocumento }}</span>
          <span v-if="r.lugarFecha" title="Lugar y fecha">📍 {{ r.lugarFecha }}</span>
          <span v-if="r.observaciones" title="Observaciones">📝 {{ r.observaciones }}</span>
        </div>
        <div class="pie-tarjeta">
          <span class="text-truncate me-auto">
            <span class="text-muted" style="font-size: 0.58rem;">📎</span>
            <span class="text-dark" style="font-size: 0.62rem;">{{ r.archivoNombre || 'respuesta.pdf' }}</span>
            <span class="text-muted ms-2" style="font-size: 0.6rem;">· {{ r.registradoPor || '—' }}</span>
          </span>
          <span class="d-inline-flex align-items-center gap-1 flex-shrink-0">
            <button type="button" class="btn-accion-respuesta ver" @click="verRespuesta(r)" title="Ver documento de la respuesta">👁</button>
            <template v-if="editable">
              <button v-if="confirmarEliminarId !== r.id" type="button" class="btn-accion-respuesta eliminar" @click="confirmarEliminarId = r.id" title="Eliminar respuesta">🗑</button>
              <template v-else>
                <span class="text-danger fw-bold" style="font-size: 0.62rem;">¿Eliminar?</span>
                <button type="button" class="btn-accion-respuesta eliminar" @click="eliminarRespuesta(r)" title="Confirmar eliminación">✔</button>
                <button type="button" class="btn-accion-respuesta" @click="confirmarEliminarId = null" title="Cancelar">✖</button>
              </template>
            </template>
          </span>
        </div>
      </div>
    </div>

    <!-- ═══════════ VISOR DEL DOCUMENTO DE RESPUESTA ═══════════ -->
    <div v-if="visor.abierta" class="visor-caja mt-2 animate-fade-in">
      <div class="d-flex align-items-center justify-content-between gap-2 px-2 py-1 bg-light border-bottom rounded-top">
        <div class="text-truncate me-auto">
          <small class="d-block text-muted fw-bold" style="font-size: 0.58rem;">📎 OFICIO DE RESPUESTA — {{ visor.abierta.numeroRadicado }}</small>
          <strong class="text-dark d-block text-truncate" style="font-size: 0.68rem;">
            {{ visor.abierta.archivoNombre || (visor.abierta.numeroOficio ? visor.abierta.numeroOficio + '.pdf' : 'Respuesta.pdf') }}
          </strong>
        </div>
        <a
          v-if="visor.url"
          :href="visor.url"
          target="_blank"
          class="btn btn-outline-primary btn-sm py-0 px-2 flex-shrink-0"
          style="font-size: 0.62rem;"
          title="Abrir en una pestaña nueva a pantalla completa"
        >↗️ Abrir Archivo</a>
        <button type="button" class="btn-close btn-close-sm flex-shrink-0" @click="cerrarVisor" aria-label="Cerrar visor"></button>
      </div>
      <div class="pdf-container rounded-3 border bg-dark bg-opacity-75 overflow-auto position-relative p-2" style="min-height: 300px; max-height: 480px;">
        <div v-if="visor.cargando" class="d-flex align-items-center justify-content-center text-white-50" style="font-size: 0.75rem; min-height: 240px;">
          ⏳ Cargando documento…
        </div>

        <!-- PDF de la respuesta -->
        <object
          v-else-if="visor.url && !esImagen(visor.mime)"
          :data="visor.url"
          type="application/pdf"
          class="w-100 rounded-3 border-0 bg-white"
          style="min-height: 380px;"
        >
          <iframe :src="visor.url" class="w-100 h-100 rounded-3 border-0 bg-white" style="min-height: 380px;" title="Visor PDF Oficio de Respuesta"></iframe>
        </object>

        <!-- Imagen escaneada -->
        <div v-else-if="visor.url" class="w-100 text-center">
          <div class="badge bg-info text-dark mb-2 shadow-sm px-3 py-1 fw-bold">IMAGEN ADJUNTA</div>
          <img :src="visor.url" class="img-fluid rounded shadow bg-white border w-100" style="max-width: 680px; object-fit: contain;" alt="Oficio de respuesta escaneado" />
        </div>

        <!-- Error de carga (reintentable) -->
        <div v-else-if="visor.error" class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 240px;">
          <div style="font-size: 1.8rem;">⚠️</div>
          <p class="text-warning mb-2" style="font-size: 0.75rem;">{{ visor.error }}</p>
          <button class="btn btn-outline-light btn-sm px-3" style="font-size: 0.7rem;" @click="verRespuesta(visor.abierta)">🔄 Reintentar</button>
        </div>

        <!-- Sin documento (estado honesto) -->
        <div v-else class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 240px;">
          <div style="font-size: 1.8rem;">📄</div>
          <p class="text-white-50 mb-0" style="font-size: 0.75rem;">Esta respuesta no tiene documento adjunto en la base de datos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import respuestasService from '../services/respuestasService.js'
import ocrRadicados from '../services/ocrRadicados.js'
import compressorRadicados from '../services/compressorRadicados.js'
import authService from '../../auth/services/authService.js'

/**
 * Panel de Oficios de Respuesta de radicados — autocontenido para reutilizarse
 * en la vista de Radicados (editable, por radicado o archivo general) y en la
 * de Gerencia (solo consulta, dentro del modal de detalle).
 *
 * El flujo de archivo replica el del radicado: compresión y OCR en paralelo
 * sobre el archivo ORIGINAL (tokens SEPARADOS), el dato sale del documento o
 * el campo queda vacío, y el Base64 comprimido es el que viaja al servidor.
 */
const props = defineProps({
  /** Radicado padre (modo por radicado). null → archivo general de todas. */
  radicado: { type: Object, default: null },
  /** true → puede archivar y eliminar (encargada de Radicados). */
  editable: { type: Boolean, default: false }
})
const emit = defineEmits(['cambiaron'])

const modoGlobal = computed(() => !props.radicado)
const puedeArchivar = computed(() => props.editable && !!props.radicado)

// ── Lista ────────────────────────────────────────────────────────────────────
const lista = ref([])
const cargando = ref(false)
// Token de recarga: una recarga tardía no pisa la lista de otra más nueva.
let listaToken = 0
let desuscribirCambios = () => {}
// "Sin conexión" ≠ "sin respuestas": obtenerTodas devuelve [] en ambas.
const sinConexion = computed(() => !cargando.value && !lista.value.length && respuestasService.ultimoOrigen === null)

const cargar = async () => {
  const token = ++listaToken
  cargando.value = true
  const data = await respuestasService.obtenerTodas(props.radicado?.id || null)
  if (token !== listaToken) return
  lista.value = data
  cargando.value = false
}

// ── Archivar respuesta (escaneo → compresión+OCR → campos → POST) ───────────
const inputArchivo = ref(null)
const formAbierto = ref(false)
const guardando = ref(false)
const form = reactive({
  numeroOficio: '', destinatario: '', asunto: '',
  fechaDocumento: '', lugarFecha: '', firmante: '', observaciones: ''
})
const archivoDataUrl = ref('')
const archivoNombre = ref('')
// Previsualización local del archivo elegido (URL de objeto → revocar siempre)
const archivoVistaUrl = ref(null)
const vistaMime = ref('')

const compresionEstado = ref(null) // null | 'comprimiendo' | 'listo'
const compresionEtapa = ref('')
const compresionProgreso = ref(0)
const lecturaEstado = ref(null) // null | 'leyendo' | 'exito' | 'error'
const lecturaEtapa = ref('')
const lecturaProgreso = ref(0)
const lecturaError = ref('')
const resumenLectura = ref(null) // { metodo, leidos: [], faltantes: [] }

// Compresión y OCR corren en PARALELO sobre el mismo archivo: tokens SEPARADOS
// (uno compartido haría que el que arranca segundo venza al primero).
let tokenCompresion = 0
let tokenLectura = 0

const CAMPOS_LEIBLES = [
  ['numeroOficio', 'número de oficio'],
  ['fechaDocumento', 'fecha del oficio'],
  ['destinatario', 'destinatario'],
  ['firmante', 'firmante'],
  ['asunto', 'asunto'],
  ['lugarFecha', 'lugar y fecha']
]

const iniciarArchivar = () => {
  formAbierto.value = true
  if (!archivoDataUrl.value) inputArchivo.value?.click()
}

const onArchivo = (event) => {
  const file = event.target.files[0]
  event.target.value = '' // permite re-seleccionar el mismo archivo
  if (!file) return
  formAbierto.value = true

  // Previsualización inmediata con el original
  if (archivoVistaUrl.value && archivoVistaUrl.value.startsWith('blob:')) URL.revokeObjectURL(archivoVistaUrl.value)
  archivoVistaUrl.value = URL.createObjectURL(file)
  vistaMime.value = file.type || ''
  archivoNombre.value = file.name
  archivoDataUrl.value = ''
  lecturaError.value = ''
  resumenLectura.value = null

  // Estados en vuelo desde ya (como VistaRadicados): sin esto las barras de
  // progreso jamás aparecen y el guard de archivar() nunca dispara.
  compresionEstado.value = 'comprimiendo'
  compresionEtapa.value = ''
  compresionProgreso.value = 0
  lecturaEstado.value = 'leyendo'
  lecturaEtapa.value = ''
  lecturaProgreso.value = 0

  // El dato sale de ESTE documento: lo leído del anterior no sobrevive al
  // cambio de archivo (regla: campo del documento o vacío, nunca de otro oficio).
  for (const [campo] of CAMPOS_LEIBLES) form[campo] = ''
  form.observaciones = ''

  comprimirArchivo(file, ++tokenCompresion)
  leerOficio(file, ++tokenLectura)
}

// Comprimir para guardar en BD; si falla, cae al original sin comprimir.
const comprimirArchivo = async (file, token) => {
  try {
    const resultado = await compressorRadicados.comprimir(file, (etapa, p) => {
      if (token !== tokenCompresion) return
      compresionEtapa.value = etapa
      compresionProgreso.value = p
    })
    if (token !== tokenCompresion) return
    archivoDataUrl.value = resultado.dataUrl
    archivoNombre.value = resultado.nombre
    compresionEstado.value = 'listo'
  } catch (err) {
    if (token !== tokenCompresion) return
    const reader = new FileReader()
    reader.onload = (e) => {
      if (token !== tokenCompresion) return
      archivoDataUrl.value = e.target.result
      compresionEstado.value = 'listo'
    }
    reader.onerror = () => {
      archivoDataUrl.value = ''
      compresionEstado.value = null
      alertar('warning', 'Documento no legible', 'No fue posible leer el archivo seleccionado.')
    }
    reader.readAsDataURL(file)
  }
}

// OCR en el navegador + parseo de campos del oficio en el servidor.
const leerOficio = async (file, token) => {
  try {
    const { texto, metodo } = await ocrRadicados.extraerTexto(file, (etapa, progreso) => {
      if (token !== tokenLectura) return
      lecturaEtapa.value = etapa
      lecturaProgreso.value = progreso
    })
    if (token !== tokenLectura) return
    lecturaEtapa.value = 'Interpretando los datos del oficio…'
    let campos = {}
    try {
      campos = await respuestasService.extraerCampos(texto)
    } catch (e) { /* parser inalcanzable: los campos quedan vacíos para llenar a mano */ }
    if (token !== tokenLectura) return
    aplicarCampos(campos, metodo)
    lecturaEstado.value = 'exito'
  } catch (err) {
    if (token !== tokenLectura) return
    lecturaError.value = err?.message || 'Error desconocido durante la lectura.'
    lecturaEstado.value = 'error'
  }
}

// Solo se llenan los campos con dato real del oficio: lo que no apareció queda
// vacío para que el usuario lo complete (nunca se inventa).
const aplicarCampos = (campos, metodo) => {
  const leidos = []
  const faltantes = []
  for (const [campo, etiqueta] of CAMPOS_LEIBLES) {
    const valor = (campos[campo] || '').toString().trim()
    if (valor) {
      form[campo] = valor
      leidos.push(etiqueta)
    } else {
      faltantes.push(etiqueta)
    }
  }
  resumenLectura.value = { metodo, leidos, faltantes }
}

const archivar = async () => {
  // Si la compresión sigue en vuelo, el Base64 aún no está listo: archivar
  // ahora crearía una respuesta SIN documento (pérdida silenciosa).
  if (compresionEstado.value === 'comprimiendo') {
    alertar('warning', 'Documento en optimización', 'Espere a que la compresión termine antes de archivar.')
    return
  }
  if (!archivoDataUrl.value) {
    alertar('warning', 'Falta el documento', 'Seleccione el oficio escaneado (PDF o imagen) para archivar.')
    return
  }
  guardando.value = true
  try {
    await respuestasService.crear({
      radicadoId: props.radicado.id,
      numeroOficio: form.numeroOficio,
      destinatario: form.destinatario,
      asunto: form.asunto,
      fechaDocumento: form.fechaDocumento,
      lugarFecha: form.lugarFecha,
      firmante: form.firmante,
      observaciones: form.observaciones,
      archivoNombre: archivoNombre.value,
      archivoBase64: archivoDataUrl.value,
      registradoPor: authService.getUsuarioActual()?.email || ''
    })
    cerrarForm()
    await cargar()
    emit('cambiaron')
    alertar('success', 'Respuesta archivada', `La respuesta del radicado ${props.radicado.numeroRadicado} quedó guardada en la base de datos.`)
  } catch (err) {
    alertar('danger', 'Error al archivar', err?.message || 'No se pudo archivar la respuesta.')
  } finally {
    guardando.value = false
  }
}

const cerrarForm = () => {
  // Invalida compresión/lectura en vuelo y libera el blob de previsualización.
  tokenCompresion++
  tokenLectura++
  if (archivoVistaUrl.value && archivoVistaUrl.value.startsWith('blob:')) URL.revokeObjectURL(archivoVistaUrl.value)
  archivoVistaUrl.value = null
  vistaMime.value = ''
  archivoDataUrl.value = ''
  archivoNombre.value = ''
  compresionEstado.value = null
  lecturaEstado.value = null
  lecturaError.value = ''
  resumenLectura.value = null
  for (const [campo] of CAMPOS_LEIBLES) form[campo] = ''
  form.observaciones = ''
  formAbierto.value = false
}

// ── Visor del documento de respuesta ─────────────────────────────────────────
// Una respuesta abierta a la vez; token anti-carrera para abrir/cerrar rápido.
const visor = reactive({ abierta: null, url: null, mime: '', cargando: false, error: '' })
let visorToken = 0

const esImagen = (mime) => (mime || '').startsWith('image/')

const liberarVisorUrl = () => {
  if (visor.url && visor.url.startsWith('blob:')) URL.revokeObjectURL(visor.url)
  visor.url = null
}

const verRespuesta = async (r) => {
  const token = ++visorToken
  visor.abierta = r
  liberarVisorUrl()
  visor.error = ''
  visor.cargando = true
  try {
    const { url, mime } = await respuestasService.obtenerArchivoRespuesta(r.id)
    if (token !== visorToken) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      return
    }
    visor.url = url
    visor.mime = mime
  } catch (e) {
    if (token !== visorToken) return
    // 404 = sin documento real: estado honesto, no error reintentable.
    if (e && e.status === 404) return
    visor.error = (e && e.message) || 'No se pudo cargar el documento de la respuesta.'
  } finally {
    if (token === visorToken) visor.cargando = false
  }
}

const cerrarVisor = () => {
  visorToken++
  liberarVisorUrl()
  visor.abierta = null
  visor.error = ''
  visor.cargando = false
}

// ── Eliminar (dos pasos, en línea) ───────────────────────────────────────────
const confirmarEliminarId = ref(null)

const eliminarRespuesta = async (r) => {
  try {
    const resultado = await respuestasService.eliminar(r)
    if (visor.abierta && visor.abierta.id === r.id) cerrarVisor()
    confirmarEliminarId.value = null
    await cargar()
    emit('cambiaron')
    alertar('success', 'Respuesta eliminada', resultado.message || 'La respuesta fue eliminada de la base de datos.')
  } catch (err) {
    alertar('danger', 'Error al eliminar', err?.message || 'No se pudo eliminar la respuesta.')
  }
}

// ── Alerta local del panel ───────────────────────────────────────────────────
const alerta = reactive({ tipo: 'info', titulo: '', mensaje: '' })
let alertaTimer = null
const alertar = (tipo, titulo, mensaje) => {
  alerta.tipo = tipo
  alerta.titulo = titulo
  alerta.mensaje = mensaje
  clearTimeout(alertaTimer)
  alertaTimer = setTimeout(() => { alerta.mensaje = '' }, 6000)
}

// ── Utilidades ───────────────────────────────────────────────────────────────
const formatearFecha = (f) => {
  try {
    return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch (e) {
    return f || '—'
  }
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────
// Al montar: carga + suscripción (otra pestaña archiva → esta se refresca).
onMounted(() => {
  cargar()
  desuscribirCambios = respuestasService.suscribirCambios(() => cargar())
})

// Higiene: desuscribir, invalidar procesos en vuelo y revocar TODOS los blobs.
onUnmounted(() => {
  desuscribirCambios()
  tokenCompresion++
  tokenLectura++
  listaToken++
  visorToken++
  clearTimeout(alertaTimer)
  if (archivoVistaUrl.value && archivoVistaUrl.value.startsWith('blob:')) URL.revokeObjectURL(archivoVistaUrl.value)
  liberarVisorUrl()
})

// Cambio de radicado padre (modal reutilizado): recarga todo el contexto.
watch(() => props.radicado?.id, () => {
  cerrarVisor()
  cerrarForm()
  confirmarEliminarId.value = null
  cargar()
})
</script>

<style scoped>
/* Panel compacto institucional — mismo lenguaje visual del módulo Radicados. */
.respuestas-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 0.6rem 0.7rem;
}

.respuestas-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.45rem;
  margin-bottom: 0.45rem;
  border-bottom: 1px solid #e9ecef;
}

/* Caja de archivo: formulario del oficio con el documento en proceso */
.archivar-caja {
  border: 1px dashed #0d6efd;
  border-radius: 8px;
  background: #f8faff;
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
}

.documento-fila {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  padding: 0.35rem 0.5rem;
  margin-bottom: 0.5rem;
}

.progreso-caja {
  margin-bottom: 0.5rem;
}

.etiqueta-campo {
  display: block;
  color: #64748b;
  font-size: 0.6rem;
  font-weight: 600;
  margin-bottom: 0.15rem;
}

/* Lista de respuestas archivadas */
.respuestas-lista {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 2px;
}

.respuesta-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 0.45rem 0.6rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.respuesta-card:hover {
  border-color: #94a3b8;
}
.respuesta-card.activa {
  border-color: #0d6efd;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.12);
}

.fila-superior {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.oficio-badge {
  background: linear-gradient(135deg, #004884, #02203d);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 5px;
  padding: 0.12rem 0.45rem;
}

.rad-ref {
  background: #eef4ff;
  color: #004884;
  font-size: 0.62rem;
  font-weight: 600;
  border-radius: 5px;
  padding: 0.12rem 0.4rem;
}

.fecha-archivado {
  font-size: 0.62rem;
}

.asunto-linea {
  color: #0f172a;
  font-size: 0.68rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.meta-linea {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  color: #475569;
  font-size: 0.64rem;
  margin-top: 0.2rem;
}

.pie-tarjeta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
  padding-top: 0.3rem;
  border-top: 1px dashed #e9ecef;
}

/* Botones de acción de cada tarjeta (28×28, como los del módulo) */
.btn-accion-respuesta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.12s ease;
}
.btn-accion-respuesta:hover {
  transform: scale(1.06);
}
.btn-accion-respuesta.ver {
  color: #004884;
  border-color: #b6d4f5;
  background: #f0f7ff;
}
.btn-accion-respuesta.eliminar {
  color: #dc3545;
  border-color: #f5b6bd;
  background: #fff5f6;
}

/* Visor embebido del documento de la respuesta */
.visor-caja {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.sin-respuestas {
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
  background: #fafcff;
}

@keyframes fadeInset {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeInset 0.18s ease;
}
</style>
