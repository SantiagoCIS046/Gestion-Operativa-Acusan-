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
   * Elimina un radicado de la base de datos (incluido su documento).
   */
  async eliminar(id) {
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
   * Genera el reporte en CSV (con BOM: Excel lo abre directo).
   */
  async generarCsv() {
    const lista = await this.listar()
    const columnas = [
      ['numeroRadicado', 'N° Radicado'],
      ['fechaRadicacion', 'Fecha Radicación'],
      ['peticionario', 'Peticionario'],
      ['dependencia', 'Dependencia'],
      ['destinatario', 'Destinatario'],
      ['asunto', 'Asunto'],
      ['referencia', 'Referencia'],
      ['fechaDocumento', 'Fecha Documento'],
      ['numeroRadicadoPdf', 'N° Radicado PDF'],
      ['estado', 'Estado'],
      ['fechaVencimiento', 'Vencimiento'],
      ['registradoPor', 'Registrado Por']
    ]
    const celda = (v) => {
      let s = String(v ?? '')
      // Neutraliza celdas que Excel interpretaría como fórmula (=, +, -, @, tab)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const filas = [
      columnas.map(([, titulo]) => celda(titulo)).join(';'),
      ...lista.map((r) => columnas.map(([campo]) => celda(r[campo])).join(';'))
    ]
    return `﻿${filas.join('\r\n')}`
  },

  /**
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

    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    // 1. N° RADICADO DEL SELLO — la etiqueta "Radicado" (cualquier grafía)
    // habilita cualquier número; "No."/"N°" solo habilitan valores con forma
    // de año (2xxx…), y un número suelto solo cuenta con esa misma forma: así
    // una cédula, un NIT o un teléfono NUNCA llenan este campo. Sin sello
    // legible el campo queda vacío.
    const probarRadicado = (crudo) => {
      // El OCR parte el número con espacios o guiones ("2026 14523",
      // "RAD-2026-00123"): se retiran antes de normalizar O/0 y l/1.
      const limpio = normalizarDigitos(String(crudo).replace(/[\- ]/g, '')).trim()
      const digitosReales = (String(crudo).match(/[0-9]/g) || []).length
      return /^\d{7,12}$/.test(limpio) && digitosReales >= 4 ? limpio : ''
    }
    const mRad =
      texto.match(new RegExp(`\\bRad(?:[i1l]c[a4]d[o0])?(?:\\s+|\\s*[:.\\-]\\s*)(?:No\\.?\\s*|N[°º.]\\s*)*(?:[:.\\-]?\\s*)((?:${DIGITO_OCR}[\\- ]?){6,11}${DIGITO_OCR})\\b`, 'i')) ||
      texto.match(new RegExp(`\\b(?:No\\.?|N[°º])\\s*[:.]?\\s*((?:2${DIGITO_OCR}[\\- ]?){5,9}${DIGITO_OCR})\\b`, 'i')) ||
      texto.match(new RegExp(`\\b(2${DIGITO_OCR}{7,10})\\b`, 'i'))
    if (mRad) resultado.numeroRadicadoPdf = probarRadicado(mRad[1].trim())

    // 2. FECHA DEL SELLO — etiqueta FECHA (con huecos de OCR) o primera fecha
    // válida del documento. La captura tolera O/0 y l/1 y se normaliza; una
    // candidata sin etiqueta se valida (día ≤ 31, mes ≤ 12) antes de aceptarse.
    const PATRON_FECHA = `${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{1,2}[/\\-]${DIGITO_OCR}{4}`
    const esFechaPosible = (f) => {
      const [d, mes] = f.split(/[/\-]/).map(Number)
      return d >= 1 && d <= 31 && mes >= 1 && mes <= 12
    }
    const mFechaSello = texto.match(new RegExp(`F\\s*E\\s*C\\s*H\\s*A\\s*[:.\\-]?\\s*(${PATRON_FECHA})`, 'i'))
    // "14/ago/2026": el mes viaja tal cual — la 'o' de "ago" no es un cero del OCR
    const mFechaTexto = texto.match(new RegExp(`(${DIGITO_OCR}{1,2})\\/([a-zA-Z0-9áéíóúÁÉÍÓÚ]{3,4})\\/(${DIGITO_OCR}{4})`, 'i'))
    const fSello = mFechaSello ? normalizarDigitos(mFechaSello[1]) : ''
    const fTexto = mFechaTexto
      ? `${normalizarDigitos(mFechaTexto[1])}/${mFechaTexto[2]}/${normalizarDigitos(mFechaTexto[3])}`
      : ''
    // El sello manda, pero una fecha imposible ("99/99/2026") jamás viaja:
    // cae a la primera fecha válida del documento.
    resultado.fechaDocumento = fSello && esFechaPosible(fSello) ? fSello : fTexto
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
    if (/ACUASAN/i.test(texto) || /ACUEDUCTO/i.test(texto)) {
      resultado.dependencia = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'
    } else if (bloqueSenores.length) {
      resultado.dependencia = bloqueSenores[0]
    } else {
      const mEmp = texto.match(/Se\s*[nñ]?\s*o?res\s*:\s*([^\n\r]+)/i)
      if (mEmp && esLineaEncabezado(mEmp[1])) resultado.dependencia = mEmp[1].trim()
    }

    // 5. PETICIONARIO — etiqueta explícita o saludo "SEÑOR(A):" + nombre/cargo.
    // Valor de etiqueta: primero en la MISMA línea; si la etiqueta queda sola,
    // la siguiente línea — salvo que esa línea sea OTRA etiqueta (un "Asunto:"
    // vacío jamás debe robar el "Remitente:" de debajo).
    const valorEtiqueta = (etiqueta) => {
      // El backtracking puede dejar ":" o " -" sueltos como valor: se pelan.
      const pelar = (v) => (v || '').replace(/^[ \t]*[:：;.,·\-]+[ \t]*/, '').trim()
      const mismo = texto.match(new RegExp(`\\b${etiqueta}\\b[ \\t]*[:：]?[ \\t]*([^\\n\\r]+)`, 'i'))
      if (mismo && pelar(mismo[1])) return pelar(mismo[1])
      const siguiente = texto.match(new RegExp(`\\b${etiqueta}\\b[ \\t]*[:：][ \\t]*\\r?\\n[ \\t]*([^\\n\\r]+)`, 'i'))
      if (siguiente) {
        const v = pelar(siguiente[1])
        // La línea de abajo es OTRA etiqueta → esta quedó vacía de verdad
        if (v && !/^(?:Remitente|Destinatario|Asunto|REFERENCIA|FECHA|Rad|RADICADO|Se[nñ]ores|Señor|C\.C|NIT)/i.test(v)) {
          return v
        }
      }
      return ''
    }
    const remitenteCrudo = valorEtiqueta('Remitente')
    const mRem = remitenteCrudo ? [null, remitenteCrudo] : null
    const mDest = (() => { const v = valorEtiqueta('Destinatario'); return v ? [null, v] : null })()
    if (mRem && !esFraseDeCuerpo(mRem[1])) {
      resultado.peticionario = mRem[1].replace(/-\s*r\/l.*$/i, '').trim()
    }
    if (mDest && !esFraseDeCuerpo(mDest[1])) {
      resultado.destinatario = mDest[1].trim()
    }

    // La autoidentificación explícita ("Yo, X, identificad@") es la evidencia
    // más fuerte: corre ANTES que el saludo para que un bloque SEÑORES con la
    // empresa debajo nunca la pise.
    if (!resultado.peticionario || esFraseDeCuerpo(resultado.peticionario)) {
      const mYo = texto.match(/Yo[,\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{5,40})[,\s]+identificad/i)
      if (mYo) resultado.peticionario = mYo[1].trim()
    }

    if (!resultado.peticionario || esFraseDeCuerpo(resultado.peticionario)) {
      for (let i = 0; i < lineas.length; i++) {
        if (!esLineaSaludo(lineas[i])) continue
        let nombre = ''
        let cargo = ''
        for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
          const l = lineas[j]
          if (/REFERENCIA|ASUNTO|FECHA|RADICADO/i.test(l)) break
          if (new RegExp(`^(?:${MUNICIPIOS_ZONA})\\b`, 'i').test(l)) break
          // La empresa destinataria no es peticionaria ("SEÑORES:" + ACUASAN…)
          if (/ACUASAN|ACUEDUCTO|E\.I\.C\.E|E\.S\.P/i.test(l)) break
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

    // 5b. DESTINATARIO sin etiqueta — a quién va dirigida la carta, en orden
    // de certeza: "A:"/"Atención:" al inicio de línea, el bloque bajo
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
        // Mismo nombre EXACTO que el peticionario (mayúsculas y espacios
        // fuera) no es destinatario; compartir solo el primer nombre sí lo
        // es ("ANA MARIA RIOS" pet. ≠ "ANA MARIA TORRES" dest.).
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
    const refCruda = valorEtiqueta('REFERENCIA')
    const mRef = refCruda ? [null, refCruda] : texto.match(/(C[oó]digo de suscriptor[^\n\r]*)/i)
    if (mRef && !esFraseDeCuerpo(mRef[1])) {
      resultado.referencia = mRef[1].trim()
    }

    // 7. ASUNTO — etiqueta, o la referencia, o la primera línea de solicitud
    const asuntoCrudo = valorEtiqueta('Asunto')
    if (asuntoCrudo && !esFraseDeCuerpo(asuntoCrudo)) {
      resultado.asunto = asuntoCrudo.trim()
    } else if (resultado.referencia) {
      resultado.asunto = resultado.referencia
    } else {
      const mSolicitud = texto.match(/(Solicitud[^\n\r]+)/i)
      if (mSolicitud && !esFraseDeCuerpo(mSolicitud[1])) {
        resultado.asunto = mSolicitud[1].trim()
      }
    }

    // 8. CONTEXTO — el párrafo sustantivo de la carta (recortado a 450 cars)
    resultado.contexto = this._extraerContexto(texto, lineas)

    // 9. DÍAS DE TÉRMINO LEGAL según lo que pide la carta
    resultado.diasParaVencer = this._inferirDias(texto)

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
      mClave = texto.match(/Solicit[^\n\r]*[\s\S]{30,600}/i)
    }
    let contexto = ''
    if (mClave && mClave[0]) {
      contexto = mClave[0]
    } else {
      const cuerpo = lineas.filter((l) => {
        if (/^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|SEÑOR|SEÑORA|REFERENCIA:|Rad\.|No\.|FECHA:)/i.test(l)) return false
        if (/^(?:San Gil|Pinchote),/i.test(l)) return false
        if (/^[\s_.\-=*]+$/.test(l)) return false
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
  }
}

export default RadicadosService
