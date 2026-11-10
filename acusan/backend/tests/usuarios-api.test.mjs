// Integración: administración de cuentas (/api/usuarios), autorregistro con
// aprobación, contraseña temporal obligatoria, recuperación por correo,
// bloqueo por intentos y cierre de sesiones (cuentaVigente).
// Se salta si la base no es alcanzable. Los correos van a la bandeja en
// memoria (NODE_ENV=test).

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: app } = await import('../src/app.js')
const { default: prisma } = await import('../src/config/prisma.js')
const { bandejaPrueba } = await import('../src/services/correo.js')
const { invalidarCuenta } = await import('../src/middlewares/auth.middleware.js')
const { enDias } = await import('../src/utils/fechas.js')

const PASSWORD = 'acuasan2026'
const GERENCIA = 'gerencia@acuasan.com'
const LIDER_OPE = 'lider.operativo@acuasan.com'
const JUAN = 'juan.valdez@acuasan.com'

// Todas las cuentas de la suite usan este prefijo (limpieza en after)
const SUFIJO = Date.now().toString(36)
const correoPrueba = (n) => `qa.usuarios.${n}.${SUFIJO}@acuasan.com`
const DESCRIPCION_PRUEBA = 'Radicado de prueba de la suite de usuarios.'

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
let OPE = null
let COM = null
let tokGerencia = null
let tokLider = null

before(async () => {
  if (!dbOk) return
  await new Promise((r) => {
    servidor = app.listen(0, '127.0.0.1', r)
  })
  base = `http://127.0.0.1:${servidor.address().port}`
  OPE = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  COM = await prisma.area.findUnique({ where: { codigo: 'COM' } })
  tokGerencia = await login(GERENCIA)
  tokLider = await login(LIDER_OPE)
})

after(async () => {
  if (dbOk) {
    const radicados = (
      await prisma.radicado.findMany({ select: { id: true, descripcion: true } })
    ).filter((r) => r.descripcion === DESCRIPCION_PRUEBA)
    const ids = radicados.map((r) => r.id)
    if (ids.length) {
      await prisma.alerta.deleteMany({ where: { radicadoId: { in: ids } } })
      await prisma.radicadoEvento.deleteMany({ where: { radicadoId: { in: ids } } })
      await prisma.radicado.deleteMany({ where: { id: { in: ids } } })
    }
    const cuentas = await prisma.usuario.findMany({
      where: { email: { startsWith: 'qa.usuarios.' } },
      select: { id: true },
    })
    if (cuentas.length) {
      await prisma.registroAcceso.deleteMany({ where: { usuarioId: { in: cuentas.map((c) => c.id) } } })
      await prisma.usuario.deleteMany({ where: { id: { in: cuentas.map((c) => c.id) } } })
    }
    // Desbloqueo por si una corrida anterior dejó bloqueado a Juan
    await prisma.usuario.update({
      where: { email: JUAN },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    })
  }
  if (servidor) {
    if (typeof servidor.closeAllConnections === 'function') servidor.closeAllConnections()
    await new Promise((r) => servidor.close(r))
  }
  await prisma.$disconnect()
})

async function api(metodo, path, token, cuerpo) {
  const res = await fetch(base + path, {
    method: metodo,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cuerpo ? { 'content-type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, json }
}

async function loginCon(email, password) {
  return api('POST', '/api/auth/login', null, { email, password })
}

async function login(email, password = PASSWORD) {
  const { json } = await loginCon(email, password)
  assert.ok(json?.success, `login falló para ${email}: ${json?.message}`)
  return json.data.token
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const tokenDelCorreo = (para) => {
  const msg = [...bandejaPrueba].reverse().find((m) => m.para.includes(para))
  assert.ok(msg, `no llegó correo a ${para}`)
  const m = msg.texto.match(/restablecer\?token=([A-Za-z0-9_\-%]+)/)
  assert.ok(m, 'el correo debe traer el enlace de restablecimiento')
  return decodeURIComponent(m[1])
}

test('opciones públicas del login informan si hay correo', async () => {
  if (!dbOk) return
  const { status, json } = await api('GET', '/api/auth/opciones')
  assert.equal(status, 200)
  assert.equal(json.data.correoHabilitado, true) // modo prueba
})

test('listar: gerencia ve todas las áreas, el líder solo su área, el usuario nada', async () => {
  if (!dbOk) return
  const g = await api('GET', '/api/usuarios', tokGerencia)
  assert.equal(g.status, 200)
  const areas = new Set(g.json.data.usuarios.map((u) => u.area?.codigo))
  assert.ok(areas.has('OPE') && areas.has('COM'))
  const juan = g.json.data.usuarios.find((u) => u.email === JUAN)
  assert.ok(Number.isInteger(juan.radicadosPendientes))
  assert.equal(juan.estado, 'activo')
  assert.equal(g.json.data.usuarios.some((u) => 'passwordHash' in u), false, 'nunca expone el hash')

  const l = await api('GET', '/api/usuarios', tokLider)
  assert.equal(l.status, 200)
  assert.ok(l.json.data.usuarios.length > 0)
  assert.ok(l.json.data.usuarios.every((u) => u.areaId === OPE.id))

  const tokJuan = await login(JUAN)
  assert.equal((await api('GET', '/api/usuarios', tokJuan)).status, 403)
  assert.equal((await api('GET', '/api/usuarios')).status, 401)
})

test('crear: el líder crea usuarios SOLO en su área; gerencia elige área y rol', async () => {
  if (!dbOk) return
  const email = correoPrueba('lider-crea')
  const r = await api('POST', '/api/usuarios', tokLider, { nombre: 'QA Operario', email, areaId: COM.id })
  assert.equal(r.status, 201, r.json?.message)
  assert.equal(r.json.data.usuario.areaId, OPE.id, 'el área la fija el token del líder')
  assert.equal(r.json.data.usuario.rol, 'USUARIO')
  assert.equal(r.json.data.usuario.debeCambiarPassword, true)
  assert.match(r.json.data.passwordTemporal, /^[A-Za-z]{4}-\d{4}-[A-Za-z]{2}$/)
  assert.equal(r.json.data.invitacionEnviada, true)
  tokenDelCorreo(email) // la invitación trae el enlace para crear la contraseña

  const lider = await api('POST', '/api/usuarios', tokLider, {
    nombre: 'QA Otro líder', email: correoPrueba('lider-lider'), rol: 'LIDER_AREA',
  })
  assert.equal(lider.status, 403)

  const dup = await api('POST', '/api/usuarios', tokGerencia, { nombre: 'Dup', email, rol: 'USUARIO', areaId: COM.id })
  assert.equal(dup.status, 409)
  const mal = await api('POST', '/api/usuarios', tokGerencia, { nombre: 'Mal', email: 'no-es-correo', rol: 'USUARIO', areaId: COM.id })
  assert.equal(mal.status, 400)
  const segundoLider = await api('POST', '/api/usuarios', tokGerencia, {
    nombre: 'QA Segundo líder', email: correoPrueba('segundo-lider'), rol: 'LIDER_AREA', areaId: OPE.id,
  })
  assert.equal(segundoLider.status, 409, 'un área tiene un solo líder activo')
  assert.match(segundoLider.json.message, /ya tiene como líder/)

  const enCom = await api('POST', '/api/usuarios', tokGerencia, {
    nombre: 'QA Comercial', email: correoPrueba('gerencia-crea'), rol: 'USUARIO', areaId: COM.id, password: 'Inicial2026',
  })
  assert.equal(enCom.status, 201)
  assert.equal(enCom.json.data.usuario.areaId, COM.id)
  const debil = await api('POST', '/api/usuarios', tokGerencia, {
    nombre: 'QA Débil', email: correoPrueba('debil'), rol: 'USUARIO', areaId: COM.id, password: 'corta',
  })
  assert.equal(debil.status, 400)
})

test('contraseña temporal: obliga a cambiarla y el cambio cierra las sesiones viejas', async () => {
  if (!dbOk) return
  const email = correoPrueba('temporal')
  const creado = await api('POST', '/api/usuarios', tokLider, { nombre: 'QA Temporal', email })
  const temporal = creado.json.data.passwordTemporal

  const ingreso = await loginCon(email, temporal)
  assert.equal(ingreso.status, 200)
  assert.equal(ingreso.json.data.usuario.debeCambiarPassword, true)
  const tokTemporal = ingreso.json.data.token

  const bloqueado = await api('GET', '/api/radicados', tokTemporal)
  assert.equal(bloqueado.status, 403)
  assert.equal(bloqueado.json.codigo, 'DEBE_CAMBIAR_PASSWORD')
  const me = await api('GET', '/api/me', tokTemporal)
  assert.equal(me.status, 200)
  assert.equal(me.json.data.debeCambiarPassword, true)

  assert.equal((await api('POST', '/api/me/password', tokTemporal, { actual: 'otra', nueva: 'Nueva2026x' })).status, 400)
  assert.equal((await api('POST', '/api/me/password', tokTemporal, { actual: temporal, nueva: 'sololetras' })).status, 400)

  await espera(1100) // el token viejo debe ser de un segundo anterior
  const cambio = await api('POST', '/api/me/password', tokTemporal, { actual: temporal, nueva: 'Nueva2026x' })
  assert.equal(cambio.status, 200, cambio.json?.message)
  const tokNuevo = cambio.json.data.token
  assert.equal(cambio.json.data.usuario.debeCambiarPassword, false)

  assert.equal((await api('GET', '/api/radicados', tokNuevo)).status, 200)
  const viejo = await api('GET', '/api/radicados', tokTemporal)
  assert.equal(viejo.status, 401)
  assert.equal(viejo.json.codigo, 'SESION_CERRADA')
  assert.equal((await loginCon(email, 'Nueva2026x')).status, 200)
})

test('invitación por correo: el enlace crea la contraseña y sirve una sola vez', async () => {
  if (!dbOk) return
  const email = correoPrueba('invitacion')
  await api('POST', '/api/usuarios', tokLider, { nombre: 'QA Invitada', email })
  const token = tokenDelCorreo(email)

  assert.equal((await api('POST', '/api/auth/restablecer', null, { token, password: 'abc' })).status, 400)
  const ok = await api('POST', '/api/auth/restablecer', null, { token, password: 'Propia2026' })
  assert.equal(ok.status, 200, ok.json?.message)
  const ingreso = await loginCon(email, 'Propia2026')
  assert.equal(ingreso.status, 200)
  assert.equal(ingreso.json.data.usuario.debeCambiarPassword, false)

  const otraVez = await api('POST', '/api/auth/restablecer', null, { token, password: 'Otra2026xx' })
  assert.equal(otraVez.status, 400)
  assert.equal((await api('POST', '/api/auth/restablecer', null, { token: 'inventado', password: 'Otra2026xx' })).status, 400)
})

test('recuperar contraseña: misma respuesta exista o no la cuenta; el enlace llega solo a cuentas reales', async () => {
  if (!dbOk) return
  const email = correoPrueba('recupera')
  const creado = await api('POST', '/api/usuarios', tokGerencia, {
    nombre: 'QA Recupera', email, rol: 'USUARIO', areaId: OPE.id, password: 'Inicial2026',
  })
  assert.equal(creado.status, 201)
  const antes = bandejaPrueba.length
  const real = await api('POST', '/api/auth/recuperar-password', null, { email })
  const falso = await api('POST', '/api/auth/recuperar-password', null, { email: correoPrueba('no-existe') })
  assert.equal(real.status, 200)
  assert.equal(falso.status, 200)
  assert.equal(real.json.message, falso.json.message)
  assert.equal(bandejaPrueba.length, antes + 1, 'solo la cuenta real recibe correo')
  const token = tokenDelCorreo(email)
  assert.equal((await api('POST', '/api/auth/restablecer', null, { token, password: 'Recuperada26' })).status, 200)
  assert.equal((await loginCon(email, 'Recuperada26')).status, 200)
})

test('desactivar a quien tiene pendientes exige reasignarlos; su sesión se cierra al instante', async () => {
  if (!dbOk) return
  const email = correoPrueba('saliente')
  const creado = await api('POST', '/api/usuarios', tokGerencia, {
    nombre: 'QA Saliente', email, rol: 'USUARIO', areaId: OPE.id, password: 'Saliente2026',
  })
  const id = creado.json.data.usuario.id
  // Sale del modo "debe cambiar" para poder usar la API
  const tok1 = (await loginCon(email, 'Saliente2026')).json.data.token
  await espera(1100)
  const tokSaliente = (await api('POST', '/api/me/password', tok1, { actual: 'Saliente2026', nueva: 'Saliente2027' })).json.data.token

  const gerencia = await prisma.usuario.findUnique({ where: { email: GERENCIA } })
  const juan = await prisma.usuario.findUnique({ where: { email: JUAN } })
  const radicado = await prisma.radicado.create({
    data: {
      numeroRadicado: `RAD-QAU-${SUFIJO}`,
      asunto: 'Prueba de reasignación',
      descripcion: DESCRIPCION_PRUEBA,
      remitente: 'Suite de usuarios',
      tipo: 'Oficio',
      categoria: 'Pruebas',
      prioridad: 'MEDIA',
      fechaRadicacion: enDias(-1),
      fechaLimite: enDias(20),
      areaId: OPE.id,
      encargadoId: id,
      creadoPorId: gerencia.id,
    },
  })

  const sinDestino = await api('PUT', `/api/usuarios/${id}`, tokLider, { activo: false })
  assert.equal(sinDestino.status, 409)
  assert.equal(sinDestino.json.codigo, 'TIENE_PENDIENTES')
  assert.equal(sinDestino.json.pendientes, 1)

  const destinoMalo = await api('PUT', `/api/usuarios/${id}`, tokLider, { activo: false, reasignarA: gerencia.id })
  assert.equal(destinoMalo.status, 400, 'el destino debe ser de la misma área')

  const ok = await api('PUT', `/api/usuarios/${id}`, tokLider, { activo: false, reasignarA: juan.id })
  assert.equal(ok.status, 200, ok.json?.message)
  assert.equal(ok.json.data.reasignados, 1)
  assert.equal(ok.json.data.usuario.estado, 'inactivo')

  const movido = await prisma.radicado.findUnique({ where: { id: radicado.id } })
  assert.equal(movido.encargadoId, juan.id)
  const evento = await prisma.radicadoEvento.findFirst({ where: { radicadoId: radicado.id, tipo: 'ASIGNADO' } })
  assert.match(evento.detalle, /Juan David Valdez/)
  assert.equal(await prisma.alerta.count({ where: { radicadoId: radicado.id, nivel: 'NUEVO' } }), 1)

  const cerrado = await api('GET', '/api/radicados', tokSaliente)
  assert.equal(cerrado.status, 401)
  assert.equal(cerrado.json.codigo, 'CUENTA_INACTIVA')
  assert.equal((await loginCon(email, 'Saliente2027')).status, 403)

  const reactivar = await api('PUT', `/api/usuarios/${id}`, tokLider, { activo: true })
  assert.equal(reactivar.status, 200)
  assert.equal((await loginCon(email, 'Saliente2027')).status, 200)
})

test('reglas: nadie se desactiva ni se cambia el rol a sí mismo; el líder no toca otras áreas ni roles', async () => {
  if (!dbOk) return
  const yo = await prisma.usuario.findUnique({ where: { email: GERENCIA } })
  assert.equal((await api('PUT', `/api/usuarios/${yo.id}`, tokGerencia, { activo: false })).status, 400)
  assert.equal((await api('PUT', `/api/usuarios/${yo.id}`, tokGerencia, { rol: 'USUARIO' })).status, 400)

  const deCom = await prisma.usuario.findFirst({ where: { areaId: COM.id, rol: 'USUARIO' } })
  assert.equal((await api('PUT', `/api/usuarios/${deCom.id}`, tokLider, { nombre: 'X' })).status, 403)
  const juan = await prisma.usuario.findUnique({ where: { email: JUAN } })
  assert.equal((await api('PUT', `/api/usuarios/${juan.id}`, tokLider, { rol: 'LIDER_AREA' })).status, 403)
  assert.equal((await api('PUT', `/api/usuarios/${juan.id}`, tokLider, { areaId: COM.id })).status, 403)
  assert.equal((await api('GET', `/api/usuarios/${'f'.repeat(24)}`, tokGerencia)).status, 404)

  const edit = await api('PUT', `/api/usuarios/${juan.id}`, tokLider, { nombre: 'Juan David Valdez' })
  assert.equal(edit.status, 200)
})

test('restablecer contraseña (líder → su usuario): temporal nueva y sesiones viejas cerradas', async () => {
  if (!dbOk) return
  const email = correoPrueba('reset')
  const creado = await api('POST', '/api/usuarios', tokLider, { nombre: 'QA Reset', email, password: 'Primera2026' })
  const id = creado.json.data.usuario.id
  const tokViejo = (await loginCon(email, 'Primera2026')).json.data.token

  await espera(1100)
  const r = await api('POST', `/api/usuarios/${id}/restablecer-password`, tokLider)
  assert.equal(r.status, 200, r.json?.message)
  const temporal = r.json.data.passwordTemporal
  assert.equal((await api('GET', '/api/me', tokViejo)).status, 401)
  assert.equal((await loginCon(email, 'Primera2026')).status, 401)
  const nuevo = await loginCon(email, temporal)
  assert.equal(nuevo.status, 200)
  assert.equal(nuevo.json.data.usuario.debeCambiarPassword, true)

  const yo = await prisma.usuario.findUnique({ where: { email: LIDER_OPE } })
  assert.equal((await api('POST', `/api/usuarios/${yo.id}/restablecer-password`, tokLider)).status, 400)
})

test('autorregistro: queda pendiente, gerencia lo aprueba con área y rol, o lo rechaza', async () => {
  if (!dbOk) return
  const email = correoPrueba('registro')
  assert.equal((await api('POST', '/api/auth/registro', null, { nombre: 'QA', email, password: '123' })).status, 400)
  const reg = await api('POST', '/api/auth/registro', null, { nombre: 'QA Solicitante', email, password: 'Solicito2026', rol: 'LIDER_GENERAL' })
  assert.equal(reg.status, 201, reg.json?.message)
  assert.equal(reg.json.data.pendiente, true)

  const intento = await loginCon(email, 'Solicito2026')
  assert.equal(intento.status, 403)
  assert.match(intento.json.message, /pendiente de aprobación/)
  // con la contraseña mala no revela el estado de la cuenta
  assert.equal((await loginCon(email, 'Equivocada1')).status, 401)

  const lista = await api('GET', '/api/usuarios?estado=pendiente', tokGerencia)
  const solicitud = lista.json.data.usuarios.find((u) => u.email === email)
  assert.ok(solicitud)
  assert.equal(solicitud.estado, 'pendiente')
  assert.ok(lista.json.data.solicitudesPendientes >= 1)
  const delLider = await api('GET', '/api/usuarios', tokLider)
  assert.equal(delLider.json.data.usuarios.some((u) => u.email === email), false)
  assert.equal((await api('POST', `/api/usuarios/${solicitud.id}/aprobar`, tokLider, { areaId: OPE.id })).status, 403)

  const aprobado = await api('POST', `/api/usuarios/${solicitud.id}/aprobar`, tokGerencia, { areaId: OPE.id, rol: 'USUARIO' })
  assert.equal(aprobado.status, 200, aprobado.json?.message)
  assert.equal(aprobado.json.data.estado, 'activo')
  assert.equal(aprobado.json.data.areaId, OPE.id)
  const ya = await loginCon(email, 'Solicito2026')
  assert.equal(ya.status, 200)
  assert.equal(ya.json.data.usuario.rol, 'USUARIO', 'el rol pedido en el registro se ignora')

  const otro = correoPrueba('rechazo')
  await api('POST', '/api/auth/registro', null, { nombre: 'QA Rechazo', email: otro, password: 'Rechazo2026' })
  const fila = (await prisma.usuario.findUnique({ where: { email: otro } }))
  assert.equal((await api('DELETE', `/api/usuarios/${fila.id}`, tokGerencia)).status, 200)
  assert.equal(await prisma.usuario.count({ where: { email: otro } }), 0)
  const activo = await prisma.usuario.findUnique({ where: { email: JUAN } })
  assert.equal((await api('DELETE', `/api/usuarios/${activo.id}`, tokGerencia)).status, 400, 'las cuentas en uso no se borran')
})

test('bloqueo: 5 intentos fallidos bloquean la cuenta aunque luego llegue la contraseña correcta', async () => {
  if (!dbOk) return
  for (let i = 1; i <= 4; i++) assert.equal((await loginCon(JUAN, 'mala-' + i)).status, 401)
  const quinto = await loginCon(JUAN, 'mala-5')
  assert.equal(quinto.status, 429)
  assert.match(quinto.json.message, /bloqueada/)
  assert.equal((await loginCon(JUAN, PASSWORD)).status, 429)

  await prisma.usuario.update({ where: { email: JUAN }, data: { bloqueadoHasta: new Date(Date.now() - 1000) } })
  const ok = await loginCon(JUAN, PASSWORD)
  assert.equal(ok.status, 200)
  const fila = await prisma.usuario.findUnique({ where: { email: JUAN } })
  assert.equal(fila.intentosFallidos, 0)
  assert.ok(fila.ultimoAcceso, 'el acceso exitoso queda registrado')
  invalidarCuenta()
})
