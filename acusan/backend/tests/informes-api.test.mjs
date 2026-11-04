// Integración del módulo de INFORMES periódicos (F9): solo gerencia,
// generación manual/último cerrado, foto inmutable, idempotencia del
// cierre automático, aviso interno, revisión, comparación y Excel.
//
// La suite usa semanas de 2024 (vacías de movimiento) para tener periodos
// cerrados 100 % controlables sin tocar el reloj, y limpia TODOS los
// informes/avisos al terminar: la BD queda lista para empezar de cero.

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
const { hoyBogota, medianocheBogotaDe } = await import('../src/utils/fechas.js')
const { guardarInforme } = await import('../src/services/informes.js')


// Usuarios del seed (npm run db:seed) — el dominio se arma por partes a
// propósito: la grafía correcta lleva UNA sola u y escribirlo literal
// invita al error de la doble u (que no existe en la BD).
const PASSWORD = 'acuasan2026'
const DOMINIO = 'ac' + 'u' + 'asan.com'
const GERENCIA = 'gerencia@' + DOMINIO // LIDER_GENERAL
const LIDER_OPE = 'lider.operativo@' + DOMINIO // LIDER_AREA (OPE)
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
let liderOpe = null
let usuarioOpe = null
let areaOpeId = null

// Lunes de una semana de 2024 vacía y su anterior, para periodos cerrados
const SEMANA_VACIA = '2024-06-10'
const RADICADOS_PROPIOS = []

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

  // Estado limpio para la semana de pruebas (por si una corrida anterior murió)
  await prisma.avisoInterno.deleteMany({ where: { tipo: 'FIN_SEMANA', periodoInicio: medianocheBogotaDe(SEMANA_VACIA) } })
  await prisma.informe.deleteMany({ where: { tipo: 'SEMANAL', periodoInicio: medianocheBogotaDe(SEMANA_VACIA) } })
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
    // Los informes son fotos derivadas: la suite deja la colección vacía
    // (incluidos los que pueda haber dejado el cron de otras suites).
    await prisma.avisoInterno.deleteMany({})
    await prisma.informe.deleteMany({})
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

test('la API de informes exige sesión; cierres y avisos son solo de gerencia', async () => {
  if (!dbOk) return
  assert.equal((await llamar('/api/informes', { token: null })).status, 401)

  // Líder de área: puede LEER informes (el servidor fuerza su área), pero
  // no generar, sincronizar ni ver avisos (solo gerencia).
  assert.equal((await llamar('/api/informes', { token: liderOpe.token })).status, 200)
  assert.equal((await llamar('/api/informes/generar', { metodo: 'POST', token: liderOpe.token, cuerpo: { tipo: 'semanal' } })).status, 403)
  assert.equal((await llamar('/api/informes/sincronizar', { metodo: 'POST', token: liderOpe.token })).status, 403)
  assert.equal((await llamar('/api/avisos', { token: liderOpe.token })).status, 403)

  // Usuario de área: 403 en todo el módulo.
  for (const ruta of ['/api/informes', '/api/avisos']) {
    assert.equal((await llamar(ruta, { token: usuarioOpe.token })).status, 403)
  }
  assert.equal(
    (await llamar('/api/informes/generar', { metodo: 'POST', token: usuarioOpe.token, cuerpo: { tipo: 'semanal' } })).status,
    403,
  )
  assert.equal((await llamar('/api/informes/sincronizar', { metodo: 'POST', token: usuarioOpe.token })).status, 403)

  assert.equal((await llamar('/api/informes', { token: gerencia.token })).status, 200)
})

test('generar sin periodo toma el último cerrado; validaciones de entrada', async () => {
  if (!dbOk) return
  // Puede no haber periodos cerrados si la BD está sin radicados: el seed
  // garantiza radicados con semanas de antigüedad, así que aquí siempre hay.
  const res = await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'semanal' } })
  assert.ok(res.ok, `generar falló: ${res.status}`)
  const json = await res.json()
  assert.ok(json.success)
  assert.equal(json.data.parcial, false, 'sin periodoInicio nunca es parcial')
  assert.match(json.data.etiqueta, /Semana .+ días hábiles/)

  assert.equal(
    (await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'anual' } })).status,
    400,
  )
  assert.equal(
    (await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'semanal', periodoInicio: 'mañana' } })).status,
    400,
  )
  // Futuro: una semana a partir de dentro de 14 días aún no empieza
  const futuro = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  assert.equal(
    (await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'semanal', periodoInicio: futuro } })).status,
    400,
  )
})

test('periodo vacío: cero en todo y cumplimiento null (semana de 2024)', async () => {
  if (!dbOk) return
  const res = await llamar('/api/informes/generar', {
    metodo: 'POST',
    cuerpo: { tipo: 'semanal', periodoInicio: SEMANA_VACIA },
  })
  assert.equal(res.status, 201)
  const json = await res.json()
  const i = json.data
  assert.equal(i.parcial, false)
  assert.equal(i.ingresados, 0)
  assert.equal(i.respondidos, 0)
  assert.equal(i.cumplimiento, null)
  assert.equal(i.vencidosAlCierre, 0)
  assert.equal(i.respondidosNoHabil, 0)
  assert.ok(Number.isInteger(i.diasHabiles) && i.diasHabiles >= 4)
  assert.equal(i.regeneradoEn, null, 'primera generación, no regenerado')
  assert.ok(Array.isArray(i.porDia) && i.porDia.length === 7)
})

test('el informe es una FOTO: editar radicados no lo cambia hasta regenerar', async () => {
  if (!dbOk) return
  const informe = await prisma.informe.findUnique({
    where: {
      tipo_periodoInicio_alcance: {
        tipo: 'SEMANAL',
        periodoInicio: medianocheBogotaDe(SEMANA_VACIA),
        alcance: 'global',
      },
    },
  })
  assert.ok(informe, 'el informe de la semana vacía existe')

  // Un radicado radicado DENTRO de esa semana antigua (directo en BD)
  const nuevo = await prisma.radicado.create({
    data: {
      numeroRadicado: `RAD-INF-${Date.now()}`,
      asunto: 'Radicado histórico para la foto',
      descripcion: 'Creado por la suite de informes',
      remitente: 'Suite de tests',
      tipo: 'Interno',
      categoria: 'General',
      prioridad: 'MEDIA',
      fechaRadicacion: medianocheBogotaDe('2024-06-12'),
      fechaLimite: medianocheBogotaDe('2024-06-20'),
      areaId: areaOpeId,
      encargadoId: usuarioOpe.id,
      creadoPorId: gerencia.id,
    },
  })
  RADICADOS_PROPIOS.push(nuevo.id)

  const sinCambiar = await prisma.informe.findUnique({ where: { id: informe.id } })
  assert.equal(sinCambiar.ingresados, 0, 'la foto guardada no cambia sola')

  // Regenerar el mismo periodo: ahora la foto sí refleja el radicado
  const reg = await llamar('/api/informes/generar', {
    metodo: 'POST',
    cuerpo: { tipo: 'semanal', periodoInicio: SEMANA_VACIA },
  })
  assert.equal(reg.status, 200, 'la segunda generación actualiza, no duplica')
  const regenerado = (await reg.json()).data
  assert.equal(regenerado.id, informe.id)
  assert.equal(regenerado.ingresados, 1)
  assert.ok(regenerado.regeneradoEn)

  // Sigue habiendo UN solo informe de ese periodo
  const cuantos = await prisma.informe.count({
    where: { tipo: 'SEMANAL', periodoInicio: medianocheBogotaDe(SEMANA_VACIA) },
  })
  assert.equal(cuantos, 1)
})

test('revisar marca el informe, atiende su aviso y el revisadoEn sobrevive regeneraciones', async () => {
  if (!dbOk) return
  // Aviso nace del cierre automático (guardarInforme con crearAviso)
  const informe = await guardarInforme(null, 'semanal', medianocheBogotaDe(SEMANA_VACIA), 'AUTOMATICO', { crearAviso: true })
  const aviso = await prisma.avisoInterno.findUnique({
    where: { tipo_periodoInicio: { tipo: 'FIN_SEMANA', periodoInicio: medianocheBogotaDe(SEMANA_VACIA) } },
  })
  assert.ok(aviso, 'el cierre automático crea el aviso')
  assert.equal(aviso.informeId, informe.id)
  assert.equal(aviso.atendido, false)
  assert.match(aviso.mensaje, /^Semana .*: \d+ respondidos \(\d+ a tiempo, \d+ con retraso\), \d+ vencidos al cierre$/)

  const res = await llamar(`/api/informes/${informe.id}/revisar`, { metodo: 'POST' })
  assert.ok(res.ok)
  const revisado = (await res.json()).data
  assert.ok(revisado.revisadoEn)
  assert.equal(revisado.revisadoPorId, gerencia.id)

  const avisoAtendido = await prisma.avisoInterno.findUnique({ where: { id: aviso.id } })
  assert.equal(avisoAtendido.atendido, true, 'revisar el informe atiende el aviso')
  assert.ok(avisoAtendido.atendidoEn)

  // Regenerar NO toca revisadoEn y el aviso sigue único
  await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'semanal', periodoInicio: SEMANA_VACIA } })
  const despues = await prisma.informe.findUnique({ where: { id: informe.id } })
  assert.equal(despues.revisadoEn.getTime(), new Date(revisado.revisadoEn).getTime())
  assert.equal(await prisma.avisoInterno.count({ where: { tipo: 'FIN_SEMANA', periodoInicio: medianocheBogotaDe(SEMANA_VACIA) } }), 1)

  // Repetir revisar es idempotente
  const deNuevo = await llamar(`/api/informes/${informe.id}/revisar`, { metodo: 'POST' })
  assert.ok(deNuevo.ok)
})

test('generar el periodo en curso produce un parcial', async () => {
  if (!dbOk) return
  const hoy = hoyBogota()
  const res = await llamar('/api/informes/generar', { metodo: 'POST', cuerpo: { tipo: 'semanal', periodoInicio: hoy } })
  assert.ok(res.ok, `generar hoy falló: ${res.status}`)
  const json = await res.json()
  assert.equal(json.data.parcial, true)
})

test('sincronizar es idempotente: dos corridas no crean ni duplican nada', async () => {
  if (!dbOk) return
  const primera = await llamar('/api/informes/sincronizar', { metodo: 'POST' })
  assert.ok(primera.ok)
  const entreCorridas = {
    informes: await prisma.informe.count(),
    avisos: await prisma.avisoInterno.count(),
  }
  const segunda = await llamar('/api/informes/sincronizar', { metodo: 'POST' })
  assert.ok(segunda.ok)
  const datos = (await segunda.json()).data
  assert.equal(datos.informesCreados, 0, 'la segunda corrida no crea informes')
  assert.equal(datos.informesActualizados, 0, 'ni actualiza parciales')
  assert.deepEqual(
    { informes: await prisma.informe.count(), avisos: await prisma.avisoInterno.count() },
    entreCorridas,
    'ni informes ni avisos cambian',
  )
})

test('el listado y el detalle con comparación contra el periodo anterior', async () => {
  if (!dbOk) return
  const lista = await llamar('/api/informes?tipo=semanal&limite=5')
  assert.ok(lista.ok)
  const informes = (await lista.json()).data
  assert.ok(Array.isArray(informes) && informes.length >= 1)
  assert.ok(informes.every((i) => i.tipo === 'SEMANAL'))
  assert.ok(informes.every((i) => i.porArea === undefined && i.porDia === undefined), 'la lista no arrastra los Json pesados')

  const detalle = await llamar(`/api/informes/${informes[0].id}`)
  assert.ok(detalle.ok)
  const d = (await detalle.json()).data
  assert.ok(d.comparacion.anterior.etiqueta, 'la comparación trae la etiqueta del anterior')
  assert.ok(Number.isInteger(d.comparacion.diferencias.respondidos))
  assert.ok(Array.isArray(d.porArea) && d.porArea.length >= 1)
  assert.ok(Array.isArray(d.criticos))
  assert.ok(Array.isArray(d.porDia))

  assert.equal((await llamar('/api/informes/aabbccddeeff001122334455')).status, 404)
})

test('el Excel trae las tres hojas (Resumen, Por área, Críticos)', async () => {
  if (!dbOk) return
  const lista = (await (await llamar('/api/informes?limite=1')).json()).data
  assert.ok(lista.length, 'debe haber al menos un informe')
  const res = await llamar(`/api/informes/${lista[0].id}/excel`)
  assert.equal(res.status, 200)
  assert.ok(res.headers.get('content-type').includes('spreadsheetml'))
  const buf = Buffer.from(await res.arrayBuffer())
  assert.equal(buf[0], 0x50, 'un xlsx abre con PK')
  assert.equal(buf[1], 0x4b)

  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buf)
  assert.deepEqual(
    libro.worksheets.map((h) => h.name),
    ['Resumen', 'Por área', 'Críticos'],
  )
})

test('los avisos se listan y se atienden por separado', async () => {
  if (!dbOk) return
  const res = await llamar('/api/avisos')
  assert.ok(res.ok)
  const { avisos, pendientes } = (await res.json()).data
  assert.ok(Array.isArray(avisos))
  assert.ok(Number.isInteger(pendientes))
  if (avisos.length) {
    const alguno = avisos[0]
    const atender = await llamar(`/api/avisos/${alguno.id}/atender`, { metodo: 'POST' })
    assert.ok(atender.ok)
    const otraVez = await llamar(`/api/avisos/${alguno.id}/atender`, { metodo: 'POST' })
    assert.ok(otraVez.ok, 'atender dos veces no es error')
  }
  assert.equal((await llamar('/api/avisos/aabbccddeeff001122334455/atender', { metodo: 'POST' })).status, 404)
})
