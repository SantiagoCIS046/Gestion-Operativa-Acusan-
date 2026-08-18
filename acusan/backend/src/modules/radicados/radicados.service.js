import { PrismaClient } from '@prisma/client'
import moment from 'moment'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import Tesseract from 'tesseract.js'
import { createObjectCsvWriter } from 'csv-writer'

const require = createRequire(import.meta.url)
const pdfParseModule = require('pdf-parse')
const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule)
const pdfPoppler = require('pdf-poppler')


const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carpeta local de respaldo y temporales OCR
const DRIVE_LOCAL_DIR = path.join(__dirname, '../../../drive_local_backup')
if (!fs.existsSync(DRIVE_LOCAL_DIR)) {
  fs.mkdirSync(DRIVE_LOCAL_DIR, { recursive: true })
}

const TEMP_OCR_DIR = path.join(__dirname, '../../../temp_ocr')
if (!fs.existsSync(TEMP_OCR_DIR)) {
  fs.mkdirSync(TEMP_OCR_DIR, { recursive: true })
}

// Auxiliares OCR & Limpieza
const limpiar = (str) => (str || '').replace(/^[:\s\-]+/, '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

const isBodySentence = (str) => {
  if (!str) return false
  return /^(?:En atenci[oó]n|Una vez|Por medio|De acuerdo|En este sentido|deber[aá]|solicitar|mediante|que la|se evidencia|con el fin|respetuosamente|me permito|para la|jurisdicci[oó]n)/i.test(str.trim())
}

async function extraerTextoConOCR(buffer, mimeType) {
  let imagenBuffer = null
  let tempPdfPath = null
  let tempImgPath = null

  try {
    if (mimeType === 'application/pdf' || !mimeType) {
      const id = Date.now()
      tempPdfPath = path.join(TEMP_OCR_DIR, `doc_${id}.pdf`)
      fs.writeFileSync(tempPdfPath, buffer)

      const opts = {
        format: 'png',
        out_dir: TEMP_OCR_DIR,
        out_prefix: `page_${id}`,
        page: 1,
        scale: 1024
      }

      await pdfPoppler.convert(tempPdfPath, opts)

      const files = fs.readdirSync(TEMP_OCR_DIR).filter(f => f.startsWith(opts.out_prefix) && f.endsWith('.png'))
      if (files.length > 0) {
        tempImgPath = path.join(TEMP_OCR_DIR, files[0])
        imagenBuffer = fs.readFileSync(tempImgPath)
      }
    } else if (mimeType && mimeType.startsWith('image/')) {
      imagenBuffer = buffer
    }
  } catch (errConv) {
    console.error('⚠️ [OCR] Error convirtiendo PDF a imagen:', errConv.message)
  } finally {
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try { fs.unlinkSync(tempPdfPath) } catch(e){}
    }
    if (tempImgPath && fs.existsSync(tempImgPath)) {
      try { fs.unlinkSync(tempImgPath) } catch(e){}
    }
  }

  if (!imagenBuffer) return ''

  try {
    const res = await Tesseract.recognize(imagenBuffer, 'spa')
    return res?.data?.text || ''
  } catch (errWorker) {
    console.warn('⚠️ Error Tesseract OCR:', errWorker.message)
    return ''
  }
}

const extraerCamposPdf = (texto) => {
  const resultado = {
    numeroRadicadoPdf: '',
    fechaDocumento: '',
    lugarFecha: '',
    peticionario: '',
    dependencia: '',
    destinatario: '',
    asunto: '',
    referencia: '',
    contexto: ''
  }

  if (!texto || texto.trim().length === 0) return resultado

  const rawLines = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // 1. NÚMERO DE RADICADO PDF
  const mRad =
    texto.match(/(?:Rad(?:icado)?|No\.?|RAD)\s*[:.-]?\s*([0-9]{7,12})/i) ||
    texto.match(/\b(2[610]\d{7,9})\b/) ||
    texto.match(/\b([0-9]{8,12})\b/)
  if (mRad) resultado.numeroRadicadoPdf = mRad[1].trim()

  // 2. FECHA / HORA SELLO
  const mFechaSello = texto.match(/(?:FECHA|Fecha)\s*[:.-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  const mFechaHora  = texto.match(/(\d{1,2}\/[a-zA-ZáéíóúÁÉÍÓÚ]{3,4}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i)
  const mFechaStd   = texto.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)

  if (mFechaSello) resultado.fechaDocumento = mFechaSello[1].trim()
  else if (mFechaHora) resultado.fechaDocumento = mFechaHora[1].trim()
  else if (mFechaStd) resultado.fechaDocumento = mFechaStd[1].trim()

  // 3. LUGAR Y FECHA CARTA
  const mLugarF =
    texto.match(/((?:San Gil|Pinchote|Socorro|Bucaramanga|Bogot[aá])[^,\n\r]*,\s*\d{1,2}\s+(?:de\s+)?[a-zA-ZáéíóúÁÉÍÓÚ]+\s+(?:de\s+)?\d{4})/i) ||
    texto.match(/([A-ZÁÉÍÓÚ][a-záéíóú]+,\s*\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})/i)
  if (mLugarF) resultado.lugarFecha = mLugarF[1].trim()

  // 4. EMPRESA DESTINATARIA
  if (/ACUASAN/i.test(texto) || /ACUEDUCTO/i.test(texto)) {
    resultado.dependencia = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'
  } else {
    const mEmp = texto.match(/Se[ñn]ores\s*:\s*([^\n\r]+)/i)
    if (mEmp) resultado.dependencia = mEmp[1].trim()
  }

  // 5. PETICIONARIO & DESTINATARIO
  const mRem  = texto.match(/Remitente\s*[:：]?\s*([^\n\r]+)/i)
  const mDest = texto.match(/Destinatario\s*[:：]?\s*([^\n\r]+)/i)

  if (mRem && !isBodySentence(mRem[1])) {
    resultado.peticionario = mRem[1].replace(/-\s*r\/l.*$/i, '').trim()
  }
  if (mDest && !isBodySentence(mDest[1])) {
    resultado.destinatario = mDest[1].trim()
  }

  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      if (/^(?:SEÑORA|SEÑOR|SR|SRA)\s*:/i.test(line)) {
        let nombre = ''
        let cargo = ''
        for (let j = i + 1; j < Math.min(i + 4, rawLines.length); j++) {
          const nextL = rawLines[j]
          if (/REFERENCIA|ASUNTO|FECHA|San Gil|Pinchote/i.test(nextL)) break
          if (nextL.length > 3 && !/^\d+$/.test(nextL) && !/@/.test(nextL) && !/Celular/i.test(nextL)) {
            if (!nombre && /^[A-ZÁÉÍÓÚ\s]+$/i.test(nextL) && nextL.length > 4) {
              nombre = nextL
            } else if (nombre && /PRESIDENTA|REPRESENTANTE|ALCALDE|GERENTE|JAC/i.test(nextL)) {
              cargo = nextL
            }
          }
        }
        if (nombre && !isBodySentence(nombre)) {
          resultado.peticionario = cargo ? `${nombre} - ${cargo}` : nombre
          break
        }
      }
    }
  }

  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    const mYo = texto.match(/Yo[,\s]+([A-ZÁÉÍÓÚ\s]{6,40})[,\s]+identificad/i)
    if (mYo) resultado.peticionario = mYo[1].trim()
  }

  if (!resultado.destinatario || isBodySentence(resultado.destinatario)) {
    resultado.destinatario = 'ACUASAN E.I.C.E. - E.S.P.'
  }

  // 6. REFERENCIA
  const mRef =
    texto.match(/REFERENCIA\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/Referencia\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/(C[oó]digo de suscriptor[^\n\r]*)/i)

  if (mRef && !isBodySentence(mRef[1])) {
    resultado.referencia = mRef[1].trim()
  }

  // 7. ASUNTO
  const mAsunto = texto.match(/Asunto\s*[:：]?\s*([^\n\r]+)/i)
  if (mAsunto && !isBodySentence(mAsunto[1])) {
    resultado.asunto = mAsunto[1].trim()
  } else if (resultado.referencia) {
    resultado.asunto = resultado.referencia
  } else {
    const mSolicitud = texto.match(/(Solicitud[^\n\r]+)/i)
    if (mSolicitud && !isBodySentence(mSolicitud[1])) resultado.asunto = mSolicitud[1].trim()
  }

  // 8. CONTEXTO
  const bodyLines = rawLines.filter(line => {
    if (/^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|San Gil,|Pinchote,|SEÑOR|SEÑORA|REFERENCIA:|E\s*950-|Rad\.|No\.|FECHA:)/i.test(line)) return false
    if (/^[\s_.\-\=\*]+$/.test(line)) return false
    if (line.length < 15 && !/[a-záéíóú]/i.test(line)) return false
    return true
  })

  let contextoTexto = ''
  const regexParrafoClave = /(?:En atenci[oó]n|Por medio|Solicit|Se solicita|Mediante|Yo,|Con el fin|Una vez|Respetado)[^\n\r]*[\s\S]{30,600}/i
  const matchClave = texto.match(regexParrafoClave)

  if (matchClave && matchClave[0]) {
    contextoTexto = matchClave[0].replace(/[\r\n]+/g, ' ').replace(/[\s._\-]{3,}/g, ' ').replace(/\s{2,}/g, ' ').trim()
  } else if (bodyLines.length > 0) {
    contextoTexto = bodyLines.slice(0, 4).join(' ').replace(/[\r\n]+/g, ' ').replace(/[\s._\-]{3,}/g, ' ').replace(/\s{2,}/g, ' ').trim()
  }

  if (contextoTexto.length > 450) {
    let sub = contextoTexto.substring(0, 450)
    const lastPeriod = sub.lastIndexOf('.')
    if (lastPeriod > 200) sub = sub.substring(0, lastPeriod + 1)
    else {
      const lastSpace = sub.lastIndexOf(' ')
      if (lastSpace > 200) sub = sub.substring(0, lastSpace) + '...'
    }
    contextoTexto = sub
  }

  resultado.contexto = contextoTexto || 'Registro documental procesado mediante OCR.'

  // 9. DÍAS PARA VENCER
  let diasSugeridos = 10
  const mPlazoNum = texto.match(/(?:plazo|t[eé]rmino|tiempo|vence|vencimiento|en|dentro de)\s*(?:un\s+t[eé]rmino\s+de\s*)?(?:de\s*)?\b([0-9]{1,2})\b\s*d[ií]as/i)
  if (mPlazoNum && mPlazoNum[1]) {
    const num = parseInt(mPlazoNum[1], 10)
    if ([3, 5, 10, 15, 30].includes(num)) diasSugeridos = num
    else if (num <= 4) diasSugeridos = 3
    else if (num <= 7) diasSugeridos = 5
    else if (num <= 12) diasSugeridos = 10
    else if (num <= 20) diasSugeridos = 15
    else diasSugeridos = 30
  } else {
    if (/tutela|urgente|inmediato|derecho de petici[oó]n prioritario/i.test(texto)) diasSugeridos = 3
    else if (/informaci[oó]n|copias|documentos/i.test(texto)) diasSugeridos = 10
    else if (/consulta|viabilidad|disponibilidad|reclamo|queja|peticion/i.test(texto)) diasSugeridos = 15
  }

  resultado.diasParaVencer = diasSugeridos

  if (isBodySentence(resultado.peticionario)) resultado.peticionario = ''
  if (isBodySentence(resultado.destinatario)) resultado.destinatario = 'ACUASAN E.I.C.E. - E.S.P.'
  if (isBodySentence(resultado.asunto))       resultado.asunto = resultado.referencia || ''

  return resultado
}

// Memoria en caliente para entornos sin base de datos activa (Vercel/Offline)
let RADICADOS_IN_MEMORY = [
  {
    id: 'RAD-1241',
    numeroRadicado: 'RAD-1241',
    numeroRadicadoPdf: '2610000648',
    peticionario: 'Yadira Velásquez Masey - Presidenta JAC Vereda El Congual',
    remitente: 'Yadira Velásquez Masey',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Ruiz Suarez Luz Marina - Gerencia General',
    asunto: 'Respuesta Radicado Acuasan EI.CE-ESP - Solicitud de Visita Técnica y Medidor',
    tipoDocumento: 'Derecho de Petición',
    registradoPor: 'Eliana',
    estado: 'Resuelto',
    prioridad: 'ALTA',
    fechaRadicacion: new Date('2026-08-18T08:30:00.000Z'),
    fechaVencimiento: new Date('2026-08-24T00:00:00.000Z'),
    contexto: 'Petición formal para revisión técnica de acometida y suministro en sector rural.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1729',
    numeroRadicado: 'RAD-1729',
    numeroRadicadoPdf: '2610000649',
    peticionario: 'Laura Dulcey Nieves - Urbanización Bella Isla',
    remitente: 'Laura Dulcey Nieves',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Área de Facturación y Medición',
    asunto: 'Solicitud de revisión de factura y aforo por variación de consumo',
    tipoDocumento: 'Reclamo',
    registradoPor: 'Román',
    estado: 'Pendiente',
    prioridad: 'ALTA',
    fechaRadicacion: new Date('2026-08-18T09:45:00.000Z'),
    fechaVencimiento: new Date('2026-08-24T00:00:00.000Z'),
    contexto: 'La usuaria reporta incremento atípico en tarifa durante el último periodo facturado.',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  },
  {
    id: 'RAD-1845',
    numeroRadicado: 'RAD-1845',
    numeroRadicadoPdf: '2640000712',
    peticionario: 'Carlos Arturo Gómez Prada - Barrio San Martín',
    remitente: 'Carlos Arturo Gómez',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Dirección Operativa y Alcantarillado',
    asunto: 'Reporte de hundimiento en pozo de inspección y mantenimiento preventivo',
    tipoDocumento: 'Petición Técnica',
    registradoPor: 'Eliana',
    estado: 'Pendiente',
    prioridad: 'CRITICA',
    fechaRadicacion: new Date('2026-08-18T10:15:00.000Z'),
    fechaVencimiento: new Date('2026-08-21T00:00:00.000Z'),
    contexto: 'Urgencia técnica por riesgo de filtración en vía pública principal.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1902',
    numeroRadicado: 'RAD-1902',
    numeroRadicadoPdf: '2640000780',
    peticionario: 'María Esperanza Cárdenas - Sector Santander',
    remitente: 'María Esperanza Cárdenas',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Subgerencia Comercial',
    asunto: 'Certificación de estratificación socioeconómica para subsidio',
    tipoDocumento: 'Solicitud',
    registradoPor: 'Román',
    estado: 'Resuelto',
    prioridad: 'MEDIA',
    fechaRadicacion: new Date('2026-08-17T14:20:00.000Z'),
    fechaVencimiento: new Date('2026-08-31T00:00:00.000Z'),
    contexto: 'Trámite concluido con entrega de certificado digital oficial.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1930',
    numeroRadicado: 'RAD-1930',
    numeroRadicadoPdf: '2640000805',
    peticionario: 'Junta de Acción Comunal Barrio José Antonio Galán',
    remitente: 'JAC José Antonio Galán',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Dirección Técnica de Redes de Acueducto',
    asunto: 'Solicitud de ampliación de redes y optimización de presión sector alto',
    tipoDocumento: 'Derecho de Petición',
    registradoPor: 'Eliana',
    estado: 'Pendiente',
    prioridad: 'MEDIA',
    fechaRadicacion: new Date('2026-08-18T11:10:00.000Z'),
    fechaVencimiento: new Date('2026-09-01T00:00:00.000Z'),
    contexto: 'Radicado recién ingresado vía ventanilla única por Eliana.',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  }
]

export const RadicadosService = {
  async obtenerTodos() {
    try {
      const dbRadicados = await prisma.radicado.findMany({
        orderBy: { fechaRadicacion: 'desc' }
      })
      if (dbRadicados && dbRadicados.length > 0) return dbRadicados
      return RADICADOS_IN_MEMORY
    } catch (e) {
      console.warn('DB no disponible para radicados, respondiendo con datos en memoria:', e.message)
      return RADICADOS_IN_MEMORY
    }
  },

  async crear(payload) {
    const {
      peticionario, dependencia, correoDrive, registradoPor, contexto, diasParaVencer, archivoNombre,
      destinatario, asunto, referencia, fechaDocumento, lugarFecha, numeroRadicadoPdf,
      archivoBase64, archivoUrl
    } = payload

    const numeroRadicado = `RAD-${Math.floor(1000 + Math.random() * 9000)}`
    const fechaVencimiento = moment().add(parseInt(diasParaVencer) || 10, 'days').toDate()

    const itemData = {
      id: numeroRadicado,
      numeroRadicado,
      peticionario,
      dependencia,
      correoDrive: correoDrive || 'encargada@acuasan.gov.co',
      registradoPor: registradoPor || 'Encargada',
      contexto: contexto || 'Registro documental de radicación.',
      destinatario: destinatario || null,
      asunto: asunto || null,
      referencia: referencia || null,
      fechaDocumento: fechaDocumento || null,
      lugarFecha: lugarFecha || null,
      numeroRadicadoPdf: numeroRadicadoPdf || null,
      fechaRadicacion: new Date(),
      fechaVencimiento,
      estado: 'Pendiente',
      archivoNombre: archivoNombre || null,
      archivoUrl: archivoUrl || null,
      archivoBase64: archivoBase64 || null
    }

    try {
      const nuevo = await prisma.radicado.create({
        data: itemData
      })
      return nuevo
    } catch (e) {
      console.warn('DB no disponible, guardando radicado en memoria:', e.message)
      RADICADOS_IN_MEMORY.unshift(itemData)
      return itemData
    }
  },

  async actualizarEstado(id, estado) {
    try {
      return await prisma.radicado.update({
        where: { id: String(id) },
        data: { estado }
      })
    } catch (e) {
      console.warn('DB no disponible, actualizando estado en memoria:', e.message)
      const idx = RADICADOS_IN_MEMORY.findIndex(r => r.id === id || r.numeroRadicado === id)
      if (idx !== -1) {
        RADICADOS_IN_MEMORY[idx].estado = estado
        return RADICADOS_IN_MEMORY[idx]
      }
      return { id, estado }
    }
  },

  async extraerPdf(dataBuffer, mimeType, originalname) {
    let texto = ''
    let metodo = ''

    // 1. Intentar pdf-parse (PDFs vectoriales con texto embebido)
    if (mimeType === 'application/pdf' || !mimeType) {
      try {
        const data = await pdfParse(dataBuffer)
        texto = (data.text || '').trim()
        if (texto.length > 40) {
          metodo = 'pdf-parse'
        } else {
          texto = ''
        }
      } catch (errPdf) {
        console.warn('pdf-parse no extrajo texto suficiente — usando OCR')
        texto = ''
      }
    }

    // 2. Si no hay texto (escaneados/imágenes), usar OCR con pdf-poppler + Tesseract.js
    if (!texto) {
      try {
        texto = await extraerTextoConOCR(dataBuffer, mimeType)
        metodo = 'OCR (Tesseract.js)'
      } catch (errOCR) {
        console.error('Error en OCR:', errOCR.message)
        texto = ''
        metodo = 'manual'
      }
    }

    if (!metodo) metodo = 'lectura básica'

    const campos = extraerCamposPdf(texto)

    return {
      mensaje: `PDF procesado exitosamente (método: ${metodo})`,
      metodo,
      peticionario: campos.peticionario || '',
      dependencia: campos.dependencia || '',
      registradoPor: 'Encargada',
      contexto: campos.contexto || '',
      numeroRadicadoPdf: campos.numeroRadicadoPdf || '',
      fechaDocumento: campos.fechaDocumento || '',
      lugarFecha: campos.lugarFecha || '',
      destinatario: campos.destinatario || '',
      asunto: campos.asunto || '',
      referencia: campos.referencia || '',
      diasParaVencer: campos.diasParaVencer || 10,
      nombreArchivo: originalname || 'documento.pdf'
    }
  },

  async generarExcel(res) {
    const radicados = await prisma.radicado.findMany({ orderBy: { fechaRadicacion: 'desc' } })
    const fileName = `Historial_Radicados_${moment().format('YYYY-MM-DD')}.csv`
    const filePath = path.join(__dirname, `../../../${fileName}`)

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'numeroRadicado',    title: 'CODIGO RADICADO SISTEMA' },
        { id: 'numeroRadicadoPdf', title: 'NUMERO RADICADO PDF' },
        { id: 'fechaRadicacion',   title: 'FECHA REGISTRO' },
        { id: 'fechaDocumento',    title: 'FECHA/HORA DOCUMENTO' },
        { id: 'lugarFecha',        title: 'LUGAR Y FECHA CARTA' },
        { id: 'peticionario',      title: 'REMITENTE / PETICIONARIO' },
        { id: 'dependencia',       title: 'EMPRESA DESTINATARIA' },
        { id: 'destinatario',      title: 'DESTINATARIO (FUNCIONARIO)' },
        { id: 'asunto',            title: 'ASUNTO' },
        { id: 'referencia',        title: 'REFERENCIA' },
        { id: 'registradoPor',     title: 'REGISTRADO POR' },
        { id: 'estado',            title: 'ESTADO' },
        { id: 'fechaVencimiento',  title: 'FECHA VENCIMIENTO' },
        { id: 'contexto',          title: 'CONTEXTO DE PETICION' }
      ]
    })

    const recordsFormatted = radicados.map(r => ({
      numeroRadicado:    r.numeroRadicado,
      numeroRadicadoPdf: r.numeroRadicadoPdf || 'N/A',
      fechaRadicacion:   moment(r.fechaRadicacion).format('YYYY-MM-DD HH:mm'),
      fechaDocumento:    r.fechaDocumento || 'N/A',
      lugarFecha:        r.lugarFecha || 'N/A',
      peticionario:      r.peticionario,
      dependencia:       r.dependencia,
      destinatario:      r.destinatario || 'N/A',
      asunto:            r.asunto || 'N/A',
      referencia:        r.referencia || 'N/A',
      registradoPor:     r.registradoPor || r.peticionario || 'Encargada',
      estado:            r.estado,
      fechaVencimiento:  moment(r.fechaVencimiento).format('YYYY-MM-DD'),
      contexto:          (r.contexto || '').replace(/\n/g, ' ')
    }))

    await csvWriter.writeRecords(recordsFormatted)
    return { filePath, fileName }
  }
}
