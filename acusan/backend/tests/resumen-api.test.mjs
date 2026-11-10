// Integración de GET /api/resumen por rol: gerencia ve el panorama de todas
// las áreas (sin porEncargado); el líder de área ve SOLO su área y el
// rendimiento de su equipo (porEncargado); un usuario del área ve los KPIs
// de su área sin el panel de equipo.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

// NODE_ENV=test ANTES de importar app.js para que no levante listener propio
process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: app } = await import('../src/app.js')
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
let encargadoOpeId = null // juan.valdez (USUARIO de OPE)
let gerencia = null // { token, id }
let liderOpe = null
let usuarioOpe = null

// Radicados que crea esta suite (se limpian en after) — dos para juan (uno
// vencido y uno respondido a tiempo) y uno pendiente para laura, todos de OPE
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
  encargadoOpeId = usuarioOpe.id

  const laura = await prisma.usuario.findFirst({
    where: { email: 'laura.martinez@acuasan.com' },
    select: { id: true },
  })

  if (areaOpeId && encargadoOpeId && laura) {
    const propios = [
      // Vencido hace 2 días, pendiente, encargado juan
      { numero: 'RES-T-VENCIDO', limite: enDias(-2), encargadoId: encargadoOpeId, estado: 'PENDIENTE' },
      // Respondido a tiempo, encargado juan
      {
        numero: 'RES-T-ATIEMPO',
        limite: enDias(3),
        encargadoId: encargadoOpeId,
        estado: 'RESPONDIDO',
        resultado: 'A_TIEMPO',
      },
      // Por vencer en 5 días, pendiente, encargado laura
      { numero: 'RES-T-PORVENCER', limite: enDias(5), encargadoId: laura.id, estado: 'PENDIENTE' },
    ]
    for (const p of propios) {
      const radicado = await prisma.radicado.create({
        data: {
          numeroRadicado: p.numero,
          asunto: `Resumen ${p.numero}`,
          descripcion: 'Radicado de prueba del resumen por rol',
          remitente: 'Suite de tests',
          tipo: 'Interno',
          categoria: 'General',
          prioridad: 'MEDIA',
          fechaRadicacion: enDias(-10),
          fechaLimite: p.limite,
          areaId: areaOpeId,
          encargadoId: p.encargadoId,
          creadoPorId: gerencia.id,
          estado: p.estado,
          ...(p.estado === 'RESPONDIDO'
            ? { respondidoEn: enDias(-1), respondidoPorId: p.encargadoId, resultadoRespuesta: p.resultado }
            : {}),
        },
      })
      PROPIOS.push(radicado.id)
    }
  }
})

after(async () => {
  if (dbOk && PROPIOS.length) {
    await prisma.alerta.deleteMany({ where: { radicadoId: { in: [...PROPIOS] } } })
    await prisma.radicadoEvento.deleteMany({ where: { radicadoId: { in: [...PROPIOS] } } })
    await prisma.radicado.deleteMany({ where: { id: { in: [...PROPIOS] } } })
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

async function resumen(token) {
  const res = await fetch(`${base}/api/resumen`, {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(res.status, 200, `GET /api/resumen falló (${res.status})`)
  const json = await res.json()
  assert.ok(json.success, `GET /api/resumen respondió con error: ${json.message}`)
  return json.data
}

test('la API de resumen exige sesión', async () => {
  if (!dbOk) return
  const res = await fetch(`${base}/api/resumen`)
  assert.equal(res.status, 401)
})

test('gerencia ve todas las áreas y sin panel de equipo', async () => {
  if (!dbOk || !areaOpeId) return
  const data = await resumen(gerencia.token)

  // KPIs globales: el total es el conteo real de radicados en la base
  const totalReal = await prisma.radicado.count()
  assert.equal(data.kpis.total, totalReal)

  // El ranking de áreas trae las que tienen radicados y entre ellas OPE
  assert.ok(Array.isArray(data.areas) && data.areas.length > 0)
  assert.ok(data.areas.some((a) => a.id === areaOpeId))

  // La herramienta por encargado es del líder de área, no de gerencia
  assert.equal('porEncargado' in data, false)
})

test('el líder de área ve SOLO su área con el rendimiento del equipo', async () => {
  if (!dbOk || !areaOpeId || PROPIOS.length < 3) return

  const data = await resumen(liderOpe.token)

  // KPIs recortados al área OPE y con los radicados propios de la suite
  const [totalOpe, vencidosOpe, aTiempoOpe] = await Promise.all([
    prisma.radicado.count({ where: { areaId: areaOpeId } }),
    prisma.radicado.count({
      where: { areaId: areaOpeId, estado: 'PENDIENTE', fechaLimite: { lt: enDias(0) } },
    }),
    prisma.radicado.count({
      where: { areaId: areaOpeId, estado: 'RESPONDIDO', resultadoRespuesta: 'A_TIEMPO' },
    }),
  ])
  assert.equal(data.kpis.total, totalOpe)
  assert.equal(data.kpis.vencidos, vencidosOpe)
  assert.equal(data.kpis.respondidosATiempo, aTiempoOpe)

  // El ranking de áreas solo puede contener OPE (si tiene radicados)
  for (const a of data.areas || []) assert.equal(a.id, areaOpeId)

  // Panel de equipo: una fila por encargado con sus conteos
  assert.ok(Array.isArray(data.porEncargado) && data.porEncargado.length > 0)

  const juan = data.porEncargado.find((e) => e.id === encargadoOpeId)
  assert.ok(juan, 'el encargado juan no aparece en porEncargado')
  assert.equal(
    juan.vencidos,
    await prisma.radicado.count({
      where: { areaId: areaOpeId, encargadoId: encargadoOpeId, estado: 'PENDIENTE', fechaLimite: { lt: enDias(0) } },
    }),
  )
  assert.equal(juan.entregadosATiempo >= 1, true)

  // La suma de totales del equipo cubre todos los radicados del área
  const sumaEquipo = data.porEncargado.reduce((s, e) => s + e.total, 0)
  assert.equal(sumaEquipo, totalOpe)
})

test('un usuario del área ve los KPIs de su área pero sin panel de equipo', async () => {
  if (!dbOk || !areaOpeId) return
  const data = await resumen(usuarioOpe.token)

  const totalOpe = await prisma.radicado.count({ where: { areaId: areaOpeId } })
  assert.equal(data.kpis.total, totalOpe)
  assert.equal('porEncargado' in data, false)
})
