// Mueve los PDFs ya guardados entre almacenes (ver src/services/almacenPdf.js).
//
// Uso (desde backend/, con el mismo .env del backend):
//   npm run pdfs:mover -- --simular          → cuenta lo que movería, sin tocar nada
//   npm run pdfs:mover                       → MongoDB → almacén actual (ALMACEN_PDF o Blob)
//   npm run pdfs:mover -- --destino=disco    → elige el destino explícito
//   npm run pdfs:mover -- --revertir         → todo de vuelta a MongoDB
//
// Es idempotente: si se corta, se vuelve a correr y sigue con lo que falte.
// Cada PDF se sube cifrado; el documento Adjunto se actualiza solo DESPUÉS
// de subirlo bien (si algo falla, ese PDF sigue donde estaba).

import 'dotenv/config'
import prisma, { prismaSinCifrado } from '../src/config/prisma.js'
import { almacenActual, subirExterno, leerExterno, eliminarExterno } from '../src/services/almacenPdf.js'

const args = process.argv.slice(2)
const simular = args.includes('--simular')
const revertir = args.includes('--revertir')
const destino = (args.find((a) => a.startsWith('--destino='))?.split('=')[1] ?? almacenActual()).toLowerCase()

async function aExterno() {
  if (destino === 'mongo') {
    console.log('El almacén destino es MongoDB: no hay nada que mover. Define ALMACEN_PDF=blob (o --destino=blob).')
    return
  }
  // Los previos al campo `almacen` no lo traen: se buscan por tener contenido
  const ids = (
    await prismaSinCifrado.adjunto.findMany({ where: { ubicacion: null }, select: { id: true } })
  ).map((a) => a.id)
  console.log(`${ids.length} PDF(s) en MongoDB → ${destino}${simular ? ' (simulación)' : ''}`)
  if (simular) return
  let movidos = 0
  for (const id of ids) {
    const doc = await prisma.adjunto.findUnique({ where: { id } }) // descifrado por la extensión
    if (!doc?.contenido) continue
    const ubicacion = await subirExterno(destino, doc.radicadoId, Buffer.from(doc.contenido))
    await prismaSinCifrado.adjunto.update({ where: { id }, data: { contenido: null, almacen: destino, ubicacion } })
    movidos++
    if (movidos % 25 === 0) console.log(`  ${movidos}/${ids.length}…`)
  }
  console.log(`✅ ${movidos} PDF(s) movidos a ${destino}.`)
}

async function aMongo() {
  const externos = await prismaSinCifrado.adjunto.findMany({
    where: { ubicacion: { not: null } },
    select: { id: true, almacen: true, ubicacion: true },
  })
  console.log(`${externos.length} PDF(s) externos → MongoDB${simular ? ' (simulación)' : ''}`)
  if (simular) return
  let movidos = 0
  for (const a of externos) {
    const bytes = await leerExterno(a.almacen, a.ubicacion)
    // Con el cliente cifrado: la extensión cifra el contenido al escribir
    await prisma.adjunto.update({ where: { id: a.id }, data: { contenido: bytes, almacen: 'mongo', ubicacion: null } })
    await eliminarExterno(a.almacen, a.ubicacion)
    movidos++
  }
  console.log(`✅ ${movidos} PDF(s) devueltos a MongoDB.`)
}

try {
  await (revertir ? aMongo() : aExterno())
} catch (error) {
  console.error(`❌ ${error.message}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
