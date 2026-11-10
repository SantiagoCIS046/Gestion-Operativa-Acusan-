// Integración: gestión de la estructura de áreas (POST/PUT/DELETE /api/areas).
// Regla: SOLO gerencia (LIDER_GENERAL) puede estructurar, agregar y eliminar
// áreas. El área nueva nace con su encargado (rol LIDER_AREA): nombre, correo,
// contraseña inicial y estado activo/inactivo. Se salta automáticamente si la
// base de datos no está alcanzable.

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
const USUARIO_OPE = 'juan.valdez@acuasan.com' // USUARIO (OPE)

// Áreas/encargados temporales de la suite (limpieza también en after)
const CODIGO_TEMP = 'TST'
const CODIGO_INACT = 'TST2'
const EMAIL_ENCARGADO = 'encargado.temporal@acuasan.com'
const EMAIL_INACTIVO = 'encargado.inactivo@acuasan.com'
const ID_FALSO = 'a'.repeat(24)

const ENCARGADO = {
  nombre: 'Encargado Temporal',
  email: EMAIL_ENCARGADO,
  password: 'ClaveTemporal2026',
  activo: true,
}

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
  // Red de seguridad: los usuarios y áreas temporales nunca sobreviven
  if (dbOk) {
    await prisma.usuario
      .deleteMany({ where: { email: { in: [EMAIL_ENCARGADO, EMAIL_INACTIVO] } } })
      .catch(() => {})
    await prisma.area.deleteMany({ where: { codigo: { in: [CODIGO_TEMP, CODIGO_INACT] } } }).catch(() => {})
    // Su historial en el mapa de estructura tampoco debe quedar en la base
    await prisma.movimientoArea
      .deleteMany({ where: { areaCodigo: { in: [CODIGO_TEMP, CODIGO_INACT] } } })
      .catch(() => {})
  }
  if (servidor) await new Promise((r) => servidor.close(r))
  await prisma.$disconnect()
})

async function login(email, password = PASSWORD) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, json }
}

async function tokenDe(email) {
  const { json } = await login(email)
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

test('POST /api/areas sin sesión → 401', { skip: !dbOk }, async () => {
  const { status } = await req('POST', '/api/areas', null, {
    codigo: 'X',
    nombre: 'X',
    encargado: { nombre: 'X', email: 'x@acuasan.com', password: 'X' },
  })
  assert.equal(status, 401)
})

test('estructurar como lider_area o usuario → 403 en POST, PUT y DELETE', { skip: !dbOk }, async () => {
  const tokenLider = await tokenDe(LIDER_OPE)
  const tokenUsuario = await tokenDe(USUARIO_OPE)
  const idCualquiera = ID_FALSO
  const cuerpo = { codigo: 'X', nombre: 'X', encargado: { nombre: 'X', email: 'x@acuasan.com', password: 'X' } }

  for (const token of [tokenLider, tokenUsuario]) {
    assert.equal((await req('POST', '/api/areas', token, cuerpo)).status, 403)
    assert.equal((await req('PUT', `/api/areas/${idCualquiera}`, token, { nombre: 'X' })).status, 403)
    assert.equal((await req('DELETE', `/api/areas/${idCualquiera}`, token)).status, 403)
  }
})

test('gerencia crea (con encargado) → edita → elimina un área operativa', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const raiz = (await areasDe(token)).find((a) => a.parentId === null)
  assert.ok(raiz, 'debe existir el área líder')

  // Crear: nace dependiente del área líder y CON su encargado como líder
  const creada = await req('POST', '/api/areas', token, {
    codigo: CODIGO_TEMP.toLowerCase(), // el backend normaliza a mayúsculas
    nombre: 'Área temporal de prueba',
    encargado: ENCARGADO,
  })
  assert.equal(creada.status, 201)
  assert.equal(creada.json.data.codigo, CODIGO_TEMP)
  assert.equal(creada.json.data.parentId, raiz.id)

  // El encargado queda listado como líder del área nueva
  const conLider = (await areasDe(token)).find((a) => a.codigo === CODIGO_TEMP)
  assert.equal(conLider.lider.email, EMAIL_ENCARGADO)
  assert.equal(conLider.lider.rol, 'LIDER_AREA')
  assert.equal(conLider.lider.activo, true)

  // Mientras tenga usuarios (el encargado), el área no se puede eliminar
  const bloqueada = await req('DELETE', `/api/areas/${creada.json.data.id}`, token)
  assert.equal(bloqueada.status, 409)
  assert.match(bloqueada.json.message, /No se puede eliminar/i)

  // Retirado el encargado, ya se puede editar y eliminar el área
  await prisma.usuario.deleteMany({ where: { email: EMAIL_ENCARGADO } })
  const editada = await req('PUT', `/api/areas/${creada.json.data.id}`, token, {
    nombre: 'Área temporal editada',
  })
  assert.equal(editada.status, 200)
  assert.equal(editada.json.data.nombre, 'Área temporal editada')

  const eliminada = await req('DELETE', `/api/areas/${creada.json.data.id}`, token)
  assert.equal(eliminada.status, 200)
  assert.ok(!(await areasDe(token)).some((a) => a.codigo === CODIGO_TEMP), 'el área eliminada no debe aparecer')
})

test('POST con código, nombre o correo del encargado duplicado → 409', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const operativa = (await areasDe(token)).find((a) => a.parentId !== null)
  const encargadoNuevo = { nombre: 'Encargado Duplic', email: 'prueba.duplicado@acuasan.com', password: 'ClaveDuplic2026' }

  const porCodigo = await req('POST', '/api/areas', token, {
    codigo: operativa.codigo,
    nombre: 'Área irrepetible A',
    encargado: encargadoNuevo,
  })
  assert.equal(porCodigo.status, 409)
  assert.match(porCodigo.json.message, /código/i)

  const porNombre = await req('POST', '/api/areas', token, {
    codigo: 'ZZZ9',
    nombre: operativa.nombre,
    encargado: { ...encargadoNuevo, email: 'otro.duplicado@acuasan.com' },
  })
  assert.equal(porNombre.status, 409)
  assert.match(porNombre.json.message, /ya existe/i)

  const porCorreo = await req('POST', '/api/areas', token, {
    codigo: 'ZZZ8',
    nombre: 'Área irrepetible B',
    encargado: { nombre: 'Copia Gerencia', email: GERENCIA, password: 'ClaveDuplic2026' },
  })
  assert.equal(porCorreo.status, 409)
  assert.match(porCorreo.json.message, /ya existe un usuario/i)
})

test('POST con datos incompletos del área o del encargado → 400', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const encargadoNuevo = { nombre: 'Encargado Val', email: 'prueba.validacion@acuasan.com', password: 'ClaveVal2026' }

  // Datos del área
  assert.equal((await req('POST', '/api/areas', token, { nombre: 'Sin código', encargado: encargadoNuevo })).status, 400)
  assert.equal((await req('POST', '/api/areas', token, { codigo: 'SC1', encargado: encargadoNuevo })).status, 400)
  // Datos del encargado
  assert.equal((await req('POST', '/api/areas', token, { codigo: 'SE1', nombre: 'Sin encargado' })).status, 400)
  assert.equal(
    (await req('POST', '/api/areas', token, { codigo: 'SE2', nombre: 'Sin correo', encargado: { nombre: 'X', password: 'Y' } })).status,
    400,
  )
  assert.equal(
    (await req('POST', '/api/areas', token, { codigo: 'SE3', nombre: 'Sin clave', encargado: { nombre: 'X', email: 'x.y@acuasan.com' } })).status,
    400,
  )
})

test('crear área con encargado inactivo → se lista como inactivo y no puede entrar', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const creada = await req('POST', '/api/areas', token, {
    codigo: CODIGO_INACT,
    nombre: 'Área con encargado inactivo',
    encargado: { nombre: 'Encargado Inactivo', email: EMAIL_INACTIVO, password: 'ClaveInactiva2026', activo: false },
  })
  assert.equal(creada.status, 201)

  // El listado muestra al líder aunque esté inactivo, marcado como tal
  const nueva = (await areasDe(token)).find((a) => a.codigo === CODIGO_INACT)
  assert.equal(nueva.lider.email, EMAIL_INACTIVO)
  assert.equal(nueva.lider.activo, false)

  // La cuenta inactiva no puede iniciar sesión (403 del login)
  const intento = await login(EMAIL_INACTIVO, 'ClaveInactiva2026')
  assert.equal(intento.status, 403)

  // Limpieza del caso (el after() también lo cubre)
  await prisma.usuario.deleteMany({ where: { email: EMAIL_INACTIVO } })
  await prisma.area.deleteMany({ where: { codigo: CODIGO_INACT } })
})

test('el área líder no se puede editar ni eliminar → 400', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const raiz = (await areasDe(token)).find((a) => a.parentId === null)

  const put = await req('PUT', `/api/areas/${raiz.id}`, token, { nombre: 'Otro nombre' })
  assert.equal(put.status, 400)
  assert.match(put.json.message, /área líder/i)

  const del = await req('DELETE', `/api/areas/${raiz.id}`, token)
  assert.equal(del.status, 400)
  assert.match(del.json.message, /área líder/i)
})

test('DELETE de un área con usuarios asignados → 409', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  const ope = (await areasDe(token)).find((a) => a.codigo === 'OPE')
  assert.ok(ope, 'el seed debe traer el área OPE')

  const del = await req('DELETE', `/api/areas/${ope.id}`, token)
  assert.equal(del.status, 409)
  assert.match(del.json.message, /No se puede eliminar/i)
})

test('PUT/DELETE con id inexistente o mal formado → 404', { skip: !dbOk }, async () => {
  const token = await tokenDe(GERENCIA)
  assert.equal((await req('PUT', `/api/areas/${ID_FALSO}`, token, { nombre: 'Nadie' })).status, 404)
  assert.equal((await req('DELETE', '/api/areas/no-es-un-id', token)).status, 404)
})
