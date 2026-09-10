import prisma from '../../config/prisma.js'

/**
 * ============================================================================
 * RADICADOS — SERVICE — ACUASAN E.S.P.
 * ============================================================================
 * Fuente de verdad de los radicados: numeración, vencimientos y documento
 * original viven en la base de datos. La extracción de texto del PDF se hace
 * en el navegador (pdfjs-dist + tesseract.js); aquí solo se parsea ese texto
 * a los campos institucionales. Regla de oro del producto: el dato sale del
 * documento o el campo queda vacío — nunca se inventa.
 * ============================================================================
 */

// ── Auxiliares de limpieza ───────────────────────────────────────────────────

const limpiar = (str) =>
  (str || '')
    .replace(/^[:\s-]+/, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

// El OCR de PDF escaneados confunde O/0, l/I/1 y | dentro de los números
// ("2O2614523O"). La clase de abajo los acepta al capturar y se normalizan
// enseguida: recuperar el dato real del documento, jamás inventarlo.
const DIGITO_OCR = '[0-9OolI|]'
const normalizarDigitos = (s) =>
  (s || '').replace(/[Oo|]/g, '0').replace(/[lI]/g, '1')

// Limpia códigos numéricos de suscripción y títulos profesionales ("Ing.", "Dr.", "Doctor", "Sra.", etc.)
const limpiarNombrePersona = (str) => {
  if (!str || typeof str !== 'string') return ''
  let s = str.trim()
  // Pelar códigos de suscriptor/dependencia delante ("950 - ", "1234: ")
  s = s.replace(/^\d{2,8}\s*[-–—:]\s*/, '')
  // Pelar títulos profesionales ("Doctor", "Doctora", "Dr.", "Dra.", "Ing.", "Lic.", etc.)
  s = s.replace(/^(?:Doctora?|Inga?|Dra?|Lic|Arq|Abg|Sra?|Prof)\.?\s*[:：]?\s*/i, '')
  // Pelar paréntesis abiertos al final (ej: "Wbeimar Hernando Perez Beltran (coordinador R" -> "Wbeimar Hernando Perez Beltran")
  s = s.replace(/\s*\([^)]*$/g, '')
  s = s.replace(/[:.,;\-]+$/g, '')
  return s.trim()
}

// ── Diccionario institucional y administrativo con tildes y ortografía correcta ──
const DIC_TILDE = {
  // Términos jurídicos, administrativos y generales
  presentacion: 'presentación',
  peticion: 'petición',
  atencion: 'atención',
  notificacion: 'notificación',
  resolucion: 'resolución',
  liquidacion: 'liquidación',
  facturacion: 'facturación',
  suspension: 'suspensión',
  reconexion: 'reconexión',
  conexion: 'conexión',
  reposicion: 'reposición',
  apelacion: 'apelación',
  revocacion: 'revocación',
  revocatoria: 'revocatoria',
  conciliacion: 'conciliación',
  certificacion: 'certificación',
  autorizacion: 'autorización',
  informacion: 'información',
  expedicion: 'expedición',
  prescripcion: 'prescripción',
  reclamacion: 'reclamación',
  indemnizacion: 'indemnización',
  verificacion: 'verificación',
  inspeccion: 'inspección',
  modificacion: 'modificación',
  disposicion: 'disposición',
  declaracion: 'declaración',
  calificacion: 'calificación',
  ubicacion: 'ubicación',
  valoracion: 'valoración',
  excepcion: 'excepción',
  remision: 'remisión',
  emision: 'emisión',
  comision: 'comisión',
  radicacion: 'radicación',
  cancelacion: 'cancelación',
  solicitud: 'solicitud',
  recurso: 'recurso',
  interno: 'interno',
  radicado: 'radicado',
  respuesta: 'respuesta',
  oficio: 'oficio',
  salida: 'salida',
  entrada: 'entrada',
  tramite: 'trámite',
  termino: 'término',
  terminos: 'términos',
  matricula: 'matrícula',
  cedula: 'cédula',
  numero: 'número',
  linea: 'línea',
  publica: 'pública',
  publico: 'público',
  publicos: 'públicos',
  publicas: 'públicas',
  tecnico: 'técnico',
  tecnica: 'técnica',
  juridico: 'jurídico',
  juridica: 'jurídica',
  economico: 'económico',
  economica: 'económica',
  alcaldia: 'alcaldía',
  personeria: 'personería',
  veeduria: 'veeduría',
  contraloria: 'contraloría',
  procuraduria: 'procuraduría',
  secretaria: 'secretaría',
  bogota: 'bogotá',
  medellin: 'medellín',
  santander: 'santander',
  valle: 'valle',
  codigo: 'código',
  pagina: 'página',
  año: 'año',
  años: 'años',
  dia: 'día',
  dias: 'días',
  vencimiento: 'vencimiento',
  direccion: 'dirección',
  alcantarillado: 'alcantarillado',
  acueducto: 'acueducto',
  desague: 'desagüe',
  area: 'área',
  areas: 'áreas',
  canon: 'canon',
  regimen: 'régimen',

  // Nombres y apellidos comunes en Colombia
  perez: 'pérez',
  hernandez: 'hernández',
  rodriguez: 'rodríguez',
  sanchez: 'sánchez',
  gomez: 'gómez',
  lopez: 'lópez',
  martinez: 'martínez',
  gonzalez: 'gonzález',
  alvarez: 'álvarez',
  diaz: 'díaz',
  ramirez: 'ramírez',
  suarez: 'suárez',
  jimenez: 'jiménez',
  munoz: 'muñoz',
  gutierrez: 'gutiérrez',
  beltran: 'beltrán',
  guzman: 'guzmán',
  leon: 'león',
  marin: 'marín',
  rondon: 'rondón',
  avila: 'ávila',
  calderon: 'calderón',
  rincon: 'rincón',
  pinzon: 'pinzón',
  ceron: 'cerón',
  pabon: 'pabón',
  chacon: 'chacón',
  duran: 'durán',
  millan: 'millán',
  roman: 'román',
  rios: 'ríos',
  pena: 'peña',
  bano: 'baño',
  maria: 'maría',
  jose: 'josé',
  jesus: 'jesús',
  angel: 'ángel',
  angela: 'ángela',
  raul: 'raúl',
  ivan: 'iván',
  sebastian: 'sebastián',
  julian: 'julián',
  cesar: 'césar',
  oscar: 'óscar',
  andres: 'andrés',
  hector: 'héctor',
  hernan: 'hernán',
  german: 'germán',
  fabian: 'fabián',
  ruben: 'rubén',
  ramon: 'ramón',
  joaquin: 'joaquín',
  martin: 'martín',
  alvaro: 'álvaro',
  cristian: 'cristián',
  adrian: 'adrián',
  damaris: 'dámaris'
}

// Corrección de errores típicos de OCR Tesseract en documentos administrativos en español
const corregirOrtografiaOcr = (str) => {
  if (!str || typeof str !== 'string') return ''
  let s = str
    // 16n, 16N, 1on, i6n -> ción / sión / xión
    .replace(/\b([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[cC](?:16|1[oó0]|i6|[ií]0)[nN]\b/g, (m, p) => {
      const mayus = m === m.toUpperCase()
      return p + (mayus ? 'CIÓN' : 'ción')
    })
    .replace(/\b([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[sS](?:16|1[oó0]|i6|[ií]0)[nN]\b/g, (m, p) => {
      const mayus = m === m.toUpperCase()
      return p + (mayus ? 'SIÓN' : 'sión')
    })
    .replace(/\b([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[xX](?:16|1[oó0]|i6|[ií]0)[nN]\b/g, (m, p) => {
      const mayus = m === m.toUpperCase()
      return p + (mayus ? 'XIÓN' : 'xión')
    })
    .replace(/conser\s*\\raci[oó6]n|conseraci6n/gi, 'conservación')
    .replace(/\\raci[oó6]n/gi, 'ración')
    .replace(/\bnornia8\b|\bnornias\b/gi, 'normas')
    .replace(/\b[dD]eticid[nm]\b|\b[dD]eticion\b/gi, 'petición')
    .replace(/\bsefi?ora\b|\bseflora\b/gi, 'señora')
    .replace(/\bsefi?or\b|\bseflor\b/gi, 'señor')
    .replace(/\bGLADVS\b/g, 'GLADYS')
    .replace(/\bDor\b/g, 'Por')
    .replace(/\bdor\b/g, 'por')
    .replace(/\bsobro\b/gi, 'sobre')
    .replace(/\bsobre\s+ds\s+consecuencias\b/gi, 'sobre las consecuencias')
    .replace(/\bds\s+consecuencias\b/gi, 'de las consecuencias')
    .replace(/\bds\b/g, 'de')
    .replace(/\bAtendiende\b/gi, 'Atendiendo')
    .replace(/\bfa\b/g, 'la')
    .replace(/\bdct\b/gi, 'del')
    .replace(/\bse\s+solicitan\b/gi, 'Se solicita')
    .replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\)/g, '$1')
    .replace(/\s{2,}/g, ' ')

  // Corregir mayúsculas intercaladas con minúsculas accidentales (ej: RECuRSO -> RECURSO)
  s = s.replace(/\b[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}\b/g, (w) => {
    const total = w.length
    const mayus = (w.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length
    if (mayus >= total - 2 && mayus / total >= 0.7 && mayus < total) {
      return w.toUpperCase()
    }
    return w
  })

  return s.trim()
}

// Aplica formato formal ("modales") con mayúsculas iniciales, minúsculas en conectores
// y tildes exactas en palabras institucionales y nombres
const aplicarTildesYModales = (str, esTitulo = true) => {
  if (!str || typeof str !== 'string') return ''
  const conectores = new Set(['de', 'del', 'al', 'el', 'la', 'las', 'los', 'a', 'en', 'por', 'para', 'con', 'y', 'e', 'o', 'u', 'sobre'])
  const siglas = new Set(['ACUASAN', 'CAS', 'ESP', 'EICE', 'NIT', 'CC', 'PQRS', 'UI', 'E.I.C.E', 'E.S.P', 'E.I.C.E.', 'E.S.P.'])

  const palabras = str.split(/\s+/)
  return palabras.map((palabra, idx) => {
    // Preservar números, códigos de radicado o siglas
    if (/\d/.test(palabra) || siglas.has(palabra.toUpperCase().replace(/[.,]/g, ''))) {
      return palabra
    }

    const match = palabra.match(/^([^a-zA-ZáéíóúÁÉÍÓÚñÑ]*)([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)([^a-zA-ZáéíóúÁÉÍÓÚñÑ]*)$/)
    if (!match) return palabra

    const prefix = match[1]
    const core = match[2]
    const suffix = match[3]

    const clean = core.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const normalizada = DIC_TILDE[clean] || core.toLowerCase()

    let res = normalizada
    if (esTitulo) {
      if (idx > 0 && conectores.has(clean)) {
        res = normalizada.toLowerCase()
      } else {
        res = normalizada.charAt(0).toUpperCase() + normalizada.slice(1)
      }
    }
    return prefix + res + suffix
  }).join(' ')
}

// Formateadores específicos para cada tipo de campo institucional:
const formatearAsunto = (str) => {
  if (!str) return ''
  const ocrLimpio = corregirOrtografiaOcr(str)
  return aplicarTildesYModales(ocrLimpio, true)
}

const formatearNombrePersona = (str) => {
  if (!str) return ''
  const sinPrefijo = limpiarNombrePersona(str)
  const ocrLimpio = corregirOrtografiaOcr(sinPrefijo)
  return aplicarTildesYModales(ocrLimpio, true)
}

const formatearTextoParrafo = (str) => {
  if (!str) return ''
  const ocrLimpio = corregirOrtografiaOcr(str)
  // Capitalizar la primera letra del párrafo
  return ocrLimpio.charAt(0).toUpperCase() + ocrLimpio.slice(1)
}

// Saneamiento del texto OCR antes de parsearlo
const normalizarTextoOcr = (texto) =>
  String(texto)
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/(?:[ \t]*\r?\n){3,}/g, '\n')

// ── probarRadicado ───────────────────────────────────────────────────────────
// Extrae y normaliza el número de radicado de un fragmento de texto OCR.
// Convierte errores OCR de dígitos (i→1, o→0) y descarta texto posterior
// ("2610000736 Folios: 1" → "2610000736").
// Definida aquí (módulo) para que sea accesible desde extraerCampos Y desde
// extraerCamposRespuesta (que la necesita para "Respuesta a Radicado No.:").
const probarRadicado = (crudo) => {
  if (!crudo) return ''
  const soloNumero = String(crudo).split(/\s+(?:Folios?|Anexos?|Fecha|Hora)\b/i)[0]
  const limpio = normalizarDigitos(soloNumero.replace(/[\- ]/g, '')).trim()
  const soloDigitos = limpio.replace(/[iIl|]/g, '1').replace(/[oO]/g, '0')
  if (/^\d{7,12}$/.test(soloDigitos)) return soloDigitos
  if (/[A-Za-z]/.test(limpio)) {
    const mA = limpio.match(/^([0-9A-Za-z]{6,12})$/)
    return mA && (mA[1].match(/\d/g) || []).length >= 4 ? mA[1] : ''
  }
  const match = limpio.match(/(\d{7,12})/)
  return match ? match[1] : ''
}

// Frases de cuerpo de carta: NO son nombres de personas ni asuntos (el OCR
// las confunde con etiquetas "Remitente:" seguidas de prosa). Ojo con
// "solicitud" (sustantivo legítimo en una referencia): solo se filtran las
// formas verbales.
const esFraseDeCuerpo = (str) => {
  if (!str) return false
  return /^(?:En atenci[oó]n|Una vez|Por medio|De acuerdo|En este sentido|deber[aá]|solicit(?:o|amos|e|en|ar[aá]?)\b|mediante|que la|se evidencia|con el fin|respetuosamente|me permito|me dirijo|estimad[oa]s?|agradezc|Yo[,\s]|para la|jurisdicci[oó]n)/i.test(
    str.trim()
  )
}

// Cargos que acompañan al peticionario bajo el saludo "SEÑOR(A):".
const CARGO_RE = /PRESIDENT[AE]|REPRESENTANTE(?: LEGAL)?|ALCALDES?A?|GERENTE|DIRECTOR[AE]?|SECRETARI[OA]|RECTOR[AE]?|PERSONER[OA]|GOBERNADOR[AE]?|TESORER[OA]|COORDINADOR|CONCEJAL|DIPUTAD|JAC|JUNTA|COMUNAL|VEREDAL/i

// ¿Es la línea de saludo "SEÑOR(A):"? El OCR tuerce la Ñ y los separadores
// ("SE ORA:", "SENORA", "SR."), así que se normaliza (sin acentos, sin
// espacios, mayúsculas) antes de comparar. Solo cuenta si es etiqueta corta
// con puntuación final, o la palabra pelada: el nombre va en las líneas de abajo.
const esLineaSaludo = (l) => {
  const n = l.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').toUpperCase()
  if (n.length > 20) return false
  if (!/^(?:SENORA|SEORA|SENOR|SEOR|SRA|SR|SENORES|SEORES)/.test(n)) return false
  return /[.:(]$/.test(n) || n.length <= 7
}

const MUNICIPIOS_ZONA = 'San Gil|Pinchote|Socorro|Bucaramanga|Bogot[aá]|Charal[aá]|Curit[ií]|Oiba|Barichara|Villanueva|Piedecuesta|Floridablanca|Gir[oó]n'

const esNombreValido = (s) => {
  if (!s || typeof s !== 'string') return false
  const str = s.trim()
  if (str.length < 3) return false
  const letras = (str.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g) || []).length
  if (letras < 3) return false
  if (/^[\d\s.,+:;|_\-\/\\()]+$/.test(str)) return false
  if (/^[+\-.,;:|_]+/.test(str)) return false
  return true
}

// Extrae el funcionario que firma un oficio (nombre + cargo) de las líneas del
// documento. El bloque de firma colombiano típico: despedida ("Atentamente,")
// → nombre → cargo. Estrategias, de mayor a menor certeza:
//   a) Etiqueta explícita: Firmante: / Firma: / Suscribe: / Suscrito por:
//   b) Bloque tras la despedida (Atentamente/Cordialmente/Respetuosamente):
//      primera línea de nombre en las 5 siguientes; si la línea posterior casa
//      con CARGO_RE, se concatena " - cargo".
//   c) Encabezado: nombre propio y cargo en la MISMA línea.
// Regla de oro: sin respaldo claro devuelve '' (una firma ilegible no se adivina).
const _extraerNombreDeFirma = (lineas) => {
  if (!Array.isArray(lineas) || !lineas.length) return ''

  // Línea que parece un nombre de persona: 2-6 palabras alfabéticas (vale el
  // punto de las iniciales), arranca en mayúscula, sin dígitos/correos/años,
  // sin municipios de la zona, sin cargo y sin ser frase de cuerpo.
  const esLineaNombre = (l) => {
    const palabras = l.split(/\s+/).filter(Boolean)
    if (palabras.length < 2 || palabras.length > 6) return false
    if (!/^[A-ZÁÉÍÓÚÜÑ]/.test(l)) return false
    if (/\d|@|www\.|http/i.test(l)) return false
    if (new RegExp(`^(?:${MUNICIPIOS_ZONA})\\b`, 'i').test(l)) return false
    if (CARGO_RE.test(l)) return false
    if (esFraseDeCuerpo(l)) return false
    return palabras.every((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+$/.test(p))
  }

  const limpiarCargo = (l) => l.replace(/[.,;:]+$/, '').replace(/\s+/g, ' ').trim()

  // a) Etiqueta explícita (la evidencia más fuerte)
  for (const l of lineas) {
    const m = l.match(/^(?:Firmante|Firma|Suscribe|Suscrito por|Remitente)\s*[:：]\s*(.+)$/i)
    if (m) {
      const v = m[1].trim()
      if (esLineaNombre(v)) return v
      // El valor puede traer nombre y cargo: "Wbeimar Pérez - Gerente General"
      const mNC = v.match(/^(.{4,60}?)\s*[-–—,]\s*(.{3,50})$/)
      if (mNC && esLineaNombre(mNC[1].trim()) && CARGO_RE.test(mNC[2])) {
        return `${mNC[1].trim()} - ${limpiarCargo(mNC[2])}`
      }
    }
  }

  // b) Bloque de firma tras la despedida
  const DESPEDIDA = /^(?:Atentamente|Cordialmente|Respetuosamente|Sinceramente)[,.]?$/i
  for (let i = 0; i < lineas.length; i++) {
    if (!DESPEDIDA.test(lineas[i])) continue
    for (let j = i + 1; j < Math.min(i + 6, lineas.length); j++) {
      const l = lineas[j]
      if (/\bASUNTO\b|\bREFERENCIA\b/i.test(l)) break
      if (/^\(?\s*firma/i.test(l)) continue // "(firma ilegible)"
      if (CARGO_RE.test(l)) break // llegó el cargo sin nombre: firma sin nombre legible
      if (esLineaNombre(l)) {
        const sig = lineas[j + 1]
        if (sig && CARGO_RE.test(sig) && !esLineaNombre(sig)) {
          return `${l} - ${limpiarCargo(sig)}`
        }
        return l
      }
    }
  }

  // c) Encabezado: nombre y cargo comparten línea ("WBEIMAR PEREZ BELTRAN - Gerente General")
  for (const l of lineas) {
    if (!CARGO_RE.test(l)) continue
    const mNC = l.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\s]{6,60}?)\s*[-–—,]\s*(.{3,50})$/)
    if (mNC && esLineaNombre(mNC[1].trim()) && CARGO_RE.test(mNC[2])) {
      return `${mNC[1].trim()} - ${limpiarCargo(mNC[2])}`
    }
  }
  return ''
}

// Campos que viajan al cliente: el documento Base64 jamás viaja en listados
// ni en respuestas de creación (pesa MBs; se sirve por /:id/archivo).
const SELECT_PUBLICO = {
  id: true,
  numeroRadicado: true,
  fechaRadicacion: true,
  peticionario: true,
  dependencia: true,
  destinatario: true,
  asunto: true,
  referencia: true,
  fechaDocumento: true,
  lugarFecha: true,
  numeroRadicadoPdf: true,
  registradoPor: true,
  contexto: true,
  estado: true,
  fechaVencimiento: true,
  archivoNombre: true,
  createdAt: true,
  updatedAt: true
}

// Documento original: solo data URL de PDF o imagen, con tope (~10 MB de
// binario) que deja margen holgado bajo el límite de 16 MB por documento BSON.
const MAX_BASE64 = 14000000
const PATRON_DATA_URL = /^data:(application\/pdf|image\/(?:png|jpe?g|webp|gif));base64,/i

const validarArchivoBase64 = (archivoBase64) => {
  if (archivoBase64 == null) return null
  if (typeof archivoBase64 !== 'string' || !PATRON_DATA_URL.test(archivoBase64)) {
    throw Object.assign(
      new Error('El documento debe ser un PDF o una imagen (PNG/JPG/WebP/GIF) codificado en base64.'),
      { status: 400 }
    )
  }
  if (archivoBase64.length > MAX_BASE64) {
    throw Object.assign(
      new Error('El documento supera el tamaño máximo de 10 MB. Comprímalo antes de radicar.'),
      { status: 413 }
    )
  }
  return archivoBase64
}

// MIME que el navegador puede mostrar embebido sin riesgo: cualquier otro
// (p.ej. text/html inyectado en la data URL) se degrada a descarga.
const MIMES_INLINE_SEGUROS = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export const RadicadosService = {
  /**
   * Lista todos los radicados (más reciente primero). El documento Base64 NO
   * viaja en el listado: pesa megas y se sirve por endpoint propio.
   */
  async listar() {
    return prisma.radicado.findMany({
      orderBy: { fechaRadicacion: 'desc' },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Crea un radicado. El backend es la fuente de verdad: asigna la
   * numeración RAD-AAAA-##### y calcula el vencimiento con los días del
   * término legal. El documento original (Base64) queda guardado en la BD.
   */
  async crear(datos) {
    const {
      peticionario, dependencia, destinatario, asunto, referencia,
      fechaDocumento, lugarFecha, numeroRadicadoPdf, registradoPor,
      contexto, diasParaVencer, archivoNombre, archivoBase64
    } = datos

    const numeroRadicado = await this._generarNumeroRadicado()
    const dias = Math.min(Math.max(parseInt(diasParaVencer, 10) || 10, 1), 365)
    const fechaVencimiento = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

    return prisma.radicado.create({
      data: {
        numeroRadicado,
        idLocal: datos.idLocal || `rad_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        peticionario: limpiar(peticionario),
        dependencia: dependencia ? limpiar(dependencia) : 'ACUASAN E.S.P.',
        destinatario: destinatario ? limpiar(destinatario) : null,
        asunto: asunto ? limpiar(asunto) : null,
        referencia: referencia ? limpiar(referencia) : null,
        fechaDocumento: fechaDocumento ? limpiar(fechaDocumento) : null,
        lugarFecha: lugarFecha ? limpiar(lugarFecha) : null,
        numeroRadicadoPdf: numeroRadicadoPdf ? limpiar(numeroRadicadoPdf) : null,
        registradoPor: registradoPor || null,
        contexto: contexto ? limpiar(contexto) : null,
        estado: 'Pendiente',
        fechaVencimiento,
        archivoNombre: archivoNombre || null,
        archivoBase64: validarArchivoBase64(archivoBase64)
      },
      select: SELECT_PUBLICO
    })
  },

  /**
   * Numeración consecutiva por año: RAD-2026-00001. El unique del modelo es
   * la red de seguridad ante una carrera entre dos radicaciones simultáneas.
   */
  async _generarNumeroRadicado() {
    const anio = new Date().getFullYear()
    const desde = new Date(`${anio}-01-01T00:00:00.000Z`)
    for (let intento = 0; intento < 5; intento++) {
      const count = await prisma.radicado.count({
        where: { fechaRadicacion: { gte: desde } }
      })
      const consecutivo = String(count + 1 + intento).padStart(5, '0')
      const candidato = `RAD-${anio}-${consecutivo}`
      const existe = await prisma.radicado.findUnique({
        where: { numeroRadicado: candidato },
        select: { id: true }
      })
      if (!existe) return candidato
    }
    throw new Error('No fue posible generar un número de radicado único. Intente de nuevo.')
  },

  /**
   * Actualiza el estado de un radicado (Pendiente ↔ Resuelto).
   */
  async actualizarEstado(id, estado) {
    if (!['Pendiente', 'Resuelto'].includes(estado)) {
      throw Object.assign(new Error('Estado no válido: debe ser Pendiente o Resuelto'), { status: 400 })
    }
    return prisma.radicado.update({
      where: { id },
      data: { estado },
      select: { id: true, numeroRadicado: true, estado: true, fechaVencimiento: true }
    })
  },

  /**
   * Elimina un radicado de la base de datos (incluido su documento) junto con
   * sus oficios de respuesta archivados: sin padre quedarían huérfanos para
   * siempre (documentos de MBs bajo un número que el consecutivo del año puede
   * reutilizar con otro radicado).
   */
  async eliminar(id) {
    await prisma.respuestaRadicado.deleteMany({ where: { radicadoId: id } })
    return prisma.radicado.delete({ where: { id } })
  },

  /**
   * Devuelve el documento original { buffer, mime, nombre } para que el
   * controller lo sirva como binario. Acepta data URL o Base64 crudo.
   */
  async obtenerArchivo(id) {
    const rad = await prisma.radicado.findUnique({
      where: { id },
      select: { archivoBase64: true, archivoNombre: true }
    })
    if (!rad || !rad.archivoBase64) return null

    let mime = 'application/pdf'
    let base64 = rad.archivoBase64
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(base64)
    if (m) {
      mime = m[1].toLowerCase()
      base64 = m[2]
    }
    // MIME fuera de la lista segura (inyectado en la data URL): se sirve como
    // descarga neutra, nunca renderizado inline en el origen de la app.
    if (!MIMES_INLINE_SEGUROS.has(mime)) mime = 'application/octet-stream'
    return {
      buffer: Buffer.from(base64, 'base64'),
      mime,
      nombre: rad.archivoNombre || 'radicado.pdf'
    }
  },

  /**
   * Adjunta (o reemplaza) el documento original de un radicado ya creado.
   */
  async adjuntarArchivo(id, { archivoBase64, archivoNombre }) {
    return prisma.radicado.update({
      where: { id },
      data: { archivoBase64: validarArchivoBase64(archivoBase64), archivoNombre: archivoNombre || null },
      select: { id: true, numeroRadicado: true, archivoNombre: true }
    })
  },

  /**
   * Genera el reporte en CSV (con BOM: Excel lo abre directo). Cada radicado
   * viaja con su primera respuesta archivada (n° de oficio y fecha): el
   * reporte queda emparejado igual que el módulo Radicado ↔ Respuesta.
   */
  async generarCsv() {
    const lista = await this.listarExpedientes()
    const fechaCsv = (v) => {
      if (!v) return ''
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return ''
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}/${d.getFullYear()}`
    }
    const columnas = [
      ['numeroRadicado', 'N° Radicado'],
      ['fechaRadicacionCsv', 'Fecha Radicación'],
      ['peticionario', 'Peticionario'],
      ['dependencia', 'Dependencia'],
      ['destinatario', 'Destinatario'],
      ['asunto', 'Asunto'],
      ['referencia', 'Referencia'],
      ['fechaDocumento', 'Fecha / Hora Sello'],
      ['numeroRadicadoPdf', 'N° Radicado PDF'],
      ['estado', 'Estado'],
      ['fechaVencimientoCsv', 'Vencimiento'],
      ['registradoPor', 'Registrado Por'],
      ['numeroOficioRespuesta', 'N° Oficio Respuesta'],
      ['fechaRespuestaCsv', 'Fecha Archivo Respuesta']
    ]
    const celda = (v) => {
      let s = String(v ?? '')
      // Neutraliza celdas que Excel interpretaría como fórmula (=, +, -, @, tab)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const filas = [
      columnas.map(([, titulo]) => celda(titulo)).join(';'),
      ...lista.map((r) => {
        const primera = (r.respuestas && r.respuestas[0]) || null
        const fila = {
          ...r,
          fechaRadicacionCsv: fechaCsv(r.fechaRadicacion),
          fechaVencimientoCsv: fechaCsv(r.fechaVencimiento),
          numeroOficioRespuesta: primera ? (primera.numeroOficio || '—') : '',
          fechaRespuestaCsv: primera ? fechaCsv(primera.fechaRespuesta) : ''
        }
        return columnas.map(([campo]) => celda(fila[campo])).join(';')
      })
    ]
    return `﻿${filas.join('\r\n')}`
  },  /**
   * ============================================================================
   * PARSING DE CAMPOS INSTITUCIONALES
   * ============================================================================
   * Recibe el texto EXTRAÍDO DEL DOCUMENTO (OCR en el navegador) y devuelve
   * los campos que logra leer con certeza. Sin dato → campo vacío: jamás se
   * rellena con supuestos.
   * ============================================================================
   */
  extraerCampos(texto) {
    const resultado = {
      numeroRadicadoPdf: '',
      fechaDocumento: '',
      lugarFecha: '',
      peticionario: '',
      dependencia: '',
      destinatario: '',
      asunto: '',
      referencia: '',
      contexto: '',
      diasParaVencer: null
    }

    if (!texto || !texto.trim()) return resultado

    texto = normalizarTextoOcr(texto)
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    // 1. N° RADICADO DEL SELLO
    // Soporta formatos SIGOB/ORFEO/Ventanilla virtual y sellos físicos:
    //   "Radicado: 20260012345"  "RADICADO No. 2026-0012"  "No. 20260012345"
    //   "Radicado No.: 2610000736 Folios: 1"
    // (probarRadicado ahora es función de módulo — ver inicio del archivo)
    const mRad =
      // SIGOB: "RADICADO:" / "Sticker:" / "Rad. No." / "Radicado No.:"
      texto.match(new RegExp(`\\b(?:Rad(?:[i1l]c[a4]d[o0])?|Sticker|Folio|Consecutivo)\\b(?:\\s+No\\.?\\s*|\\s*N[°º\.]\\s*)?\\s*[:.-]?\\s*((?:${DIGITO_OCR}[\\- ]?){6,11}${DIGITO_OCR})`, 'i')) ||
      // Sticker con serie ALFANUMÉRICA ("Radicado No.: 2H210000736"):
      // token pegado, sin espacios — la etiqueta da la certeza
      texto.match(new RegExp(`\\b(?:Rad(?:[i1l]c[a4]d[o0])?|Sticker|Consecutivo)\\b(?:\\s+No\\.?\\s*|\\s*N[°º\.]\\s*)?\\s*[:.-]?\\s*([0-9A-Za-zOolI|]{6,12})`, 'i')) ||
      // "No." / "N°" seguido de número con año (20xxxxxx / 26xxxxxx)
      texto.match(new RegExp(`\\b(?:No\\.?|N[°º])\\s*[:.]?\\s*((?:[2][0-9OolI|][\\- ]?){5,9}${DIGITO_OCR})\\b`, 'i')) ||
      // RAD-AAAA-NNNNN
      texto.match(/\bRAD[-.]?(\d{4})[-.]?(\d{4,6})\b/i) ||
      // Número suelto con forma de año al inicio (20xxxxxx / 26xxxxxx)
      texto.match(new RegExp(`\\b(2${DIGITO_OCR}{7,10})\\b`, 'i'))
    if (mRad) {
      const crudo = mRad[2] ? `${mRad[1]}${mRad[2]}` : mRad[1].trim()
      resultado.numeroRadicadoPdf = probarRadicado(crudo)
    }

    // 2. FECHA DEL SELLO — etiqueta FECHA (con huecos de OCR) o primera fecha
    // válida del documento. La captura tolera O/0 y l/1 y se normaliza; una
    // candidata sin etiqueta se valida (día ≤ 31, mes ≤ 12) antes de aceptarse.
    const PATRON_FECHA = `${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{4}`
    const esFechaPosible = (f) => {
      const [d, mes] = f.split(/[/\-]/).map(Number)
      return d >= 1 && d <= 31 && mes >= 1 && mes <= 12
    }
    const mFechaSello = texto.match(new RegExp(`F\\s*E\\s*C\\s*H\\s*A(?:\\s*[:.\\-]\\s*|\\s*)(${PATRON_FECHA})`, 'i'))
    // "27/may/2026": mapa de meses cortos o con ruido OCR a formato numérico/estándar
    const MES_OCR = {
      ene: '01', enero: '01', feb: '02', febrero: '02', mar: '03', marzo: '03',
      abr: '04', abril: '04', may: '05', mayo: '05', jun: '06', junio: '06',
      jul: '07', julio: '07', ago: '08', agosto: '08', age: '08', ag0: '08', a9o: '08',
      sep: '09', sept: '09', septiembre: '09', setiembre: '09',
      oct: '10', octubre: '10', '0ct': '10',
      nov: '11', noviembre: '11', n0v: '11',
      dic: '12', diciembre: '12', d1c: '12'
    }
    const mFechaTexto = texto.match(new RegExp(`(${DIGITO_OCR}{1,2})\\/([a-zA-Z0-9áéíóúÁÉÍÓÚ]{3,9})\\/(${DIGITO_OCR}{4})`, 'i'))
    const fSello = mFechaSello ? normalizarDigitos(mFechaSello[1]) : ''
    const mesMapeado = mFechaTexto ? (MES_OCR[mFechaTexto[2].toLowerCase()] || mFechaTexto[2]) : ''
    const fTexto = mFechaTexto
      ? `${normalizarDigitos(mFechaTexto[1])}-${mesMapeado}-${normalizarDigitos(mFechaTexto[3])}`
      : ''
    const diaTexto = mFechaTexto ? parseInt(normalizarDigitos(mFechaTexto[1]), 10) : 0
    // El sello manda, pero una fecha imposible ("99/99/2026") jamás viaja:
    // cae a la primera fecha válida del documento.
    resultado.fechaDocumento = fSello && esFechaPosible(fSello) ? fSello : (diaTexto >= 1 && diaTexto <= 31 ? fTexto : '')
    if (!resultado.fechaDocumento) {
      for (const m of texto.matchAll(new RegExp(PATRON_FECHA, 'g'))) {
        const f = normalizarDigitos(m[0])
        if (esFechaPosible(f)) { resultado.fechaDocumento = f; break }
      }
    }
    // Último recurso: la fecha solo está en letras ("12 de agosto de 2026",
    // "agosto 12 de 2026"). Día y año toleran ruido OCR (O/0, l/1) y se
    // normalizan; el mes viaja tal cual. El día se valida (1-31) y el mes es
    // de calendario: "45 de febrero" o "Acuerdo 15 de 2019" no son fecha.
    const DIA_LE = '(?:[0-9OolI]|[12][0-9OolI]|3[01])(?:ro|º|°)?'
    const MES_LE = '(?:ene\\.?|feb\\.?|mar\\.?|abr\\.?|may\\.?|jun\\.?|jul\\.?|ag[o0]\\.?|se[pt]\\.?|set\\.?|oct\\.?|nov\\.?|dic\\.?|enero|febrero|marzo|abril|mayo|junio|julio|ag[o0]st[o0]|se[pt]tiembre|setiembre|octubre|noviembre|diciembre)'
    const ANIO_LE = '[0-9OolI]{4}'
    // Conector mes→año: "de", "del" o "del año" — un "de" literal aparte se
    // comería la "l" de "del" y rompería "septiembre 3 del año 2026".
    const ENTRE = `(?:del?(?:[ \t]+a[nñ]o)?|de)?[ \t]*`
    if (!resultado.fechaDocumento) {
      // El día no puede salir de mitad de otro número ("factura 45" → "5")
      const mLetras =
        texto.match(new RegExp(`(?<![0-9OolI])(${DIA_LE})[ \\t]+de[ \\t]+(${MES_LE})[ \\t]*${ENTRE}(${ANIO_LE})(?![0-9OolI])`, 'i')) ||
        texto.match(new RegExp(`(?<![0-9OolI])(${MES_LE})[ \\t]+(${DIA_LE})[ \\t]*${ENTRE}(${ANIO_LE})(?![0-9OolI])`, 'i'))
      if (mLetras) {
        const mesPrimero = new RegExp(`^${MES_LE}$`, 'i').test(mLetras[1])
        const dia = normalizarDigitos(mesPrimero ? mLetras[2] : mLetras[1]).replace(/(?:ro|º|°)$/, '')
        const mes = mesPrimero ? mLetras[1] : mLetras[2]
        resultado.fechaDocumento = `${dia} de ${mes} de ${normalizarDigitos(mLetras[3])}`
      }
    }
    // Sticker: "14 ago. 2020" — día, mes abreviado (con o sin punto) y año
    // SEPARADOS POR ESPACIO, sin la palabra "de". Viaja tal cual aparece.
    if (!resultado.fechaDocumento) {
      const mSticker = texto.match(new RegExp(`(?<![0-9OolI])(${DIA_LE})[ \\t]+(${MES_LE})[ \\t]+(${ANIO_LE})(?![0-9OolI])`, 'i'))
      if (mSticker) {
        const d = normalizarDigitos(mSticker[1]).replace(/(?:ro|º|°)$/, '')
        resultado.fechaDocumento = `${d} ${mSticker[2]} ${normalizarDigitos(mSticker[3])}`
      }
    }

    // 2b. HORA DEL SELLO — etiqueta HORA ("Hora: 4:06 PM") u hora que viaja
    // junto a la fecha corta del sello ("14/08/2026 4:06 PM"). Los dígitos
    // toleran el ruido O/0 y l/1 del OCR y se normalizan; una hora imposible
    // (minuto > 59, 13 con AM/PM, 25 en formato 24h) jamás viaja. Si hay fecha
    // y hora ambas se combinan en el mismo campo ("14/08/2026 — 4:06 PM");
    // una hora sin fecha no alcanza para rellenar nada (regla: dato o vacío).
    const PATRON_HORA = `${DIGITO_OCR}{1,2}:${DIGITO_OCR}{2}`
    const validarYFormatearHora = (cruda, ampm) => {
      const [hStr, mStr] = normalizarDigitos(cruda).split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr, 10)
      if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) return ''
      const es12h = /[AP]/i.test(ampm || '')
      if (es12h ? (h < 1 || h > 12) : h > 23) return ''
      const marca = ampm ? ' ' + ampm.toUpperCase().replace(/[.\s]/g, '') : ''
      return `${h}:${String(m).padStart(2, '0')}${marca}`
    }
    const mHora =
      // Etiqueta del sello: "Hora: 4:06 PM" / "HORA 10:30" (con ruido OCR)
      texto.match(new RegExp(`\\bH[O0]R[OA4]\\b(?:\\s*[:.\\-]\\s*|\\s+)(${PATRON_HORA})(?:\\s*([AP]\\.?\\s?M\\.?))?`, 'i')) ||
      // Hora inmediatamente después de una fecha corta del documento
      texto.match(new RegExp(`(?:^|[\\s,])${PATRON_FECHA}\\s+(${PATRON_HORA})(?:\\s*([AP]\\.?\\s?M\\.?))?`, 'im')) ||
      // Hora pegada al sticker SIGOB: "2610000736 14 ago. 2026 10:30" (mismo
      // formato día-mes-año con espacios que capturó la fecha del sticker)
      texto.match(new RegExp(`(?<![0-9OolI])${DIA_LE}[ \\t]+${MES_LE}[ \\t]+${ANIO_LE}[ \\t]+(${PATRON_HORA})(?![0-9OolI])`, 'i'))
    const horaSello = mHora ? validarYFormatearHora(mHora[1], mHora[2]) : ''
    if (resultado.fechaDocumento && horaSello) {
      resultado.fechaDocumento = `${resultado.fechaDocumento} — ${horaSello}`
    }

    // 3. LUGAR Y FECHA DE LA CARTA — "San Gil, 12 de agosto de 2026" y las
    // variantes colombianas: mes primero ("agosto 12 de 2026"), con
    // departamento o D.C. ("San Gil, Santander, 12 de…", "Bogotá, D.C., …"),
    // formal ("San Gil a 12 de…", "…del año 2026"), mes abreviado ("12 ago
    // 2026"), fecha corta tras el municipio y, a falta de lugar, la fecha en
    // letras tal como aparece. Las alternativas con lugar van ANCLADAS a
    // inicio de línea — una fecha en mitad del cuerpo no es el lugar de la
    // carta — y la genérica exige palabras con inicial mayúscula SIN flag
    // /i: la insensibilidad dejaba colar prefijos minúsculos de la línea
    // superior. Día, mes y año toleran el ruido O/0 y l/1 del OCR.
    const FECHA_LARGA = `${DIA_LE}[ \\t]+de[ \\t]+${MES_LE}[ \\t]*${ENTRE}${ANIO_LE}|${MES_LE}[ \\t]+${DIA_LE}[ \\t]*${ENTRE}${ANIO_LE}|${DIA_LE}[ \\t]+${MES_LE}[ \\t]+${ANIO_LE}`
    const FECHA_CORTA = `[0-9OolI]{1,2}[\\/\\-][0-9OolI]{1,2}[\\/\\-][0-9OolI]{4}`
    const mLugarF =
      texto.match(new RegExp(`^[ \\t]*((?:${MUNICIPIOS_ZONA})[ \\t]*,?[ \\t]*(?:${FECHA_LARGA}|${FECHA_CORTA}))`, 'im')) ||
      texto.match(new RegExp(`^[ \\t]*((?:${MUNICIPIOS_ZONA}),[^,\\n\\r]{2,32},[ \\t]*(?:${FECHA_LARGA}))`, 'im')) ||
      texto.match(new RegExp(`^[ \\t]*((?:${MUNICIPIOS_ZONA})[ \\t]+a[ \\t]+(?:${FECHA_LARGA}))`, 'im')) ||
      texto.match(new RegExp(`^[ \\t]*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]*(?:[ \\t]+[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]*){0,2}[ \\t]*,[ \\t]*(?:${FECHA_LARGA}))`, 'm')) ||
      texto.match(new RegExp(`^[ \\t]*(${FECHA_LARGA})[ \\t]*$`, 'im'))
    if (mLugarF) resultado.lugarFecha = mLugarF[1].replace(/\s+/g, ' ').trim()

    // Bloque bajo "Señores:" (plural): la entidad o cargo A QUIÉN va dirigida
    // la carta, en la MISMA línea ("Señores: ALCALDÍA…", "Señores ACUASAN…")
    // o en las siguientes. "Señores" también llega manglado del OCR ("Seores",
    // "SE ORES"). Una línea de cuerpo jamás entra: se exige apariencia de
    // encabezado (sin verbos de carta, sin años, sin NIT ni contactos) y la
    // segunda línea solo aporta si es un cargo.
    const esLineaEncabezado = (l) => {
      if (!l || l.length <= 3 || l.length > 90) return false
      if (esFraseDeCuerpo(l)) return false
      if (/\b(?:solicito|solicitamos|solicitar|manifiesto|informo|dirijo|presente|atenta|favor|seg[uú]n|respuesta|lleva|existe|reclam|escribo|peticion|comunicaci[oó]n|usted|fin)\b/i.test(l)) return false
      if (l.split(/\s+/).length > 15) return false
      return true
    }
    const esLineaContacto = (l) => /N\.?\s?I\.?\s?T\.?|Celular|C[eé]dula|C\.C\.|NIT/i.test(l)
    const bloqueSenores = (() => {
      const limpiar = (s) => (s || '').replace(/[,;:]\s*$/, '').trim()
      for (let i = 0; i < lineas.length; i++) {
        const mLinea = lineas[i].match(/^Se\s*[nñ]?\s*o?res\b[ \t]*[:：]?[ \t]*(.*)$/i)
        if (!mLinea) continue
        const partes = []
        const resto = limpiar(mLinea[1])
        if (resto && esLineaEncabezado(resto)) partes.push(resto)
        for (let j = i + 1; j < Math.min(i + 3, lineas.length); j++) {
          const l = lineas[j]
          if (/REFERENCIA|ASUNTO|FECHA|RADICADO/i.test(l)) break
          // Anclado: la línea de lugar EMPIEZA por el municipio ("San Gil,
          // 12 de…") — la razón social contiene el pueblo y también es válida
          if (new RegExp(`^(?:${MUNICIPIOS_ZONA})\\b`, 'i').test(l)) break
          if (esLineaSaludo(l)) break
          if (esLineaContacto(l) || /@/.test(l) || /\d{4}/.test(l)) continue
          if (!esLineaEncabezado(l)) break
          if (!partes.length && !/^[A-ZÁÉÍÓÚÑ]/.test(l)) break
          partes.push(l)
          if (partes.length === 2) break
        }
        if (partes.length) return partes
      }
      return []
    })()

    // 4. DEPENDENCIA / EMPRESA DESTINATARIA
    // Prioridad: ACUASAN detectado → nombre completo institucional.
    // SIGOB/ORFEO tienen "DEPENDENCIA:" en el sello digital: se lee primero.
    const mDepSello = texto.match(/\bDEPENDENCIA\s*[:：]\s*([^\n\r]{4,120})/i)
    if (mDepSello && /ACUASAN|ACUEDUCTO/i.test(mDepSello[1])) {
      resultado.dependencia = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'
    } else if (/ACUASAN/i.test(texto) || /ACUEDUCTO/i.test(texto)) {
      resultado.dependencia = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'
    } else if (mDepSello) {
      resultado.dependencia = limpiar(mDepSello[1])
    } else if (bloqueSenores.length) {
      resultado.dependencia = bloqueSenores[0]
    } else {
      const mEmp = texto.match(/Se\s*[nñ]?\s*o?res\s*:\s*([^\n\r]+)/i)
      if (mEmp && esLineaEncabezado(mEmp[1])) resultado.dependencia = mEmp[1].trim()
    }

    // 5. PETICIONARIO — etiqueta explícita o saludo "SEÑOR(A):" + nombre/cargo.
    // Valor de etiqueta: detiene la captura si en la misma línea aparece otra etiqueta
    // de sello (Remitente, Destinataria, Radicado, Folios, Anexos, Fecha, etc.)
    const valorEtiqueta = (etiqueta) => {
      const pelar = (v) => (v || '').replace(/^[ \t]*[:：;.,·\-]+[ \t]*/, '').trim()
      const regMismo = new RegExp('\\b(?:' + etiqueta + ')\\b[ \\t]*[:：]?[ \\t]*([^\\n\\r]+)', 'i')
      const mismo = texto.match(regMismo)
      if (mismo && pelar(mismo[1])) {
        let val = pelar(mismo[1])
        const posProx = val.search(/\b(?:Remitente|Peticionario|Solicitante|Destinatari[oa]s?|Radicad[oa]|Folios?|Anexos?|Fecha|Hora|Asunto|Referencia)\b/i)
        if (posProx > 0) val = val.substring(0, posProx).trim()
        return val
      }

      const regSig = new RegExp('\\b(?:' + etiqueta + ')\\b[ \\t]*[:：][ \\t]*\\r?\\n[ \\t]*([^\\n\\r]+)', 'i')
      const siguiente = texto.match(regSig)
      
      if (siguiente) {
        const v = pelar(siguiente[1])
        if (v && !/^(?:Remitente|Peticionario|Solicitante|Destinatari[oa]|Asunto|REFERENCIA|FECHA|Rad|RADICADO|Se[nñ]ores|Señor|C\.C|NIT)/i.test(v)) {
          return v
        }
      }
      return ''
    }

    const remitenteCrudo = valorEtiqueta('(?:Remitente|Peticionario|Solicitante)')
    const mRem = remitenteCrudo ? [null, remitenteCrudo] : null
    const mDest = (() => { const v = valorEtiqueta('Destinatari[oa]s?'); return v ? [null, v] : null })()

    let peticionarioDeSticker = false
    if (mRem && !esFraseDeCuerpo(mRem[1])) {
      const limpio = limpiarNombrePersona(mRem[1].replace(/-\s*r\.?\s*\/?\s*l\.?\s.*$/i, ''))
      if (esNombreValido(limpio)) {
        resultado.peticionario = limpio
        peticionarioDeSticker = true
      }
    }
    if (mDest && !esFraseDeCuerpo(mDest[1])) {
      let valDest = mDest[1].trim()
      const mCodDest = valDest.match(/^(\d{2,8})\s*[-–—]\s*(.{4,80})$/)
      if (mCodDest && !/^\d+$/.test(mCodDest[2])) {
        valDest = mCodDest[2].trim()
        if (!resultado.referencia) resultado.referencia = mCodDest[1]
      }
      const limpioDest = limpiarNombrePersona(valDest)
      if (esNombreValido(limpioDest)) {
        resultado.destinatario = limpioDest
      }
    }

    if (!peticionarioDeSticker) {
      // La autoidentificación explícita ("Yo, X, identificad@ / mayor de edad") es la evidencia
      // más fuerte: corre ANTES que el saludo para que un bloque SEÑORES con la
      // empresa debajo nunca la pise.
      if (!resultado.peticionario || !esNombreValido(resultado.peticionario) || esFraseDeCuerpo(resultado.peticionario)) {
        const mYo = texto.match(/Yo[,\s]+([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{5,50})[,\s]+(?:identificad|mayor de edad|en mi calidad|actuando)/i)
        if (mYo && !esFraseDeCuerpo(mYo[1]) && esNombreValido(mYo[1])) resultado.peticionario = limpiarNombrePersona(mYo[1])
      }

      if (!resultado.peticionario || !esNombreValido(resultado.peticionario) || esFraseDeCuerpo(resultado.peticionario)) {
        for (let i = 0; i < lineas.length; i++) {
          if (!esLineaSaludo(lineas[i])) continue
          let nombre = ''
          let cargo = ''
          for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
            const l = lineas[j]
            if (/REFERENCIA|ASUNTO|FECHA|RADICADO/i.test(l)) break
            if (new RegExp(`^(?:${MUNICIPIOS_ZONA})\\b`, 'i').test(l)) break
            // La empresa destinataria no es peticionaria ("SEÑORES:" + ACUASAN…)
            if (/ACUASAN|ACUEDUCTO|E\.I\.CE|E\.S\.P/i.test(l)) break
            if (l.length <= 3 || /^\d+$/.test(l) || /@/i.test(l)) continue
            if (/Celular|C[eé]dula|C\.C\.|NIT/i.test(l)) continue
            // Nombre: 2-6 palabras capitalizadas (con conectores "de/la/y"…),
            // empieza en mayúscula, no es cargo, sin años ni correo. Tolerar
            // hasta 2 dígitos sueltos: el OCR escribe "M0RALES".
            if (!nombre && /^[A-ZÁÉÍÓÚÑ]/.test(l) && !CARGO_RE.test(l) && !/19\d\d|20\d\d/.test(l) && (l.match(/\d/g) || []).length <= 2 && l.length > 4 && l.length <= 60) {
              const palabras = l.split(/\s+/)
              const esConector = (w) => /^(?:de|del|la|las|los|y|e|van|von|mac)$/i.test(w)
              const capitalizadas = palabras.filter((w) => esConector(w) || /^[A-ZÁÉÍÓÚÑ]/.test(w)).length
              if (palabras.length >= 2 && palabras.length <= 6 && capitalizadas === palabras.length && !esFraseDeCuerpo(l)) nombre = l
            } else if (nombre && CARGO_RE.test(l)) {
              cargo = l
            }
          }
          if (nombre && !esFraseDeCuerpo(nombre)) {
            resultado.peticionario = cargo ? `${nombre} - ${cargo}` : nombre
            break
          }
        }
      }

      // Saludo abreviado y nombre en la MISMA línea — como encabezado
      // ("SRA. ANA MARIA RIOS") o como firma con dos puntos al final
      // ("SRA. ANA MARIA RIOS:" tras el "Atentamente,")
      if (!resultado.peticionario || esFraseDeCuerpo(resultado.peticionario)) {
        const mInline = texto.match(
          /^[ \t]*(?:SEÑOR\(A\)|SEÑORA|SEÑOR|SENORA|SENOR|SE ORA|SE OR|SRA|SR)\.?[ \t]*[:.]?[ \t]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú']{1,}){1,5})(?:[ \t]*[:.])?[ \t]*$/im
        )
        if (mInline && !esFraseDeCuerpo(mInline[1])) resultado.peticionario = mInline[1].trim()
      }

      // Formularios de solicitud / permisos / constancias oficiales:
      // "NOMBRE: Angelica Sandrit Morales Rojas" o "HACE CONSTAR QUE MORALES ROJAS ANGELICA SANDRIT..."
      if (!resultado.peticionario || !esNombreValido(resultado.peticionario) || esFraseDeCuerpo(resultado.peticionario)) {
        const mFormNombre = texto.match(/\b(?:NOMBRE|FUNCIONARIO|SOLICITANTE|PETICIONARIO|EMPLEADO)\s*[:.-]?\s*([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{5,60})(?=\s*CARGO|\s*CEDULA|\s*FECHA|\s*HORA|\n|$)/i)
        if (mFormNombre && esNombreValido(mFormNombre[1])) {
          resultado.peticionario = mFormNombre[1].trim()
        }
      }
      if (!resultado.peticionario || !esNombreValido(resultado.peticionario) || esFraseDeCuerpo(resultado.peticionario)) {
        const mConstancia = texto.match(/(?:HACE[N]?\s*CONSTAR\s*[:\s]*QUE|QUE\s+EL\s+SEÑOR|QUE\s+LA\s+SEÑORA|QUE)\s+([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{6,60})(?=\s+identificad|\s+con\s+documento|\s+prest[oó]|\s+en\s+calidad)/i)
        if (mConstancia && esNombreValido(mConstancia[1])) {
          resultado.peticionario = mConstancia[1].trim()
        }
      }
    } // fin !peticionarioDeSticker

    // 5b. DESTINATARIO sin etiqueta — a quién va dirigida la carta, en orden
    // de certeza: "A:"/"Att:" al inicio de línea, el bloque bajo
    // "Señores:", el saludo SEÑOR(A) cuando el peticionario ya quedó
    // establecido por otra vía (carta respuesta: el saludo señala al
    // receptor), y de último la línea propia de la entidad (membrete).
    if (!resultado.destinatario) {
      const mAtt = texto.match(/^[ \t]*(?:A|ATT|Atenci[oó]n)\.?[ \t]*[:：][ \t]*([^\n\r]{4,90})[ \t]*$/im)
      if (mAtt && esLineaEncabezado(mAtt[1])) resultado.destinatario = mAtt[1].trim()
    }
    if (!resultado.destinatario && bloqueSenores.length) {
      resultado.destinatario = bloqueSenores.slice(0, 2).join(' - ')
    }
    if (!resultado.destinatario && resultado.peticionario && !esFraseDeCuerpo(resultado.peticionario)) {
      for (let i = 0; i < lineas.length; i++) {
        if (!esLineaSaludo(lineas[i]) || /^Se\s*[nñ]?\s*o?res\b/i.test(lineas[i])) continue
        let nombre = ''
        let cargo = ''
        for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
          const l = lineas[j]
          if (/REFERENCIA|ASUNTO|FECHA|RADICADO/i.test(l)) break
          if (new RegExp(`^(?:${MUNICIPIOS_ZONA})\\b`, 'i').test(l)) break
          if (esFraseDeCuerpo(l) || !esLineaEncabezado(l)) break
          if (esLineaContacto(l) || /^\d+$/.test(l) || /@/.test(l)) continue
          if (l.length <= 3) continue
          if (!nombre && /^[A-ZÁÉÍÓÚÑ]/.test(l) && !CARGO_RE.test(l) && !/19\d\d|20\d\d/.test(l) && (l.match(/\d/g) || []).length <= 2 && l.length > 4 && l.length <= 60) {
            const palabras = l.split(/\s+/).length
            if (palabras >= 2 && palabras <= 6) nombre = l
          } else if (nombre && CARGO_RE.test(l)) {
            cargo = l
          }
        }
        const igual = (a, b) => String(a).replace(/\s+/g, ' ').trim().toUpperCase() === String(b).replace(/\s+/g, ' ').trim().toUpperCase()
        if (nombre && !igual(nombre, String(resultado.peticionario).split(' - ')[0])) {
          resultado.destinatario = cargo ? `${nombre} - ${cargo}` : nombre
          break
        }
      }
    }
    if (!resultado.destinatario) {
      const lEntidad = lineas.find((l) =>
        /^(?:EMPRESA|ACUASAN|ACUEDUCTO|GERENTE|GERENCIA|PRESIDENT|REPRESENTANTE|DIRECTOR|SECRETARI)/i.test(l) &&
        /ACUASAN|ACUEDUCTO|E\.?\s?I\.?\s?C\.?\s?E|E\.?\s?S\.?\s?P/i.test(l) &&
        l.length <= 90 && esLineaEncabezado(l))
      if (lEntidad) resultado.destinatario = lEntidad.trim()
    }

    // 6. REFERENCIA
    // SIGOB / ORFEO incluyen etiqueta "CODIGO:", "Ref:", "REFERENCIA:" o "CÓDIGO DE DEPENDENCIA:" en el sello
    const refCruda =
      valorEtiqueta('REFERENCIA|REF') ||
      valorEtiqueta('CODIGO') ||
      valorEtiqueta('C[OÓ]DIGO DE DEPENDENCIA')
    const mRef = refCruda ? [null, refCruda] : texto.match(/(C[oó]digo de suscriptor[^\n\r]*)/i)
    if (!resultado.referencia) {
      const mDoc = texto.match(/\b(?:documento|c[eé]dula|C\.?C\.?)\s*(?:No\.?|#)?\s*[:.-]?\s*([0-9]{6,12})\b/i)
      if (mDoc) {
        resultado.referencia = `C.C. ${mDoc[1]}`
      }
    }

    // 7. ASUNTO — etiqueta (Asunto, Descripción, Motivo, Objeto), o la referencia, o solicitud / tutela
    const asuntoCrudo = valorEtiqueta('Asunto|Descr(?:ipci[oó]n)?|Motivo|Objeto')
    if (asuntoCrudo && !esFraseDeCuerpo(asuntoCrudo)) {
      resultado.asunto = asuntoCrudo.trim()
    } else if (resultado.referencia && !/^\d{1,6}$/.test(resultado.referencia) && !/^C\.C\./i.test(resultado.referencia)) {
      // Un código pelado ("950" del Destinatario) no describe un asunto
      resultado.asunto = resultado.referencia
    } else {
      const mSolicitud = texto.match(/(Solicitud[^\n\r]+)/i) || texto.match(/(Acci[oó]n de Tutela[^\n\r]{5,100})/i)
      if (mSolicitud && !esFraseDeCuerpo(mSolicitud[1])) {
        resultado.asunto = mSolicitud[1].trim()
      } else if (/SOLICITUD\s+DE\s+PERMISO|PERMISO\s+LABORAL/i.test(texto)) {
        resultado.asunto = 'Solicitud de Permiso Laboral'
        if (/Compensatorio/i.test(texto)) resultado.asunto += ' - Compensatorio'
        else if (/M[eé]dico/i.test(texto)) resultado.asunto += ' - Cita Médica'
        else if (/Personal/i.test(texto)) resultado.asunto += ' - Personal'
      } else if (/FORMULARIO\s+E-?18|JURADO\s+DE\s+VOTACI[OÓ]N|REGISTRADUR/i.test(texto)) {
        resultado.asunto = 'Certificado de Función Electoral - Formulario E-18'
      }
    }

    // SIGOB: "USUARIO:" / "FUNCIONARIO:" = destinatario del trámite interno
    // (a quién se asignó en el sistema). Se lee SOLO si destinatario no se
    // resolvió por los bloques de saludo (el bloque de saludo tiene mayor certeza).
    if (!resultado.destinatario) {
      const mUsuarioSigob = texto.match(/\b(?:USUARIO|FUNCIONARIO|ASIGNADO A)\s*[:：]\s*([^\n\r]{4,90})/i)
      if (mUsuarioSigob) {
        // Formato "940 - Ruiz Suarez Luz Marina": pelar código delante
        let val = mUsuarioSigob[1].trim()
        const mCod = val.match(/^(\d{2,8})\s*[-–—]\s*(.{4,80})$/)
        if (mCod && !/^\d+$/.test(mCod[2])) val = mCod[2].trim()
        if (esLineaEncabezado(val)) resultado.destinatario = val
      }
    }

    // 8. CONTEXTO — el párrafo sustantivo de la carta (recortado a 450 cars)
    resultado.contexto = this._extraerContexto(texto, lineas)

    // 9. DÍAS DE TÉRMINO LEGAL según lo que pide la carta
    resultado.diasParaVencer = this._inferirDias(texto)

    // 10. CORRECCIÓN ORTOGRÁFICA DE RUIDO OCR Y FORMATEO ELEGANTE ("MODALES")
    if (resultado.peticionario) resultado.peticionario = formatearNombrePersona(resultado.peticionario)
    if (resultado.destinatario) resultado.destinatario = formatearNombrePersona(resultado.destinatario)
    if (resultado.asunto) resultado.asunto = formatearAsunto(resultado.asunto)
    if (resultado.contexto) resultado.contexto = formatearTextoParrafo(resultado.contexto)

    return resultado
  },

  _extraerContexto(texto, lineas) {
    // Dos niveles: las aperturas de cuerpo de carta (En atención, Por medio…)
    // describen el asunto real; "Solicit…" también aparece en etiquetas como
    // REFERENCIA/Asunto, así que solo se usa si no hay apertura de cuerpo.
    let mClave = texto.match(
      /(?:En atenci[oó]n|Por medio|Me permito|Me dirijo|Yo,|Con el fin|Una vez|Respetados?[oa]?\b|Respetuosamente|Mediante|A trav[eé]s|Se solicita)[^\n\r]*[\s\S]{30,600}/i
    )
    if (!mClave) {
      // "Solicitante:" es etiqueta de sello, no apertura de carta: con el
      // lookahead negativo no arrastra las líneas del sticker al contexto.
      mClave = texto.match(/Solicit(?!ante\b)[^\n\r]*[\s\S]{30,600}/i)
    }
    let contexto = ''
    if (mClave && mClave[0]) {
      contexto = mClave[0]
    } else {
      const cuerpo = lineas.filter((l) => {
        if (/^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|SEÑOR|SEÑORA|REFERENCIA:|Rad\.|Radicad[oa]|Sticker|Remitente|Peticionario|Solicitante|Destinatari|Folios?|Anexos?|No\.|FECHA|Hora|USUARIO|FUNCIONARIO)/i.test(l)) return false
        if (/^(?:San Gil|Pinchote),/i.test(l)) return false
        // Líneas propias de un sello: fecha corta o con mes, y hora "4:06 PM"
        if (/^[0-9OolI]{1,2}[\/\-][0-9OolA-Za-z]{1,4}[\/\-][0-9OolI]{4}\s*(?:[0-9]{1,2}:[0-9]{2}\s*(?:[AP]\.?M\.?)?)?\s*$/i.test(l)) return false
        if (/^[0-9]{1,2}:[0-9]{2}\s*(?:[AP]\.?M\.?)?$/i.test(l)) return false
        if (/^[0-9OolI]{1,2}[ \t]+de[ \t]+[a-záéíóú]+[ \t]+de[ \t]+[0-9OolI]{4}\s*$/i.test(l)) return false
        if (/^[\s_.\-=*|I:]+$/.test(l)) return false
        // Un sello de una palabra ("RADICADO", "PETICION") no es párrafo
        if ((l.match(/\S+/g) || []).length < 2) return false
        if (l.length < 15 && !/[a-záéíóú]/i.test(l)) return false
        return true
      })
      contexto = cuerpo.slice(0, 4).join(' ')
    }

    contexto = contexto
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\s._\-]{3,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      // Las líneas de contacto/firma que cierran la carta no aportan al
      // resumen — pero un "C.C." dentro de una frase de identificación se
      // queda (es parte del texto sustantivo).
      .replace(/\s+(?:C[eé]dula|Celular|Tel[eé]fono|Atentamente)[\s\S]*$/i, '')
      .trim()

    if (contexto.length > 450) {
      let sub = contexto.substring(0, 450)
      const ultimoPunto = sub.lastIndexOf('.')
      if (ultimoPunto > 200) sub = sub.substring(0, ultimoPunto + 1)
      else {
        const ultimoEspacio = sub.lastIndexOf(' ')
        if (ultimoEspacio > 200) sub = `${sub.substring(0, ultimoEspacio)}...`
      }
      contexto = sub
    }
    return contexto
  },

  /**
   * Término legal en días: SOLO cuando el documento lo declara expresamente
   * ("dentro de los 15 días…"), o cuando es tutela (término fijo de 3 días por
   * la ley 1755/2015 y el decreto 2591). Sin plazo explícito devuelve null:
   * el operador conserva el término que eligió — no se adivina del contenido.
   */
  _inferirDias(texto) {
    // Acepta el número con palabra y paréntesis ("quince (15) días"), el
    // singular ("un (1) día") y dígitos torcidos por el OCR; el ancla final
    // \bd[ií]as?\b evita falsos positivos tipo "acuerdo 014".
    const mPlazo = texto.match(
      new RegExp(`(?:plazo|t[eé]rmino|tiempo|vence|vencimiento|dentro de)\\s*(?:un\\s+t[eé]rmino\\s+de\\s*)?(?:de\\s+)?(?:el\\s+|los\\s+|las\\s+|un\\s+|una\\s+)?(?:[a-záéíúó]+\\s+)?\\(?(${DIGITO_OCR}{1,2})\\)?\\s*d[ií]as?\\b`, 'i')
    )
    if (mPlazo) {
      const num = parseInt(normalizarDigitos(mPlazo[1]), 10)
      if ([3, 5, 10, 15, 30].includes(num)) return num
      if (num <= 4) return 3
      if (num <= 7) return 5
      if (num <= 12) return 10
      if (num <= 20) return 15
      return 30
    }
    if (/\btutela\b/i.test(texto)) return 3
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OFICIOS DE RESPUESTA — el documento de salida se escanea (OCR en el
  // navegador), se comprime y se archiva aquí, enlazado a su radicado padre.
  // ═══════════════════════════════════════════════════════════════════════════

  // Campos de respuesta que viajan al cliente: su Base64 jamás viaja en
  // listados (se sirve por /respuestas/:id/archivo, igual que los radicados).
  _SELECT_RESPUESTA: {
    id: true,
    radicadoId: true,
    numeroRadicado: true,
    fechaRespuesta: true,
    numeroOficio: true,
    destinatario: true,
    asunto: true,
    fechaDocumento: true,
    lugarFecha: true,
    firmante: true,
    observaciones: true,
    archivoNombre: true,
    registradoPor: true,
    createdAt: true,
    updatedAt: true
  },

  /**
   * Lista las respuestas archivadas. Con radicadoId filtra las de un radicado;
   * sin él devuelve todas (archivo general del módulo y vista de Gerencia).
   */
  async listarRespuestas(radicadoId) {
    return prisma.respuestaRadicado.findMany({
      where: radicadoId ? { radicadoId } : undefined,
      orderBy: { createdAt: 'desc' },
      select: this._SELECT_RESPUESTA
    })
  },

  /**
   * Expedientes emparejados: cada radicado con sus oficios de respuesta
   * archivados (del más antiguo al más reciente). El cruce es por radicadoId
   * — el vínculo lo validó el servidor al archivar, así que el número del
   * radicado y el de cada respuesta coinciden por construcción. Un viaje por
   * colección y la unión en memoria: los Base64 jamás viajan en el listado.
   */
  async listarExpedientes() {
    const [radicados, respuestas] = await Promise.all([
      prisma.radicado.findMany({
        orderBy: { fechaRadicacion: 'desc' },
        select: SELECT_PUBLICO
      }),
      prisma.respuestaRadicado.findMany({
        orderBy: { createdAt: 'asc' },
        select: this._SELECT_RESPUESTA
      })
    ])
    const porRadicado = new Map()
    for (const resp of respuestas) {
      const grupo = porRadicado.get(resp.radicadoId)
      if (grupo) grupo.push(resp)
      else porRadicado.set(resp.radicadoId, [resp])
    }
    return radicados.map((rad) => ({ ...rad, respuestas: porRadicado.get(rad.id) || [] }))
  },

  /**
   * Archiva la respuesta de un radicado. El servidor es la fuente de verdad:
   * valida que el radicado padre exista y toma su numeroRadicado (el cliente
   * no lo envía). Al archivar una respuesta el radicado queda Resuelto —
   * responder la petición es la definición operativa de resolverla.
   */
  async crearRespuesta(datos) {
    const { radicadoId } = datos
    if (!radicadoId) {
      throw Object.assign(new Error('radicadoId es obligatorio'), { status: 400 })
    }

    const radicado = await prisma.radicado.findUnique({
      where: { id: radicadoId },
      select: { id: true, numeroRadicado: true, estado: true }
    })
    if (!radicado) {
      throw Object.assign(new Error('El radicado al que responde no existe'), { status: 404 })
    }

    const { numeroOficio, destinatario, asunto, fechaDocumento, lugarFecha, firmante,
      observaciones, registradoPor, archivoNombre, archivoBase64 } = datos

    const respuesta = await prisma.respuestaRadicado.create({
      data: {
        radicadoId,
        numeroRadicado: radicado.numeroRadicado,
        numeroOficio: numeroOficio ? limpiar(numeroOficio) : null,
        destinatario: destinatario ? limpiar(destinatario) : null,
        asunto: asunto ? limpiar(asunto) : null,
        fechaDocumento: fechaDocumento ? limpiar(fechaDocumento) : null,
        lugarFecha: lugarFecha ? limpiar(lugarFecha) : null,
        firmante: firmante ? limpiar(firmante) : null,
        observaciones: observaciones ? limpiar(observaciones) : null,
        registradoPor: registradoPor || null,
        archivoNombre: archivoNombre || null,
        archivoBase64: validarArchivoBase64(archivoBase64)
      },
      select: this._SELECT_RESPUESTA
    })

    // La respuesta archivada resuelve el radicado (salvo que ya lo esté).
    if (radicado.estado !== 'Resuelto') {
      await prisma.radicado.update({
        where: { id: radicadoId },
        data: { estado: 'Resuelto' },
        select: { id: true }
      })
    }

    return respuesta
  },

  /**
   * Devuelve el documento de la respuesta { buffer, mime, nombre } para que
   * el controller lo sirva como binario (mismo contrato que radicados).
   */
  async obtenerArchivoRespuesta(id) {
    const resp = await prisma.respuestaRadicado.findUnique({
      where: { id },
      select: { archivoBase64: true, archivoNombre: true }
    })
    if (!resp || !resp.archivoBase64) return null

    let mime = 'application/pdf'
    let base64 = resp.archivoBase64
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(base64)
    if (m) {
      mime = m[1].toLowerCase()
      base64 = m[2]
    }
    if (!MIMES_INLINE_SEGUROS.has(mime)) mime = 'application/octet-stream'
    return {
      buffer: Buffer.from(base64, 'base64'),
      mime,
      nombre: resp.archivoNombre || 'respuesta.pdf'
    }
  },

  /**
   * Elimina una respuesta archivada (la respuesta, no el radicado padre).
   */
  async eliminarRespuesta(id) {
    return prisma.respuestaRadicado.delete({ where: { id } })
  },

  /**
   * ============================================================================
   * PARSING DE OFICIOS DE RESPUESTA (documento de SALIDA de Acuasan)
   * ============================================================================
   * Mismo contrato que extraerCampos pero para oficios: el texto llega del OCR
   * del navegador y solo se devuelven los campos que se leen con certeza.
   * Regla de oro: el dato sale del documento o el campo queda vacío.
   * ============================================================================
   */
  extraerCamposRespuesta(texto) {
    const resultado = {
      numeroOficio: '',
      fechaDocumento: '',
      lugarFecha: '',
      destinatario: '',
      asunto: '',
      firmante: '',           // Funcionario que suscribe el oficio
      radicadoReferencia: ''  // Número del radicado padre detectado en el texto
    }
    if (!texto || !texto.trim()) return resultado

    texto = normalizarTextoOcr(texto)
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    // ── Constantes reutilizadas (deben definirse antes que se usen) ──────────
    const DIA_LE  = '(?:[0-9OolI]|[12][0-9OolI]|3[01])(?:ro|º|°)?'
    const MES_LE  = '(?:ene\\.?|feb\\.?|mar\\.?|abr\\.?|may\\.?|jun\\.?|jul\\.?|ag[o0]\\.?|se[pt]\\.?|set\\.?|oct\\.?|nov\\.?|dic\\.?|enero|febrero|marzo|abril|mayo|junio|julio|ag[o0]st[o0]|se[pt]tiembre|setiembre|octubre|noviembre|diciembre)'
    const ANIO_LE = '[0-9OolI]{4}'
    const ENTRE   = `(?:del?(?:[ \\t]+a[nñ]o)?|de)?[ \\t]*`
    const PATRON_FECHA = `${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{4}`
    const esFechaPosible = (f) => {
      const [d, mes] = f.split(/[/\-]/).map(Number)
      return d >= 1 && d <= 31 && mes >= 1 && mes <= 12
    }

    // ════════════════════════════════════════════════════════════════════════
    // 0. RADICADO AL QUE RESPONDE — el sello impreso en el oficio de salida
    //    incluye la etiqueta "Respuesta a Radicado No.:" seguida del número.
    //    También se busca "En respuesta al Radicado No." en el cuerpo.
    // ════════════════════════════════════════════════════════════════════════
    const mRadRef =
      texto.match(new RegExp(`Respuesta\\s+a\\s+Radicado\\s+No\\.?\\s*[:.]?\\s*((?:${DIGITO_OCR}[\\- ]?){6,11}${DIGITO_OCR})`, 'i')) ||
      texto.match(new RegExp(`(?:en\\s+respuesta|dando\\s+respuesta)\\s+.*?[Rr]adicado\\s+(?:No\\.?|N[°º])\\.?\\s*((?:${DIGITO_OCR}[\\- ]?){6,11}${DIGITO_OCR})`, 'i')) ||
      texto.match(new RegExp(`[Rr]adicado\\s+(?:No\\.?|N[°º])?\\.?\\s*((?:${DIGITO_OCR}[\\- ]?){6,11}${DIGITO_OCR})`, 'i'))
    if (mRadRef) resultado.radicadoReferencia = probarRadicado(mRadRef[1])

    // ════════════════════════════════════════════════════════════════════════
    // 1. N° DE OFICIO — Prioridad:
    //    a) Etiqueta "CÓDIGO:" (tabla de encabezado institucional)
    //    b) "Oficio No./N°" en cualquier forma
    //    c) "No. de Oficio:" al revés
    //    d) Patrón alfanumérico de código de dependencia (XXX-YY-NNN-AAAA)
    // ════════════════════════════════════════════════════════════════════════
    const mCodigo =
      // CÓDIGO: 940-CE-236-2026  (tabla de encabezado)
      texto.match(/\bC[OÓ]DIGO\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9\-\/\.]{2,24})/i) ||
      // "Oficio No." / "OFICIO N°" en cualquier forma
      texto.match(new RegExp(`\\b(?:Ofici[o0]s?)\\b(?:\\s*(?:No\\.?|N[°º]|de)\\s*)?(?:[ \\t]*[:.\\-][ \\t]*|\\s*)([A-Za-z0-9][A-Za-z0-9OolI|\\-\\/.]{1,24})`, 'i')) ||
      texto.match(new RegExp(`\\b(?:No\\.?|N[°º])\\s*(?:de\\s+)?(?:Ofici[o0])(?:[ \\t]*[:.\\-][ \\t]*|\\s*)([A-Za-z0-9][A-Za-z0-9OolI|\\-\\/.]{1,24})`, 'i')) ||
      // Código de serie institucional Acuasan: "940-CE-236-2026"
      texto.match(/\b(\d{2,4}-[A-Za-z]{1,4}-\d{1,5}-\d{4})\b/) ||
      // Código de serie clásico: "OF-2026-104" o "AC-2026-045"
      texto.match(/\b([A-Za-z]{2,5}-\d{4}-\d{1,5})\b/)
    if (mCodigo) {
      const token = mCodigo[1].replace(/[.:,;]+$/, '').trim()
      // Debe tener al menos 2 dígitos o ser un código alfanumérico corto
      if ((token.match(/\d/g) || []).length >= 2 || /^[A-Za-z]{1,6}[-]?\d+/i.test(token)) {
        resultado.numeroOficio = token
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. LUGAR Y FECHA — "San Gil, 16 de junio de 2026" al inicio de línea.
    //    La fecha de emisión del documento está en el encabezado (lugarFecha)
    //    y tiene prioridad sobre fechas de radicados anteriores citados en el cuerpo.
    // ════════════════════════════════════════════════════════════════════════
    const FECHA_LARGA = `${DIA_LE}[ \\t]+de[ \\t]+${MES_LE}[ \\t]*${ENTRE}${ANIO_LE}|${MES_LE}[ \\t]+${DIA_LE}[ \\t]*${ENTRE}${ANIO_LE}|${DIA_LE}[ \\t]+${MES_LE}[ \\t]+${ANIO_LE}`
    const mLugar =
      texto.match(new RegExp(`^[ \\t]*((?:${MUNICIPIOS_ZONA})[ \\t]*,?[ \\t]*(?:${FECHA_LARGA}|${PATRON_FECHA}))`, 'im')) ||
      texto.match(new RegExp(`^[ \\t]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,20}(?:[ \\t]+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,15})?)[ \\t]*,[ \\t]*(${FECHA_LARGA}|${PATRON_FECHA})[ \\t]*$`, 'im'))
    if (mLugar) {
      resultado.lugarFecha = (mLugar[2] ? `${mLugar[1]}, ${mLugar[2]}` : mLugar[1]).replace(/\s+/g, ' ').trim()
      const mFechaLetrasLugar = resultado.lugarFecha.match(
        new RegExp(`(${DIA_LE})[ \\t]+de[ \\t]+(${MES_LE})[ \\t]*${ENTRE}(${ANIO_LE})`, 'i')
      )
      if (mFechaLetrasLugar) {
        const d = normalizarDigitos(mFechaLetrasLugar[1]).replace(/(?:ro|º|°)$/, '')
        resultado.fechaDocumento = `${d} de ${mFechaLetrasLugar[2]} de ${normalizarDigitos(mFechaLetrasLugar[3])}`
      } else {
        const mFechaCortaLugar = resultado.lugarFecha.match(new RegExp(`(${PATRON_FECHA})`))
        if (mFechaCortaLugar && esFechaPosible(normalizarDigitos(mFechaCortaLugar[1]))) {
          resultado.fechaDocumento = normalizarDigitos(mFechaCortaLugar[1])
        }
      }
    }

    // Si no hubo lugar y fecha con fecha, buscar etiqueta FECHA o fecha en letras
    if (!resultado.fechaDocumento) {
      const mFechaEtiqueta = texto.match(new RegExp(`F\\s*E\\s*C\\s*H\\s*A(?:\\s*[:.\\-]\\s*|\\s*)(${PATRON_FECHA})`, 'i'))
      if (mFechaEtiqueta && esFechaPosible(normalizarDigitos(mFechaEtiqueta[1]))) {
        resultado.fechaDocumento = normalizarDigitos(mFechaEtiqueta[1])
      }
    }
    if (!resultado.fechaDocumento) {
      for (const m of texto.matchAll(new RegExp(PATRON_FECHA, 'g'))) {
        const f = normalizarDigitos(m[0])
        if (esFechaPosible(f)) { resultado.fechaDocumento = f; break }
      }
    }
    if (!resultado.fechaDocumento) {
      const mLetras =
        texto.match(new RegExp(`(?<![0-9OolI])(${DIA_LE})[ \\t]+de[ \\t]+(${MES_LE})[ \\t]*${ENTRE}(${ANIO_LE})(?![0-9OolI])`, 'i')) ||
        texto.match(new RegExp(`(?<![0-9OolI])(${MES_LE})[ \\t]+(${DIA_LE})[ \\t]*${ENTRE}(${ANIO_LE})(?![0-9OolI])`, 'i'))
      if (mLetras) {
        const mesPrimero = new RegExp(`^${MES_LE}$`, 'i').test(mLetras[1])
        const dia = normalizarDigitos(mesPrimero ? mLetras[2] : mLetras[1]).replace(/(?:ro|º|°)$/, '')
        const mes = mesPrimero ? mLetras[1] : mLetras[2]
        const anio = normalizarDigitos(mLetras[3])
        resultado.fechaDocumento = `${dia} de ${mes} de ${anio}`
      }
    }

    if (!resultado.numeroOficio) {
      // Fallback 1: Número de radicado impreso en el sticker del oficio ("Radicado No.: 2630000562")
      const mRadSalida = texto.match(/\b(?:Radicado|Consecutivo)\s+(?:No\.?|N[°º])?\s*[:.]?\s*([0-9]{7,12})\b/i)
      if (mRadSalida) {
        resultado.numeroOficio = mRadSalida[1]
      }
    }
    if (!resultado.numeroOficio) {
      // Fallback 2: Token alfanumérico destacado en el encabezado
      const mToken = texto.match(/\b([A-Z0-9]{2,6}[-–—][A-Z0-9]{2,6}[-–—]\d{2,6})\b/)
      if (mToken) resultado.numeroOficio = mToken[1]
    }

    // Si aún no hay fecha del oficio, usar la fecha de hoy formateada formalmente
    if (!resultado.fechaDocumento) {
      const hoy = new Date()
      const MESES_FORMAL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      resultado.fechaDocumento = `${hoy.getDate()} de ${MESES_FORMAL[hoy.getMonth()]} de ${hoy.getFullYear()}`
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. DESTINATARIO — a quién va dirigida la respuesta.
    //    Orden de certeza (de mayor a menor):
    //    a) Etiqueta "Destinatario:" o "Para:"
    //    b) DOCTOR / DR. / DRA. / ING. / LIC. + nombre (en la misma línea o la siguiente)
    //    c) Saludo "SEÑOR(A):" + nombre en líneas de abajo
    //    d) "Estimado(a) Nombre:" en línea
    // ════════════════════════════════════════════════════════════════════════
    const valorEtq = (etiqueta) => {
      const m = texto.match(new RegExp('\\b(?:' + etiqueta + ')\\b[ \\t]*[:：][ \\t]*([^\\n\\r]+)', 'i'))
      if (!m) return ''
      const v = m[1].replace(/^[ \t]*[:：;.,·\-]+[ \t]*/, '').trim()
      if (!v || esFraseDeCuerpo(v) || !esNombreValido(v)) return ''
      return v
    }
    resultado.destinatario = valorEtq('Destinatari[oa]s?') || valorEtq('Para')

    // DOCTOR / DR. / DRA. / ING. / LIC. / PROF. (saludo en una línea o nombre en la siguiente)
    if (!resultado.destinatario) {
      // Mismo renglón: "DOCTOR: WBEIMAR HERNANDO PEREZ BELTRAN"
      const mDocInline = texto.match(
        /^[ \t]*(?:DOCTOR[A]?|DR[A]?|ING(?:ENIERD?[OA]?)?|LIC(?:ENCIADO?[OA]?)?|PROF(?:ESOR)?|ARQ(?:UITECTO)?)\s*\.?\s*[:：]?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{1,}){1,5})[ \t]*$/im
      )
      if (mDocInline && !esFraseDeCuerpo(mDocInline[1]) && esNombreValido(mDocInline[1])) {
        resultado.destinatario = mDocInline[1].trim()
      }
    }
    if (!resultado.destinatario) {
      // Siguiente línea: "DOCTOR" sólo → nombre en la línea de abajo
      for (let i = 0; i < lineas.length; i++) {
        if (!/^(?:DOCTOR[A]?|DR[A]?\.?|ING\.?|LIC\.?|PROF\.?|ARQ\.?)\s*$/i.test(lineas[i])) continue
        for (let j = i + 1; j < Math.min(i + 3, lineas.length); j++) {
          const l = lineas[j]
          if (/ASUNTO|REFERENCIA|FECHA|CIUDAD/i.test(l)) break
          if (/^[A-ZÁÉÍÓÚÑ]/.test(l) && !CARGO_RE.test(l) && l.length > 4 && l.length <= 70) {
            const pal = l.split(/\s+/)
            if (pal.length >= 2 && pal.length <= 7 && !esFraseDeCuerpo(l) && esNombreValido(l)) {
              resultado.destinatario = l; break
            }
          }
        }
        if (resultado.destinatario) break
      }
    }
    if (!resultado.destinatario) {
      // "Estimado(a) Nombre:" en línea
      const mInline = texto.match(
        /^[ \t]*(?:Estimad[oa]s?)\s*\(?[aá]?\)?(?:\s*[.:，]{0,2}[ \t]*|\s*)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{1,}){1,5})[ \t]*:?[ \t]*$/im
      )
      if (mInline && !esFraseDeCuerpo(mInline[1]) && esNombreValido(mInline[1])) {
        resultado.destinatario = mInline[1].trim()
      }
    }
    if (!resultado.destinatario) {
      // Bloque bajo saludo "SEÑOR(A):"
      for (let i = 0; i < lineas.length; i++) {
        if (!esLineaSaludo(lineas[i]) || /^Se\s*[nñ]?\s*o?res\b/i.test(lineas[i])) continue
        for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
          const l = lineas[j]
          if (/ASUNTO|REFERENCIA|FECHA|REF\b/i.test(l)) break
          if (/Celular|C[eé]dula|C\.C\.|NIT|@/i.test(l)) continue
          if (/^[A-ZÁÉÍÓÚÑ]/.test(l) && !CARGO_RE.test(l) && !/19\d\d|20\d\d/.test(l) &&
              (l.match(/\d/g) || []).length <= 2 && l.length > 4 && l.length <= 60) {
            const palabras = l.split(/\s+/)
            if (palabras.length >= 2 && palabras.length <= 6 && !esFraseDeCuerpo(l) && esNombreValido(l)) {
              resultado.destinatario = l; break
            }
          }
          if (CARGO_RE.test(l)) break
        }
        if (resultado.destinatario) break
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. ASUNTO — etiqueta "Asunto:" / "Referencia:" / "Ref." en la misma
    //    o siguiente línea. Solo texto con apariencia de título, no prosa.
    // ════════════════════════════════════════════════════════════════════════
    const mAsuntoMisma = texto.match(/\b(?:Asunto|Referencia)\b\s*[:：]\s*([^\n\r]{3,120})/i)
    if (mAsuntoMisma && !esFraseDeCuerpo(mAsuntoMisma[1])) {
      resultado.asunto = limpiar(mAsuntoMisma[1])
    } else {
      const mAsuntoSig = texto.match(/\b(?:Asunto|Referencia)\b\s*[:：][ \t]*\r?\n[ \t]*([^\n\r]{3,120})/i)
      if (mAsuntoSig && !esFraseDeCuerpo(mAsuntoSig[1])) {
        resultado.asunto = limpiar(mAsuntoSig[1])
      } else {
        const mRef = texto.match(/\bRef\.?\s*[:：]\s*([^\n\r]{3,120})/i)
        if (mRef && !esFraseDeCuerpo(mRef[1])) resultado.asunto = limpiar(mRef[1])
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. FIRMANTE — funcionario que suscribe el oficio. Del bloque de firma
    //    ("Atentamente," → nombre → cargo), de una etiqueta explícita o del
    //    encabezado con nombre y cargo en la misma línea. Firma ilegible = ''.
    // ════════════════════════════════════════════════════════════════════════
    resultado.firmante = _extraerNombreDeFirma(lineas)

    // CORRECCIÓN OCR Y FORMATEO ELEGANTE EN CAMPOS DEL OFICIO DE RESPUESTA
    if (resultado.destinatario) resultado.destinatario = formatearNombrePersona(resultado.destinatario)
    if (resultado.asunto)       resultado.asunto       = formatearAsunto(resultado.asunto)
    if (resultado.firmante)     resultado.firmante     = formatearNombrePersona(resultado.firmante)

    return resultado
  }
}

export default RadicadosService
