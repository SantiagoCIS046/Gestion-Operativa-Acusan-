// Integración: PDFs en un almacén externo (ALMACEN_PDF=disco, el mismo
// camino que Vercel Blob). El objeto se guarda cifrado fuera de MongoDB,
// se sirve descifrado, el script de migración lo mueve en ambos sentidos y
// borrar el radicado borra el objeto. Se salta si la base no es alcanzable.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'test'
await import('dotenv/config')
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'
const DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'acuasan-pdf-'))
process.env.ALMACEN_PDF = 'disco'
process.env.ALMACEN_PDF_DIR = DIR

const { default: app } = await import('../src/app.js')
const { default: prisma, prismaSinCifrado } = await import('../src/config/prisma.js')
const { enDias } = await import('../src/utils/fechas.js')

const BACKEND = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const correr = promisify(execFile)
const DESCRIPCION_PRUEBA = 'Radicado de prueba del almacén de PDFs.'
const PDF = Buffer.from('%PDF-1.4\nContenido confidencial del radicado\n%%EOF\n')

let dbOk = false
try {
  await Promise.race([prisma.$connect(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))])
  dbOk = true
} catch {
  dbOk = false
}

let servidor = null
let base = null
let token = null
let radicadoId = null

before(async () => {
  if (!dbOk) return
  await new Promise((r) => {
    servidor = app.listen(0, '127.0.0.1', r)
  })
  base = `http://127.0.0.1:${servidor.address().port}`
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'gerencia@acuasan.com', password: 'acuasan2026' }),
  })
  token = (await res.json()).data.token
})

after(async () => {
  if (dbOk) {
    const propios = (await prisma.radicado.findMany({ select: { id: true, descripcion: true } })).filter(
      (r) => r.descripcion === DESCRIPCION_PRUEBA,
    )
    for (const r of propios) {
      await prisma.alerta.deleteMany({ where: { radicadoId: r.id } })
      await prisma.adjunto.deleteMany({ where: { radicadoId: r.id } })
      await prisma.radicadoEvento.deleteMany({ where: { radicadoId: r.id } })
      await prisma.radicado.delete({ where: { id: r.id } })
    }
  }
  if (servidor) {
    if (typeof servidor.closeAllConnections === 'function') servidor.closeAllConnections()
    await new Promise((r) => servidor.close(r))
  }
  await prisma.$disconnect()
  await fs.rm(DIR, { recursive: true, force: true })
})

async function archivosEn(dir) {
  const salida = []
  for (const e of await fs.readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) salida.push(path.join(e.parentPath ?? e.path, e.name))
  }
  return salida
}

test('un PDF nuevo se guarda cifrado en el almacén externo y se sirve descifrado', async () => {
  if (!dbOk) return
  const ope = await prisma.area.findUnique({ where: { codigo: 'OPE' } })
  const juan = await prisma.usuario.findUnique({ where: { email: 'juan.valdez@acuasan.com' } })
  const form = new FormData()
  form.append('asunto', 'Prueba de almacén externo')
  form.append('descripcion', DESCRIPCION_PRUEBA)
  form.append('remitente', 'Suite de PDFs')
  form.append('tipo', 'Oficio')
  form.append('prioridad', 'media')
  form.append('areaId', ope.id)
  form.append('encargadoId', juan.id)
  form.append('fechaRadicacion', enDias(0).toISOString().slice(0, 10))
  form.append('fechaLimite', enDias(15).toISOString().slice(0, 10))
  form.append('archivo', new Blob([PDF], { type: 'application/pdf' }), 'oficio.pdf')
  const res = await fetch(`${base}/api/radicados`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form })
  const json = await res.json()
  assert.equal(res.status, 201, json.message)
  radicadoId = json.data.id

  const adj = await prismaSinCifrado.adjunto.findFirst({ where: { radicadoId } })
  assert.equal(adj.almacen, 'disco')
  assert.equal(adj.contenido, null, 'los bytes ya no viven en MongoDB')
  assert.ok(adj.ubicacion)

  const archivos = await archivosEn(DIR)
  assert.equal(archivos.length, 1)
  const crudo = await fs.readFile(archivos[0])
  assert.equal(crudo.subarray(0, 4).toString('latin1'), 'ENC1', 'el objeto externo va cifrado')
  assert.equal(crudo.includes(Buffer.from('confidencial')), false)

  const pdf = await fetch(`${base}/api/radicados/${radicadoId}/pdf/radicado`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(pdf.status, 200)
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), PDF)
})

test('el script mueve PDFs a MongoDB y de vuelta al almacén externo sin perder bytes', async () => {
  if (!dbOk || !radicadoId) return
  const env = { ...process.env, ALMACEN_PDF: 'disco', ALMACEN_PDF_DIR: DIR }
  const simulado = await correr('node', ['scripts/mover-pdfs.mjs', '--revertir', '--simular'], { cwd: BACKEND, env })
  assert.match(simulado.stdout, /simulación/)

  await correr('node', ['scripts/mover-pdfs.mjs', '--revertir'], { cwd: BACKEND, env })
  let adj = await prismaSinCifrado.adjunto.findFirst({ where: { radicadoId } })
  assert.equal(adj.almacen, 'mongo')
  assert.equal(adj.ubicacion, null)
  assert.equal(Buffer.from(adj.contenido).subarray(0, 4).toString('latin1'), 'ENC1', 'en MongoDB también cifrado')
  assert.equal((await archivosEn(DIR)).length, 0, 'el objeto externo se borra tras volver')

  await correr('node', ['scripts/mover-pdfs.mjs'], { cwd: BACKEND, env })
  adj = await prismaSinCifrado.adjunto.findFirst({ where: { radicadoId } })
  assert.equal(adj.almacen, 'disco')

  const pdf = await fetch(`${base}/api/radicados/${radicadoId}/pdf/radicado`, { headers: { authorization: `Bearer ${token}` } })
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), PDF)
})

test('eliminar el radicado borra también su objeto externo', async () => {
  if (!dbOk || !radicadoId) return
  assert.equal((await archivosEn(DIR)).length, 1)
  const res = await fetch(`${base}/api/radicados/${radicadoId}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })
  assert.equal(res.status, 200)
  assert.equal((await archivosEn(DIR)).length, 0)
})
