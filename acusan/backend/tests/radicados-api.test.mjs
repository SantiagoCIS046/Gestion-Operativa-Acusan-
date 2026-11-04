// Integración: /api/radicados — registro por gerencia, alcance por rol/área,
// respuesta del área con PDF, estados derivados, adjuntos/eventos, alertas y
// PDFs aislados en almacenPdf. Se salta si la base no es alcanzable.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

// NODE_ENV=test ANTES de importar app.js para que no levante listener propio
process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: app } = await import('../src/app.js')
// Cliente CON la extensión de cifrado: lee descifrado y escribe cifrado,
// igual que el backend
const { default: prisma } = await import('../src/config/prisma.js')
const { enDias } = await import('../src/utils/fechas.js')


// Usuarios del seed (npm run db:seed) — emails con UNA sola u
const PASSWORD = 'acuasan2026'
const GERENCIA = 'gerencia@acuasan.com' // LIDER_GENERAL
const LIDER_OPE = 'lider.operativo@acuasan.com' // LIDER_AREA (OPE)
const JUAN = 'juan.valdez@acuasan.com' // USUARIO (OPE) — será el encargado
const LAURA = 'laura.martinez@acuasan.com' // USUARIO (OPE) — NO es encargado
const LIDER_COM = 'lider.comercial@acuasan.com' // LIDER_AREA (COM)

// Números de radicado de la suite (limpieza también en after)
const SUFIJO = `RAD-T-${Date.now().toString(36)}`
const numero = (n) => `${SUFIJO}-${n}`
const ID_FALSO = 'a'.repeat(24)

// PDF mínimo: solo la firma mágica (el backend no parsea el contenido)
const PDF_PRUEBA = Buffer.from('%PDF-1.4\nRadicado de prueba\n%%EOF\n')
const fechaISO = (n) => enDias(n).toISOString().slice(0, 10)

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

// Ids resueltos en before: áreas y usuarios que necesita la suite
let OPE = null
let COM = null
let JUAN_ID = null
let LAURA_ID = null
let GERENCIA_ID = null

// Radicados creados por la suite (para el after)
const creados = []

before(async () => {
  if (!dbOk) return
  await new Promise((resolver) => {
    servidor = app.listen(0, '127.0.0.1', resolver)
  })
  base = `http://127.0.0.1:${servidor.address().port}`

  OPE = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  COM = await prisma.area.findUnique({ where: { codigo: 'COM' } })
  JUAN_ID = (await prisma.usuario.findUnique({ where: { email: JUAN } })).id
  LAURA_ID = (await prisma.usuario.findUnique({ where: { email: LAURA } })).id
  GERENCIA_ID = (await prisma.usuario.findUnique({ where: { email: GERENCIA } })).id
})

after(async () => {
  if (dbOk) {
    // Radicados de la suite (también de corridas previas que quedaron huérfanas):
    // primero sus alertas/adjuntos/eventos (referencias explícitas), luego el raíz
    // El número está cifrado en la base: se filtra en memoria, ya descifrado
    const propios = (
      await prisma.radicado.findMany({ select: { id: true, numeroRadicado: true } })
    ).filter((r) => String(r.numeroRadicado).startsWith('RAD-T-'))
    const ids = propios.map((r) => r.id)
    if (ids.length) {
      await prisma.alerta.deleteMany({ where: { radicadoId: { in: ids } } })
      await prisma.adjunto.deleteMany({ where: { radicadoId: { in: ids } } })
      await prisma.radicadoEvento.deleteMany({ where: { radicadoId: { in: ids } } })
      await prisma.radicado.deleteMany({ where: { id: { in: ids } } })
    }
    // Ejecuciones de prueba del motor (sus alertas son derivadas: se van
    // primero, incluidas las de radicados del seed creadas en estas corridas)
    const ejecuciones = await prisma.ejecucionAlerta.findMany({
      where: { alcance: { startsWith: 'radicados' } },
      select: { id: true },
    })
    if (ejecuciones.length) {
      await prisma.alerta.deleteMany({
        where: { ejecucionId: { in: ejecuciones.map((e) => e.id) } },
      })
    }
    await prisma.ejecucionAlerta.deleteMany({ where: { alcance: { startsWith: 'radicados' } } })
  }
  if (servidor) await new Promise((r) => servidor.close(r))
  await prisma.$disconnect()
})

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const json = await res.json()
  assert.ok(json.success, `login falló para ${email}: ${json.message}`)
  return json.data.token
}

async function req(metodo, path, token, cuerpo, cabeceras = {}) {
  const res = await fetch(base + path, {
    method: metodo,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...cabeceras,
    },
    body: cuerpo,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* respuesta binaria o sin cuerpo */
  }
  return { status: res.status, json }
}

const get = (path, token) => req('GET', path, token)
const put = (path, token, cuerpo) => req('PUT', path, token, JSON.stringify(cuerpo), { 'Content-Type': 'application/json' })
const post = (path, token, cuerpo) => req('POST', path, token, JSON.stringify(cuerpo), { 'Content-Type': 'application/json' })

// POST multipart del radicado: campos + PDF (igual que lo envía el frontend).
// autoNumero=true omite el número → el backend genera RAD-AÑO-#### consecutivo.
function formRadicado({ n = 1, autoNumero = false, categoria = 'Pruebas', areaId, encargadoId, fechaRadicacion = fechaISO(-1), fechaLimite = fechaISO(30), prioridad = 'media', pdf = PDF_PRUEBA, nombrePdf = 'radicado.pdf', tipo = 'application/pdf' }) {
  const form = new FormData()
  if (!autoNumero) form.append('numeroRadicado', numero(n))
  form.append('asunto', 'Solicitud de información técnica')
  form.append('descripcion', 'Contexto de prueba para el encargado del área.')
  form.append('remitente', 'Secretaría General')
  form.append('tipo', 'Derecho de petición')
  form.append('categoria', categoria)
  form.append('prioridad', prioridad)
  if (areaId) form.append('areaId', areaId)
  if (encargadoId) form.append('encargadoId', encargadoId)
  form.append('fechaRadicacion', fechaRadicacion)
  form.append('fechaLimite', fechaLimite)
  if (pdf) form.append('archivo', new Blob([pdf], { type: tipo }), nombrePdf)
  return form
}

async function crearRadicado(token, opciones) {
  const { status, json } = await req('POST', '/api/radicados', token, formRadicado(opciones))
  return { status, json }
}

async function responderPdf(token, id, bytes = PDF_PRUEBA, nombre = 'respuesta.pdf', extra = {}) {
  const form = new FormData()
  form.append('archivo', new Blob([bytes], { type: 'application/pdf' }), nombre)
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  return req('POST', `/api/radicados/${id}/responder`, token, form)
}

// ─── Registro (solo gerencia) ────────────────────────────────────────────────

test('GET/POST /api/radicados sin sesión → 401', { skip: !dbOk }, async () => {
  assert.equal((await get('/api/radicados', null)).status, 401)
  assert.equal((await crearRadicado(null, { areaId: OPE.id, encargadoId: JUAN_ID })).status, 401)
})

test('crear como lider_area o usuario → 403', { skip: !dbOk }, async () => {
  assert.equal((await crearRadicado(await login(LIDER_OPE), { areaId: OPE.id, encargadoId: JUAN_ID })).status, 403)
  assert.equal((await crearRadicado(await login(JUAN), { areaId: OPE.id, encargadoId: JUAN_ID })).status, 403)
})

test('setup: gerencia registra tres radicados de OPE (sano, por vencer, vencido)', { skip: !dbOk }, async () => {
  const token = await login(GERENCIA)

  const sano = await crearRadicado(token, { n: 1, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: fechaISO(30) })
  assert.equal(sano.status, 201)
  assert.equal(sano.json.data.numeroRadicado, numero(1))
  assert.equal(sano.json.data.estado, 'sano')
  assert.equal(sano.json.data.prioridad, 'media')
  assert.equal(sano.json.data.categoria, 'Pruebas')
  assert.equal(sano.json.data.area.codigo, 'OPE')
  assert.equal(sano.json.data.adjuntoRadicado.nombre, 'radicado.pdf')
  assert.equal(sano.json.data.adjuntoRadicado.tamano, PDF_PRUEBA.length)
  assert.equal(sano.json.data.adjuntoRespuesta, null)
  creados.push({ id: sano.json.data.id })

  // Radicación 3 días atrás: el plazo total (8 días) cruza el umbral de 7,
  // así la revisión sí genera la alerta D7
  const porVencer = await crearRadicado(token, { n: 2, areaId: OPE.id, encargadoId: JUAN_ID, fechaRadicacion: fechaISO(-3), fechaLimite: fechaISO(5) })
  assert.equal(porVencer.status, 201)
  assert.equal(porVencer.json.data.estado, 'por_vencer')
  assert.equal(porVencer.json.data.diasRestantes, 5)
  creados.push({ id: porVencer.json.data.id })

  // El vencido ya no se puede crear por la API (la límite no puede ser
  // anterior a hoy): va directo a BD, como un radicado viejo sin responder
  const vencido = await prisma.radicado.create({
    data: {
      numeroRadicado: numero(3),
      asunto: 'Solicitud de información técnica',
      descripcion: 'Contexto de prueba para el encargado del área.',
      remitente: 'Secretaría General',
      tipo: 'Derecho de petición',
      prioridad: 'MEDIA',
      fechaRadicacion: enDias(-10),
      fechaLimite: enDias(-2),
      areaId: OPE.id,
      encargadoId: JUAN_ID,
      creadoPorId: GERENCIA_ID,
    },
  })
  await prisma.adjunto.create({
    data: {
      radicadoId: vencido.id,
      tipo: 'RADICADO',
      nombreOriginal: 'radicado.pdf',
      tamano: PDF_PRUEBA.length,
      contenido: PDF_PRUEBA,
      subidoPorId: GERENCIA_ID,
    },
  })
  await prisma.radicadoEvento.createMany({
    data: [
      { radicadoId: vencido.id, tipo: 'CREADO', usuarioId: GERENCIA_ID, detalle: `${numero(3)} — viejo` },
      { radicadoId: vencido.id, tipo: 'ASIGNADO', usuarioId: GERENCIA_ID, detalle: 'Asignado a Juan (OPE).' },
    ],
  })
  creados.push({ id: vencido.id })

  // Auditoría: el alta queda como eventos creado + asignado
  const eventos = await prisma.radicadoEvento.findMany({
    where: { radicadoId: sano.json.data.id },
    orderBy: { fecha: 'asc' },
  })
  assert.deepEqual(eventos.map((e) => e.tipo), ['CREADO', 'ASIGNADO'])
  assert.match(eventos[1].detalle, /Juan/)

  // R3: el alta genera la alerta 'nuevo' para el área/encargado (fuera de
  // cualquier corrida de revisión → sin ejecución asociada)
  const nuevas = await prisma.alerta.findMany({
    where: { radicadoId: { in: [sano.json.data.id, porVencer.json.data.id] }, nivel: 'NUEVO' },
  })
  assert.equal(nuevas.length, 2, 'una alerta nuevo por radicado registrado')
  assert.ok(nuevas.every((a) => !a.atendida && a.ejecucionId === null))
  // El creado directo en BD (como un radicado viejo) no trae alerta alguna
  assert.equal(await prisma.alerta.count({ where: { radicadoId: vencido.id } }), 0)

  // El estado almacenado es pendiente (el visual sano/por_vencer/vencido se deriva)
  const enBd = await prisma.radicado.findUnique({ where: { id: sano.json.data.id }, select: { estado: true } })
  assert.equal(enBd.estado, 'PENDIENTE')
})

test('sin número de radicado → 201 con RAD-AÑO-#### automático', { skip: !dbOk }, async () => {
  const token = await login(GERENCIA)
  const auto = await crearRadicado(token, { autoNumero: true, areaId: OPE.id, encargadoId: JUAN_ID })
  assert.equal(auto.status, 201)
  assert.match(auto.json.data.numeroRadicado, /^RAD-\d{4}-\d{4}$/, 'consecutivo RAD-AÑO-####')
  assert.equal(auto.json.data.categoria, 'Pruebas')
  assert.match(auto.json.message, /RAD-\d{4}-\d{4}/)
  creados.push({ id: auto.json.data.id })

  // Dos automáticos seguidos no chocan (consecutivo distinto)
  const auto2 = await crearRadicado(token, { autoNumero: true, areaId: OPE.id, encargadoId: JUAN_ID })
  assert.equal(auto2.status, 201)
  assert.notEqual(auto2.json.data.numeroRadicado, auto.json.data.numeroRadicado)
  creados.push({ id: auto2.json.data.id })
})

test('validaciones del POST → 400', { skip: !dbOk }, async () => {
  const token = await login(GERENCIA)

  const sinAsunto = await req('POST', '/api/radicados', token, (() => {
    const f = formRadicado({ n: 4, areaId: OPE.id, encargadoId: JUAN_ID })
    f.delete('asunto')
    return f
  })())
  assert.equal(sinAsunto.status, 400)
  assert.match(sinAsunto.json.message, /asunto/i)

  const prioridadMala = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, prioridad: 'urgente' })
  assert.equal(prioridadMala.status, 400)
  assert.match(prioridadMala.json.message, /prioridad/i)

  const sinFechaRadicacion = await req('POST', '/api/radicados', token, (() => {
    const f = formRadicado({ n: 4, areaId: OPE.id, encargadoId: JUAN_ID })
    f.delete('fechaRadicacion')
    return f
  })())
  assert.equal(sinFechaRadicacion.status, 400)
  assert.match(sinFechaRadicacion.json.message, /radicación/i)

  const sinPdf = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, pdf: null })
  assert.equal(sinPdf.status, 400)
  assert.match(sinPdf.json.message, /PDF/i)

  const encargadoAjeno = await crearRadicado(token, { n: 4, areaId: COM.id, encargadoId: JUAN_ID })
  assert.equal(encargadoAjeno.status, 400)
  assert.match(encargadoAjeno.json.message, /encargado/)

  const areaMala = await crearRadicado(token, { n: 4, areaId: ID_FALSO, encargadoId: JUAN_ID })
  assert.equal(areaMala.status, 400)
  assert.match(areaMala.json.message, /área/)

  const fechaMala = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: 'mai' })
  assert.equal(fechaMala.status, 400)
  assert.match(fechaMala.json.message, /fecha/i)

  const txt = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, nombrePdf: 'datos.txt', tipo: 'text/plain' })
  assert.equal(txt.status, 400)
  assert.match(txt.json.message, /PDF/i)

  const falso = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, pdf: Buffer.from('no soy un pdf') })
  assert.equal(falso.status, 400)
  assert.match(falso.json.message, /PDF de hasta 10 MB/)

  // La límite no puede ser anterior a hoy ni a la fecha de radicación
  const limitePasada = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: fechaISO(-1) })
  assert.equal(limitePasada.status, 400)
  assert.match(limitePasada.json.message, /hoy/)

  const limiteAntesDeRadicacion = await crearRadicado(token, { n: 4, areaId: OPE.id, encargadoId: JUAN_ID, fechaRadicacion: fechaISO(10), fechaLimite: fechaISO(5) })
  assert.equal(limiteAntesDeRadicacion.status, 400)
  assert.match(limiteAntesDeRadicacion.json.message, /radicación/)

  // Más de 10 MB: multer lo corta con LIMIT_FILE_SIZE → mensaje unificado
  const grande = await crearRadicado(token, {
    n: 4,
    areaId: OPE.id,
    encargadoId: JUAN_ID,
    pdf: Buffer.alloc(10 * 1024 * 1024 + 64, 0x25), // '%' → parece PDF por el tamaño miente
  })
  assert.equal(grande.status, 400)
  assert.match(grande.json.message, /PDF de hasta 10 MB/)
})

test('número duplicado → 409', { skip: !dbOk }, async () => {
  const token = await login(GERENCIA)
  const dup = await crearRadicado(token, { n: 1, areaId: OPE.id, encargadoId: JUAN_ID })
  assert.equal(dup.status, 409)
  assert.match(dup.json.message, /ya existe/)
})

// ─── Listado: alcance por rol/área ───────────────────────────────────────────

test('listar: USUARIO y lider_area solo ven su área; gerencia ve todo', { skip: !dbOk }, async () => {
  const juan = await login(JUAN)
  const { status, json } = await get('/api/radicados', juan)
  assert.equal(status, 200)

  const propios = json.data.filter((r) => r.numeroRadicado.startsWith(SUFIJO))
  assert.ok(propios.length >= 3, 'los radicados de prueba aparecen')
  assert.ok(json.data.every((r) => r.area.codigo === 'OPE'), 'nunca filtra radicados ajenos')

  // Permisos por fila: el encargado puede responder, gerencia puede editar
  const fila = propios.find((r) => r.numeroRadicado === numero(1))
  assert.equal(fila.puedeResponder, true)
  assert.equal(fila.puedeEditar, false)
  assert.equal(fila.encargado.nombre, 'Juan David Valdez')

  const liderCom = await login(LIDER_COM)
  const com = await get('/api/radicados', liderCom)
  assert.ok(com.json.data.every((r) => r.area.codigo === 'COM'), 'COM no ve los de OPE')
  assert.equal(com.json.data.filter((r) => r.numeroRadicado.startsWith(SUFIJO)).length, 0)

  const gerencia = await login(GERENCIA)
  const todo = await get('/api/radicados', gerencia)
  const filaGerencia = todo.json.data.find((r) => r.numeroRadicado === numero(1))
  assert.equal(filaGerencia.puedeResponder, false, 'gerencia no responde: responde el área')
  assert.equal(filaGerencia.puedeEditar, true)

  // Orden: pendientes primero, límite más urgente arriba
  const numerosPendientes = todo.json.data
    .filter((r) => r.numeroRadicado.startsWith(SUFIJO) && r.estado !== 'respondido')
    .map((r) => r.numeroRadicado)
  assert.deepEqual(numerosPendientes, [numero(3), numero(2), numero(1)])
})

test('usuario del área que NO es el encargado no puede responder', { skip: !dbOk }, async () => {
  const laura = await login(LAURA)
  const { json } = await get('/api/radicados', laura)
  const fila = json.data.find((r) => r.numeroRadicado === numero(1))
  assert.equal(fila.puedeResponder, false)
})

// ─── PDFs ────────────────────────────────────────────────────────────────────

test('ver el PDF del radicado: encargado sí, área ajena no', { skip: !dbOk }, async () => {
  const juan = await login(JUAN)
  const res = await fetch(`${base}/api/radicados/${creados[0].id}/pdf/radicado`, {
    headers: { authorization: `Bearer ${juan}` },
  })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /application\/pdf/)
  assert.match(res.headers.get('content-disposition') ?? '', /inline/)
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString('latin1'), '%PDF-')

  const liderCom = await login(LIDER_COM)
  assert.equal((await get(`/api/radicados/${creados[0].id}/pdf/radicado`, liderCom)).status, 403)

  // La respuesta todavía no existe
  assert.equal((await get(`/api/radicados/${creados[0].id}/pdf/respuesta`, juan)).status, 404)
})

// ─── Respuesta del área ──────────────────────────────────────────────────────

test('responder: quien no debe → 403 (gerencia y usuario no encargado)', { skip: !dbOk }, async () => {
  assert.equal((await responderPdf(await login(GERENCIA), creados[0].id)).status, 403)
  assert.equal((await responderPdf(await login(LAURA), creados[0].id)).status, 403)
})

test('el encargado responde a tiempo → respondido / a_tiempo', { skip: !dbOk }, async () => {
  const { status, json } = await responderPdf(
    await login(JUAN),
    creados[0].id,
    PDF_PRUEBA,
    'respuesta.pdf',
    { observacionesRespuesta: 'Se adjunta soporte.', numeroOficioRespuesta: 'OF-2026-001' },
  )
  assert.equal(status, 200)
  assert.equal(json.data.estado, 'respondido')
  assert.equal(json.data.tieneRespuesta, true)
  assert.equal(json.data.resultadoRespuesta, 'a_tiempo')
  assert.equal(json.data.adjuntoRespuesta.nombre, 'respuesta.pdf')
  assert.equal(json.data.numeroOficioRespuesta, 'OF-2026-001')
  assert.match(json.message, /correctamente/)

  // En BD quedó el estado almacenado y el resultado del enum
  const enBd = await prisma.radicado.findUnique({
    where: { id: creados[0].id },
    select: { estado: true, resultadoRespuesta: true },
  })
  assert.equal(enBd.estado, 'RESPONDIDO')
  assert.equal(enBd.resultadoRespuesta, 'A_TIEMPO')

  // Evento de respuesta en la auditoría
  const evento = await prisma.radicadoEvento.findFirst({
    where: { radicadoId: creados[0].id, tipo: 'RESPONDIDO' },
  })
  assert.ok(evento)
  assert.match(evento.detalle, /a tiempo/)

  // El PDF de respuesta ya se puede ver
  const juan = await login(JUAN)
  const res = await fetch(`${base}/api/radicados/${creados[0].id}/pdf/respuesta`, {
    headers: { authorization: `Bearer ${juan}` },
  })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /application\/pdf/)
})

test('responder un radicado ya vencido → con_retraso; segunda respuesta → 409; reabrir y volver a responder', { skip: !dbOk }, async () => {
  const liderOpe = await login(LIDER_OPE)

  const retraso = await responderPdf(liderOpe, creados[2].id)
  assert.equal(retraso.status, 200)
  assert.equal(retraso.json.data.estado, 'respondido')
  assert.equal(retraso.json.data.resultadoRespuesta, 'con_retraso')
  assert.match(retraso.json.message, /retraso/)

  // R3: un radicado respondido no admite otra respuesta → 409 (para
  // cambiarla, gerencia lo reabre)
  const doble = await responderPdf(liderOpe, creados[2].id, PDF_PRUEBA, 'doble.pdf')
  assert.equal(doble.status, 409)
  assert.match(doble.json.message, /reabra/)

  // Reabrir: solo gerencia, motivo obligatorio y solo si está respondido
  const gerencia = await login(GERENCIA)
  assert.equal((await post(`/api/radicados/${creados[2].id}/reabrir`, liderOpe, { motivo: 'x' })).status, 403)
  assert.equal((await post(`/api/radicados/${creados[2].id}/reabrir`, gerencia, {})).status, 400)
  assert.equal((await post(`/api/radicados/${creados[1].id}/reabrir`, gerencia, { motivo: 'todavía sin respuesta' })).status, 400)

  const reabierto = await post(`/api/radicados/${creados[2].id}/reabrir`, gerencia, {
    motivo: 'La respuesta llegó incompleta.',
  })
  assert.equal(reabierto.status, 200)
  assert.equal(reabierto.json.data.estado, 'vencido', 'vuelve a pendiente y su límite ya pasó')
  assert.equal(reabierto.json.data.tieneRespuesta, false)
  assert.equal(reabierto.json.data.adjuntoRespuesta, null, 'la respuesta anterior deja de ser vigente')
  assert.equal(reabierto.json.data.respondidoPor, null)
  assert.match(reabierto.json.message, /reabierto/)

  const evReabierto = await prisma.radicadoEvento.findFirst({
    where: { radicadoId: creados[2].id, tipo: 'REABIERTO' },
  })
  assert.ok(evReabierto)
  assert.match(evReabierto.detalle, /incompleta/)

  // Tras reabrir, el área puede responder de nuevo: el adjunto anterior NO
  // se borra — queda histórico (vigente=false) y el nuevo es el vigente
  const segunda = await responderPdf(liderOpe, creados[2].id, PDF_PRUEBA, 'respuesta-final.pdf')
  assert.equal(segunda.status, 200)
  assert.equal(segunda.json.data.adjuntoRespuesta.nombre, 'respuesta-final.pdf')
  assert.equal(segunda.json.data.resultadoRespuesta, 'con_retraso')

  const adjuntos = await prisma.adjunto.findMany({
    where: { radicadoId: creados[2].id, tipo: 'RESPUESTA' },
  })
  assert.equal(adjuntos.length, 2, 'la primera respuesta queda como historial')
  assert.equal(adjuntos.filter((a) => a.vigente).length, 1)
  assert.equal(adjuntos.find((a) => a.vigente).nombreOriginal, 'respuesta-final.pdf')

  // Renovar = reabrir + nueva fecha límite en un paso (fusión): el radicado
  // vuelve a pendiente con plazo nuevo y queda el evento PLAZO_CAMBIADO.
  // Se usa un radicado aparte para no tocar los estados de los demás tests.
  const renovable = await crearRadicado(gerencia, { n: 7, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: fechaISO(4) })
  assert.equal(renovable.status, 201)
  creados.push({ id: renovable.json.data.id })
  assert.equal((await responderPdf(liderOpe, renovable.json.data.id)).status, 200)

  const fechaMala2 = await post(`/api/radicados/${renovable.json.data.id}/reabrir`, gerencia, {
    motivo: 'Renovación de plazo',
    fechaLimite: fechaISO(-5),
  })
  assert.equal(fechaMala2.status, 400, 'la nueva fecha no puede ser pasada')

  const renovado = await post(`/api/radicados/${renovable.json.data.id}/reabrir`, gerencia, {
    motivo: 'Renovación de plazo',
    fechaLimite: fechaISO(20),
  })
  assert.equal(renovado.status, 200)
  assert.equal(renovado.json.data.estado, 'sano', 'pendiente de nuevo, con plazo holgado')
  assert.equal(renovado.json.data.tieneRespuesta, false)
  assert.match(renovado.json.message, /nuevo plazo/)
  const eventosRenovo = await prisma.radicadoEvento.findMany({
    where: { radicadoId: renovable.json.data.id, tipo: 'PLAZO_CAMBIADO' },
  })
  assert.equal(eventosRenovo.length, 1, 'la renovación registra el cambio de plazo')
})

// ─── Alertas de radicados ────────────────────────────────────────────────────

test('la revisión genera alertas de pendientes (sin duplicar) y no de respondidos', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)

  const primera = await post('/api/alertas/ejecutar', gerencia, { areaId: OPE.id })
  assert.equal(primera.status, 200)

  // El vencido (radicado 3) ya fue respondido en la prueba anterior → sin alertas.
  // El por vencer (radicado 2, límite en 5 días, plazo total 8) queda con su
  // NUEVO del alta más UNA D7 pendiente de la revisión.
  const alertas2 = await prisma.alerta.findMany({ where: { radicadoId: creados[1].id } })
  assert.equal(alertas2.length, 2, 'NUEVO del alta + D7 de la revisión')
  const d7 = alertas2.find((a) => a.nivel === 'D7')
  assert.ok(d7)
  assert.equal(d7.atendida, false)
  assert.ok(d7.ejecucionId, 'la de revisión referencia su ejecución')
  assert.match(d7.mensaje, /radicado/)

  assert.equal(await prisma.alerta.count({ where: { radicadoId: creados[2].id } }), 0, 'respondido no genera alertas')
  // El sano (>7 días) no genera alertas de revisión; su NUEVO quedó atendida
  // al responderlo en la prueba anterior
  const delSano = await prisma.alerta.findMany({ where: { radicadoId: creados[0].id } })
  assert.equal(delSano.length, 1)
  assert.equal(delSano[0].nivel, 'NUEVO')
  assert.equal(delSano[0].atendida, true, 'responder cerró la NUEVO pendiente')

  // Segunda corrida sin forzar: no duplica
  await post('/api/alertas/ejecutar', gerencia, { areaId: OPE.id })
  assert.equal(await prisma.alerta.count({ where: { radicadoId: creados[1].id } }), 2)

  // El listado marca la alerta pendiente
  const { json } = await get('/api/radicados?area=' + OPE.id, gerencia)
  assert.equal(json.data.find((r) => r.numeroRadicado === numero(2)).alertaPendiente, true)

  // R3: las de radicado SÍ aparecen en GET /api/alertas, con su radicado
  const { json: jAlertas } = await get('/api/alertas', gerencia)
  assert.equal(jAlertas.data.alertas.filter((a) => a.radicadoId === creados[1].id && a.nivel === 'D7').length, 1)
  const delRad = jAlertas.data.alertas.find((a) => a.radicadoId === creados[1].id && a.nivel === 'NUEVO')
  assert.ok(delRad)
  assert.equal(delRad.radicado.numeroRadicado, numero(2))
  assert.equal(delRad.radicado.asunto, 'Solicitud de información técnica')
  assert.ok(Number.isInteger(delRad.radicado.dias))
  assert.equal(delRad.escalada, false, 'solo las vencidas escalan')

  // El área ajena no ve las alertas de radicados de OPE
  const comoCom = await get('/api/alertas', await login(LIDER_COM))
  assert.ok(comoCom.json.data.alertas.every((a) => a.radicadoId !== creados[1].id))
})

test('responder cierra las alertas pendientes del radicado', { skip: !dbOk }, async () => {
  const antes = await prisma.alerta.findFirst({ where: { radicadoId: creados[1].id, nivel: 'D7' } })
  assert.ok(antes && !antes.atendida, 'parte con la alerta pendiente')

  const { status } = await responderPdf(await login(JUAN), creados[1].id)
  assert.equal(status, 200)

  // Se cierran TODAS las pendientes del radicado (la NUEVO y la D7)
  const despues = await prisma.alerta.findMany({ where: { radicadoId: creados[1].id } })
  assert.ok(despues.length >= 1 && despues.every((a) => a.atendida))
  assert.ok(despues.every((a) => a.atendidaPor === JUAN_ID))
})

test('la revisión manual es solo de gerencia', { skip: !dbOk }, async () => {
  assert.equal((await post('/api/alertas/ejecutar', await login(LIDER_OPE), {})).status, 403)
})

// ─── Edición (solo gerencia) ─────────────────────────────────────────────────

test('PUT: gerencia edita y mover la fecha límite cierra alertas y registra eventos', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)

  const lider = await put(`/api/radicados/${creados[0].id}`, await login(LIDER_OPE), { fechaLimite: fechaISO(10) })
  assert.equal(lider.status, 403)

  const ok = await put(`/api/radicados/${creados[0].id}`, gerencia, { numeroRadicado: numero('1b'), prioridad: 'alta' })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.data.numeroRadicado, numero('1b'))
  assert.equal(ok.json.data.prioridad, 'alta')

  // Radicado nuevo para probar el cierre de alertas al aplazar
  const nuevo = await crearRadicado(gerencia, { n: 5, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: fechaISO(3) })
  assert.equal(nuevo.status, 201)
  creados.push({ id: nuevo.json.data.id })
  await post('/api/alertas/ejecutar', gerencia, { areaId: OPE.id })
  assert.equal((await prisma.alerta.findFirst({ where: { radicadoId: nuevo.json.data.id } })).atendida, false)

  const aplazado = await put(`/api/radicados/${nuevo.json.data.id}`, gerencia, { fechaLimite: fechaISO(60) })
  assert.equal(aplazado.status, 200)
  assert.equal(aplazado.json.data.estado, 'sano', 'al aplazar a 60 días el derivado vuelve a sano')
  const alerta = await prisma.alerta.findFirst({ where: { radicadoId: nuevo.json.data.id } })
  assert.equal(alerta.atendida, true, 'aplazar el plazo cierra la alerta pendiente')

  // Eventos del cambio de plazo
  const evento = await prisma.radicadoEvento.findFirst({
    where: { radicadoId: nuevo.json.data.id, tipo: 'PLAZO_CAMBIADO' },
  })
  assert.ok(evento)
  assert.match(evento.detalle, /→/)

  const dup = await put(`/api/radicados/${nuevo.json.data.id}`, gerencia, { numeroRadicado: numero('1b') })
  assert.equal(dup.status, 409)

  // R3: reasignar retira TODAS las alertas del destinatario anterior y genera
  // una 'nuevo' para la nueva asignación (mismo punto que al crear)
  const totalAntes = await prisma.alerta.count({ where: { radicadoId: nuevo.json.data.id } })
  assert.ok(totalAntes >= 1, 'parte con las alertas del ciclo anterior (aunque atendidas)')
  const reasignado = await put(`/api/radicados/${nuevo.json.data.id}`, gerencia, { encargadoId: LAURA_ID })
  assert.equal(reasignado.status, 200)
  assert.equal(reasignado.json.data.encargado.id, LAURA_ID)
  const trasReasigno = await prisma.alerta.findMany({ where: { radicadoId: nuevo.json.data.id } })
  assert.equal(trasReasigno.length, 1)
  assert.equal(trasReasigno[0].nivel, 'NUEVO')
  assert.equal(trasReasigno[0].atendida, false)
  assert.equal(
    (await prisma.radicadoEvento.count({ where: { radicadoId: nuevo.json.data.id, tipo: 'ASIGNADO' } })),
    2,
    'el reasigno deja otro evento asignado',
  )
})

test('ids mal formados o inexistentes → 404', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)
  assert.equal((await get('/api/radicados/no-es-un-id/pdf/radicado', gerencia)).status, 404)
  assert.equal((await get(`/api/radicados/${ID_FALSO}/pdf/radicado`, gerencia)).status, 404)
  assert.equal((await get(`/api/radicados/${ID_FALSO}`, gerencia)).status, 404)
  assert.equal((await put(`/api/radicados/${ID_FALSO}`, gerencia, { numeroRadicado: 'x' })).status, 404)
  assert.equal((await responderPdf(gerencia, ID_FALSO)).status, 404)
})

// ─── Detalle, resumen y filtros del listado (R2) ─────────────────────────────

test('GET /:id: detalle con adjuntos, línea de tiempo y respondedor; área ajena → 403', { skip: !dbOk }, async () => {
  const juan = await login(JUAN)
  const { status, json } = await get(`/api/radicados/${creados[0].id}`, juan)
  assert.equal(status, 200)

  const r = json.data
  assert.equal(r.numeroRadicado, numero('1b'))
  assert.ok(Array.isArray(r.eventos) && r.eventos.length >= 3, 'línea de tiempo: creado, asignado, respondido')
  assert.deepEqual(
    r.eventos.map((e) => e.tipo),
    ['creado', 'asignado', 'respondido'],
  )
  assert.equal(r.eventos[0].usuario.nombre, 'Sandra Milena Gómez')
  assert.match(r.eventos[2].detalle, /a tiempo/)
  assert.ok(r.adjuntos.length >= 2, 'metadatos del PDF del radicado y de la respuesta')
  assert.ok(r.adjuntos.every((a) => !('contenido' in a)), 'adjuntos sin contenido')
  assert.equal(r.respondidoPor.id, JUAN_ID)
  assert.equal(r.respondidoPor.nombre, 'Juan David Valdez')
  assert.equal(r.tieneRespuesta, true)

  // Área ajena no ve el detalle
  assert.equal((await get(`/api/radicados/${creados[0].id}`, await login(LIDER_COM))).status, 403)
})

test('GET /api/resumen: kpis, ventanas y áreas con alcance por rol', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)

  // El líder ya no recibe 403: ve el resumen de SU área nada más
  const lider = await get('/api/resumen', await login(LIDER_OPE))
  assert.equal(lider.status, 200)
  assert.ok(lider.json.data.areas.length >= 1)
  assert.ok(lider.json.data.areas.every((a) => a.codigo === 'OPE'))
  assert.equal(
    lider.json.data.kpis.total,
    lider.json.data.areas.reduce((s, a) => s + a.total, 0),
  )

  const { status, json } = await get('/api/resumen', gerencia)
  assert.equal(status, 200)

  const kpis = json.data.kpis
  for (const campo of [
    'pendientes', 'porVencer', 'vencidos', 'respondidosATiempo',
    'respondidosConRetraso', 'alertasPendientes', 'total',
  ]) {
    assert.ok(Number.isInteger(kpis[campo]), `kpis.${campo}`)
  }
  assert.equal(kpis.pendientes + kpis.respondidosATiempo + kpis.respondidosConRetraso, kpis.total)

  for (const campo of ['hasta1Dia', 'dias2a3', 'dias4a7']) {
    assert.ok(Number.isInteger(json.data.ventanas[campo]), `ventanas.${campo}`)
  }

  const ope = json.data.areas.find((a) => a.codigo === 'OPE')
  assert.ok(ope, 'OPE aparece en el resumen por área')
  assert.ok(ope.respondidosATiempo >= 1 && ope.respondidosConRetraso >= 1)

  assert.ok(Array.isArray(json.data.proximosAVencer) && json.data.proximosAVencer.length >= 1)
  assert.ok(json.data.proximosAVencer.every((p) => p.numeroRadicado && Number.isInteger(p.dias)))
  assert.ok(Array.isArray(json.data.categorias) && json.data.categorias.length >= 1)
  assert.ok(json.data.categorias.some((c) => c.categoria === 'Pruebas'))
  assert.ok(!JSON.stringify(json.data).includes('"contenido"'))
})

test('listado con q, estado y orden; nunca devuelve contenido', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)

  // El contrato del listado nunca incluye los bytes de los adjuntos
  const todo = await get('/api/radicados', gerencia)
  assert.ok(todo.json.data.every((r) => !('contenido' in r)))
  assert.ok(!JSON.stringify(todo.json.data).includes('"contenido"'))

  // q: busca por número, asunto o remitente (insensible a mayúsculas)
  const porNumero = await get(`/api/radicados?q=${encodeURIComponent(numero(2))}`, gerencia)
  assert.ok(porNumero.json.data.every((r) => r.numeroRadicado.startsWith(SUFIJO)))
  assert.ok(porNumero.json.data.some((r) => r.numeroRadicado === numero(2)))
  const porAsunto = await get(`/api/radicados?q=${encodeURIComponent('sOLICITUD DE INFORMACIÓN')}`, gerencia)
  assert.ok(porAsunto.json.data.some((r) => r.numeroRadicado.startsWith(SUFIJO)))
  const sinResultados = await get(`/api/radicados?q=inexistente-${SUFIJO}`, gerencia)
  assert.equal(sinResultados.json.data.length, 0)

  // estado: respondido / vencido / por_vencer como filtro de servidor.
  // El vencido pendiente va directo a BD (por API ya no se puede crear).
  const vencidoExtra = await prisma.radicado.create({
    data: {
      numeroRadicado: numero(6),
      asunto: 'Tutela ambiental',
      descripcion: 'Radicado viejo sin responder para el filtro de estado.',
      remitente: 'Juzgado Primero Civil',
      tipo: 'Tutela',
      prioridad: 'ALTA',
      fechaRadicacion: enDias(-12),
      fechaLimite: enDias(-3),
      areaId: OPE.id,
      encargadoId: JUAN_ID,
      creadoPorId: GERENCIA_ID,
    },
  })
  creados.push({ id: vencidoExtra.id })
  const respondidos = await get('/api/radicados?estado=respondido', gerencia)
  assert.ok(respondidos.json.data.every((r) => r.estado === 'respondido'))
  const vencidos = await get('/api/radicados?estado=vencido', gerencia)
  assert.ok(vencidos.json.data.some((r) => r.numeroRadicado === numero(6)))
  assert.ok(vencidos.json.data.every((r) => r.estado === 'vencido' && r.diasRestantes < 0))
  const porVencerFiltro = await get('/api/radicados?estado=por_vencer', gerencia)
  assert.ok(porVencerFiltro.json.data.every((r) => r.estado === 'por_vencer'))

  // orden + dir: por número descendente
  const ordenados = await get('/api/radicados?orden=numero&dir=desc', gerencia)
  const numerosOrden = ordenados.json.data.map((r) => r.numeroRadicado)
  assert.deepEqual([...numerosOrden].sort().reverse(), numerosOrden)

  // Un lider_area que manda otra área en el query queda forzado a la suya
  const comConTrampa = await get(`/api/radicados?area=${OPE.id}`, await login(LIDER_COM))
  assert.ok(comConTrampa.json.data.every((r) => r.area.codigo === 'COM'), 'el área sale del token')
})

// ─── Escalada de vencidas (R3) ───────────────────────────────────────────────

test('la vencida genera alerta VENCIDO y aparece escalada en /api/alertas', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)

  // El radicado 6 quedó vencido y pendiente en la prueba de filtros: la
  // revisión le genera la VENCIDO (y a nadie más del set de la suite)
  const r = await post('/api/alertas/ejecutar', gerencia, { areaId: OPE.id })
  assert.equal(r.status, 200)

  const vencidoExtra = await prisma.radicado.findFirst({ where: { numeroRadicado: numero(6) } })
  const vencida = await prisma.alerta.findFirst({
    where: { radicadoId: vencidoExtra.id, nivel: 'VENCIDO' },
  })
  assert.ok(vencida)
  assert.equal(vencida.atendida, false)
  assert.match(vencida.mensaje, /Vencido desde el/)

  const { json } = await get('/api/alertas', gerencia)
  const fila = json.data.alertas.find((a) => a.id === vencida.id)
  assert.ok(fila)
  assert.equal(fila.nivel, 'VENCIDO')
  assert.equal(fila.escalada, true, 'la vencida queda marcada como escalada a gerencia')
  assert.equal(fila.radicado.numeroRadicado, numero(6))
  assert.ok(fila.radicado.dias < 0)

  // El resumen de la ejecución registra la escalada a gerencia
  const area = r.json.data.areas.find((a) => a.area.codigo === 'OPE')
  assert.ok(area)
  assert.ok(area.notificados.gerencia.length >= 1, 'las vencidas notifican también a gerencia')
})

// ─── Eliminación (solo gerencia, fusión) ─────────────────────────────────────

test('DELETE /:id: solo gerencia, y borra adjuntos, eventos y alertas', { skip: !dbOk }, async () => {
  const gerencia = await login(GERENCIA)
  const victima = await crearRadicado(gerencia, { n: 8, areaId: OPE.id, encargadoId: JUAN_ID, fechaLimite: fechaISO(3) })
  assert.equal(victima.status, 201)
  const id = victima.json.data.id

  // Nace con PDF, eventos y alerta NUEVO del alta
  assert.ok((await prisma.adjunto.count({ where: { radicadoId: id } })) >= 1)
  assert.ok((await prisma.radicadoEvento.count({ where: { radicadoId: id } })) >= 1)
  assert.ok((await prisma.alerta.count({ where: { radicadoId: id } })) >= 1)

  assert.equal((await req('DELETE', `/api/radicados/${id}`, await login(LIDER_OPE))).status, 403)
  assert.equal((await req('DELETE', `/api/radicados/${id}`, await login(JUAN))).status, 403)
  assert.equal((await req('DELETE', `/api/radicados/${ID_FALSO}`, gerencia)).status, 404)

  const eliminado = await req('DELETE', `/api/radicados/${id}`, gerencia)
  assert.equal(eliminado.status, 200)
  assert.equal(eliminado.json.data.numeroRadicado, numero(8))
  assert.match(eliminado.json.message, /eliminado/i)

  // Cascada manual: nada derivado queda huérfano
  assert.equal(await prisma.radicado.findUnique({ where: { id } }), null)
  assert.equal(await prisma.adjunto.count({ where: { radicadoId: id } }), 0)
  assert.equal(await prisma.radicadoEvento.count({ where: { radicadoId: id } }), 0)
  assert.equal(await prisma.alerta.count({ where: { radicadoId: id } }), 0)
})
