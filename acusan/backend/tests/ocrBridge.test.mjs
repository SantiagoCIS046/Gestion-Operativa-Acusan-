// ocrBridge.test.mjs — Puente Node → motor OCR Python (ocr.service.js)
// ─────────────────────────────────────────────────────────────────────────────
// Corre contra stubs de node:http (puerto efímero), sin levantar nada real:
//   1. Python OK              → status 200 con el cuerpo tal cual
//   2. Python caído (ECONNREFUSED) → 503 no-disponible (fallback navegador)
//   3. Python responde 500    → 502 error-python
//   4. Python colgado         → 504 timeout (OCR_PY_TIMEOUT_MS corto)
// Ejecutar: node acusan/backend/tests/ocrBridge.test.mjs

import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RUTA_SERVICIO = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules', 'ocr', 'ocr.service.js')

let pasados = 0
let fallidos = 0
const verificar = (nombre, condicion, detalle = '') => {
  if (condicion) {
    pasados++
    console.log(`  ✔ ${nombre}`)
  } else {
    fallidos++
    console.error(`  ✘ ${nombre} ${detalle}`)
  }
}

// Importa ocr.service.js con un OCR_PY_URL distinto por caso: la URL se lee
// del env al cargar el módulo, así que cada variante usa un import fresco
// (query-string distinto = módulo distinto en la caché de ESM).
const importarServicio = async (url, timeoutMs) => {
  process.env.OCR_PY_URL = url
  if (timeoutMs) process.env.OCR_PY_TIMEOUT_MS = String(timeoutMs)
  return import(pathToFileURL(RUTA_SERVICIO).href + `?py=${encodeURIComponent(url)}`)
}

const escuchar = (manejador) => new Promise((resolve) => {
  const servidor = http.createServer(manejador)
  servidor.listen(0, '127.0.0.1', () => resolve({ servidor, puerto: servidor.address().port }))
})

const cerrar = (servidor) => new Promise((resolve) => servidor.close(resolve))

// ── 1. Python OK ─────────────────────────────────────────────────────────────
{
  const { servidor, puerto } = await escuchar((req, res) => {
    let cuerpo = ''
    req.on('data', (c) => { cuerpo += c })
    req.on('end', () => {
      const datos = JSON.parse(cuerpo)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        metodo: 'pdf-digital',
        paginas: 1,
        texto: `Radicado No.: 2610000736 (${datos.dominio})`,
        tipo: 'RADICADO',
        campos: { peticionario: 'PEREZ GOMEZ JOSE' }
      }))
    })
  })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const { status, cuerpo } = await OcrService.escanearEnPython({
    archivoBase64: 'data:application/pdf;base64,JVBERi0',
    nombreArchivo: 'prueba.pdf',
    mimeType: 'application/pdf',
    dominio: 'radicados'
  })

  verificar('Python OK → status 200', status === 200)
  verificar('Python OK → cuerpo intacto', cuerpo?.success === true && cuerpo?.campos?.peticionario === 'PEREZ GOMEZ JOSE')
  await cerrar(servidor)
}

// ── 2. Python caído (puerto cerrado) ────────────────────────────────────────
{
  const { servidor, puerto } = await escuchar(() => {})
  await cerrar(servidor) // puerto liberado: nadie escucha ahí

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const { status, codigo, cuerpo } = await OcrService.escanearEnPython({ dominio: 'radicados', texto: 'x' })

  verificar('Python caído → status 503', status === 503)
  verificar('Python caído → codigo no-disponible', codigo === 'no-disponible')
  verificar('Python caído → disponible:false para el fallback', cuerpo?.disponible === false)
}

// ── 3. Python responde 500 → 502 ────────────────────────────────────────────
{
  const { servidor, puerto } = await escuchar((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'boom interno' }))
  })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const { status, codigo, cuerpo } = await OcrService.escanearEnPython({ dominio: 'permisos', texto: 'x' })

  verificar('Python 500 → status 502', status === 502)
  verificar('Python 500 → codigo error-python', codigo === 'error-python')
  verificar('Python 500 → message original propagado', cuerpo?.message === 'boom interno')
  await cerrar(servidor)
}

// ── 4. Python colgado → 504 timeout ─────────────────────────────────────────
{
  const { servidor, puerto } = await escuchar(() => { /* nunca responde */ })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`, 300)
  const inicio = Date.now()
  const { status, codigo } = await OcrService.escanearEnPython({ dominio: 'radicados', texto: 'x' })
  const duracion = Date.now() - inicio

  verificar('Python colgado → status 504', status === 504)
  verificar('Python colgado → codigo timeout', codigo === 'timeout')
  verificar('Timeout respeta OCR_PY_TIMEOUT_MS (300ms)', duracion >= 250 && duracion < 3000, `(tardó ${duracion}ms)`)
  servidor.closeAllConnections?.()
  await cerrar(servidor)
}

// ── Resumen ─────────────────────────────────────────────────────────────────
console.log(`\nPuente OCR: ${pasados} pasados, ${fallidos} fallidos`)
process.exit(fallidos === 0 ? 0 : 1)
