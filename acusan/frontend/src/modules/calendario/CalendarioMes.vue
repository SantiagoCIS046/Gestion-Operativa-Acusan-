<template>
  <div
    class="calendario"
    :class="{ 'calendario--compacta': compacta }"
    tabindex="0"
    role="grid"
    aria-label="Calendario del mes"
    @keydown="alTeclar"
  >
    <div v-if="titulo || subtitulo" class="cal-encabezado">
      <h3 class="cal-titulo-tarjeta">{{ titulo }}</h3>
      <span v-if="subtitulo" class="cal-actualizado"><i></i>{{ subtitulo }}</span>
    </div>

    <div v-if="!sinNavegacion" class="cal-cabecera" role="toolbar" aria-label="Navegación del calendario">
      <div class="cal-nav">
        <button
          type="button"
          class="btn-flecha"
          title="Mes anterior (RePág)"
          aria-label="Mes anterior"
          @click="$emit('mover', -1)"
        >‹</button>
        <div class="cal-titulo">
          <select class="cal-select" :value="mes" aria-label="Mes" @change="irAMes(Number($event.target.value))">
            <option
              v-for="m in mesesOpciones"
              :key="m.valor"
              :value="m.valor"
              :disabled="m.deshabilitado"
            >
              {{ m.nombre }}
            </option>
          </select>
          <select class="cal-select cal-select--anio" :value="anio" aria-label="Año" @change="irAAnio(Number($event.target.value))">
            <option v-for="a in aniosFiltrados" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <button
          type="button"
          class="btn-flecha"
          title="Mes siguiente (AvPág)"
          aria-label="Mes siguiente"
          :disabled="esMesSiguienteInvalido"
          @click="$emit('mover', 1)"
        >›</button>
      </div>
      <button type="button" class="btn-hoy" @click="$emit('hoy')">Hoy</button>
    </div>

    <div class="cal-grid cal-grid--dias" role="row">
      <span v-for="d in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="d" class="cal-dia-semana">{{ d }}</span>
    </div>

    <div class="cal-grid cal-grid--mes">
      <span
        v-for="p in diasPrevios"
        :key="`prev-${p.fecha}`"
        class="cal-celda cal-celda--fuera"
        aria-hidden="true"
      >
        <span class="cal-fila-sup">
          <span class="cal-numero">{{ p.numero }}</span>
          <span class="cal-mes-adj">{{ mesCortoDe(p.fecha) }}</span>
        </span>
      </span>
      <button
        v-for="d in dias"
        :key="d.fecha"
        type="button"
        class="cal-celda"
        :class="[
          `cal-celda--${d.tipo}`,
          {
            'cal-celda--hoy': d.fecha === hoyISO_,
            'cal-celda--sel': d.fecha === seleccionada,
            'cal-celda--vence': (enviados[d.fecha] || 0) > 0,
            'cal-celda--pico': fechaPico && d.fecha === fechaPico,
            'cal-celda--inhab': inhabilitada(d),
          },
        ]"
        :disabled="inhabilitada(d)"
        role="gridcell"
        :aria-selected="d.fecha === seleccionada"
        :aria-current="d.fecha === hoyISO_ ? 'date' : undefined"
        :title="tituloDe(d)"
        @click="$emit('seleccionar', d.fecha)"
      >
        <span class="cal-fila-sup">
          <span class="cal-numero">{{ Number(d.fecha.slice(8, 10)) }}</span>
          <span v-if="d.fecha === hoyISO_" class="cal-hoy-tag">HOY</span>
          <span v-if="fechaPico && d.fecha === fechaPico" class="cal-pico-tag">PICO</span>
          <span v-if="d.nombreFestivo && !inhabilitada(d)" class="cal-estrella">★</span>
        </span>
        <span v-if="(enviados[d.fecha] || 0) > 0 && !inhabilitada(d)" class="cal-valor">
          {{ enviados[d.fecha] }}<small>rad.</small>
        </span>
      </button>
      <span
        v-for="p in diasSiguientes"
        :key="`sig-${p.fecha}`"
        class="cal-celda cal-celda--fuera"
        aria-hidden="true"
      >
        <span class="cal-fila-sup">
          <span class="cal-numero">{{ p.numero }}</span>
          <span class="cal-mes-adj">{{ mesCortoDe(p.fecha) }}</span>
        </span>
      </span>
    </div>

    <div v-if="!compacta" class="cal-leyenda">
      <span class="cal-ley"><i class="cal-swatch cal-swatch--vence"></i> Hábil con radicados</span>
      <span class="cal-ley"><i class="cal-swatch cal-swatch--festivo"></i> Festivo / no laboral ★</span>
      <span class="cal-ley"><i class="cal-swatch cal-swatch--fin"></i> Fin de semana</span>
      <span class="cal-ley"><i class="cal-swatch cal-swatch--sel"></i> Seleccionado</span>
      <span v-if="nota" class="cal-nota">{{ nota }}</span>
    </div>
    <p v-if="!compacta" class="cal-ayuda">Teclado: flechas mueven el día, RePág/AvPág cambian de mes, Inicio/Fin saltan al primero/último día.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import { hoyISO, sumaDias } from '@/utils/fechas.js'

const props = defineProps({
  anio: { type: Number, required: true },
  mes: { type: Number, required: true }, // 1-12
  dias: { type: Array, default: () => [] }, // [{fecha, diaSemana, tipo, nombreFestivo}] del backend
  enviados: { type: Object, default: () => ({}) }, // { 'YYYY-MM-DD': n } radicados enviados ese día
  seleccionada: { type: String, default: '' },
  fechaPico: { type: String, default: '' }, // día con más radicados enviados del mes (tag PICO)
  rangoSemana: { type: Object, default: null }, // { inicio: 'YYYY-MM-DD', fin: 'YYYY-MM-DD' }
  compacta: { type: Boolean, default: false }, // versión reducida, para embeber en modales
  maxFecha: { type: String, default: '' }, // días posteriores a esta fecha quedan bloqueados
  hastaFecha: { type: String, default: '' }, // días posteriores quedan deshabilitados (regla: el futuro no existe), SIN limitar la navegación
  sinNavegacion: { type: Boolean, default: false }, // la navegación vive en la página (cabecera)
  titulo: { type: String, default: '' }, // encabezado de la tarjeta (matriz mensual)
  subtitulo: { type: String, default: '' }, // nota a la derecha del título (actualizado)
  nota: { type: String, default: '' }, // línea a la derecha de la leyenda (promedio del mes)
})

const emit = defineEmits(['seleccionar', 'mover', 'hoy', 'cambiar'])

const esFutura = (fecha) => !!props.hastaFecha && fecha > props.hastaFecha
const inhabilitada = (d) => esFutura(d.fecha) || (!!props.maxFecha && d.fecha > props.maxFecha)

const estaEnRango = (fecha) => {
  if (!props.rangoSemana?.inicio || !props.rangoSemana?.fin) return false
  return fecha >= props.rangoSemana.inicio && fecha <= props.rangoSemana.fin
}
const esInicioRango = (fecha) => props.rangoSemana?.inicio === fecha
const esFinRango = (fecha) => props.rangoSemana?.fin === fecha

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const mesCortoDe = (fecha) => MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]

const hoyISO_ = hoyISO()
const anios = computed(() => {
  const base = new Date().getFullYear()
  return Array.from({ length: 9 }, (_, i) => base - 4 + i)
})

const esMesSiguienteInvalido = computed(() => {
  if (!props.maxFecha) return false
  const [maxA, maxM] = props.maxFecha.split('-').map(Number)
  return props.anio > maxA || (props.anio === maxA && props.mes >= maxM)
})

const aniosFiltrados = computed(() => {
  if (!props.maxFecha) return anios.value
  const maxA = Number(props.maxFecha.slice(0, 4))
  return anios.value.filter((a) => a <= maxA)
})

const mesesOpciones = computed(() => {
  if (!props.maxFecha) return MESES_LARGOS.map((m, i) => ({ nombre: m, valor: i + 1, deshabilitado: false }))
  const [maxA, maxM] = props.maxFecha.split('-').map(Number)
  return MESES_LARGOS.map((m, i) => {
    const val = i + 1
    const deshabilitado = props.anio > maxA || (props.anio === maxA && val > maxM)
    return { nombre: m, valor: val, deshabilitado }
  })
})

// El primer día ocupa su columna (lun=0 … dom=6); el resto cae solo
const celdasVacias = computed(() => {
  const primero = props.dias[0]
  return primero ? Array.from({ length: (primero.diaSemana + 6) % 7 }, (_, i) => i) : []
})

// Cola del mes anterior: las celdas "vacías" muestran su día real atenuado
const diasPrevios = computed(() => {
  const primero = props.dias[0]
  if (!primero) return []
  const n = celdasVacias.value.length
  return Array.from({ length: n }, (_, i) => {
    const fecha = sumaDias(primero.fecha, i - n)
    return { fecha, numero: Number(fecha.slice(8, 10)) }
  })
})

// Punta del mes siguiente: completa la última fila de la matriz
const diasSiguientes = computed(() => {
  const ultimo = props.dias[props.dias.length - 1]
  if (!ultimo) return []
  const faltan = (7 - ((celdasVacias.value.length + props.dias.length) % 7)) % 7
  return Array.from({ length: faltan }, (_, i) => {
    const fecha = sumaDias(ultimo.fecha, i + 1)
    return { fecha, numero: Number(fecha.slice(8, 10)) }
  })
})

const tituloDe = (d) => {
  const partes = [d.fecha]
  partes.push(d.tipo === 'habil' ? 'Día hábil' : d.tipo === 'festivo' ? `Festivo: ${d.nombreFestivo}` : `Fin de semana${d.nombreFestivo ? ` (${d.nombreFestivo})` : ''}`)
  const v = props.enviados[d.fecha] || 0
  if (v > 0) partes.push(`${v} radicado(s) enviado(s)`)
  if (props.fechaPico && d.fecha === props.fechaPico) partes.push('día pico del mes')
  return partes.join(' · ')
}

function irAMes(m) {
  if (m === props.mes) return
  emit('cambiar', props.anio, m)
}

function irAAnio(a) {
  if (a === props.anio) return
  emit('cambiar', a, props.mes)
}

// ── Teclado ──────────────────────────────────────────────────
function alTeclar(ev) {
  const ACCIONES = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  }
  if (ev.key in ACCIONES) {
    ev.preventDefault()
    const base = props.seleccionada || hoyISO_
    const nueva = sumaDias(base, ACCIONES[ev.key])
    if (props.maxFecha && nueva > props.maxFecha) return // No pasar del día actual
    if (esFutura(nueva)) return // Regla: el futuro no es seleccionable
    emit('seleccionar', nueva)
    // Si el día cayó fuera del mes visible, el padre también debe moverse
    const [a, m] = nueva.split('-').map(Number)
    if (a !== props.anio || m !== props.mes) emit('cambiar', a, m)
    return
  }
  if (ev.key === 'PageUp' || ev.key === 'PageDown') {
    ev.preventDefault()
    emit('mover', ev.key === 'PageUp' ? -1 : 1)
    return
  }
  if (ev.key === 'Home' || ev.key === 'End') {
    ev.preventDefault()
    const primero = props.dias[0]?.fecha
    const ultimo = props.dias[props.dias.length - 1]?.fecha
    if (ev.key === 'Home' && primero && !esFutura(primero)) emit('seleccionar', primero)
    if (ev.key === 'End' && ultimo && !esFutura(ultimo)) emit('seleccionar', ultimo)
  }
}
</script>

<style scoped>
/* Paleta del diseño de referencia (índigo + verde + ámbar sobre tarjetas blancas) */
.calendario {
  --cx-primario: #3a2bd8;
  --cx-primario-medio: #5b4ee8;
  --cx-borde: #e4e6f4;
  --cx-texto: #17192b;
  --cx-secundario: #5c5e72;
  --cx-verde: #0b7a4b;
  --cx-verde-bg: #e7f7ee;
  --cx-verde-borde: #bee4cf;
  --cx-ambar: #8a6410;
  --cx-ambar-bg: #fdf3dc;
  --cx-ambar-borde: #efdba8;
  --cx-gris-bg: #f1f1f6;

  background: #ffffff;
  border: 1px solid var(--cx-borde);
  border-radius: 14px;
  padding: 16px 18px 14px;
  outline: none;
}

.calendario:focus-visible {
  border-color: var(--cx-primario-medio);
}

/* Encabezado de la tarjeta (título de la matriz + nota de actualización) */
.cal-encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.cal-titulo-tarjeta {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--cx-texto);
}

.cal-actualizado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--cx-secundario);
  white-space: nowrap;
}

.cal-actualizado i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #12b76a;
}

.cal-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-flecha {
  width: 32px;
  height: 32px;
  border: 1px solid var(--cx-borde);
  border-radius: 999px;
  background: #ffffff;
  color: var(--cx-texto);
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0 2px;
  transition: all 0.15s ease;
}

.btn-flecha:hover {
  border-color: var(--cx-primario-medio);
  color: var(--cx-primario-medio);
  background: #f0f1fd;
}

.cal-select {
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid var(--cx-borde);
  background: #ffffff;
  color: var(--cx-texto);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 9px;
  transition: all 0.15s ease;
}

.cal-select:hover {
  border-color: var(--cx-primario-medio);
  color: var(--cx-primario-medio);
}

.cal-select:focus-visible {
  border-color: var(--cx-primario-medio);
  outline: none;
}

.btn-hoy {
  border: 1px solid var(--cx-borde);
  border-radius: 999px;
  background: #ffffff;
  color: var(--cx-primario);
  font-size: 0.72rem;
  font-weight: 800;
  padding: 7px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-hoy:hover {
  border-color: var(--cx-primario-medio);
  background: #f0f1fd;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.cal-dia-semana {
  text-align: center;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--cx-secundario);
  padding: 2px 0 9px;
}

.cal-celda {
  position: relative;
  min-height: 82px;
  border: 1px solid var(--cx-borde);
  border-radius: 10px;
  background: #fafbff;
  padding: 7px 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
}

.cal-celda:hover {
  border-color: var(--cx-primario-medio);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(90, 74, 230, 0.1);
}

/* Días de los meses adyacentes: visibles pero inertes, con su mes ("1 nov") */
.cal-celda--fuera {
  background: transparent;
  border: 1px dashed var(--cx-borde);
  cursor: default;
}

.cal-celda--fuera:hover {
  border-color: var(--cx-borde);
  transform: none;
  box-shadow: none;
}

.cal-celda--fuera .cal-numero {
  color: #b6b7c6;
  font-weight: 700;
}

.cal-mes-adj {
  font-size: 0.54rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #b6b7c6;
}

.cal-fila-sup {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 14px;
}

.cal-numero {
  font-size: 0.86rem;
  font-weight: 800;
  color: var(--cx-texto);
  line-height: 1;
}

.cal-hoy-tag {
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--cx-primario);
  line-height: 1;
}

.cal-pico-tag {
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #ffffff;
  background: #0b9d61;
  border-radius: 4px;
  padding: 2px 4px;
  line-height: 1;
}

.cal-estrella {
  margin-left: auto;
  font-size: 0.68rem;
  color: #d97706;
  line-height: 1;
}

/* Valor del día (número de vencimientos), anclado al fondo de la celda */
.cal-valor {
  margin-top: auto;
  color: var(--cx-verde);
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1;
  align-self: flex-start;
  font-variant-numeric: tabular-nums;
}

.cal-valor small {
  margin-left: 3px;
  font-size: 0.54rem;
  font-weight: 700;
  color: var(--cx-secundario);
}

/* ── Tipos de día (el orden de la cascada define prioridades) ── */
.cal-celda--fin_de_semana {
  background: var(--cx-gris-bg);
}

.cal-celda--fin_de_semana .cal-numero {
  color: var(--cx-secundario);
}

.cal-celda--vence {
  background: var(--cx-verde-bg);
  border-color: var(--cx-verde-borde);
}

.cal-celda--vence .cal-valor {
  color: var(--cx-verde);
}

.cal-celda--festivo {
  background: var(--cx-ambar-bg);
  border-color: var(--cx-ambar-borde);
}

.cal-celda--festivo .cal-numero {
  color: var(--cx-ambar);
}

.cal-celda--festivo .cal-valor {
  color: var(--cx-verde);
}

/* Día pico del mes: verde más presente, como el PICO del diseño */
.cal-celda--pico {
  background: #c9f2dd;
  border-color: #6fcd9f;
}

/* Días fuera de rango (maxFecha): visibles pero no seleccionables */
.cal-celda--inhab {
  opacity: 0.35;
  cursor: not-allowed;
}

.cal-celda--inhab:hover {
  border-color: var(--cx-borde);
  transform: none;
  box-shadow: none;
}

.cal-celda--hoy:not(.cal-celda--sel) {
  border: 2px solid var(--cx-primario);
  background: #f0f1fd;
}

/* Semana resaltada (rangoSemana) */
.cal-celda--en-rango {
  background: #f0f1fd !important;
}

.cal-celda--rango-inicio {
  border-left: 3px solid var(--cx-primario) !important;
}

.cal-celda--rango-fin {
  border-right: 3px solid var(--cx-primario) !important;
}

/* Día seleccionado: relleno índigo completo */
.cal-celda--sel {
  outline: 2px solid var(--cx-primario);
  outline-offset: -1px;
  background: var(--cx-primario) !important;
  border-color: var(--cx-primario) !important;
  transform: none;
  box-shadow: 0 4px 14px rgba(58, 43, 216, 0.35);
}

.cal-celda--sel .cal-numero {
  color: #ffffff !important;
}

.cal-celda--sel .cal-hoy-tag {
  color: rgba(255, 255, 255, 0.92) !important;
}

.cal-celda--sel .cal-pico-tag {
  background: #12b76a;
}

.cal-celda--sel .cal-estrella {
  color: rgba(255, 255, 255, 0.92) !important;
}

.cal-celda--sel .cal-valor {
  color: #ffffff !important;
}

.cal-celda--sel .cal-valor small {
  color: rgba(255, 255, 255, 0.75) !important;
}

.btn-flecha:disabled {
  opacity: 0.3 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
}

/* ── Modo compacto: embebido en modales ───────────────────── */
.calendario--compacta {
  border: none;
  padding: 0;
  --cx-borde: #e4e6f4;
}

.calendario--compacta .cal-celda {
  min-height: 42px;
  padding: 5px 6px;
}

.calendario--compacta .cal-numero {
  font-size: 0.78rem;
}

.calendario--compacta .cal-valor {
  position: absolute;
  right: 4px;
  bottom: 4px;
  margin-top: 0;
  font-size: 0.6rem;
}

.calendario--compacta .cal-valor small {
  display: none;
}

.calendario--compacta .cal-select {
  font-size: 0.92rem;
}

.calendario--compacta .cal-celda:hover {
  transform: none;
  box-shadow: none;
}

/* ── Leyenda, nota y ayuda ────────────────────────────────── */
.cal-leyenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cx-borde);
}

.cal-ley {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--cx-secundario);
}

.cal-swatch {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  border: 1px solid var(--cx-borde);
  flex: none;
}

.cal-swatch--vence {
  background: var(--cx-verde-bg);
  border-color: var(--cx-verde-borde);
}

.cal-swatch--festivo {
  background: var(--cx-ambar-bg);
  border-color: var(--cx-ambar-borde);
}

.cal-swatch--fin {
  background: #d8d8e2;
}

.cal-swatch--sel {
  background: var(--cx-primario);
  border-color: var(--cx-primario);
}

.cal-nota {
  margin-left: auto;
  font-size: 0.66rem;
  font-weight: 800;
  color: var(--cx-texto);
  white-space: nowrap;
}

.cal-ayuda {
  margin: 6px 0 0;
  font-size: 0.62rem;
  color: #9a9cb0;
}

@media (max-width: 700px) {
  .calendario {
    padding: 12px 10px;
  }

  .cal-celda {
    min-height: 54px;
    padding: 4px;
    gap: 2px;
    border-radius: 8px;
  }

  .cal-numero {
    font-size: 0.76rem;
  }

  .cal-hoy-tag,
  .cal-pico-tag,
  .cal-mes-adj {
    display: none;
  }

  .cal-valor {
    font-size: 0.72rem;
  }

  .cal-valor small {
    display: none;
  }

  .cal-dia-semana {
    font-size: 0.56rem;
    padding-bottom: 6px;
  }

  .cal-grid {
    gap: 3px;
  }
}
</style>
