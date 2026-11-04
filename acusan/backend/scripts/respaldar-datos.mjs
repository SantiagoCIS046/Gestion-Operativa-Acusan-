// Respaldo local de las colecciones que toca el cifrado, ANTES de migrar.
// Escribe un archivo JSONL por colección en backend/respaldos/<fecha>/
// (carpeta ignorada por git). Los PDFs van en base64.
//
// ⚠️ El respaldo queda en TEXTO PLANO (es una copia de lo que hoy hay en la
// base): cuando confirmes que todo funciona cifrado, BÓRRALO.
//
// Uso (desde backend/): node scripts/respaldar-datos.mjs

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { prismaSinCifrado as db } from '../src/config/prisma.js'

const LOTE = 50
const marca = new Date().toISOString().replace(/[:.]/g, '-')
const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'respaldos', marca)
fs.mkdirSync(carpeta, { recursive: true })

const serializar = (fila) =>
  JSON.stringify(fila, (_k, v) => {
    if (v instanceof Uint8Array) return { $base64: Buffer.from(v).toString('base64') }
    if (v && v.type === 'Buffer' && Array.isArray(v.data)) return { $base64: Buffer.from(v.data).toString('base64') }
    return v
  })

async function respaldar(nombre, delegado) {
  const archivo = path.join(carpeta, `${nombre}.jsonl`)
  const salida = fs.createWriteStream(archivo)
  let cursor = null
  let total = 0
  for (;;) {
    const filas = await delegado.findMany({
      orderBy: { id: 'asc' },
      take: LOTE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!filas.length) break
    for (const f of filas) salida.write(serializar(f) + '\n')
    total += filas.length
    cursor = filas[filas.length - 1].id
  }
  await new Promise((r) => salida.end(r))
  console.log(`  ${nombre}: ${total}`)
  return total
}

console.log(`💾 Respaldo en ${carpeta}`)
await respaldar('radicados', db.radicado)
await respaldar('adjuntos', db.adjunto)
await respaldar('alertas', db.alerta)
await respaldar('radicado_eventos', db.radicadoEvento)
await respaldar('informes', db.informe)
console.log('✅ Respaldo listo (texto plano: bórralo cuando confirmes que todo funciona).\n')

await db.$disconnect()
