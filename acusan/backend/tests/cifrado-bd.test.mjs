// Integración: lo que queda GUARDADO en MongoDB está cifrado. Se compara la
// vista de la aplicación (cliente con extensión: descifra) con la vista cruda
// de la base (cliente sin extensión: lo que vería quien robara un respaldo).
// Se salta si la base no es alcanzable.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
await import('dotenv/config')

const { default: prisma, prismaSinCifrado: crudo } = await import('../src/config/prisma.js')
const { indiceCiego } = await import('../src/lib/cifrado.js')

const NUMERO = `RAD-CIF-${Date.now().toString(36)}`
const PDF = Buffer.from('%PDF-1.4\nDocumento confidencial de prueba\n%%EOF\n')

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

let radicado = null

before(async () => {
  if (!dbOk) return
  const area = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  const encargado = await prisma.usuario.findFirst({ where: { areaId: area.id, activo: true } })
  radicado = await prisma.radicado.create({
    data: {
      numeroRadicado: NUMERO,
      asunto: 'Derecho de petición de prueba',
      descripcion: 'Descripción sensible',
      remitente: 'Ciudadana de prueba',
      tipo: 'Derecho de petición',
      categoria: 'General',
      prioridad: 'MEDIA',
      fechaRadicacion: new Date(),
      fechaLimite: new Date(Date.now() + 10 * 864e5),
      areaId: area.id,
      encargadoId: encargado.id,
      creadoPorId: encargado.id,
      adjuntos: {
        create: { tipo: 'RADICADO', nombreOriginal: `${NUMERO}.pdf`, tamano: PDF.length, contenido: PDF, subidoPorId: encargado.id },
      },
      eventos: { create: { tipo: 'CREADO', usuarioId: encargado.id, detalle: `${NUMERO} — prueba` } },
    },
  })
})

after(async () => {
  if (dbOk && radicado) {
    await prisma.adjunto.deleteMany({ where: { radicadoId: radicado.id } })
    await prisma.radicadoEvento.deleteMany({ where: { radicadoId: radicado.id } })
    await prisma.alerta.deleteMany({ where: { radicadoId: radicado.id } })
    await prisma.radicado.delete({ where: { id: radicado.id } })
  }
  await prisma.$disconnect()
  await crudo.$disconnect()
})

test('la aplicación ve el radicado descifrado', { skip: !dbOk }, async () => {
  assert.equal(radicado.numeroRadicado, NUMERO)
  assert.equal(radicado.asunto, 'Derecho de petición de prueba')
})

test('en la base el número, asunto y remitente están cifrados', { skip: !dbOk }, async () => {
  const enBd = await crudo.radicado.findUnique({ where: { id: radicado.id } })
  for (const campo of ['numeroRadicado', 'asunto', 'descripcion', 'remitente']) {
    assert.ok(enBd[campo].startsWith('enc:v1:'), `${campo} debería estar cifrado`)
    assert.ok(!enBd[campo].includes('prueba'), `${campo} no debe dejar ver el texto`)
  }
  assert.equal(enBd.numeroRadicadoIndice, indiceCiego(NUMERO))
  assert.equal(enBd.categoria, 'General', 'lo no sensible sigue legible')
})

test('el PDF y su nombre están cifrados en la base y vuelven intactos', { skip: !dbOk }, async () => {
  const adj = await crudo.adjunto.findFirst({ where: { radicadoId: radicado.id } })
  assert.notEqual(Buffer.from(adj.contenido).subarray(0, 5).toString('latin1'), '%PDF-')
  assert.ok(adj.nombreOriginal.startsWith('enc:v1:'))
  const app = await prisma.adjunto.findFirst({ where: { radicadoId: radicado.id } })
  assert.ok(Buffer.from(app.contenido).equals(PDF))
  assert.equal(app.nombreOriginal, `${NUMERO}.pdf`)
})

test('el detalle del evento está cifrado en la base', { skip: !dbOk }, async () => {
  const ev = await crudo.radicadoEvento.findFirst({ where: { radicadoId: radicado.id } })
  assert.ok(ev.detalle.startsWith('enc:v1:'))
})

test('se encuentra por número exacto (sin importar mayúsculas) vía índice ciego', { skip: !dbOk }, async () => {
  const hallado = await prisma.radicado.findFirst({ where: { numeroRadicado: `  ${NUMERO.toLowerCase()} ` } })
  assert.equal(hallado?.id, radicado.id)
})

test('el número sigue siendo único', { skip: !dbOk }, async () => {
  await assert.rejects(
    prisma.radicado.create({
      data: {
        numeroRadicado: NUMERO,
        asunto: 'dup', descripcion: 'dup', remitente: 'dup', tipo: 'x', prioridad: 'BAJA',
        fechaRadicacion: new Date(), fechaLimite: new Date(),
        areaId: radicado.areaId, encargadoId: radicado.encargadoId, creadoPorId: radicado.creadoPorId,
      },
    }),
    (e) => e?.code === 'P2002',
  )
})
