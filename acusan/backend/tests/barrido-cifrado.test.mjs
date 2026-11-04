// Integración: lo que entra a la base POR FUERA de la aplicación (cliente sin
// cifrado, como un documento creado a mano en Atlas) queda cifrado tras el
// barrido automático, y la aplicación lo lee normal. Se salta sin base.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
await import('dotenv/config')

const { default: prisma, prismaSinCifrado: crudo } = await import('../src/config/prisma.js')
const { cifrarPendientes } = await import('../src/services/barridoCifrado.js')
const { indiceCiego } = await import('../src/lib/cifrado.js')

const NUMERO = `RAD-BARRIDO-${Date.now().toString(36)}`
const PDF = Buffer.from('%PDF-1.4\nMetido a mano por fuera de la app\n%%EOF\n')

let dbOk = false
try {
  await Promise.race([
    crudo.$connect(),
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('timeout')), 5000)),
  ])
  dbOk = true
} catch {
  dbOk = false
}

let radicadoId = null

before(async () => {
  if (!dbOk) return
  const area = await crudo.area.findUnique({ where: { codigo: 'OPE' } })
  const encargado = await crudo.usuario.findFirst({ where: { areaId: area.id, activo: true } })
  // Inserción SIN cifrado y SIN índice: simula un documento creado a mano
  const r = await crudo.radicado.create({
    data: {
      numeroRadicado: NUMERO,
      asunto: 'Asunto escrito a mano en Atlas',
      descripcion: 'Descripción a mano',
      remitente: 'Remitente a mano',
      tipo: 'Oficio',
      categoria: 'General',
      prioridad: 'BAJA',
      fechaRadicacion: new Date(),
      fechaLimite: new Date(Date.now() + 20 * 864e5),
      areaId: area.id,
      encargadoId: encargado.id,
      creadoPorId: encargado.id,
    },
  })
  radicadoId = r.id
  await crudo.adjunto.create({
    data: { radicadoId, tipo: 'RADICADO', nombreOriginal: 'a-mano.pdf', tamano: PDF.length, contenido: PDF, subidoPorId: encargado.id },
  })
  await crudo.radicadoEvento.create({ data: { radicadoId, tipo: 'CREADO', usuarioId: encargado.id, detalle: `${NUMERO} — a mano` } })
  await crudo.alerta.create({
    data: { radicadoId, areaId: area.id, nivel: 'NUEVO', venceRef: new Date(), mensaje: `Radicado ${NUMERO} a mano` },
  })
})

after(async () => {
  if (dbOk && radicadoId) {
    await crudo.adjunto.deleteMany({ where: { radicadoId } })
    await crudo.radicadoEvento.deleteMany({ where: { radicadoId } })
    await crudo.alerta.deleteMany({ where: { radicadoId } })
    await crudo.radicado.deleteMany({ where: { id: radicadoId } })
  }
  await crudo.$disconnect()
  await prisma.$disconnect()
})

test('antes del barrido: el documento metido por fuera está en texto plano', { skip: !dbOk }, async () => {
  const r = await crudo.radicado.findUnique({ where: { id: radicadoId } })
  assert.equal(r.asunto, 'Asunto escrito a mano en Atlas')
  assert.equal(r.numeroRadicadoIndice, null)
})

test('el barrido lo cifra todo: radicado, PDF, evento y alerta', { skip: !dbOk }, async () => {
  const resumen = await cifrarPendientes()
  assert.ok(resumen.radicados.cambiados >= 1)
  assert.ok(resumen.adjuntos.cambiados >= 1, 'el PDF plano se detecta por su firma')

  const r = await crudo.radicado.findUnique({ where: { id: radicadoId } })
  for (const campo of ['numeroRadicado', 'asunto', 'descripcion', 'remitente']) {
    assert.ok(r[campo].startsWith('enc:v1:'), `${campo} quedó cifrado`)
  }
  assert.equal(r.numeroRadicadoIndice, indiceCiego(NUMERO))

  const adj = await crudo.adjunto.findFirst({ where: { radicadoId } })
  assert.notEqual(Buffer.from(adj.contenido).subarray(0, 5).toString('latin1'), '%PDF-')
  assert.ok(adj.nombreOriginal.startsWith('enc:v1:'))
  assert.ok((await crudo.radicadoEvento.findFirst({ where: { radicadoId } })).detalle.startsWith('enc:v1:'))
  assert.ok((await crudo.alerta.findFirst({ where: { radicadoId } })).mensaje.startsWith('enc:v1:'))
})

test('la aplicación lo lee normal y lo encuentra por número', { skip: !dbOk }, async () => {
  const r = await prisma.radicado.findFirst({ where: { numeroRadicado: NUMERO.toLowerCase() } })
  assert.equal(r?.id, radicadoId)
  assert.equal(r.asunto, 'Asunto escrito a mano en Atlas')
  const adj = await prisma.adjunto.findFirst({ where: { radicadoId } })
  assert.ok(Buffer.from(adj.contenido).equals(PDF))
})

test('un segundo barrido no encuentra nada pendiente (idempotente)', { skip: !dbOk }, async () => {
  const resumen = await cifrarPendientes()
  for (const [col, r] of Object.entries(resumen)) {
    if (col === 'contadores') continue
    assert.equal(r.cambiados, 0, `${col} no debería tener pendientes`)
  }
})
