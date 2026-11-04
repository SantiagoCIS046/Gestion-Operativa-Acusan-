// Integración de Excel de radicados: export.xlsx, plantilla.xlsx e import
// (multipart). El libro de importación mezcla filas buenas y malas a propósito.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

// NODE_ENV=test ANTES de importar app.js para que no levante listener propio
process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: app } = await import('../src/app.js')
const { default: ExcelJS } = await import('exceljs')
// Cliente CON la extensión de cifrado: lee descifrado y escribe cifrado,
// igual que el backend
const { default: prisma } = await import('../src/config/prisma.js')
const { fechaCalendario } = await import('../src/utils/fechas.js')


// Usuarios del seed (npm run db:seed) — emails con UNA sola u
const PASSWORD = 'acuasan2026'
const GERENCIA = 'gerencia@acuasan.com' // LIDER_GENERAL
const LIDER_OPE = 'lider.operativo@acuasan.com' // LIDER_AREA (OPE)
const ENCARGADO_OPE = 'juan.valdez@acuasan.com' // USUARIO (OPE)

// ¿Hay BD disponible? (5s de paciencia; si no, se saltan las pruebas)
let dbOk = false
try {
  await Promise.race([
    prisma.$connect(),
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('timeout')), 5000)),
  ])
  dbOk = true
} catch {
  dbOk = false
}

let servidor = null
let base = null
let token = null
let areaOpeId = null
let encargadoOpeId = null

// Los radicados de esta suite se reconocen por el asunto (prefijo XL)
const ASUNTO_PREFIX = 'XL '

// Encabezados que la importación entiende (los de la plantilla + Encargado)
const ENCABEZADOS = [
  'Número', 'Asunto', 'Descripción', 'Categoría', 'Área', 'Tipo', 'Remitente',
  'Prioridad', 'Fecha radicación', 'Fecha límite', 'Instrucciones', 'Encargado',
]

// Columna de cada encabezado en ENCABEZADOS (índice 0-based para armar filas)
const C = Object.fromEntries(ENCABEZADOS.map((h, i) => [h, i]))

function fila(vals) {
  const celda = new Array(ENCABEZADOS.length).fill('')
  for (const [header, valor] of Object.entries(vals)) celda[C[header]] = valor
  return celda
}

// Busca un radicado por asunto exacto (en memoria: el asunto va cifrado)
async function porAsunto(asunto) {
  const todos = await prisma.radicado.findMany()
  return todos.find((r) => r.asunto === asunto) ?? null
}

async function limpiarXL() {
  // El asunto está cifrado en la base: se filtra en memoria, ya descifrado
  const radicados = (await prisma.radicado.findMany({ select: { id: true, asunto: true } })).filter((r) =>
    String(r.asunto).startsWith(ASUNTO_PREFIX),
  )
  for (const { id } of radicados) {
    await prisma.adjunto.deleteMany({ where: { radicadoId: id } })
    await prisma.alerta.deleteMany({ where: { radicadoId: id } })
    await prisma.radicadoEvento.deleteMany({ where: { radicadoId: id } })
  }
  if (radicados.length) {
    await prisma.radicado.deleteMany({ where: { id: { in: radicados.map((r) => r.id) } } })
  }
}

before(async () => {
  if (!dbOk) return
  await new Promise((resolver) => {
    servidor = app.listen(0, '127.0.0.1', resolver)
  })
  base = `http://127.0.0.1:${servidor.address().port}`

  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: GERENCIA, password: PASSWORD }),
  })
  const json = await res.json()
  assert.ok(json.success, `login falló: ${json.message}`)
  token = json.data.token

  const areaOpe = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  areaOpeId = areaOpe.id
  encargadoOpeId = (
    await prisma.usuario.findUnique({ where: { email: ENCARGADO_OPE } })
  ).id

  await limpiarXL() // residuo de una corrida previa interrumpida
})

after(async () => {
  if (dbOk) await limpiarXL()
  if (servidor) {
    if (typeof servidor.closeAllConnections === 'function') servidor.closeAllConnections()
    await new Promise((r) => servidor.close(r))
  }
  await prisma.$disconnect()
})

async function loginOpe() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LIDER_OPE, password: PASSWORD }),
  })
  const json = await res.json()
  assert.ok(json.success)
  return json.data.token
}

async function descargar(path, tok = token) {
  const res = await fetch(base + path, { headers: { authorization: `Bearer ${tok}` } })
  const buffer = Buffer.from(await res.arrayBuffer())
  return { status: res.status, contentType: res.headers.get('content-type'), buffer }
}

async function libro(filas, hoja = 'Radicados') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(hoja)
  ws.addRow(ENCABEZADOS)
  for (const f of filas) ws.addRow(f)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

async function subirExcel(buffer, tok = token, nombre = 'importacion.xlsx') {
  const form = new FormData()
  form.append('archivo', new Blob([buffer]), nombre)
  const res = await fetch(`${base}/api/radicados/import`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}` },
    body: form,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, json }
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test('export y plantilla exigen sesión y rol de gerencia', async () => {
  if (!dbOk) return
  assert.equal((await descargar('/api/radicados/export.xlsx', 'sin-token')).status, 401)
  assert.equal((await descargar('/api/radicados/plantilla.xlsx', 'sin-token')).status, 401)

  const tokOpe = await loginOpe()
  assert.equal((await descargar('/api/radicados/export.xlsx', tokOpe)).status, 403)
  assert.equal((await descargar('/api/radicados/plantilla.xlsx', tokOpe)).status, 403)
})

test('la plantilla trae las hojas Instrucciones y Radicados', async () => {
  if (!dbOk) return
  const { status, contentType, buffer } = await descargar('/api/radicados/plantilla.xlsx')
  assert.equal(status, 200)
  assert.ok(contentType.includes('spreadsheetml'))

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  assert.deepEqual(wb.worksheets.map((h) => h.name), ['Instrucciones', 'Radicados'])
  assert.match(String(wb.getWorksheet('Instrucciones').getCell('A1').value), /Importaci/)
  const encabezados = wb
    .getWorksheet('Radicados')
    .getRow(1)
    .values.slice(1)
    .filter(Boolean)
  assert.deepEqual(encabezados, ENCABEZADOS.slice(0, 11))
})

test('el export trae filas con estado, extras y hoja Resumen', async () => {
  if (!dbOk) return
  await prisma.radicado.create({
    data: {
      numeroRadicado: 'XL-EXPORT-1',
      asunto: 'XL Export prueba',
      descripcion: 'Radicado para validar el export',
      remitente: 'Alcalía',
      tipo: 'Interno',
      categoria: 'Pruebas XL',
      prioridad: 'MEDIA',
      fechaRadicacion: new Date(Date.now() - 5 * 86400000),
      fechaLimite: new Date(Date.now() + 5 * 86400000),
      areaId: areaOpeId,
      encargadoId: encargadoOpeId,
      creadoPorId: (
        await prisma.usuario.findUnique({ where: { email: GERENCIA } })
      ).id,
    },
  })

  const { status, contentType, buffer } = await descargar('/api/radicados/export.xlsx')
  assert.equal(status, 200)
  assert.ok(contentType.includes('spreadsheetml'))

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const nombres = wb.worksheets.map((h) => h.name)
  assert.ok(nombres.includes('Radicados'), `hojas: ${nombres}`)
  assert.ok(nombres.includes('Resumen'), `hojas: ${nombres}`)

  // Encabezados completos: 11 de captura + 6 de solo-lectura
  const encabezados = wb.getWorksheet('Radicados').getRow(1).values.slice(1).filter(Boolean)
  assert.equal(encabezados.length, 17)
  assert.deepEqual(
    encabezados.slice(11),
    ['Estado', 'Días', 'Encargado', 'Respondido el', 'N.° oficio', 'Observaciones respuesta'],
  )

  // La fila del radicado de prueba, con su semáforo y encargado
  const hoja = wb.getWorksheet('Radicados')
  let filaXl = null
  hoja.eachRow((row, n) => {
    if (n > 1 && row.getCell(1).value === 'XL-EXPORT-1') filaXl = row
  })
  assert.ok(filaXl, 'el radicado XL-EXPORT-1 debe salir en el export')
  assert.equal(filaXl.getCell(C['Asunto'] + 1).value, 'XL Export prueba')
  assert.equal(filaXl.getCell(C['Categoría'] + 1).value, 'Pruebas XL')
  assert.equal(filaXl.getCell(C['Área'] + 1).value, 'OPE')
  assert.equal(filaXl.getCell(12).value, 'Por vencer') // Estado (vence en 5)
  assert.equal(String(filaXl.getCell(13).value), '5') // Días
  assert.equal(filaXl.getCell(14).value, 'Juan David Valdez') // Encargado

  // Resumen: una fila por área con radicados (OPE viene del seed)
  let filaOpe = null
  wb.getWorksheet('Resumen').eachRow((row, n) => {
    if (n > 1 && row.getCell(1).value === 'OPE') filaOpe = row
  })
  assert.ok(filaOpe, 'el área OPE debe salir en el Resumen')
  assert.ok(Number(filaOpe.getCell(3).value) >= 1, 'total de OPE ≥ 1')
})

test('la importación exige gerencia y un .xlsx real', async () => {
  if (!dbOk) return
  const buffer = await libro([])
  const tokOpe = await loginOpe()
  assert.equal((await subirExcel(buffer, tokOpe)).status, 403)

  // Extensión que no es .xlsx: lo rechaza el multer
  const malTipo = await subirExcel(Buffer.from('no es excel'), token, 'datos.csv')
  assert.equal(malTipo.status, 400)
  assert.match(malTipo.json.message, /debe ser un Excel/)

  // Contenido que no es un libro, aunque el nombre diga .xlsx
  const malContenido = await subirExcel(Buffer.from('basura'), token)
  assert.equal(malContenido.status, 400)
  assert.match(malContenido.json.message, /no es un Excel .*\.xlsx.* válido/)
})

test('un libro sin hoja de radicados se rechaza con 400', async () => {
  if (!dbOk) return
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Instrucciones').addRow(['solo instrucciones'])
  const res = await subirExcel(Buffer.from(await wb.xlsx.writeBuffer()))
  assert.equal(res.status, 400)
  assert.match(res.json.message, /no tiene una hoja "Radicados"/)
})

test('importa: crea con número automático, actualiza por número y reporta filas malas', async () => {
  if (!dbOk) return
  const buffer = await libro([
    // número vacío → auto; prioridad vacía → media; radicación vacía → hoy
    fila({
      'Número': '', 'Asunto': 'XL Nuevo import', 'Categoría': 'Pruebas XL',
      'Área': 'OPE', 'Fecha límite': '2030-01-15', 'Encargado': ENCARGADO_OPE,
    }),
    // número nuevo explícito, encargado por NOMBRE dentro del área
    fila({
      'Número': 'XL-BASE-1', 'Asunto': 'XL Base import', 'Área': 'OPE',
      'Fecha límite': '2030-02-01', 'Encargado': 'Juan David Valdez',
    }),
    // el MISMO número → actualiza, no crea
    fila({
      'Número': 'XL-BASE-1', 'Asunto': 'XL Base RENOMBRADO', 'Área': 'OPE',
      'Fecha límite': '2030-02-15', 'Encargado': ENCARGADO_OPE,
    }),
    // área que no existe
    fila({
      'Número': '', 'Asunto': 'XL Área mala', 'Área': 'NADA',
      'Fecha límite': '2030-01-15', 'Encargado': ENCARGADO_OPE,
    }),
    // sin fecha límite
    fila({
      'Número': '', 'Asunto': 'XL Sin límite', 'Área': 'OPE',
      'Fecha límite': '', 'Encargado': ENCARGADO_OPE,
    }),
    // prioridad fuera del dominio
    fila({
      'Número': '', 'Asunto': 'XL Prioridad loca', 'Área': 'OPE',
      'Prioridad': 'urgente', 'Fecha límite': '2030-01-15', 'Encargado': ENCARGADO_OPE,
    }),
  ])

  const { status, json } = await subirExcel(buffer)
  assert.equal(status, 200)
  assert.ok(json.success)
  const data = json.data
  assert.equal(data.total, 6)
  assert.equal(data.creados, 2)
  assert.equal(data.actualizados, 1)
  assert.equal(data.errores.length, 3)
  assert.deepEqual(
    data.errores.map((e) => e.fila),
    [5, 6, 7],
  )
  assert.match(data.errores.find((e) => e.fila === 5).mensaje, /Área "NADA" no reconocida/)
  assert.match(data.errores.find((e) => e.fila === 6).mensaje, /fecha límite es obligatoria/)
  assert.match(data.errores.find((e) => e.fila === 7).mensaje, /prioridad debe ser baja, media o alta/)

  // El creado con número automático: RAD-AÑO-####, defaults y PDF de relleno
  const nuevo = await porAsunto('XL Nuevo import')
  assert.ok(nuevo, 'el radicado sin número debe crearse')
  assert.match(nuevo.numeroRadicado, /^RAD-\d{4}-\d{4}$/)
  assert.equal(nuevo.categoria, 'Pruebas XL')
  assert.equal(String(nuevo.prioridad).toLowerCase(), 'media')
  assert.equal(fechaCalendario(nuevo.fechaRadicacion), fechaCalendario(new Date()))
  assert.equal(
    (await prisma.adjunto.count({ where: { radicadoId: nuevo.id, vigente: true } })),
    1,
    'el importado nace con su PDF de relleno',
  )

  // El número repetido quedó ACTUALIZADO, sin duplicar
  const base = await prisma.radicado.findFirst({ where: { numeroRadicado: 'XL-BASE-1' } })
  assert.equal(base.asunto, 'XL Base RENOMBRADO')
  assert.equal(fechaCalendario(base.fechaLimite), '2030-02-15')
})

test('la importación acepta fechas serial de Excel y texto AAAA-MM-DD', async () => {
  if (!dbOk) return
  // Serial 45000 = días desde 1899-12-30 (una fecha pasada, válida como radicación)
  const EPOCA_EXCEL = Date.UTC(1899, 11, 30)
  const serialEsperado = fechaCalendario(new Date(EPOCA_EXCEL + 45000 * 86400000))

  const buffer = await libro([
    fila({
      'Número': '', 'Asunto': 'XL Fecha serial', 'Área': 'OPE',
      'Fecha radicación': 45000, 'Fecha límite': '2030-03-01', 'Encargado': ENCARGADO_OPE,
    }),
    fila({
      'Número': '', 'Asunto': 'XL Fecha iso', 'Área': 'OPE',
      'Fecha radicación': '2026-01-15', 'Fecha límite': '2030-03-02', 'Encargado': ENCARGADO_OPE,
    }),
  ])

  const { status, json } = await subirExcel(buffer)
  assert.equal(status, 200)
  assert.equal(json.data.creados, 2)
  assert.equal(json.data.errores.length, 0)

  const serial = await porAsunto('XL Fecha serial')
  assert.equal(fechaCalendario(serial.fechaRadicacion), serialEsperado)
  const iso = await porAsunto('XL Fecha iso')
  assert.equal(fechaCalendario(iso.fechaRadicacion), '2026-01-15')
})
