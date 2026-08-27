/**
 * Prueba del pipeline de lectura de radicados SIN navegador.
 * Genera PDFs digitales con el layout real de Acuasan, extrae el texto con el
 * ALGORITMO EXACTO de ocrRadicados.js (pdfjs + hasEOL) y lo parsea con el
 * RadicadosService real del backend. Reporta campo por campo.
 */
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'acuusan-pdf-'))

// ── Generador de PDF válido (Helvetica, una línea por Td) ────────────────────
function buildPdf(lines, path) {
  const esc = (s) => s.replace(/[\\()]/g, (m) => '\\' + m)
  const stream = lines
    .map((l, i) => `BT /F1 11 Tf 50 ${790 - i * 15} Td (${esc(l)}) Tj ET`)
    .join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  writeFileSync(path, pdf, 'latin1')
  return path
}

// ── Extracción con el algoritmo EXACTO de ocrRadicados.js ────────────────────
async function extraerComoElNavegador(path) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const fs = await import('node:fs')
  const buffer = fs.readFileSync(path).buffer.slice(
    fs.readFileSync(path).byteOffset,
    fs.readFileSync(path).byteOffset + fs.readFileSync(path).length
  )
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
  try {
    let embebido = ''
    const totalPaginas = Math.min(doc.numPages, 4)
    for (let i = 1; i <= totalPaginas; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      for (const it of content.items) {
        embebido += it.str
        if (it.hasEOL) embebido += '\n'
      }
      embebido += '\n'
    }
    return embebido
  } finally {
    try { await doc.loadingTask?.destroy() } catch (e) { /* ya destruido */ }
  }
}

// ── Casos: layouts reales de radicados de Acuasan ────────────────────────────
const CASOS = {
  'sello-clasico': [
    'RADICADO No. 2026145230',
    'FECHA: 14/08/2026 09:35 AM',
    'REPUBLICA DE COLOMBIA',
    'DEPARTAMENTO DE SANTANDER',
    'Señores:',
    'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL',
    'REFERENCIA: Peticion de revision de facturacion',
    'Asunto: Solicitud de revision del consumo facturado',
    'San Gil, 12 de agosto de 2026',
    'Remitente: MARIA FERNANDA PEREZ RINCON',
    'En atencion a la peticion presentada por medio de la presente',
    'solicito respetuosamente la revision del consumo de agua facturado',
    'para el inmueble ubicado en la carrera 5 numero 12-34, dado que el',
    'valor cobrado no corresponde al consumo historico. Solicito dar',
    'respuesta dentro de los 15 dias habiles conforme a la ley 1755 de 2015.'
  ],
  'etiquetas-en-linea-separada': [
    'RADICADO',
    '2026145230',
    'FECHA',
    '14/08/2026',
    'REFERENCIA: Revision de conexion de acueducto',
    'Asunto: Solicitud de nueva conexion domiciliaria',
    'Remitente:',
    'JOSE ANTONIO GARCIA MARTINEZ',
    'San Gil, 3 de septiembre de 2026',
    'Por medio de la presente solicito la nueva conexion del servicio',
    'de acueducto para el predio de mi propiedad. Agradezco respuesta',
    'dentro de los 10 dias habiles.'
  ],
  'peticionario-señor-bloque': [
    'RADICADO No. 2026198765',
    'FECHA: 20/08/2026',
    'SEÑORA:',
    'MARIA DEL CARMEN SUAREZ',
    'PRESIDENTA DE LA JAC VEREDA EL CENTRO',
    'San Gil, 18 de agosto de 2026',
    'Asunto: Peticion de mejora del servicio en el sector norte',
    'Respetuosamente solicito la mejora del servicio de acueducto',
    'en el sector norte de la vereda, ya que el suministro es',
    'irregular desde hace tres meses.'
  ]
}

// ── Ejecutar ─────────────────────────────────────────────────────────────────
const { RadicadosService } = await import(
  'file:///c:/Escritorio/Codigo%20Aquasan/acusan/backend/src/modules/radicados/radicados.service.js'
)

let fallos = 0
for (const [nombre, lineas] of Object.entries(CASOS)) {
  const pdfPath = buildPdf(lineas, join(dir, `${nombre}.pdf`))
  const texto = await extraerComoElNavegador(pdfPath)
  console.log(`\n════════ CASO: ${nombre} ════════`)
  console.log('── TEXTO RECONSTRUIDO (primeras 6 líneas):')
  texto.split('\n').slice(0, 6).forEach((l) => console.log(`   |${l}|`))
  const r = RadicadosService.extraerCampos(texto)
  console.log('── CAMPOS EXTRAIDOS:')
  for (const [k, v] of Object.entries(r)) {
    const vacio = (v === '' || v === null) ? '  ← VACIO' : ''
    console.log(`   ${k}: ${JSON.stringify(String(v).slice(0, 60))}${vacio}`)
  }
}

console.log('\nHecho. PDFs en:', dir)
