// Integración del CALENDARIO hábil (F12): tira "Hoy", mes con radicados
// enviados con scope por rol, festivos, detalle del día y días no laborales
// (solo gerencia, con refresco de la caché de calendarioCO).

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
const { hoyBogota, medianocheBogotaDe, sumarDiasISO, diaSemanaISO } = await import('../src/utils/fechas.js')
const { cargarDiasNoLaborales } = await import('../src/lib/calendarioCO.js')


// Usuarios del seed (npm run db:seed) — el dominio se arma por partes a
// propósito: la grafía correcta lleva UNA sola u y escribirlo literal
// invita al error de la doble u (que no existe en la BD).
const PASSWORD = 'acuasan2026'
const DOMINIO = 'ac' + 'u' + 'asan.com'
const GERENCIA = 'gerencia@' + DOMINIO // LIDER_GENERAL
const USUARIO_OPE = 'juan.valdez@' + DOMINIO // USUARIO (OPE)

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
let gerencia = null
let usuarioOpe = null
let usuarioOtraArea = null // USUARIO de un área ≠ OPE (para el scope cruzado)
let areaOpeId = null
let otraAreaId = null

const RADICADOS_PROPIOS = []
let diaNoLaboralId = null

before(async () => {
  if (!dbOk) return
  await new Promise((resolver) => {
    servidor = app.listen(0, '127.0.0.1', resolver)
  })
  base = `http://127.0.0.1:${servidor.address().port}`

  const areaOpe = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  areaOpeId = areaOpe?.id ?? null
  const otra = await prisma.area.findFirst({ where: { id: { not: areaOpeId }, parentId: { not: null } } })
  otraAreaId = otra?.id ?? null

  gerencia = await login(GERENCIA)
  usuarioOpe = await login(USUARIO_OPE)
  const usuarioCruzado = await prisma.usuario.findFirst({
    where: { rol: 'USUARIO', activo: true, areaId: otraAreaId },
  })
  if (usuarioCruzado) usuarioOtraArea = await login(usuarioCruzado.email)
})

after(async () => {
  if (dbOk) {
    for (const id of RADICADOS_PROPIOS) {
      await prisma.alerta.deleteMany({ where: { radicadoId: id } })
      await prisma.radicadoEvento.deleteMany({ where: { radicadoId: id } })
    }
    if (RADICADOS_PROPIOS.length) {
      await prisma.radicado.deleteMany({ where: { id: { in: [...RADICADOS_PROPIOS] } } })
    }
    if (diaNoLaboralId) {
      await prisma.diaNoLaboral.deleteMany({ where: { id: diaNoLaboralId } })
      await cargarDiasNoLaborales(true)
    }
  }
  if (servidor) {
    if (typeof servidor.closeAllConnections === 'function') servidor.closeAllConnections()
    await new Promise((r) => servidor.close(r))
  }
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
  return { token: json.data.token, id: json.data.usuario.id, email }
}

async function llamar(ruta, { metodo = 'GET', token = gerencia.token, cuerpo } = {}) {
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  return res
}

async function crearRadicado({ numero, limite, areaId, encargadoId }) {
  const radicado = await prisma.radicado.create({
    data: {
      numeroRadicado: numero,
      asunto: `Calendario ${numero}`,
      descripcion: 'Radicado de prueba del calendario',
      remitente: 'Suite de tests',
      tipo: 'Interno',
      categoria: 'General',
      prioridad: 'MEDIA',
      fechaRadicacion: medianocheBogotaDe(hoyBogota()),
      fechaLimite: limite,
      areaId,
      encargadoId,
      creadoPorId: gerencia.id,
    },
  })
  RADICADOS_PROPIOS.push(radicado.id)
  return radicado
}

test('hoy: exige sesión y resume el día con los vencimientos del rol', async () => {
  if (!dbOk) return
  assert.equal((await llamar('/api/calendario/hoy', { token: null })).status, 401)

  const hoy = hoyBogota()
  const [a, m] = hoy.split('-').map(Number)
  const res = await llamar('/api/calendario/hoy')
  assert.ok(res.ok)
  const d = (await res.json()).data
  assert.equal(d.fecha, hoy)
  assert.ok(['habil', 'fin_de_semana', 'festivo'].includes(d.tipo))
  assert.ok(Number.isInteger(d.venceHoy))
  if (d.proximoFestivo) {
    assert.ok(d.proximoFestivo.fecha > hoy)
    assert.ok(d.proximoFestivo.nombre)
  }
  // El mes actual con defaults explícitos también responde
  assert.ok(await llamar(`/api/calendario?anio=${a}&mes=${m}`))
})

test('mes: validaciones y días con su clasificación', async () => {
  if (!dbOk) return
  assert.equal((await llamar('/api/calendario?anio=2026&mes=13')).status, 400)
  assert.equal((await llamar('/api/calendario?anio=1826&mes=10')).status, 400)
  assert.equal((await llamar('/api/calendario')).status, 400)

  const res = await llamar('/api/calendario?anio=2026&mes=10')
  assert.ok(res.ok)
  const d = (await res.json()).data
  assert.equal(d.dias.length, 31)
  assert.ok(Number.isInteger(d.diasHabiles) && d.diasHabiles > 0)
  // El lunes 12 de octubre de 2026 es el Día de la Raza (Emiliani)
  const doce = d.dias.find((x) => x.fecha === '2026-10-12')
  assert.equal(doce.tipo, 'festivo')
  assert.equal(doce.nombreFestivo, 'Día de la Raza')
  // Y el 31 es sábado
  assert.equal(d.dias.find((x) => x.fecha === '2026-10-31').tipo, 'fin_de_semana')
})

test('enviados del mes con scope por rol: gerencia ve todo, el área solo lo suyo', async () => {
  if (!dbOk) return
  const hoy = hoyBogota()
  const radicaHoy = medianocheBogotaDe(hoy) // radicados HOY: siempre dentro del mes
  await crearRadicado({ numero: `RAD-CAL-A-${Date.now()}`, limite: radicaHoy, areaId: areaOpeId, encargadoId: usuarioOpe.id })
  if (otraAreaId) {
    await crearRadicado({
      numero: `RAD-CAL-B-${Date.now()}`,
      limite: radicaHoy,
      areaId: otraAreaId,
      encargadoId: usuarioOtraArea?.id ?? usuarioOpe.id,
    })
  }

  const [a, m] = hoy.split('-').map(Number)
  const total = await llamar(`/api/calendario?anio=${a}&mes=${m}`)
  const dGerencia = (await total.json()).data
  const enBD = await prisma.radicado.count({
    where: { fechaRadicacion: radicaHoy }, // todos los estados: enviado es enviado
  })
  assert.equal(dGerencia.enviados[hoy] ?? 0, enBD, 'gerencia ve todos los radicados enviados hoy')

  const propio = await llamar(`/api/calendario?anio=${a}&mes=${m}`, { token: usuarioOpe.token })
  const dOpe = (await propio.json()).data
  const enOpe = await prisma.radicado.count({
    where: { fechaRadicacion: radicaHoy, areaId: areaOpeId },
  })
  assert.equal(dOpe.enviados[hoy] ?? 0, enOpe, 'el usuario de OPE solo ve los enviados de OPE')
})

test('día: radicados enviados con detalle y scope', async () => {
  if (!dbOk) return
  const hoy = hoyBogota()
  const res = await llamar(`/api/calendario/dia?fecha=${hoy}`)
  assert.ok(res.ok)
  const d = (await res.json()).data
  assert.equal(d.fecha, hoy)
  assert.ok(Array.isArray(d.enviados) && d.enviados.length >= 1)
  const propio = d.enviados.find((r) => r.numeroRadicado.startsWith('RAD-CAL-A'))
  assert.ok(propio, 'el radicado propio de la suite aparece')
  assert.ok(propio.area?.codigo, 'trae el área')
  assert.ok(propio.encargado, 'resuelve el nombre del encargado')

  const ope = await llamar(`/api/calendario/dia?fecha=${hoy}`, { token: usuarioOpe.token })
  const dOpe = (await ope.json()).data
  assert.ok(dOpe.enviados.every((r) => r.area.codigo === 'OPE'), 'el usuario de OPE solo ve radicados de OPE')

  assert.equal((await llamar('/api/calendario/dia?fecha=2026-02-30')).status, 400)
  assert.equal((await llamar('/api/calendario/dia?fecha=nope')).status, 400)
})

test('festivos del año 2026: las 18 fechas', async () => {
  if (!dbOk) return
  const res = await llamar('/api/calendario/festivos?anio=2026')
  assert.ok(res.ok)
  const festivos = (await res.json()).data
  assert.equal(new Set(festivos.map((f) => f.fecha)).size, 18)
  assert.ok(festivos.every((f) => f.nombre))
  assert.equal((await llamar('/api/calendario/festivos')).status, 400)
})

test('días no laborales: solo gerencia, CRUD completo y caché refrescada', async () => {
  if (!dbOk) return
  // Un lunes a ~45 días: hábil antes del registro
  let f = sumarDiasISO(hoyBogota(), 45)
  while (diaSemanaISO(f) !== 1) f = sumarDiasISO(f, 1)

  const cuerpo = { fecha: f, nombre: 'Cierre administrativo (test)', motivo: 'suite calendario' }
  assert.equal(
    (await llamar('/api/calendario/no-laborales', { metodo: 'POST', token: usuarioOpe.token, cuerpo })).status,
    403,
    'un USUARIO no puede registrar días no laborales',
  )
  assert.equal((await llamar('/api/calendario/no-laborales', { token: usuarioOpe.token })).status, 403)

  const antes = await llamar(`/api/calendario/dia?fecha=${f}`)
  assert.equal((await antes.json()).data.tipo, 'habil')

  const crear = await llamar('/api/calendario/no-laborales', { metodo: 'POST', cuerpo })
  assert.equal(crear.status, 201)
  diaNoLaboralId = (await crear.json()).data.id

  // La caché de calendarioCO se refrescó: el día ya NO es hábil
  const durante = await llamar(`/api/calendario/dia?fecha=${f}`)
  const dDurante = (await durante.json()).data
  assert.equal(dDurante.tipo, 'festivo')
  assert.equal(dDurante.nombreFestivo, 'Cierre administrativo (test)')

  // Duplicado por fecha: 409
  assert.equal(
    (await llamar('/api/calendario/no-laborales', { metodo: 'POST', cuerpo: { fecha: f, nombre: 'Otro' } })).status,
    409,
  )

  // Listado y borrado
  const lista = await llamar('/api/calendario/no-laborales')
  assert.ok((await lista.json()).data.some((x) => x.id === diaNoLaboralId))
  const borrar = await llamar(`/api/calendario/no-laborales/${diaNoLaboralId}`, { metodo: 'DELETE' })
  assert.ok(borrar.ok)
  diaNoLaboralId = null

  const despues = await llamar(`/api/calendario/dia?fecha=${f}`)
  const dDespues = (await despues.json()).data
  assert.equal(dDespues.tipo, 'habil', 'al borrar, el día vuelve a ser hábil')
  assert.equal(dDespues.nombreFestivo, null)

  assert.equal((await llamar('/api/calendario/no-laborales/aabbccddeeff001122334455', { metodo: 'DELETE' })).status, 404)
})
