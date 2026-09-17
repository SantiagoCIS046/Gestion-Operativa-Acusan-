// ocrBridge.test.mjs — Puente Node → motor OCR Python (ocr.service.js)
// ─────────────────────────────────────────────────────────────────────────────
// Corre contra stubs de node:http (puerto efímero), sin levantar nada real:
//   1. Python OK              → status 200 con el cuerpo tal cual
//   2. Python caído (ECONNREFUSED) → 503 no-disponible (fallback navegador)
//   3. Python responde 500    → 502 error-python
//   4. Python colgado         → 504 timeout (OCR_PY_TIMEOUT_MS corto)
//   5. Permisos colgado       → 504 timeout (OCR_PY_TIMEOUT_PERMISOS_MS corto)
//   6-8. Trabajos asíncronos  → 202/jobId, estado procesando→listo, 429/404 tipados
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

// ── 5. Permisos usa su propio techo (OCR_PY_TIMEOUT_PERMISOS_MS) ────────────
// El pipeline de permisos arrastra la ronda de refuerzo (~3 min/pág en el
// motor free): su espera máxima es independiente de la de radicados.
{
  const { servidor, puerto } = await escuchar(() => { /* nunca responde */ })

  process.env.OCR_PY_TIMEOUT_PERMISOS_MS = '250'
  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`, 60000)
  const inicio = Date.now()
  const { status, codigo } = await OcrService.escanearEnPython({ dominio: 'permisos', texto: 'x' })
  const duracion = Date.now() - inicio
  delete process.env.OCR_PY_TIMEOUT_PERMISOS_MS

  verificar('Permisos colgado → status 504', status === 504)
  verificar('Permisos colgado → codigo timeout', codigo === 'timeout')
  verificar('Permisos respeta OCR_PY_TIMEOUT_PERMISOS_MS (250ms), no el de radicados (60s)', duracion >= 200 && duracion < 3000, `(tardó ${duracion}ms)`)
  servidor.closeAllConnections?.()
  await cerrar(servidor)
}

// ── 6. Trabajos asíncronos: iniciar OK → 202 + jobId ───────────────────────
{
  const { servidor, puerto } = await escuchar((req, res) => {
    let cuerpo = ''
    req.on('data', (c) => { cuerpo += c })
    req.on('end', () => {
      const datos = JSON.parse(cuerpo)
      if (req.method === 'POST' && req.url === '/api/ocr/trabajos') {
        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, jobId: 'job-123', estado: 'procesando', dominio: datos.dominio }))
      } else {
        res.writeHead(404); res.end()
      }
    })
  })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const { status, cuerpo } = await OcrService.iniciarTrabajoPython({ dominio: 'permisos', archivoBase64: 'data:image/png;base64,AAA' })
  verificar('Iniciar trabajo → status 202', status === 202)
  verificar('Iniciar trabajo → jobId del motor', cuerpo?.jobId === 'job-123')
  await cerrar(servidor)
}

// ── 7. Consultar trabajo: procesando → listo con respuesta ─────────────────
{
  let consultas = 0
  const { servidor, puerto } = await escuchar((req, res) => {
    if (req.method === 'GET' && req.url === '/api/ocr/trabajos/job-123') {
      consultas++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(consultas === 1
        ? { success: true, estado: 'procesando' }
        : { success: true, estado: 'listo', codigo: 200, respuesta: { success: true, metodo: 'ocr-tesseract', campos: { nombreFuncionario: 'GOMEZ MARIA' } } }))
    } else {
      res.writeHead(404); res.end()
    }
  })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const primera = await OcrService.consultarTrabajoPython('job-123')
  verificar('Consultar (1ª) → procesando', primera?.cuerpo?.estado === 'procesando')
  const segunda = await OcrService.consultarTrabajoPython('job-123')
  verificar('Consultar (2ª) → listo', segunda?.cuerpo?.estado === 'listo')
  verificar('Consultar (2ª) → respuesta intacta', segunda?.cuerpo?.respuesta?.campos?.nombreFuncionario === 'GOMEZ MARIA')
  await cerrar(servidor)
}

// ── 8. Trabajos: 429 ocupado y 404 perdido salen tipados ────────────────────
{
  const { servidor, puerto } = await escuchar((req, res) => {
    res.writeHead(req.method === 'POST' ? 429 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'ocupado' }))
  })

  const { OcrService } = await importarServicio(`http://127.0.0.1:${puerto}`)
  const inicio = await OcrService.iniciarTrabajoPython({ dominio: 'permisos', archivoBase64: 'x' })
  verificar('Motor ocupado → status 429', inicio.status === 429)
  verificar('Motor ocupado → codigo ocupado', inicio.codigo === 'ocupado')
  const consulta = await OcrService.consultarTrabajoPython('inexistente')
  verificar('Trabajo perdido → status 404', consulta.status === 404)
  verificar('Trabajo perdido → codigo trabajo-no-encontrado', consulta.codigo === 'trabajo-no-encontrado')
  await cerrar(servidor)
}

// ── Resumen ─────────────────────────────────────────────────────────────────
console.log(`\nPuente OCR: ${pasados} pasados, ${fallidos} fallidos`)
process.exit(fallidos === 0 ? 0 : 1)
