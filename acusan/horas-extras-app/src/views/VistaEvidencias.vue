<template>
  <LayoutApp activo="evidencias" :empleado="empleado">

    <!-- Alerta de resultado -->
    <div v-if="alerta.msg" :class="['alert', `alert--${alerta.tipo}`]">
      <span>{{ alerta.icono }}</span>
      <span>{{ alerta.msg }}</span>
    </div>

    <!-- Barra de cola offline -->
    <div v-if="pendientes > 0" class="offline-bar">
      <span>📥 {{ pendientes }} pendiente{{ pendientes === 1 ? '' : 's' }} de sincronizar</span>
      <button class="offline-bar__btn" :disabled="sincronizando" @click="sincronizarPendientes">
        <span v-if="sincronizando" class="spinner spinner--mini"></span>
        <span v-else>↻ Reintentar</span>
      </button>
    </div>

    <!-- Cargando sesión activa -->
    <div v-if="cargandoSesion" class="empty-state">
      <div class="spinner" style="margin: 0 auto 12px;"></div>
      <p>Buscando tu sesión activa...</p>
    </div>

    <!-- Procesando foto (compresión + subida) -->
    <div v-else-if="procesando.activo" class="card card--proceso">
      <div class="spinner" style="margin: 0 auto 10px;"></div>
      <p class="proceso-etapa">{{ procesando.etapa }}</p>
      <p class="proceso-sub">No cierres la app mientras se envía la evidencia.</p>
    </div>

    <!-- SESIÓN EN CURSO -->
    <div v-else-if="sesionActiva" class="card sesion-card">
      <div class="sesion-head">
        <span class="sesion-estado"><span class="pulso-dot"></span> Sesión en curso</span>
        <span
          v-if="sesionActiva.pendienteLocal || finalPendiente"
          class="badge badge--ev badge--ev-pendiente_revision"
        >⏳ Por sincronizar</span>
      </div>

      <div class="sesion-timer">{{ transcurrido }}</div>
      <div class="sesion-inicio">Iniciada {{ horaInicio }} · {{ fechaInicioTxt }}</div>

      <div class="sesion-datos">
        <div class="sesion-dato">
          <span>Cuadrilla / Área</span>
          <strong>{{ sesionActiva.cuadrillaArea }}</strong>
        </div>
        <div v-if="sesionActiva.justificacion || sesionActiva.descripcion" class="sesion-dato">
          <span>Descripción inicial</span>
          <strong>{{ sesionActiva.justificacion || sesionActiva.descripcion }}</strong>
        </div>
      </div>

      <img v-if="fotoUrl" :src="fotoUrl" class="sesion-foto" alt="Foto inicial de la evidencia" />

      <div v-if="finalPendiente" class="alert alert--info" style="margin-bottom: 4px;">
        <span>ℹ️</span>
        <span>Foto final guardada sin conexión. Se enviará automáticamente al recuperar la señal.</span>
      </div>

      <template v-else>
        <div class="field">
          <label for="descFinal">
            Descripción del cierre <span class="label-opcional">(opcional)</span>
          </label>
          <textarea
            id="descFinal"
            v-model="descripcionFinal"
            rows="2"
            placeholder="Ej: ruptura reparada y presión probada..."
          ></textarea>
        </div>

        <button class="boton-foto boton-foto--final" @click="abrirCamara('final')">
          <span class="boton-foto__icono">📷</span>
          <span>Finalizar — Tomar Foto Final</span>
          <span class="boton-foto__sub">La hora y ubicación del cierre quedan registradas</span>
        </button>
      </template>

      <button class="btn btn--danger" style="margin-top: 10px;" @click="anularSesion">
        🗑️ Anular sesión
      </button>
    </div>

    <!-- RESUMEN tras finalizar -->
    <div v-else-if="resumen" class="card resumen-card">
      <div class="resumen-titulo">✅ Sesión finalizada</div>
      <p class="resumen-sub">Tu evidencia quedó registrada y pasará a revisión del Encargado.</p>

      <div class="resumen-grid">
        <div class="resumen-item">
          <span class="resumen-item__lbl">Duración</span>
          <span class="resumen-item__val">{{ resumen.duracion }}</span>
        </div>
        <div class="resumen-item">
          <span class="resumen-item__lbl">Horas reconocidas</span>
          <span class="resumen-item__val">{{ resumen.horas }}</span>
        </div>
        <div class="resumen-item">
          <span class="resumen-item__lbl">Tipo calculado</span>
          <span class="resumen-item__val">{{ resumen.tipo }}</span>
        </div>
        <div v-if="resumen.turno" class="resumen-item">
          <span class="resumen-item__lbl">Turno</span>
          <span class="resumen-item__val">{{ resumen.turno }}</span>
        </div>
      </div>

      <p v-if="resumen.aviso" class="resumen-aviso">ℹ️ {{ resumen.aviso }}</p>

      <div v-if="resumen.desglose.length" class="resumen-desglose">
        <div class="card__title" style="margin-bottom: 6px;"><span>📊</span> Desglose</div>
        <div v-for="d in resumen.desglose" :key="d.etiqueta" class="desglose-fila">
          <span>{{ d.etiqueta }}</span>
          <strong>{{ d.valor }}</strong>
        </div>
      </div>

      <button class="btn btn--primary" @click="cerrarResumen">Nueva sesión</button>
    </div>

    <!-- SIN SESIÓN: formulario de inicio -->
    <div v-else class="card">
      <div class="card__title"><span>📷</span> Registrar Evidencia</div>
      <p class="intro-evidencias">
        Toma una foto al <strong>iniciar</strong> tu hora extra y otra al <strong>finalizar</strong>.
        El sistema registra la hora y ubicación de cada foto, y calcula las horas automáticamente.
      </p>

      <form @submit.prevent>
        <div class="field">
          <label for="cuadrillaEv">Cuadrilla / Área de Trabajo</label>
          <input
            id="cuadrillaEv"
            v-model="form.cuadrillaArea"
            type="text"
            placeholder="Ej: Cuadrilla Norte, Planta de Tratamiento..."
          />
        </div>
        <div class="field">
          <label for="descInicial">
            Descripción <span class="label-opcional">(opcional)</span>
          </label>
          <textarea
            id="descInicial"
            v-model="form.descripcion"
            rows="2"
            placeholder="Ej: fuga reportada en el sector norte..."
          ></textarea>
        </div>

        <button
          class="boton-foto"
          type="button"
          :disabled="!form.cuadrillaArea.trim()"
          @click="abrirCamara('inicial')"
        >
          <span class="boton-foto__icono">📷</span>
          <span>Tomar Foto Inicial</span>
          <span class="boton-foto__sub">Se registra hora y ubicación automáticamente</span>
        </button>
        <p v-if="!form.cuadrillaArea.trim()" class="field-hint2">
          Diligencia la cuadrilla o área para habilitar la cámara.
        </p>
      </form>
    </div>

    <!-- Inputs de cámara ocultos -->
    <input
      ref="inputInicial"
      type="file"
      accept="image/*"
      capture="environment"
      class="input-oculto"
      @change="fotoSeleccionada($event, 'inicial')"
    />
    <input
      ref="inputFinal"
      type="file"
      accept="image/*"
      capture="environment"
      class="input-oculto"
      @change="fotoSeleccionada($event, 'final')"
    />
  </LayoutApp>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { authService, evidenciasService } from '@/services/api.js'
import { comprimirImagen } from '@/services/compressorEvidencias.js'
import { evidenciasOffline } from '@/services/evidenciasOffline.js'
import { obtenerPosicion } from '@/services/geoService.js'
import LayoutApp from '@/components/LayoutApp.vue'

const empleado = authService.getEmpleado()

const TIPOS_LABEL = {
  DIURNA: 'Extra Diurna (HED)',
  NOCTURNA: 'Extra Nocturna (HEN)',
  FESTIVA_DIURNA: 'Festiva Diurna (HEFD)',
  FESTIVA_NOCTURNA: 'Festiva Nocturna (HEFN)'
}

// Etiquetas para claves conocidas del recargoDesglose (Json del servidor)
const ETIQUETAS_DESGLOSE = {
  diurnas: 'Extra diurna',
  nocturnas: 'Extra nocturna',
  festivasDiurnas: 'Festiva diurna',
  festivasNocturnas: 'Festiva nocturna',
  DIURNA: 'Extra diurna',
  NOCTURNA: 'Extra nocturna',
  FESTIVA_DIURNA: 'Festiva diurna',
  FESTIVA_NOCTURNA: 'Festiva nocturna'
}

// ── Estado general ───────────────────────────────────────────────────────────
const alerta = ref({ msg: '', tipo: 'success', icono: '✅' })
const cargandoSesion = ref(true)
const sesionActiva = ref(null)      // HoraExtra EN_CURSO (o sesión local pendiente)
const evidenciaInicial = ref(null)  // evidencia INICIAL sin foto (para miniatura)
const fotoUrl = ref('')
const resumen = ref(null)
const finalPendiente = ref(false)   // foto final encolada, esperando sincronizar
const idFinalPendiente = ref(null)  // idLocal del FINALIZAR encolado (para anular)
const pendientes = ref(0)
const sincronizando = ref(false)
const procesando = ref({ activo: false, etapa: '' })

const form = ref({ cuadrillaArea: '', descripcion: '' })
const descripcionFinal = ref('')

const inputInicial = ref(null)
const inputFinal = ref(null)

// ── Contador de tiempo transcurrido ──────────────────────────────────────────
const ahora = ref(Date.now())
let intervaloTimer = null

const transcurrido = computed(() => {
  const inicio = sesionActiva.value?.fechaInicio
    ? new Date(sesionActiva.value.fechaInicio).getTime()
    : 0
  if (!inicio) return '0:00:00'
  let seg = Math.max(0, Math.floor((ahora.value - inicio) / 1000))
  const h = Math.floor(seg / 3600)
  seg %= 3600
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const horaInicio = computed(() =>
  sesionActiva.value?.fechaInicio
    ? new Date(sesionActiva.value.fechaInicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : ''
)

const fechaInicioTxt = computed(() =>
  sesionActiva.value?.fechaInicio
    ? new Date(sesionActiva.value.fechaInicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : ''
)

// ── Utilidades ───────────────────────────────────────────────────────────────
const mostrarAlerta = (tipo, msg) => {
  const iconos = { success: '✅', error: '⚠️', info: 'ℹ️' }
  alerta.value = { msg, tipo, icono: iconos[tipo] }
  setTimeout(() => { alerta.value.msg = '' }, 6000)
}

// Error de red: fetch lanza TypeError si no hay conexión; SyntaxError si el
// backend cayó a mitad de respuesta («Unexpected end of JSON input»).
const esErrorRed = (e) =>
  e instanceof TypeError || e instanceof SyntaxError || /network|fetch/i.test(e?.message || '')

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const fmtDuracion = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

// recargoDesglose llega como Json: acepta {tipo: horas} o [{tipo, horas}].
// Solo los 4 tipos de recargo son horas — totalHoras/horasOrdinariasDentroTurno/
// festivosAplicados son metadatos del cálculo y no se muestran como horas.
const TIPOS_DESGLOSE = ['DIURNA', 'NOCTURNA', 'FESTIVA_DIURNA', 'FESTIVA_NOCTURNA']
const parsearDesglose = (desglose) => {
  if (!desglose) return []
  const pares = []
  if (Array.isArray(desglose)) {
    for (const d of desglose) {
      if (d && d.tipo != null) pares.push([d.tipo, d.horas])
    }
  } else if (typeof desglose === 'object') {
    for (const k of TIPOS_DESGLOSE) {
      const v = desglose[k]
      if (v != null && Number(v) !== 0) pares.push([k, v])
    }
  }
  return pares
    .filter(([, v]) => Number(v) !== 0)
    .map(([k, v]) => ({ etiqueta: ETIQUETAS_DESGLOSE[k] || String(k), valor: `${Number(v)} h` }))
}

// ── Miniatura de la foto inicial (opcional, con Authorization) ───────────────
const limpiarFoto = () => {
  if (fotoUrl.value) URL.revokeObjectURL(fotoUrl.value)
  fotoUrl.value = ''
  evidenciaInicial.value = null
}

const cargarFotoMiniatura = async () => {
  limpiarFoto()
  const id = evidenciaInicial.value?.id
  if (!id) return
  try {
    fotoUrl.value = await evidenciasService.obtenerFotoBlob(id)
  } catch (_) {
    // La miniatura es decorativa: si falla, la tarjeta funciona igual
  }
}

// ── Carga de sesión activa (servidor = fuente de verdad) ────────────────────
const cargarSesion = async ({ silencioso = false } = {}) => {
  if (!silencioso) cargandoSesion.value = true
  try {
    const data = await evidenciasService.miSesionActiva()
    if (data?.sesion) {
      sesionActiva.value = data.sesion
      evidenciaInicial.value = data.evidenciaInicial || null
      finalPendiente.value = false
      idFinalPendiente.value = null
      await evidenciasOffline.guardarSesionLocal(data.sesion)
      cargarFotoMiniatura()
    } else {
      // Sin sesión en el servidor: conservar la local SOLO si es un borrador
      // pendiente de sincronizar (su INICIAR sigue en la cola)
      const local = await evidenciasOffline.obtenerSesionLocal()
      if (local?.pendienteLocal) {
        sesionActiva.value = local
      } else {
        sesionActiva.value = null
        finalPendiente.value = false
        idFinalPendiente.value = null
        await evidenciasOffline.eliminarSesionLocal()
        limpiarFoto()
      }
    }
  } catch (e) {
    if (esErrorRed(e)) {
      // Sin conexión: mostrar el último estado conocido de este dispositivo
      const local = await evidenciasOffline.obtenerSesionLocal()
      if (local) {
        sesionActiva.value = local
        if (!silencioso) mostrarAlerta('info', 'Sin conexión: mostrando la sesión guardada en este dispositivo.')
      } else if (!silencioso) {
        mostrarAlerta('info', 'Sin conexión. Puedes iniciar una evidencia y se guardará para sincronizar después.')
      }
    } else if (!silencioso) {
      mostrarAlerta('error', e.message || 'No se pudo consultar la sesión activa.')
    }
  } finally {
    cargandoSesion.value = false
    // Reconstruir "foto final encolada" desde la cola: la app pudo reiniciarse
    // tras encolar el FINALIZAR sin sincronizar (sin esto ofrecería repetir
    // la foto final y crearía un segundo FINALIZAR)
    try {
      const s = sesionActiva.value
      if (s) {
        const enCola = (await evidenciasOffline.listarPendientes()).find((it) =>
          it.tipo === 'FINALIZAR' &&
          (it.horaExtraId ? String(it.horaExtraId) === String(s.id) : it.idLocalPadre === s.idLocalPadre)
        )
        finalPendiente.value = !!enCola
        idFinalPendiente.value = enCola?.idLocal || null
      }
    } catch { /* cola ilegible: no bloquea la carga de la sesión */ }
  }
}

const refrescarPendientes = async () => {
  pendientes.value = (await evidenciasOffline.listarPendientes()).length
}

// ── Tomar foto (inicial / final) ─────────────────────────────────────────────
const abrirCamara = (tipo) => {
  const input = tipo === 'inicial' ? inputInicial.value : inputFinal.value
  input?.click()
}

const fotoSeleccionada = async (evento, tipo) => {
  const file = evento.target.files?.[0]
  evento.target.value = '' // permite volver a seleccionar la misma foto
  if (!file) return
  if (tipo === 'inicial' && !form.value.cuadrillaArea.trim()) {
    mostrarAlerta('error', 'Diligencia la cuadrilla o área antes de tomar la foto.')
    return
  }
  if (tipo === 'final' && !sesionActiva.value) return
  await procesarEvidencia(tipo, file)
}

const procesarEvidencia = async (tipo, file) => {
  procesando.value = { activo: true, etapa: 'Comprimiendo foto...' }
  const capturadaEn = new Date().toISOString() // hora del DISPOSITIVO al capturar
  try {
    // Compresión y GPS en paralelo: ninguno retrasa al otro
    const [{ dataUrl }, posicion] = await Promise.all([
      comprimirImagen(file),
      obtenerPosicion()
    ])

    const body = {
      cuadrillaArea: tipo === 'inicial'
        ? form.value.cuadrillaArea.trim()
        : sesionActiva.value?.cuadrillaArea,
      descripcion: (tipo === 'inicial' ? form.value.descripcion : descripcionFinal.value).trim() || undefined,
      fotoBase64: dataUrl,
      capturadaEn,
      ...(posicion || {}) // latitud, longitud, precisionGps (si el GPS respondió)
    }

    procesando.value = { activo: true, etapa: 'Enviando evidencia...' }

    if (tipo === 'inicial') {
      const data = await evidenciasService.iniciar(body)
      if (!data?.horaExtra) throw new Error('Respuesta inesperada del servidor al iniciar.')
      sesionActiva.value = data.horaExtra
      evidenciaInicial.value = data.evidencia || null
      descripcionFinal.value = ''
      form.value = { cuadrillaArea: '', descripcion: '' }
      await evidenciasOffline.guardarSesionLocal(data.horaExtra)
      mostrarAlerta('success', 'Sesión iniciada. Recuerda tomar la foto final al terminar.')
      cargarFotoMiniatura()
    } else {
      const data = await evidenciasService.finalizar(sesionActiva.value.id, body)
      mostrarResumen(data)
    }
  } catch (e) {
    if (esErrorRed(e)) {
      await encolarEvidencia(tipo, capturadaEn, body)
    } else {
      mostrarAlerta('error', e.message || 'No se pudo enviar la evidencia.')
    }
  } finally {
    procesando.value = { activo: false, etapa: '' }
  }
}

// ── Cola offline ─────────────────────────────────────────────────────────────
const encolarEvidencia = async (tipo, capturadaEn, body) => {
  const idLocal = uid()
  const ok = await evidenciasOffline.guardarPendiente({
    idLocal,
    tipo: tipo === 'inicial' ? 'INICIAR' : 'FINALIZAR',
    // Si la sesión aún no tiene id de servidor, encadenar con su INICIAR pendiente
    horaExtraId: tipo === 'final' ? (sesionActiva.value?.id || undefined) : undefined,
    idLocalPadre: (tipo === 'final' && !sesionActiva.value?.id)
      ? sesionActiva.value?.idLocalPadre
      : undefined,
    payload: body,
    createdAt: new Date().toISOString()
  })

  if (!ok) {
    mostrarAlerta('error', 'Sin conexión y este navegador no permite guardar la evidencia offline. Vuelve a intentarlo cuando haya señal.')
    return
  }

  if (tipo === 'inicial') {
    // Sesión local pendiente: se muestra en curso aunque el servidor no la tenga
    sesionActiva.value = {
      pendienteLocal: true,
      idLocalPadre: idLocal,
      cuadrillaArea: body.cuadrillaArea,
      justificacion: body.descripcion || '',
      fechaInicio: capturadaEn
    }
    await evidenciasOffline.guardarSesionLocal(sesionActiva.value)
    form.value = { cuadrillaArea: '', descripcion: '' }
    mostrarAlerta('info', 'Sin conexión: la foto inicial quedó guardada y se sincronizará automáticamente.')
  } else {
    finalPendiente.value = true
    idFinalPendiente.value = idLocal
    descripcionFinal.value = ''
    mostrarAlerta('info', 'Sin conexión: la foto final quedó guardada y se sincronizará automáticamente.')
  }
  await refrescarPendientes()
}

const sincronizarPendientes = async () => {
  if (sincronizando.value) return
  sincronizando.value = true
  const antes = pendientes.value
  try {
    const items = await evidenciasOffline.listarPendientes()
    // idLocal de un INICIAR → id de HoraExtra en el servidor (encadena FINALIZAR)
    const idsResueltos = {}

    for (const item of items) {
      // FINALIZAR cuyo INICIAR ya no está en la cola (se sincronizó en una
      // corrida anterior y el mapa de ids es volátil): recuperar el id vía
      // mi-sesion-activa — el servidor garantiza UNA sesión EN_CURSO por
      // cédula, así que si existe, es su padre. Si no existe, la sesión se
      // cerró/anuló por otra vía y el FINALIZAR queda huérfano: se descarta
      // con aviso en lugar de bloquear la cola para siempre.
      if (item.tipo === 'FINALIZAR' && !item.horaExtraId && !idsResueltos[item.idLocalPadre]) {
        try {
          const activa = await evidenciasService.miSesionActiva()
          if (activa?.sesion?.id) {
            idsResueltos[item.idLocalPadre] = activa.sesion.id
          } else {
            await evidenciasOffline.eliminarPendiente(item.idLocal)
            mostrarAlerta('error', 'Una foto final quedó huérfana (su sesión ya no está abierta en el servidor) y fue descartada.')
            continue
          }
        } catch (e) {
          break // sin respuesta del servidor: reintentar en la próxima
        }
      }

      const idServidor = item.horaExtraId || idsResueltos[item.idLocalPadre]

      // FINALIZAR cuyo INICIAR aún no llegó: detener y reintentar después
      if (item.tipo === 'FINALIZAR' && !idServidor) break

      try {
        const data = item.tipo === 'INICIAR'
          ? await evidenciasService.iniciar(item.payload)
          : await evidenciasService.finalizar(idServidor, item.payload)
        if (item.tipo === 'INICIAR' && data?.horaExtra?.id) {
          idsResueltos[item.idLocal] = data.horaExtra.id
        }
        await evidenciasOffline.eliminarPendiente(item.idLocal)
      } catch (e) {
        if (esErrorRed(e)) break // volvimos a quedar offline: seguirá luego
        if (item.tipo === 'INICIAR' && e.status === 409) {
          // El servidor ya tiene una sesión en curso (ej: creada en otro
          // dispositivo): el efecto ya existe, la cola sobra
          await evidenciasOffline.eliminarPendiente(item.idLocal)
          continue
        }
        // TODO: llevar conteo de intentos por item para degradar errores definitivos
        mostrarAlerta('error', `Una evidencia no se pudo sincronizar: ${e.message}`)
      }
    }
  } finally {
    sincronizando.value = false
    await refrescarPendientes()
    if (pendientes.value === 0 && antes > 0) {
      mostrarAlerta('success', 'Evidencias sincronizadas correctamente.')
    }
    await cargarSesion({ silencioso: true })
  }
}

const alVolverOnline = () => {
  mostrarAlerta('info', 'Conexión recuperada: sincronizando evidencias...')
  sincronizarPendientes()
}

// ── Anulación y cierre ───────────────────────────────────────────────────────
const limpiarSesionLocal = async () => {
  sesionActiva.value = null
  finalPendiente.value = false
  idFinalPendiente.value = null
  descripcionFinal.value = ''
  limpiarFoto()
  await evidenciasOffline.eliminarSesionLocal()
}

const anularSesion = async () => {
  const s = sesionActiva.value
  if (!s) return
  if (!window.confirm('¿Anular esta sesión de evidencia? Las fotos no se enviarán a nómina.')) return
  try {
    if (!s.id) {
      // Sesión que solo existe en la cola local: descartar sus pendientes
      if (s.idLocalPadre) await evidenciasOffline.eliminarPendiente(s.idLocalPadre)
      if (idFinalPendiente.value) await evidenciasOffline.eliminarPendiente(idFinalPendiente.value)
    } else {
      await evidenciasService.anular(s.id)
      // Anulada en el servidor: su FINALIZAR encolado (si existe) sobra —
      // sin esto la cola lo reintentaría contra una sesión ya cerrada
      const huerfanos = (await evidenciasOffline.listarPendientes()).filter((it) =>
        it.tipo === 'FINALIZAR' &&
        (it.horaExtraId ? String(it.horaExtraId) === String(s.id) : it.idLocalPadre === s.idLocalPadre)
      )
      for (const h of huerfanos) await evidenciasOffline.eliminarPendiente(h.idLocal)
    }
    mostrarAlerta('info', 'Sesión anulada.')
  } catch (e) {
    if (esErrorRed(e)) {
      // TODO: encolar la anulación offline (hoy requiere conexión; la sesión queda activa)
      mostrarAlerta('info', 'Sin conexión: la anulación requiere señal. Intenta de nuevo más tarde.')
      return
    }
    mostrarAlerta('error', e.message || 'No se pudo anular la sesión.')
    return
  }
  await limpiarSesionLocal()
  await refrescarPendientes()
}

// ── Resumen tras finalizar ───────────────────────────────────────────────────
const mostrarResumen = (horaExtra) => {
  const ini = horaExtra?.fechaInicio ? new Date(horaExtra.fechaInicio) : null
  const fin = horaExtra?.fechaFin ? new Date(horaExtra.fechaFin) : null
  const horas = Number(horaExtra?.cantidadHoras) || 0
  resumen.value = {
    duracion: ini && fin ? fmtDuracion(fin - ini) : '—',
    horas: `${horas} h`,
    tipo: TIPOS_LABEL[horaExtra?.tipoRecargo] || horaExtra?.tipoRecargo || '—',
    turno: horaExtra?.turnoNombre || '',
    // Aviso del clasificador (ej: horas descontadas por turno) — llega adherido
    // al data por manejarRespuesta
    aviso: horaExtra?.aviso || '',
    desglose: parsearDesglose(horaExtra?.recargoDesglose)
  }
  limpiarSesionLocal()
}

const cerrarResumen = () => {
  resumen.value = null
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────
onMounted(async () => {
  intervaloTimer = setInterval(() => { ahora.value = Date.now() }, 1000)
  window.addEventListener('online', alVolverOnline)
  await Promise.all([cargarSesion(), refrescarPendientes()])
  // Reintentar automáticamente lo pendiente al entrar con conexión
  if (pendientes.value > 0 && navigator.onLine) {
    await sincronizarPendientes()
  }
})

onBeforeUnmount(() => {
  clearInterval(intervaloTimer)
  window.removeEventListener('online', alVolverOnline)
  if (fotoUrl.value) URL.revokeObjectURL(fotoUrl.value)
})
</script>
