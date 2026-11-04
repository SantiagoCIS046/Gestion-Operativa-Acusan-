// Integración: /api/me y /api/areas contra la app real + Atlas.
// Se salta automáticamente si la base de datos no está alcanzable.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

// NODE_ENV=test ANTES de importar app.js para que no levante listener propio
process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: jwt } = await import('jsonwebtoken')
const { default: app } = await import('../src/app.js')
// Cliente CON la extensión de cifrado: lee descifrado y escribe cifrado,
// igual que el backend
const { default: prisma } = await import('../src/config/prisma.js')


// Usuarios del seed (npm run db:seed) — emails con UNA sola u
const PASSWORD = 'acuasan2026'
const GERENCIA = 'gerencia@acuasan.com' // LIDER_GENERAL
const LIDER_OPE = 'lider.operativo@acuasan.com' // LIDER_AREA (OPE)
const USUARIO_OPE = 'juan.valdez@acuasan.com' // USUARIO (OPE)
const LIDER_COM = 'lider.comercial@acuasan.com' // LIDER_AREA (COM)

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
  return json.data
}

async function get(path, token) {
  const res = await fetch(base + path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, json }
}

test('el token del login incluye id, rol y areaId', { skip: !dbOk }, async () => {
  const { token, usuario } = await login(USUARIO_OPE)
  const payload = jwt.decode(token)
  assert.equal(payload.id, usuario.id)
  assert.equal(payload.rol, 'USUARIO')
  assert.ok(payload.areaId, 'areaId debe venir en el token')
  assert.equal(payload.areaId, usuario.areaId)
})

test('GET /api/me sin sesión → 401 con mensaje claro', { skip: !dbOk }, async () => {
  const { status, json } = await get('/api/me', null)
  assert.equal(status, 401)
  assert.match(json.message, /iniciar sesión/i)
})

test('GET /api/me con sesión → perfil fresco con área y sin passwordHash', { skip: !dbOk }, async () => {
  const { token } = await login(USUARIO_OPE)
  const { status, json } = await get('/api/me', token)
  assert.equal(status, 200)
  assert.equal(json.data.rol, 'USUARIO')
  assert.equal(json.data.area.codigo, 'OPE')
  assert.equal(json.data.activo, true)
  assert.ok(!('passwordHash' in json.data), 'nunca debe exponer el hash')
})

test('GET /api/areas sin sesión → 401', { skip: !dbOk }, async () => {
  const { status } = await get('/api/areas', null)
  assert.equal(status, 401)
})

test('GET /api/areas como lider_general → todas las áreas, líder primero', { skip: !dbOk }, async () => {
  const { token } = await login(GERENCIA)
  const { status, json } = await get('/api/areas', token)
  assert.equal(status, 200)

  const areas = json.data
  // Total dinámico: node --test corre los archivos en paralelo y otros tests
  // (p. ej. areas-admin-api) crean/borran áreas temporalmente.
  const totalEnBd = await prisma.area.count()
  assert.equal(areas.length, totalEnBd, 'lider_general ve TODAS las áreas de la BD')
  assert.ok(areas.length >= 5, 'el seed trae al menos las 5 áreas (1 líder + 4 operativas)')
  assert.equal(areas[0].codigo, 'GER')
  assert.equal(areas[0].parentId, null, 'el área líder va primero y no tiene padre')
  assert.ok(areas.every((a) => Array.isArray(a.miembros)))
})

test('GET /api/areas como usuario → solo su área, con líder y miembros', { skip: !dbOk }, async () => {
  const { token } = await login(USUARIO_OPE)
  const { status, json } = await get('/api/areas', token)
  assert.equal(status, 200)

  const areas = json.data
  assert.equal(areas.length, 1, 'un usuario solo ve su área')
  assert.equal(areas[0].codigo, 'OPE')
  assert.equal(areas[0].lider.rol, 'LIDER_AREA')
  assert.equal(areas[0].lider.email, LIDER_OPE)
  assert.equal(areas[0].miembros.length, 2, 'juan y laura')
})

test('GET /api/areas como lider_area → solo su área', { skip: !dbOk }, async () => {
  const { token } = await login(LIDER_COM)
  const { status, json } = await get('/api/areas', token)
  assert.equal(status, 200)
  assert.equal(json.data.length, 1)
  assert.equal(json.data[0].codigo, 'COM')
})
