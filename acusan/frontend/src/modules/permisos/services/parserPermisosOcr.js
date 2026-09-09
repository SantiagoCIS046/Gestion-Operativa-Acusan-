/**
 * parserPermisosOcr.js — Motor de extracción de campos para permisos laborales
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo PURO (sin Vue, sin DOM): recibe el texto OCR del documento y produce
 * los campos del formulario. Al ser importable desde Node, se prueba directo
 * con corpus de documentos (ver parserPermisosOcr.test.mjs).
 *
 * REGLA DE ORO (inquebrantable): el dato sale del documento o el campo queda
 * vacío. Jamás se inventa contenido "lógico" que el PDF no respalde.
 *
 * Los PDF reales difieren entre sí (letra, membrete, orden, calidad) y la letra
 * puede venir borrosa: el motor asume errores típicos de OCR (0↔O, 1↔I/l,
 * 5↔S, dos puntos perdidos, líneas aplanadas) y corrige SOLO etiquetas — el
 * valor capturado nunca se "adivina".
 *
 * Campos producidos (las 9 áreas del formulario del Encargado):
 *   nombreFuncionario · cedula · cargo · dependencia · fechaInicio (DD/MM/AAAA)
 *   horaInicio · horaFin (HH:mm 24h) · motivo (+ tipoPermiso y banderas técnicas)
 */

// ─── Normalización base del texto OCR ────────────────────────────────────────

/**
 * Corrige confusiones típicas de escaneo PRESERVANDO las columnas: el
 * reconstructor espacial (pdfjs) y Tesseract marcan los saltos de columna con
 * doble espacio, y varias etiquetas cortan el valor justo ahí ("CARGO X  ÁREA
 * Y"). Se normaliza a máx. 2 espacios y se limpian los bordes de cada línea.
 */
export const normalizarTextoOCR = (texto) => (texto || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\t/g, ' ')
  .replace(/[ ]{3,}/g, '  ')
  .replace(/[ ]+\n/g, '\n')
  .replace(/\n[ ]+/g, '\n')
  .replace(/[–—‒]/g, '-')
  .replace(/(\d)O(\d)/g, '$10$2')
  .replace(/O(\d{1,2}[-\/.])(\d)/g, '0$1$2')
  .replace(/(\d[-\/.])O(\d)/g, '$10$2')
  .replace(/(\d)l(\d)/g, '$11$2')
  .replace(/(\d{1,2})[\.\-\/]\s+(\d{1,2})/g, '$1-$2')
  .replace(/([0-9])(am|pm)\b/gi, '$1 $2')
  .replace(/(\d)\.(\d{2})\s*(am|pm)/gi, '$1:$2$3')

/**
 * Des-OCRiza ETIQUETAS de campo ("N0MBRE C0MPLET0:" → "NOMBRE COMPLETO:",
 * "CEDU1A:" → "CEDULA:"). Toma secuencias de 1 a 3 tokens que terminan en ':'
 * y corrige SOLO los tokens con ≥3 letras y ≥1 dígito (0→O, 1→I, 5→S, 8→B,
 * 6→G). Las fechas (18-08-2026), los NIT y los valores numéricos no cumplen
 * esa condición y quedan intactos: la letra borrosa se corrige donde es
 * etiqueta conocida, jamás dentro del valor capturado.
 */
export const desOcrizarEtiquetas = (texto) => (texto || '').replace(
  /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}){0,2}(?=\s*:)/g,
  (secuencia) => secuencia.replace(
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}/g,
    (token) => {
      const letras = token.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
      if (letras.length < 3 || !/[0-9]/.test(token)) return token
      return token
        .replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S')
        .replace(/8/g, 'B').replace(/6/g, 'G')
    }
  )
)

// ─── Limpiadores de valores ──────────────────────────────────────────────────

/**
 * Limpia y formatea un nombre propio en mayúsculas limpias. Los tokens con
 * ≥3 letras y un dígito suelto son letra borrosa leída como número ("MAR1A",
 * "G0MEZ"): se corrigen 0→O, 1→I, 5→S, 8→B, 6→G ANTES de retirar dígitos,
 * porque un nombre no lleva números y el dígito siempre es la vocal dañada.
 */
export const limpiarNombreCompleto = (nombreRaw) => {
  if (!nombreRaw) return ''
  const n = nombreRaw
    .replace(/^PERMISO\s+/i, '')
    .replace(/202[0-9]{5,}.*$/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*[0156][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*\b/g, (tok) => {
      const letras = tok.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
      if (letras.length < 3) return tok // "2026" o "098" no son palabras
      return tok
        .replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S')
        .replace(/8/g, 'B').replace(/6/g, 'G')
    })
    .replace(/[0-9_\-\.\:\;\,\(\)]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b(?:PERMISO|ACUASAN|ESCANEO|SCAN|SOLICITUD|ESCANEAR|DOC)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (n.length < 5) return ''
  return n.toUpperCase()
}

/** Diccionario institucional de cargos y áreas de Acuasan. */
export const normalizarCargoYDependencia = (texto) => {
  const c = (texto || '').toLowerCase()
  if (c.includes('potabiliz') || c.includes('lider') || c.includes('líder') || c.includes('planta') || c.includes('tratam')) {
    return { cargo: 'Líder de Potabilización', dependencia: 'Planta de Tratamiento / Potabilización' }
  }
  if (c.includes('aux') && (c.includes('adt') || c.includes('adm') || c.includes('ada') || c.includes('tivo'))) {
    return { cargo: 'Auxiliar Administrativo', dependencia: 'Administrativa' }
  }
  if (c.includes('fontan')) {
    return { cargo: 'Fontanero', dependencia: 'Distribución y Redes' }
  }
  if (c.includes('alcant') || c.includes('redes')) {
    return { cargo: 'Operario de Alcantarillado', dependencia: 'Alcantarillado' }
  }
  if (c.includes('conduct')) {
    return { cargo: 'Conductor Operativo', dependencia: 'Operativa' }
  }
  if (c.includes('analist') || c.includes('fact')) {
    return { cargo: 'Analista de Facturación y Cartera', dependencia: 'Comercial y Facturación' }
  }
  return { cargo: 'Funcionario Acuasan', dependencia: 'Operativa' }
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const MESES_VARIACIONES = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8, agos: 8, agoslo: 8, agto: 8, agost: 8, qgosto: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12
}

export const NOMBRES_MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Fecha de calendario real (rechaza 31/02/2026, 00/xx, mes 13…). */
export const esFechaReal = (dd, mm, aa) => {
  const d = parseInt(dd, 10), m = parseInt(mm, 10), a = parseInt(aa, 10)
  if (!d || !m || !a || d < 1 || m < 1 || m > 12) return false
  const fecha = new Date(a, m - 1, d)
  return fecha.getDate() === d && fecha.getMonth() === m - 1 && fecha.getFullYear() === a
}

const numeroDeMes = (palabra) => {
  const p = String(palabra || '').toLowerCase().replace(/[^a-záéíóúñ]/g, '')
  if (!p) return null
  for (const [clave, valor] of Object.entries(MESES_VARIACIONES)) {
    if (p.startsWith(clave) || clave.startsWith(p)) return valor
  }
  return null
}

/**
 * Recolecta todas las fechas del texto con su posición y contexto, validadas
 * como calendario real. Un documento real trae varias fechas (expedición,
 * nacimiento, membresía…): se prefiere la que esté rotulada como FECHA/PERMISO,
 * luego la de la página 1, y por último la primera del documento.
 */
const recolectarFechas = (texto, esPagina1) => {
  const fechas = []
  const RX_TEXTO = /\b([0-3]?\d)\s+de\s+([a-záéíóúñ]{3,12})(?:\s+de|\s+del\s+a[nñ]o|\s+de\s+)?\s*(\d{4})\b/gi
  const RX_NUM = /\b([0-3]?\d)\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})\b/g
  const anclar = (m, dd, mm, aa, tipo) => {
    const anio = aa.length === 2 ? `20${aa}` : aa
    const mes = tipo === 'texto' ? numeroDeMes(mm) : parseInt(mm, 10)
    if (!mes) return
    if (!esFechaReal(dd, String(mes).padStart(2, '0'), anio)) return
    const contextoPrevio = texto.slice(Math.max(0, m.index - 22), m.index)
    const rotulada = /fecha|permiso|solicitud|del?\s*permiso/i.test(contextoPrevio)
    fechas.push({
      dd: String(parseInt(dd, 10)).padStart(2, '0'),
      mm: String(mes).padStart(2, '0'),
      aa: anio,
      idx: m.index,
      rotulada,
      p1: esPagina1,
      tipo
    })
  }
  for (const m of texto.matchAll(RX_TEXTO)) anclar(m, m[1], m[2], m[3], 'texto')
  for (const m of texto.matchAll(RX_NUM)) anclar(m, m[1], m[2], m[3], 'numero')
  return fechas
}

const elegirFecha = (fechas) => {
  if (!fechas.length) return null
  const conPuntaje = fechas.map((f) => ({
    ...f,
    puntaje: (f.rotulada ? 3 : 0) + (f.p1 ? 2 : 0) + (f.tipo === 'texto' ? 1 : 0)
  }))
  conPuntaje.sort((a, b) => b.puntaje - a.puntaje || a.idx - b.idx)
  return conPuntaje[0]
}

// ─── Horarios ────────────────────────────────────────────────────────────────

/** Convierte hora + meridiano a 24h ("12 a.m." → 0, "12 m./12 p.m." → 12). */
const a24h = (h, meridiano) => {
  const m = String(meridiano || '').toLowerCase().replace(/[\s.]/g, '')
  let hh = h
  if (m.startsWith('a')) { if (hh === 12) hh = 0 }
  else if (m.startsWith('p')) { if (hh !== 12) hh += 12 }
  else if (m === 'm' && hh === 12) { hh = 12 } // "12 m." = mediodía
  return hh
}

const horaValida = (h, min) => h >= 0 && h <= 23 && min >= 0 && min <= 59
const hhmm = (h, min) => `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`

/**
 * Extrae un rango horario explícito del texto ("7:30 a 9:30 a.m.", "2 pm a
 * 4 pm", "07:30-18:00", "de 8 a 12", "ENTRADA: 8:00 SALIDA: 12:00").
 * Devuelve { horaInicio, horaFin, detalle } en formato 24h o null si el
 * documento no trae horario. Guardas anti-falso-positivo:
 *   · la hora no puede ser cola de un número mayor (fechas, cédulas, NIT)
 *   · rangos tipo "del 8 al 10 de agosto" (fechas con día≤12) se descartan
 *   · horaFin debe ser estrictamente mayor que horaInicio
 */
export const extraerRangoHorario = (texto) => {
  if (!texto) return null
  const t = texto

  // Guardas del final del rango:
  //   (?!\d)          — no es cola de un número mayor (cédulas, NIT)
  //   (?![.,]\d)      — no es decimal ("8 a 12.5") ni fecha "12.08.2026"
  //   (?!\s*[-\/.]\d) — no continúa una fecha ("01-12-2026", "12/08/2026")
  const RX_RANGO = /(^|[^\w.,:\/-])\s*(?:de\s+|desde\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?\s*(?:a\b|hasta|al\b|-|–)\s*(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?(?!\d)(?![.,]\d)(?!\s*[-\/.]\s*\d)/gi

  const MESES_RX = '(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)'

  const candidatos = []
  for (const m of t.matchAll(RX_RANGO)) {
    const iniIdx = m.index + m[1].length

    // "del 8 al 10 de agosto": días de fecha, no horas
    const posterior = t.slice(m.index + m[0].length, m.index + m[0].length + 34)
    if (new RegExp(`^\\s*(?:de\\s+)?${MESES_RX}\\b`, 'i').test(posterior)) continue
    const previo = t.slice(Math.max(0, iniIdx - 14), iniIdx)
    if (/\b(?:del|d[ií]as?|d[ií]a)\s*$/i.test(previo)) continue

    const h1 = parseInt(m[2], 10)
    const min1 = m[3] !== undefined ? parseInt(m[3], 10) : 0
    const h2 = parseInt(m[5], 10)
    const min2 = m[6] !== undefined ? parseInt(m[6], 10) : 0
    if (!horaValida(h1, min1) || !horaValida(h2, min2)) continue

    const tieneMinutos = m[3] !== undefined || m[6] !== undefined
    const tieneMeridiano = Boolean(m[4] || m[7])
    const rotuladoPrevio = /hora|horario|entrada|salida|permiso/i.test(t.slice(Math.max(0, iniIdx - 18), iniIdx))
    // Rango pelado ("1 a 2", "2 a 4") sin minutos, sin a.m./p.m. y sin rótulo:
    // la jornada empieza 7:30 a.m., así que horas tan bajas son casi siempre
    // numeración de página/capítulo, no un horario. Se prefiere el campo vacío.
    if (!tieneMinutos && !tieneMeridiano && !rotuladoPrevio && (h1 < 6 || h2 < 6)) continue

    // Combinaciones de meridiano: explícitos primero; si solo hay uno, se
    // propaga al otro y como alternativa se prueba el cruce am→pm ("11 a.m.
    // a 1"), quedándose con la primera combinación coherente (fin > ini).
    const combos = []
    if (m[4] && m[7]) combos.push([m[4], m[7]])
    else if (m[4]) combos.push([m[4], m[4]], [m[4], 'p.m.'], [m[4], null])
    else if (m[7]) combos.push([m[7], m[7]], ['a.m.', m[7]], [null, m[7]])
    else combos.push([null, null])

    for (const [mer1, mer2] of combos) {
      const ini = a24h(h1, mer1) * 60 + min1
      const fin = a24h(h2, mer2) * 60 + min2
      if (fin <= ini) continue
      candidatos.push({
        horaInicio: hhmm(a24h(h1, mer1), min1),
        horaFin: hhmm(a24h(h2, mer2), min2),
        detalle: m[0].trim().replace(/^[^0-9]+/, '').trim(),
        rotulado: rotuladoPrevio,
        idx: iniIdx
      })
      break
    }
  }
  if (candidatos.length) {
    const ordenados = candidatos
      .map((c) => ({ ...c, puntaje: (c.rotulado ? 2 : 0) }))
      .sort((a, b) => b.puntaje - a.puntaje || a.idx - b.idx)
    const mejor = ordenados[0]
    return { horaInicio: mejor.horaInicio, horaFin: mejor.horaFin, detalle: mejor.detalle }
  }

  // Plan B: etiquetas ENTRADA/INICIO y SALIDA/FIN separadas en el formulario
  const mEnt = t.match(/\b(?:entr(?:ada|e)|inicio)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?/i)
  const mSal = t.match(/\b(?:salida|fin|finalizaci[oó]n)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?/i)
  if (mEnt && mSal) {
    const h1 = parseInt(mEnt[1], 10), min1 = mEnt[2] !== undefined ? parseInt(mEnt[2], 10) : 0
    const h2 = parseInt(mSal[1], 10), min2 = mSal[2] !== undefined ? parseInt(mSal[2], 10) : 0
    if (horaValida(h1, min1) && horaValida(h2, min2) && h2 * 60 + min2 > h1 * 60 + min1) {
      return { horaInicio: hhmm(h1, min1), horaFin: hhmm(h2, min2), detalle: `${hhmm(h1, min1)} a ${hhmm(h2, min2)}` }
    }
  }
  return null
}

/** Minutos entre dos horas HH:mm (para duración real, nunca inventada). */
export const duracionHoras = (horaInicio, horaFin) => {
  const a = String(horaInicio || '').match(/^(\d{1,2}):(\d{2})$/)
  const b = String(horaFin || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!a || !b) return null
  const ini = parseInt(a[1], 10) * 60 + parseInt(a[2], 10)
  const fin = parseInt(b[1], 10) * 60 + parseInt(b[2], 10)
  if (fin <= ini) return null
  const horas = (fin - ini) / 60
  return Number.isInteger(horas) ? String(horas) : horas.toFixed(1).replace('.', ',')
}

// ─── Etiquetas de referencia para cortar valores ─────────────────────────────

const ETIQUETAS_CORTE = String.raw`(?:CEDULA|C[eÉ]DULA|C\.?\s?C\.?|DOCUMENTO|IDENTIFICACI[oÓ]N|NOMBRES?|APELLIDOS|CARGO|PUESTO|OFICIO|DEPENDENCIA|DEPARTAMENTO|[ÁA]REA|FECHA|HORA|ENTRADA|SALIDA|FIRMA|MOTIVO|JEFE|OBSERVACION|SOLICITANTE|Vo\.?\s?Bo\.?|PERMISO|TIPO)`

// ─── Parser principal ────────────────────────────────────────────────────────

/**
 * Parsea el texto OCR (completo y página 1) y produce los campos del permiso.
 * @param {string} textoCompleto Texto de todas las páginas (o del documento).
 * @param {string} nombreArchivo Nombre del archivo cargado (último recurso del nombre).
 * @param {string} textoPagina1   Texto de la página 1 (el formulario de solicitud).
 */
export const parsearTextoPermiso = (textoCompleto, nombreArchivo = '', textoPagina1 = '') => {
  const texto = desOcrizarEtiquetas(normalizarTextoOCR(textoCompleto))
  const p1 = desOcrizarEtiquetas(normalizarTextoOCR(textoPagina1 || textoCompleto))
  const campos = {}

  // ═══ 1. NOMBRE COMPLETO DEL TRABAJADOR ═══
  let nombreEncontrado = ''

  // A. Etiquetas del formulario (NOMBRE(S) / NOMBRE COMPLETO / DEL TRABAJADOR…)
  //    Priman sobre el anexo EPS: si la solicitud trae su propio rótulo de
  //    nombre, ese es el solicitante; el "Paciente" de la orden médica es la
  //    misma persona solo cuando el formulario no rotuló el campo.
  {
    const mNombre = (p1 + '\n' + texto).match(
      new RegExp(
        // Los dígitos entran a la captura a propósito: con letra borrosa el
        // OCR lee "MAR1A" y limpiarNombreCompleto corrige 1→I después. Sin
        // dígitos aquí, el nombre con una sola letra dañada se perdería entero.
        String.raw`\b(?:NOMBRES?\s*(?:Y\s*APELLIDOS|COMPLETO|DEL\s*(?:TRABAJADOR|FUNCIONARIO|SOLICITANTE))?|TRABAJADOR|SOLICITANTE|FUNCIONARIO)\s*:?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9' ]{5,70}?)(?=\s{2,}|\s*\b${ETIQUETAS_CORTE}\b|[.\n]|$)`,
        'i'
      )
    )
    if (mNombre) {
      const nLimpio = limpiarNombreCompleto(mNombre[1])
      if (nLimpio.length >= 5 && nLimpio.split(' ').filter(Boolean).length >= 2) nombreEncontrado = nLimpio
    }
  }

  // B. Anexo EPS / orden médica sin formulario: el paciente es el solicitante
  if (!nombreEncontrado) {
    const mPaciente = texto.match(/(?:Paciente|PACIENTE|Usuario|USUARIO|Afiliado|Ciudadano)[:\s]+([A-ZÁÉÍÓÚÑa-z\s]{6,55})(?=\s*ID|\s*CC|\s*Contrato|\s*Edad|\s*Plan|\n|$)/i)
    if (mPaciente) {
      const pNombre = limpiarNombreCompleto(mPaciente[1])
      if (pNombre.split(' ').filter(Boolean).length >= 2) nombreEncontrado = pNombre
    }
  }

  // C. Último recurso: nombre del archivo (metadato aportado por quien escaneó)
  if (!nombreEncontrado && nombreArchivo) {
    const pArch = limpiarNombreCompleto(nombreArchivo)
    if (pArch.split(' ').filter(Boolean).length >= 2) nombreEncontrado = pArch
  }

  // Guardia de coherencia: un nombre no lleva dígitos ni restos de etiquetas
  if (nombreEncontrado && /\d/.test(nombreEncontrado)) nombreEncontrado = ''
  if (nombreEncontrado) campos.nombreFuncionario = nombreEncontrado

  // ═══ 2. CÉDULA / DOCUMENTO ═══
  // SOLO con evidencia explícita. El membrete trae el NIT 68.679.000 impreso
  // y el OCR lo mallee ("58679000"): antes se reportaba como cédula.
  const numerosAExcluir = ['890120175', '8901201757', '68679000', '1686790001', '2640000', '2610000']
  let cedulaDetectada = ''

  const esCedulaPlausible = (digitos) => {
    if (!/^[0-9]{6,11}$/.test(digitos)) return false
    if (numerosAExcluir.includes(digitos)) return false
    if (/^20(1[5-9]|2[0-9])$/.test(digitos)) return false        // año suelto
    if (/^20(1[5-9]|2[0-9])[0-9]{4}$/.test(digitos)) return false // aaaamm
    if (/^(30|31|32)[0-9]{8}$/.test(digitos)) return false        // celular
    return true
  }

  const contextoEsEmpresarial = (textoPrevio) =>
    /(nit|n\.?\s*i\.?\s*t|registro|empresa|acueducto|alcantarillado|acuasan|e\.?\s?s\.?\s*p|tel[eé]fono|pbx)/i.test(textoPrevio || '')

  // Flag 'm': en OCR el número suele terminar al final de la línea, y sin 'm'
  // el ancla '$' solo casa al final de todo el texto (el lookahead corta antes
  // y la captura queda vacía). '$' con 'm' = fin de cada línea.
  const patronesCedula = [
    /\b(?:CEDULA|C[eÉ]DULA)\s*(?:DE\s*CIUDADANIA)?\s*[:\-]?\s*N?o?\.?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bC\.?\s?C\.?\s*(?:No\.?|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bdocumento\s*(?:No\.?|n[uú]mero|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bidentificad[oa]\s*(?:con)?\s*(?:el)?\s*(?:documento|c[eé]dula)?\s*(?:No\.?|#)?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\b(?:TRABAJADOR|SOLICITANTE|FUNCIONARIO)\s*(?:IDENTIFICADO\s*(?:CON)?)?\s*(?:CON)?\s*(?:C\.?\s?C\.?|CEDULA)?\s*N?o?\.?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim
  ]
  for (const rx of patronesCedula) {
    for (const m of texto.matchAll(rx)) {
      const digitos = (m[1] || '').trim().replace(/[^\d]/g, '')
      // Para un número ETIQUETADO la etiqueta es la evidencia: NO se aplica el
      // guard de contexto (el membrete queda a pocas decenas de los campos).
      if (esCedulaPlausible(digitos)) { cedulaDetectada = digitos; break }
    }
    if (cedulaDetectada) break
  }

  // Último recurso: número suelto FUERA de contexto empresarial
  if (!cedulaDetectada) {
    for (const m of texto.matchAll(/\b[0-9][0-9\.,]{5,14}\b/g)) {
      const digitos = (m[0] || '').replace(/[^\d]/g, '')
      const previo = texto.slice(Math.max(0, m.index - 45), m.index)
      if (esCedulaPlausible(digitos) && !contextoEsEmpresarial(previo)) {
        cedulaDetectada = digitos
        break
      }
    }
  }

  if (cedulaDetectada) campos.cedula = cedulaDetectada

  // ═══ 3. CARGO y ═══ 4. ÁREA / DEPENDENCIA ═══
  const rxValorLabeled = (etiquetas) => new RegExp(
    String.raw`\b(?:${etiquetas})\s*[:.\-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\.\-/ ]{2,50}?)(?=\s{2,}|\s*\b${ETIQUETAS_CORTE}\b\s*[:.\-]|[.\n]|$)`,
    'i'
  )

  const mCargo = texto.match(rxValorLabeled('CARGO|PUESTO|OFICIO|EMPLEO'))
  if (mCargo) {
    const cargoLiteral = mCargo[1].replace(/\s{2,}/g, ' ').replace(/[\s\-.,:;]+$/, '').trim()
    const info = normalizarCargoYDependencia(cargoLiteral)
    campos.cargo = info.cargo !== 'Funcionario Acuasan' ? info.cargo : cargoLiteral
    if (!campos.dependencia && info.dependencia !== 'Operativa') campos.dependencia = info.dependencia
  }

  const mDependencia = texto.match(rxValorLabeled('DEPENDENCIA|DEPARTAMENTO|[ÁA]REA'))
  if (mDependencia) {
    const depLiteral = mDependencia[1].replace(/\s{2,}/g, ' ').replace(/[\s\-.,:;]+$/, '').trim()
    // El área rotulada la aporta el documento: se respeta el LITERAL. El
    // diccionario de cargos re-mapearía "Distribución y Redes" a "Alcantarillado"
    // (por la palabra "redes") y corrompería un valor que el PDF dice explícito.
    if (depLiteral.length >= 3) campos.dependencia = depLiteral
  }

  // Fallback: cargo reconocible en el texto (la palabra sí está en el documento)
  if (!campos.cargo) {
    if (/potabiliz|planta\s+de\s+tratam/i.test(texto)) {
      campos.cargo = 'Líder de Potabilización'
      campos.dependencia = campos.dependencia || 'Planta de Tratamiento / Potabilización'
    } else if (/fontan/i.test(texto)) {
      campos.cargo = 'Fontanero'
      campos.dependencia = campos.dependencia || 'Distribución y Redes'
    } else if (/alcant/i.test(texto)) {
      campos.cargo = 'Operario de Alcantarillado'
      campos.dependencia = campos.dependencia || 'Redes de Alcantarillado'
    } else if (/conduct/i.test(texto)) {
      campos.cargo = 'Conductor Operativo'
      campos.dependencia = campos.dependencia || 'Transporte y Maquinaria'
    } else if (/analist/i.test(texto)) {
      campos.cargo = 'Analista de Facturación y Cartera'
      campos.dependencia = campos.dependencia || 'Comercial y Facturación'
    } else if (/auxiliar/i.test(texto)) {
      campos.cargo = 'Auxiliar Administrativo'
      campos.dependencia = campos.dependencia || 'Administrativa'
    }
  }

  // ═══ 5. FECHA DEL PERMISO (DD/MM/AAAA) ═══
  const fechasP1 = recolectarFechas(p1, true)
  const fechasTodo = recolectarFechas(texto, false)
  const elegida = elegirFecha([...fechasP1, ...fechasTodo])
  if (elegida) {
    campos.fechaInicio = `${elegida.dd}/${elegida.mm}/${elegida.aa}`
    campos.fechaFin = campos.fechaInicio
    campos.fechaPermisoTexto = `${parseInt(elegida.dd, 10)} de ${NOMBRES_MES[parseInt(elegida.mm, 10)]} de ${elegida.aa}`
  }

  // ═══ 6. HORA INICIO y HORA FIN (24h) ═══
  const rango = extraerRangoHorario(p1) || extraerRangoHorario(texto)
  const rxCheckJornada = /jornada[^.\n]{0,30}[\[\(]?\s*[xX✓☑]\s*[\]\)]?|[\[\(]?\s*[xX✓☑]\s*[\]\)]?[^.\n]{0,30}jornada/i
  const hayMarcasJornada = /\b07[:.]?30\b/.test(texto) && /\b(?:17[:.]?30|18[:.]?00)\b/.test(texto)
  const evidenciaJornada = rxCheckJornada.test(texto) || hayMarcasJornada

  if (rango) {
    campos.horaInicio = rango.horaInicio
    campos.horaFin = rango.horaFin
    const horas = duracionHoras(rango.horaInicio, rango.horaFin)
    campos.horaDetalle = horas ? `${rango.horaInicio} a ${rango.horaFin} (${horas} horas)` : `${rango.horaInicio} a ${rango.horaFin}`
    campos.horasCalculadas = campos.horaDetalle
    // El rango puede SER la jornada completa (07:30–18:00): se marca igual
    campos.jornadaCompleta = rango.horaInicio === '07:30' && (rango.horaFin === '18:00' || rango.horaFin === '17:30')
  } else if (evidenciaJornada) {
    // Sin rango horario pero con casilla/rotulado de jornada completa:
    // la jornada institucional (el viernes 17:30 lo ajusta la vista con la fecha)
    campos.horaInicio = '07:30'
    campos.horaFin = '18:00'
    campos.horaDetalle = '07:30 a 18:00 (Jornada Laboral Completa)'
    campos.jornadaCompleta = true
  } else if (/jornada\s+(?:laboral\s+)?completa|todo\s+el\s+d[ií]a/i.test(texto)) {
    // Mención literal SIN casilla y SIN horas explícitas: se toma como
    // jornada completa solo porque el documento lo dice con esas palabras.
    campos.horaInicio = '07:30'
    campos.horaFin = '18:00'
    campos.horaDetalle = '07:30 a 18:00 (Jornada Laboral Completa)'
    campos.jornadaCompleta = true
  } else {
    campos.horaDetalle = ''
    campos.horasCalculadas = ''
  }

  // ═══ 7. TIPO DE PERMISO (casillas [X] primero, luego palabras clave) ═══
  let tipoDetectado = ''

  const rxCompMarcado = /[Cc]ompensatori[ao]\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]ompensatori[ao]/
  const hayEvidenciaElectoral = /registradur|jurament|jurado|electoral|votaci[oó]n|E-18|E\.?18/i.test(texto)
  if (rxCompMarcado.test(p1) && hayEvidenciaElectoral) tipoDetectado = 'Compensatorio'

  const rxMedicoMarcado = /M[eé]dic[ao]\*?\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*M[eé]dic[ao]\*?/
  if (!tipoDetectado && rxMedicoMarcado.test(p1)) tipoDetectado = 'Cita Médica'
  if (!tipoDetectado && rxCompMarcado.test(p1)) tipoDetectado = 'Compensatorio'
  if (!tipoDetectado) {
    const rxPersonalMarcado = /[Pp]ersonal\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Pp]ersonal/
    if (rxPersonalMarcado.test(p1)) tipoDetectado = 'Personal'
  }
  if (!tipoDetectado) {
    const rxCalaMarcado = /[Cc]alamidad\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]alamidad/
    if (rxCalaMarcado.test(p1)) tipoDetectado = 'Calamidad Doméstica'
  }
  if (!tipoDetectado) {
    // "Personal" escrito como valor rotulado ("TIPO DE PERMISO: Personal",
    // "PERMISO PERSONAL"). La palabra suelta no cuenta: aparece en frases como
    // "personal administrativo" y sembraría un tipo que el documento no dice.
    const rxPersonalLabeled = /tipo\s+de\s+permiso\s*[:\-]\s*personal|permiso\s+personal|asunto\s+propio/i
    if (rxPersonalLabeled.test(texto)) tipoDetectado = 'Personal'
  }
  if (!tipoDetectado) {
    const rxEstudioMarcado = /[Ee]studio|[Cc]apacitaci[oó]n\s*[\[\(]?[xX✓✗☑]/
    if (rxEstudioMarcado.test(p1)) tipoDetectado = 'Estudio / Capacitación'
  }
  if (!tipoDetectado) {
    const hayMedico = /m[eé]dic[ao]|cita\s*m[eé]dic|eps|cardiolog|urolog|ortoped|remisi[oó]n|especialista|orden\s*m[eé]dic|diagn[oó]stico/i.test(texto)
    const hayJurado = /jurado|consulta\s*popular|votaci[oó]n|electoral|certificado\s*electoral|registradur|jurament/i.test(texto)
    const hayCalamidad = /calamidad|fallecimiento|inundaci[oó]n|accidente\s*familiar/i.test(texto)
    const hayEstudio = /universidad|capacitaci[oó]n|seminario|congreso|examen\s*acad[eé]mico/i.test(texto)
    if (hayJurado) tipoDetectado = 'Compensatorio'
    else if (hayMedico) tipoDetectado = 'Cita Médica'
    else if (hayCalamidad) tipoDetectado = 'Calamidad Doméstica'
    else if (hayEstudio) tipoDetectado = 'Estudio / Capacitación'
  }
  campos.tipoPermiso = tipoDetectado

  // ═══ 8. MOTIVO Y JUSTIFICACIÓN EXTRAÍDA ═══
  let motivoExtraido = ''

  const rxMotivoLinea = new RegExp(
    String.raw`MOTIVO[\s\:\*]*(?:Compensatorio|M[eé]dic[oa]\*?|Personal|Calamidad)?[\s\[\]\(\)\{\}xX✓✗☑☒☐\*]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\/\s\,\.\-\(\)]{6,140}?)(?=\s{2,}|\s*\b${ETIQUETAS_CORTE}\b\s*[:.\-]?|[.\n]|$)`,
    'i'
  )
  const mMotivoLinea = p1.match(rxMotivoLinea)
  if (mMotivoLinea) {
    let trabajo = mMotivoLinea[1]
      .replace(/en caso de cita.*/i, '')
      .replace(/\*en caso.*/i, '')
      .replace(/firma.*/i, '')
      .replace(/solicitante.*/i, '')
      .replace(/jefe.*/i, '')
      .replace(/observacion.*/i, '')
      .replace(/dependencia.*/i, '')
      .replace(/vo\.?\s?bo\.?.*/i, '')
      .replace(/[_|~]{2,}/g, ' ')
    trabajo = trabajo
      .replace(/[\[\]\(\)\{\}]/g, ' ')
      // Marcas de casilla sueltas, solo como palabra completa: sin \b, la x de
      // "examen" o la o inicial de "oxígeno" se comerían y el texto quedaría
      // mutilado ("e amen").
      .replace(/\b[xX✓✗☑☒☐]\b/g, ' ')
    // Ruido inicial: símbolos, palabras de 1-2 letras y —si el valor arranca
    // con la etiqueta de un tipo ("Médico", "Compensatorio…")— esa palabra,
    // que es rótulo de casilla y no parte del motivo escrito. Solo al inicio:
    // en "Cita médica general EPS" la palabra "médica" pertenece al motivo.
    const rxRuidoInicial = /^(?:[^\wáéíóúñ]+|\b[a-záéíóúñ]{1,2}\b|\b\d{1,2}\b|\b(?:compensatorio|m[eé]dic[oa]\*?|calamidad|personal|estudio|capacitaci[oó]n)\b)\s*/i
    let estable = false
    while (!estable) {
      const recorte = trabajo.replace(rxRuidoInicial, '')
      estable = recorte === trabajo
      trabajo = recorte
    }
    trabajo = trabajo.replace(/\s{2,}/g, ' ').trim()
    if (trabajo.length >= 5 && /[a-záéíóúñ]{3,}/i.test(trabajo)) motivoExtraido = trabajo
  }

  if (!motivoExtraido) {
    // Manuscrito: "c/ta médica del 25 de agosto" — incluye dígitos porque la
    // fecha escrita a mano suele venir en la misma línea del motivo.
    const rxCitaManuscrita = /c[\/\.]?ta\s+m[eé]dic[oa][a-z0-9\s\/\,\.]{0,60}/i
    const mCita = texto.match(rxCitaManuscrita)
    if (mCita) motivoExtraido = mCita[0].replace(/\s+/g, ' ').trim()
  }

  if (!motivoExtraido) {
    // Síntesis SOLO a partir de palabras que están en el documento
    if (/registradur|jurament|jurado\s+de\s+votaci|electoral|votaci[oó]n|E-18/i.test(texto)) {
      motivoExtraido = 'Compensatorio por función electoral (certificado E-18 / Registraduría adjunto)'
    } else if (/cardiolog/i.test(texto)) {
      motivoExtraido = 'Cita médica - Consulta especialista Cardiología'
      if (/reclamar|medicam/i.test(texto)) motivoExtraido += ' / Reclamar medicamentos'
    } else if (/urolog/i.test(texto)) {
      motivoExtraido = 'Cita médica - Consulta especialista Urología'
    } else if (/reclamar|medicam/i.test(texto)) {
      motivoExtraido = 'Cita médica - Reclamar medicamentos (EPS)'
    }
  }

  // Guardia de coherencia: el motivo no puede ser una etiqueta desnuda
  if (motivoExtraido && !/[a-záéíóúñ]{3,}/i.test(motivoExtraido.replace(/\b(?:cita|m[eé]dica?|permiso)\b/gi, ''))) {
    motivoExtraido = ''
  }
  campos.motivo = motivoExtraido || ''
  campos.motivoManuscrito = motivoExtraido || ''

  return campos
}

// ─── Evaluación de cobertura de las 9 áreas ──────────────────────────────────

/** Las 9 áreas del formulario, en el orden en que se muestran. */
export const CAMPOS_OCR = [
  ['nombreFuncionario', 'Nombre Completo del Trabajador'],
  ['cedula', 'Cédula / Documento'],
  ['cargo', 'Cargo'],
  ['dependencia', 'Área / Dependencia'],
  ['fechaInicio', 'Fecha'],
  ['horaInicio', 'Hora Inicio'],
  ['horaFin', 'Hora Fin'],
  ['tipoPermiso', 'Tipo de Permiso'],
  ['motivo', 'Motivo y Justificación']
]

/**
 * Evalúa cuántas de las 9 áreas quedaron llenas con respaldo del documento.
 * @returns {{faltantes: string[], confianza: number}} confianza = % de áreas llenas.
 */
export const evaluarCamposExtraidos = (valores = {}) => {
  const faltantes = CAMPOS_OCR
    .filter(([clave]) => !String(valores[clave] ?? '').trim())
    .map(([, etiqueta]) => etiqueta)
  const confianza = Math.round(((CAMPOS_OCR.length - faltantes.length) / CAMPOS_OCR.length) * 100)
  return { faltantes, confianza }
}

export default {
  normalizarTextoOCR,
  desOcrizarEtiquetas,
  limpiarNombreCompleto,
  normalizarCargoYDependencia,
  esFechaReal,
  extraerRangoHorario,
  duracionHoras,
  parsearTextoPermiso,
  evaluarCamposExtraidos,
  CAMPOS_OCR
}
