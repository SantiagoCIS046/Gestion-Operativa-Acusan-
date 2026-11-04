// Integración del motor ÚNICO de alertas de radicados (post-fusión):
// ejecución con/sin área, forzar, cambio de nivel D30→D15, renovación de
// plazo que atiende las pendientes, listado, atender y el endpoint de cron.

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
const USUARIO_OPE = 'juan.valdez@acuasan.com' // USUARIO (OPE)

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

let areaOpeId = null
let gerencia = null // { token, id }
let liderOpe = null
let usuarioOpe = null
let liderOtraArea = null // líder de un área ≠ OPE (para el 403 de atender)

// Radicados que crea esta suite (se limpian en after)
const PROPIOS = []

before(async () => {
  if (!dbOk) return
  await new Promise((resolver) => {
    servidor = app.listen(0, '127.0.0.1', resolver)
  })
  base = `http://127.0.0.1:${servidor.address().port}`

  const areaOpe = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  areaOpeId = areaOpe?.id ?? null

  gerencia = await login(GERENCIA)
  liderOpe = await login(LIDER_OPE)
  usuarioOpe = await login(USUARIO_OPE)

  // Un líder de OTRA área para probar el 403 cruzado de atender
  liderOtraArea = await prisma.usuario.findFirst({
    where: { rol: 'LIDER_AREA', activo: true, areaId: { not: areaOpeId } },
  })

  // SATURACIÓN: una corrida previa del área OPE deja las claves del seed ya
  // vistas, así los conteos de los tests solo reflejan los radicados propios
  // que cada prueba crea (el mismo día no cambian las claves del seed).
  await ejecutar({ areaId: areaOpeId })
})

after(async () => {
  if (dbOk) {
    // Las alertas son datos derivados: se borran con sus ejecuciones
    const ejecuciones = await prisma.ejecucionAlerta.findMany({
      where: { alcance: { startsWith: 'radicados' } },
      select: { id: true },
    })
    if (ejecuciones.length) {
      await prisma.alerta.deleteMany({
        where: { ejecucionId: { in: ejecuciones.map((e) => e.id) } },
      })
    }
    await prisma.ejecucionAlerta.deleteMany({
      where: { alcance: { startsWith: 'radicados' } },
    })
    for (const id of PROPIOS) {
      await prisma.alerta.deleteMany({ where: { radicadoId: id } })
      await prisma.radicadoEvento.deleteMany({ where: { radicadoId: id } })
    }
    if (PROPIOS.length) {
      await prisma.radicado.deleteMany({ where: { id: { in: [...PROPIOS] } } })
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

async function ejecutar(body, token = gerencia.token) {
  const res = await fetch(`${base}/api/alertas/ejecutar`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json()
  assert.ok(json.success, `ejecutar falló: ${JSON.stringify(json)}`)
  return json.data
}

// Radicado pendiente directo en BD (el motor no necesita adjuntos)
async function crearRadicado({ numero, radicacion, limite, encargadoId }) {
  const radicado = await prisma.radicado.create({
    data: {
      numeroRadicado: numero,
      asunto: `Alerta ${numero}`,
      descripcion: 'Radicado de prueba del motor de alertas',
      remitente: 'Suite de tests',
      tipo: 'Interno',
      categoria: 'General',
      prioridad: 'MEDIA',
      fechaRadicacion: radicacion,
      fechaLimite: limite,
      areaId: areaOpeId,
      encargadoId,
      creadoPorId: gerencia.id,
    },
  })
  PROPIOS.push(radicado.id)
  return radicado
}

const alertasDe = (radicadoId) =>
  prisma.alerta.findMany({ where: { radicadoId }, orderBy: { nivel: 'asc' } })

test('la API de alertas exige sesión', async () => {
  if (!dbOk) return
  const res = await fetch(`${base}/api/alertas`)
  assert.equal(res.status, 401)
})

test('ejecutar la revisión es solo de gerencia', async () => {
  if (!dbOk) return
  for (const token of [liderOpe.token, usuarioOpe.token]) {
    const res = await fetch(`${base}/api/alertas/ejecutar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(res.status, 403)
  }
})

test('un área que no existe da 400', async () => {
  if (!dbOk) return
  const res = await fetch(`${base}/api/alertas/ejecutar`, {
    method: 'POST',
    headers: { authorization: `Bearer ${gerencia.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaId: 'aabbccddeeff001122334455' }),
  })
  assert.equal(res.status, 400)
})

test('dos ejecuciones no duplican alertas y notifican a encargado y líder', async () => {
  if (!dbOk) return
  // Radicación hace 3 días, límite en 5 → plazo 8: solo D7 (plazo ≥ 7)
  await crearRadicado({
    numero: `RAD-AL1-${Date.now()}`,
    radicacion: enDias(-3),
    limite: enDias(5),
    encargadoId: usuarioOpe.id,
  })

  const primera = await ejecutar({ areaId: areaOpeId })
  assert.equal(primera.nuevas, 1, `esperaba solo la D7 nueva: ${primera.nuevas}`)
  assert.equal(primera.reenviadas, 0)
  assert.equal(primera.ejecucion.alcance, 'radicados-area:OPE')

  const area = primera.areas.find((a) => a.areaId === areaOpeId)
  assert.ok(area, 'el área OPE debe salir en el resumen')
  assert.equal(area.nuevas, 1)
  assert.equal(area.alertas, 1)
  assert.equal(area.notificados.lider.email, LIDER_OPE)
  const emails = area.notificados.encargados.map((u) => u.email)
  assert.ok(emails.includes(USUARIO_OPE), `encargados notificados: ${emails}`)
  if (area.vencidos > 0) assert.ok(Array.isArray(area.notificados.gerencia))

  // La segunda corrida (sin forzar) no crea ni reenvía nada
  const segunda = await ejecutar({ areaId: areaOpeId })
  assert.equal(segunda.nuevas, 0)
  assert.equal(segunda.reenviadas, 0)
})

test('forzar reabre y reenvía sin duplicar', async () => {
  if (!dbOk) return
  const forzada = await ejecutar({ areaId: areaOpeId, forzar: true })
  assert.equal(forzada.nuevas, 0, 'forzar no debe crear alertas nuevas')
  assert.ok(forzada.reenviadas >= 1, 'debe reenviar las existentes')

  const propias = await prisma.alerta.findMany({ where: { radicadoId: { in: [...PROPIOS] } } })
  assert.ok(propias.length >= 1)
  for (const a of propias) {
    assert.equal(a.atendida, false, 'forzar reabre las alertas')
    assert.equal(a.reenvios, 1)
  }
  // Sin duplicados: una sola alerta por (radicado, nivel)
  const claves = propias.map((a) => `${a.radicadoId}|${a.nivel}|${a.venceRef}`)
  assert.equal(new Set(claves).size, claves.length)
})

test('acortar el plazo cambia el nivel (D30 → D15) sin duplicar', async () => {
  if (!dbOk) return
  // Radicación hace 10 días, límite en 20 → plazo 30: solo D30
  const radicado = await crearRadicado({
    numero: `RAD-AL2-${Date.now()}`,
    radicacion: enDias(-10),
    limite: enDias(20),
    encargadoId: usuarioOpe.id,
  })
  let corrida = await ejecutar({ areaId: areaOpeId })
  assert.equal(corrida.nuevas, 1)
  let niveles = (await alertasDe(radicado.id)).map((a) => a.nivel)
  assert.deepEqual(niveles, ['D30'])

  // Nuevo límite en 10 → plazo 20: D15 sí (plazo ≥ 15), D30 ya no (plazo < 30)
  const put = await fetch(`${base}/api/radicados/${radicado.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${gerencia.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fechaLimite: enDias(10).toISOString() }),
  })
  assert.ok(put.ok, `PUT falló: ${put.status}`)
  corrida = await ejecutar({ areaId: areaOpeId })
  assert.equal(corrida.nuevas, 1, 'solo la D15 del plazo nuevo')

  const despues = await alertasDe(radicado.id)
  assert.equal(despues.length, 2, 'D30 (atendida por el cambio) + D15 nueva')
  const d30 = despues.find((a) => a.nivel === 'D30')
  const d15 = despues.find((a) => a.nivel === 'D15')
  assert.equal(d30.atendida, true, 'cambiar el plazo atiende la D30 vieja')
  assert.equal(d15.atendida, false)
})

test('renovar el plazo más allá de la ventana atiende las pendientes', async () => {
  if (!dbOk) return
  const radicado = await prisma.radicado.findFirst({
    where: { id: { in: [...PROPIOS] } },
    orderBy: { createdAt: 'desc' },
  })
  const put = await fetch(`${base}/api/radicados/${radicado.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${gerencia.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fechaLimite: enDias(40).toISOString() }),
  })
  assert.ok(put.ok, `PUT falló: ${put.status}`)

  const pendientes = await prisma.alerta.count({
    where: { radicadoId: radicado.id, atendida: false },
  })
  assert.equal(pendientes, 0, 'fuera de la ventana no debe quedar nada pendiente')

  // Y una corrida más no vuelve a crear alertas para ese radicado
  await ejecutar({ areaId: areaOpeId })
  assert.equal(await prisma.alerta.count({ where: { radicadoId: radicado.id } }), 2)
})

test('el listado trae radicados con días y ejecuciones solo para gerencia', async () => {
  if (!dbOk) return
  const res = await fetch(`${base}/api/alertas`, {
    headers: { authorization: `Bearer ${gerencia.token}` },
  })
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.ok(json.data.alertas.length >= 1)
  for (const a of json.data.alertas) {
    assert.ok(a.radicadoId, 'toda alerta del motor referencia su radicado')
    assert.ok(a.radicado.numeroRadicado)
    assert.ok(Number.isInteger(a.radicado.dias))
    assert.equal(a.escalada, a.nivel === 'VENCIDO')
  }
  assert.ok(Array.isArray(json.data.ejecuciones))
  assert.ok(json.data.ejecuciones.length >= 1)
  assert.ok(json.data.ejecuciones.every((e) => typeof e.alcance === 'string'))

  // El líder de área solo ve su área y no ve ejecuciones
  const resLider = await fetch(`${base}/api/alertas`, {
    headers: { authorization: `Bearer ${liderOpe.token}` },
  })
  const jsonLider = await resLider.json()
  assert.equal(jsonLider.data.alertas.length >= 1, true)
  assert.equal(jsonLider.data.alertas.every((a) => a.area.id === areaOpeId), true)
  assert.equal('ejecuciones' in jsonLider.data, false)

  // Un areaId malformado es 400, no 500
  const resMala = await fetch(`${base}/api/alertas?area=xxx`, {
    headers: { authorization: `Bearer ${gerencia.token}` },
  })
  assert.equal(resMala.status, 400)
})

test('atender una alerta respeta el área del token', async () => {
  if (!dbOk) return
  // Una pendiente propia (la D15 del test de cambio de nivel quedó atendida
  // por el PUT; la D7 del primer test sigue pendiente tras el forzar)
  const alerta = await prisma.alerta.findFirst({
    where: { radicadoId: { in: [...PROPIOS] }, atendida: false },
  })
  assert.ok(alerta, 'debe haber una alerta propia pendiente')

  const llamar = async (token) =>
    (
      await fetch(`${base}/api/alertas/${alerta.id}/atender`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
    ).status

  assert.equal(await llamar(usuarioOpe.token), 403, 'un USUARIO no puede atender')
  if (liderOtraArea) {
    // El líder de OTRA área no puede atender una alerta de OPE: se valida
    // con puedeGestionar sin necesidad de abrir su sesión
    const { puedeGestionar } = await import('../src/modules/auth/permisos.js')
    assert.equal(
      puedeGestionar({ rol: 'LIDER_AREA', areaId: liderOtraArea.areaId }, alerta.areaId),
      false,
    )
  }
  assert.equal(await llamar(liderOpe.token), 200, 'el líder del área sí puede')
  const cuerpo = await prisma.alerta.findUnique({ where: { id: alerta.id } })
  assert.equal(cuerpo.atendida, true)
  assert.equal(cuerpo.atendidaPor, liderOpe.id)
  assert.equal(await llamar(liderOpe.token), 400, 'repetir da 400')
})

test('el cron corre sin usuario y registra la ejecución automática', async () => {
  if (!dbOk) return
  const original = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'secreto-cron-de-pruebas'
  try {
    const mala = await fetch(`${base}/api/cron/alertas`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'otra-cosa' },
    })
    assert.equal(mala.status, 401)

    // GET con el secreto en query (como lo llama Vercel Cron)
    const res = await fetch(`${base}/api/cron/alertas?secreto=secreto-cron-de-pruebas`)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.ok(json.success)
    assert.ok(Number.isInteger(json.data.nuevas))
    assert.equal(json.data.ejecucion.alcance, 'radicados')
    assert.ok(json.data.areas.every((a) => Array.isArray(a.notificados.encargados)))

    // Sin usuario: la ejecución queda como corrida automática
    const registro = await prisma.ejecucionAlerta.findUnique({
      where: { id: json.data.ejecucion.id },
    })
    assert.equal(registro.ejecutadaPor, null)
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  }
})
