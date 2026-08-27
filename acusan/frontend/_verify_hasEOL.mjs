// Reproduce EXACTLY the ocrRadicados.js line 148 logic with the installed pdfjs-dist 6.2.108
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync } from 'node:fs'

const file = process.argv[2] || '_test_lineas.pdf'
const buffer = new Uint8Array(readFileSync(file))
const doc = await getDocument({ data: buffer, useSystemFonts: true }).promise

let embebido = ''
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  if (i === 1) {
    console.log('=== ITEMS (page 1) ===')
    for (const it of content.items) {
      console.log(JSON.stringify({ str: it.str, hasEOL: it.hasEOL }))
    }
  }
  // EXACT copy of frontend line 148-149
  embebido += content.items.map((it) => it.str).join(' ') + '\n'
  embebido = embebido.replace(/\s{3,}/g, '\n')
}

console.log('=== RESULTING TEXT (after join + \\n) ===')
console.log(JSON.stringify(embebido))
console.log('=== LINES AFTER BACKEND SPLIT (texto.split(/\\r?\\n/)) ===')
const lineas = embebido.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
console.log('line count:', lineas.length)
lineas.forEach((l, idx) => console.log(`${idx}: ${JSON.stringify(l.slice(0, 120))}`))

// Backend regexes against this text
const mAsunto = embebido.match(/Asunto\s*[:：]?\s*([^\n\r]+)/i)
console.log('=== ASUNTO captured ===')
console.log(mAsunto ? JSON.stringify(mAsunto[1].slice(0, 200)) : '(no match)')
const anchored = lineas.filter(l => /^(?:SEÑORA|SEÑOR|SR|SRA)\s*:/i.test(l))
console.log('=== lines matching /^(SEÑOR|SEÑORA|SR|SRA)\s*:/ ===', anchored.length)

// What the CORRECT approach would yield
let fixed = ''
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  fixed += content.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('') + '\n'
}
console.log('=== FIXED VERSION (hasEOL respected) line count ===')
console.log(fixed.split(/\r?\n/).filter(Boolean).length)
