// Integración: mapa de estructura — subáreas, estado activa/inactiva y
// registro de movimientos (POST /api/areas con parentId, PATCH :id/estado,
// GET /api/areas/movimientos). Regla: SOLO gerencia (LIDER_GENERAL).
// Se salta automáticamente si la base de datos no está alcanzable.

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


// Usuarios del seed (npm run db:seed) — emails con UNA sola u
const PASSWORD = 'acuasan2026'
const GERENCIA = 'gerencia@acuasan.com' // LIDER_GENERAL
const LIDER_OPE = 'lider.operativo@acuasan.com' // LIDER_AREA (OPE)

// Áreas temporales de la suite (limpieza también en after)
const CODIGO_PADRE = 'TP1'
const CODIGO_SUB = 'TS1'
const EMAIL_ENCARGADO = 'encargado.estructura@acuasan.com'
const ID_FALSO = 'a'.repeat(24)

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

before(async () => {
  if (!dbOk) return
  await new Promise((resolver) => {
    servidor = app.listen(0, '127.0.0.1', resolver)
  })
  base = `http://127.0.0.1:${servidor.address().port}`
})

after(async () => {
  // Red de seguridad: nada temporal sobrevive (áreas, encargado, movimientos)
  if (dbOk) {
    await prisma.usuario.deleteMany({ where: { email: EMAIL_ENCARGADO } }).catch(() => {})
    await prisma.area.deleteMany({ where: { codigo: { in: [CODIGO_PADRE, CODIGO_SUB] } } }).catch(() => {})
    await prisma.movimientoArea
      .deleteMany({ where: { areaCodigo: { in: [CODIGO_PADRE, CODIGO_SUB] } } })
      .catch(() => {})
  }
  if (servidor) await new Promise((r) => servidor.close(r))
  await prisma.$disconnect()
})

async function tokenDe(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const json = await res.json()
  assert.ok(json.success, `login falló para ${email}: ${json.message}`)
  return json.data.token
}

async function req(metodo, path, token, cuerpo) {
  const res = await fetch(base + path, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, json }
}

async function areasDe(token) {
  const { json } = await req('GET', '/api/areas', token)
  return json.data
}

async function movimientosDe(token, params = '') {
  const { json } = await req('GET', `/api/areas/movimientos${params}`, token)
  return json.data
}

test('subárea y estado sin sesión o sin gerencia → 401/403', { skip: !dbOk }, async () => {
  const cuerpo = { codigo: 'X', nombre: 'X' }
  assert.equal((await req('POST', '/api/areas', null, cuerpo)).status, 401)
  assert.equal((await req('GET', '/api/areas/movimientos', null)).status, 401)

  const tokenLider = await tokenDe(LIDER_OPE)
  const areaCualquiera = (await areasDe(tokenLider))[0]
  assert.equal((await req('PATCH', `/api/areas/${areaCualquiera.id}/estado`, tokenLider, { activa: false })).status, 403)
  assert.equal((await req('GET', '/api/areas/movimientos', tokenLider)).status, 403)
})

test('gerencia crea área operativa y una subárea debajo (sin encargado)', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)

  // Área operativa de gerencia: el encargado sigue siendo obligatorio
  const padre = await req('POST', '/api/areas', token, {
    codigo: CODIGO_PADRE,
    nombre: 'Área padre de prueba',
    encargado: { nombre: 'Encargado Estructura', email: EMAIL_ENCARGADO, password: 'ClaveEstructura2026', activo: true },
  })
  assert.equal(padre.status, 201)

  // Subárea: cuelga del área padre y NO exige encargado
  const sub = await req('POST', '/api/areas', token, {
    codigo: CODIGO_SUB,
    nombre: 'Subárea de prueba',
    parentId: padre.json.data.id,
  })
  assert.equal(sub.status, 201)
  assert.equal(sub.json.data.parentId, padre.json.data.id)

  // El listado trae la subárea con estado activo por defecto
  const listada = (await areasDe(token)).find((a) => a.codigo === CODIGO_SUB)
  assert.ok(listada, 'la subárea debe listarce')
  assert.equal(listada.parentId, padre.json.data.id)
  assert.equal(listada.activa, true)
  assert.equal(listada.lider, null, 'la subárea nació sin encargado')

  // El movimiento CREADA quedó registrado (con el padre de contexto)
  const movs = await movimientosDe(token, `?areaId=${sub.json.data.id}`)
  assert.ok(movs.length >= 1)
  assert.equal(movs[0].tipo, 'CREADA')
  assert.equal(movs[0].areaCodigo, CODIGO_SUB)
  assert.match(movs[0].detalle, /Subárea creada bajo/)
  assert.equal(movs[0].padreNombre, 'Área padre de prueba')
})

test('POST con parentId inexistente → 404', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const res = await req('POST', '/api/areas', token, {
    codigo: 'TXX',
    nombre: 'Huérfana',
    parentId: ID_FALSO,
  })
  assert.equal(res.status, 404)
})

test('activar/desactivar pinta la línea y queda en el registro', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const sub = (await areasDe(token)).find((a) => a.codigo === CODIGO_SUB)

  // Desactivar: la línea del mapa pasa a roja (activa: false)
  const apagar = await req('PATCH', `/api/areas/${sub.id}/estado`, token, { activa: false })
  assert.equal(apagar.status, 200)
  assert.equal(apagar.json.data.activa, false)

  const desactivada = (await areasDe(token)).find((a) => a.codigo === CODIGO_SUB)
  assert.equal(desactivada.activa, false)

  const movs = await movimientosDe(token, `?areaId=${sub.id}`)
  assert.equal(movs[0].tipo, 'DESACTIVADA')
  assert.match(movs[0].detalle, /línea roja/i)
  assert.equal(movs[0].usuarioNombre.length > 0, true)

  // Mismo estado otra vez → 400 (no hay cambio que registrar)
  assert.equal((await req('PATCH', `/api/areas/${sub.id}/estado`, token, { activa: false })).status, 400)

  // Reactivar: vuelve a la línea verde
  const prender = await req('PATCH', `/api/areas/${sub.id}/estado`, token, { activa: true })
  assert.equal(prender.status, 200)
  const movs2 = await movimientosDe(token, `?areaId=${sub.id}`)
  assert.equal(movs2[0].tipo, 'ACTIVADA')
})

test('PATCH estado de la raíz o con cuerpo inválido → 400', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const raiz = (await areasDe(token)).find((a) => a.parentId === null)

  const putRaiz = await req('PATCH', `/api/areas/${raiz.id}/estado`, token, { activa: false })
  assert.equal(putRaiz.status, 400)
  assert.match(putRaiz.json.message, /siempre activa/i)

  const sub = (await areasDe(token)).find((a) => a.codigo === CODIGO_SUB)
  assert.equal((await req('PATCH', `/api/areas/${sub.id}/estado`, token, {})).status, 400)
  assert.equal((await req('PATCH', `/api/areas/${sub.id}/estado`, token, { activa: 'si' })).status, 400)
  assert.equal((await req('PATCH', `/api/areas/no-es-id/estado`, token, { activa: true })).status, 404)
})

test('área con subáreas no se elimina; eliminada deja registro', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const padre = (await areasDe(token)).find((a) => a.codigo === CODIGO_PADRE)
  const sub = (await areasDe(token)).find((a) => a.codigo === CODIGO_SUB)

  // El padre tiene la subárea colgando → 409
  const bloqueado = await req('DELETE', `/api/areas/${padre.id}`, token)
  assert.equal(bloqueado.status, 409)
  assert.match(bloqueado.json.message, /subárea/i)

  // La subárea (vacía) sí se puede eliminar
  const eliminada = await req('DELETE', `/api/areas/${sub.id}`, token)
  assert.equal(eliminada.status, 200)

  // El registro ELIMINADA sobrevive al área con sus snapshots
  const movs = await movimientosDe(token, `?areaId=${sub.id}`)
  const deEliminacion = movs.filter((m) => m.tipo === 'ELIMINADA')
  assert.equal(deEliminacion.length, 1)
  assert.equal(deEliminacion[0].areaCodigo, CODIGO_SUB)
  assert.equal(deEliminacion[0].areaNombre, 'Subárea de prueba')
})

test('GET /movimientos lista la auditoría completa de gerencia', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const movs = await movimientosDe(token, '?limite=50')
  assert.ok(Array.isArray(movs))
  assert.ok(movs.length >= 4, 'deben existir movimientos de la suite (creada, desactivada, activada, eliminada)')
  // Orden descendente por fecha
  for (let i = 1; i < movs.length; i++) {
    assert.ok(new Date(movs[i - 1].fecha) >= new Date(movs[i].fecha), 'orden descendente')
  }
})
