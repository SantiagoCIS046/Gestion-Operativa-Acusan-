// Unitarias del cifrado de datos sensibles y de la extensión de Prisma.
// No necesitan base de datos: la extensión se prueba con un `query` falso que
// captura lo que llegaría a MongoDB.
//
// Uso: node --test src/lib/cifrado.test.mjs   (desde backend/)

import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.CLAVE_MAESTRA_DATOS = crypto.randomBytes(32).toString('hex')

const c = await import('./cifrado.js')
const { extensionCifrado, prepararArgs } = await import('./extensionCifrado.js')

const ejecutar = async (model, operation, args, respuesta) => {
  let enviado = null
  const resultado = await extensionCifrado.query.$allModels.$allOperations({
    model,
    operation,
    args,
    query: async (a) => {
      enviado = a
      return typeof respuesta === 'function' ? respuesta(a) : respuesta
    },
  })
  return { enviado, resultado }
}

test('texto: ida y vuelta, IV aleatorio y prefijo', () => {
  const a = c.cifrarTexto('Derecho de petición — Juan Pérez')
  const b = c.cifrarTexto('Derecho de petición — Juan Pérez')
  assert.ok(a.startsWith('enc:v1:'))
  assert.notEqual(a, b, 'el mismo texto produce cifrados distintos')
  assert.equal(c.descifrarTexto(a), 'Derecho de petición — Juan Pérez')
  assert.equal(c.cifrarTexto(null), null)
  assert.equal(c.cifrarTexto(undefined), undefined)
  assert.equal(c.descifrarTexto('texto viejo sin cifrar'), 'texto viejo sin cifrar')
})

test('texto: no se cifra dos veces, pero un "enc:v1:" falso sí se cifra', () => {
  const a = c.cifrarTexto('RAD-2026-0042')
  assert.equal(c.cifrarTexto(a), a)
  const trampa = 'enc:v1:esto-no-es-un-cifrado'
  const guardado = c.cifrarTexto(trampa)
  assert.notEqual(guardado, trampa)
  assert.equal(c.descifrarTexto(guardado), trampa)
})

test('dato alterado: el descifrado falla (GCM autentica)', () => {
  const a = c.cifrarTexto('confidencial')
  const crudo = Buffer.from(a.slice(7), 'base64')
  crudo[crudo.length - 1] ^= 1
  assert.throws(() => c.descifrarTexto('enc:v1:' + crudo.toString('base64')))
})

test('bytes: PDF cifrado ya no empieza por %PDF y vuelve igual', () => {
  const pdf = Buffer.from('%PDF-1.4\nhola\n%%EOF\n')
  const cif = c.cifrarBytes(pdf)
  assert.ok(c.estaCifradoBytes(cif))
  assert.notEqual(cif.subarray(0, 5).toString('latin1'), '%PDF-')
  assert.ok(c.descifrarBytes(cif).equals(pdf))
  assert.ok(c.descifrarBytes(new Uint8Array(cif)).equals(pdf), 'acepta Uint8Array (Prisma 6)')
})

test('json: ida y vuelta', () => {
  const criticos = [{ numeroRadicado: 'RAD-1', asunto: 'X', diasAtraso: 3 }]
  const cif = c.cifrarJson(criticos)
  assert.equal(typeof cif, 'string')
  assert.deepEqual(c.descifrarJson(cif), criticos)
})

test('índice ciego: determinista y normalizado', () => {
  assert.equal(c.indiceCiego('RAD-2026-0042'), c.indiceCiego('  rad-2026-0042 '))
  assert.notEqual(c.indiceCiego('RAD-2026-0042'), c.indiceCiego('RAD-2026-0043'))
  assert.match(c.indiceCiego('x'), /^[0-9a-f]{64}$/)
})

test('otra llave no descifra (y no tumba la lectura profunda)', () => {
  const a = c.cifrarTexto('secreto')
  const original = process.env.CLAVE_MAESTRA_DATOS
  process.env.CLAVE_MAESTRA_DATOS = crypto.randomBytes(32).toString('hex')
  try {
    assert.throws(() => c.descifrarTexto(a))
    const fila = c.descifrarProfundo({ asunto: a })
    assert.equal(fila.asunto, a, 'queda ilegible pero la consulta no se cae')
  } finally {
    process.env.CLAVE_MAESTRA_DATOS = original
  }
})

test('sin llave: error claro', () => {
  const original = process.env.CLAVE_MAESTRA_DATOS
  delete process.env.CLAVE_MAESTRA_DATOS
  try {
    assert.throws(() => c.verificarClaves(), /CLAVE_MAESTRA_DATOS/)
    process.env.CLAVE_MAESTRA_DATOS = 'corta'
    assert.throws(() => c.verificarClaves(), /32 bytes/)
  } finally {
    process.env.CLAVE_MAESTRA_DATOS = original
  }
})

test('descifrarProfundo: anidados y solo en campos sensibles', () => {
  const fila = {
    asunto: c.cifrarTexto('A'),
    categoria: 'enc:v1:lo-escribio-un-usuario',
    area: { codigo: 'OPE' },
    adjuntos: [{ nombreOriginal: c.cifrarTexto('r.pdf'), subidoEn: new Date(0) }],
  }
  c.descifrarProfundo(fila)
  assert.equal(fila.asunto, 'A')
  assert.equal(fila.categoria, 'enc:v1:lo-escribio-un-usuario')
  assert.equal(fila.adjuntos[0].nombreOriginal, 'r.pdf')
  assert.ok(fila.adjuntos[0].subidoEn instanceof Date)
})

test('extensión: create de Radicado cifra campos y agrega el índice', async () => {
  const { enviado, resultado } = await ejecutar(
    'Radicado',
    'create',
    { data: { numeroRadicado: 'RAD-2026-0042', asunto: 'Petición', remitente: 'Juan', categoria: 'General', prioridad: 'ALTA' } },
    (a) => ({ id: '1', ...a.data }),
  )
  assert.ok(enviado.data.numeroRadicado.startsWith('enc:v1:'))
  assert.ok(enviado.data.asunto.startsWith('enc:v1:'))
  assert.ok(enviado.data.remitente.startsWith('enc:v1:'))
  assert.equal(enviado.data.categoria, 'General', 'lo no sensible queda igual')
  assert.equal(enviado.data.numeroRadicadoIndice, c.indiceCiego('RAD-2026-0042'))
  assert.equal(resultado.numeroRadicado, 'RAD-2026-0042', 'el resultado vuelve descifrado')
  assert.equal(resultado.asunto, 'Petición')
})

test('extensión: where por número → índice; startsWith/orderBy → error', async () => {
  const { enviado } = await ejecutar('Radicado', 'findFirst', { where: { numeroRadicado: 'rad-2026-0042' } }, null)
  assert.deepEqual(enviado.where, { numeroRadicadoIndice: c.indiceCiego('RAD-2026-0042') })

  const conIn = prepararArgs('Radicado', 'findMany', { where: { numeroRadicado: { in: ['A', 'B'] } } })
  assert.deepEqual(conIn.where.numeroRadicadoIndice.in, [c.indiceCiego('A'), c.indiceCiego('B')])

  await assert.rejects(
    ejecutar('Radicado', 'findMany', { where: { numeroRadicado: { startsWith: 'RAD-' } } }, []),
    /cifrado/,
  )
  await assert.rejects(ejecutar('Radicado', 'findMany', { where: { OR: [{ asunto: { contains: 'x' } }] } }, []), /cifrado/)
  await assert.rejects(ejecutar('Radicado', 'findMany', { orderBy: { numeroRadicado: 'asc' } }, []), /cifrado/)
  await assert.rejects(ejecutar('Alerta', 'findMany', { where: { radicado: { is: { asunto: 'x' } } } }, []), /cifrado/)

  const nulos = prepararArgs('Radicado', 'findMany', { where: { instrucciones: null, observacionesRespuesta: { not: null } } })
  assert.deepEqual(nulos.where, { instrucciones: null, observacionesRespuesta: { not: null } })
})

test('extensión: update con { set }, upsert y escrituras anidadas', async () => {
  const upd = prepararArgs('Radicado', 'update', { where: { id: '1' }, data: { numeroRadicado: { set: 'N-1' }, estado: 'PENDIENTE' } })
  assert.ok(upd.data.numeroRadicado.set.startsWith('enc:v1:'))
  assert.equal(upd.data.numeroRadicadoIndice, c.indiceCiego('N-1'))

  const ups = prepararArgs('Informe', 'upsert', { where: { id: '1' }, create: { criticos: [{ a: 1 }] }, update: { criticos: [] } })
  assert.ok(ups.create.criticos.startsWith('encj:v1:'))
  assert.ok(ups.update.criticos.startsWith('encj:v1:'))

  const anid = prepararArgs('Radicado', 'create', {
    data: {
      asunto: 'A',
      adjuntos: { create: [{ nombreOriginal: 'x.pdf', contenido: Buffer.from('%PDF-1') }] },
      eventos: { createMany: { data: [{ detalle: 'RAD-1 — A' }] } },
    },
  })
  assert.ok(anid.data.adjuntos.create[0].nombreOriginal.startsWith('enc:v1:'))
  assert.ok(c.estaCifradoBytes(anid.data.adjuntos.create[0].contenido))
  assert.ok(anid.data.eventos.createMany.data[0].detalle.startsWith('enc:v1:'))

  const many = prepararArgs('RadicadoEvento', 'createMany', { data: [{ detalle: 'x' }, { detalle: 'y' }] })
  assert.ok(many.data.every((d) => d.detalle.startsWith('enc:v1:')))
})

test('extensión: no muta los argumentos del llamador', async () => {
  const where = { areaId: 'a', numeroRadicado: 'RAD-1' }
  const data = { asunto: 'A' }
  prepararArgs('Radicado', 'updateMany', { where, data })
  assert.deepEqual(where, { areaId: 'a', numeroRadicado: 'RAD-1' })
  assert.deepEqual(data, { asunto: 'A' })
})

test('extensión: modelos sin campos sensibles pasan intactos', async () => {
  const args = { where: { email: 'a@b.com' } }
  const { enviado, resultado } = await ejecutar('Usuario', 'findUnique', args, { email: 'a@b.com', passwordHash: '$2b$12$x' })
  assert.deepEqual(enviado, args)
  assert.equal(resultado.passwordHash, '$2b$12$x')
})

test('barrido: el filtro de pendientes cubre cada campo sensible', async () => {
  const { filtroPendientes } = await import('../services/barridoCifrado.js')
  const f = filtroPendientes('Radicado')
  const campos = f.$or.map((c) => Object.keys(c)[0])
  for (const k of ['numeroRadicado', 'asunto', 'descripcion', 'remitente', 'instrucciones', 'observacionesRespuesta', 'numeroOficioRespuesta', 'numeroRadicadoIndice']) {
    assert.ok(campos.includes(k), `falta ${k}`)
  }
  const adj = filtroPendientes('Adjunto').$or
  assert.ok(adj.some((c) => c.contenido?.$bitsAnyClear), 'PDF: bits en 0 que deberían ser 1')
  assert.ok(adj.some((c) => c.contenido?.$bitsAnySet), 'PDF: bits en 1 que deberían ser 0')
  const inf = filtroPendientes('Informe').$or[0].criticos
  assert.deepEqual(inf.$not, { $type: 'string' })
})
