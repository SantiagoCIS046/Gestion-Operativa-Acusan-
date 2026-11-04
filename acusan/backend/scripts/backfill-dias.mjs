// Backfill puntual (2026-10-21, módulo de informes por alcance):
//   1. Radicados: rellena diaRadicacion/diaVencimiento/diaRespuesta (texto
//      AAAA-MM-DD bogotano, regla de los informes) desde las fechas Date.
//   2. Informes: fija alcance='global' en los registros previos a la columna.
//
// Idempotente: solo toca documentos a los que les falte algo. El filtro de
// nulls se hace en JS porque en Mongo `where: { campo: null }` NO matchea
// documentos a los que el campo les falta (Prisma omite nulls al crear).
//
// Uso: node scripts/backfill-dias.mjs   (desde backend/)
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { aCalendarioBogota } from '../src/utils/fechas.js'

const prisma = new PrismaClient()

// ── 1. Radicados ──
const radicados = await prisma.radicado.findMany({
  select: { id: true, fechaRadicacion: true, fechaLimite: true, respondidoEn: true, diaRadicacion: true, diaVencimiento: true, diaRespuesta: true },
})

let tocados = 0
for (const r of radicados) {
  const faltan =
    !r.diaRadicacion || !r.diaVencimiento || (r.respondidoEn && !r.diaRespuesta)
  if (!faltan) continue

  await prisma.radicado.update({
    where: { id: r.id },
    data: {
      diaRadicacion: r.diaRadicacion ?? aCalendarioBogota(r.fechaRadicacion),
      diaVencimiento: r.diaVencimiento ?? aCalendarioBogota(r.fechaLimite),
      ...(r.respondidoEn && !r.diaRespuesta
        ? { diaRespuesta: aCalendarioBogota(r.respondidoEn) }
        : {}),
    },
  })
  tocados++
}
console.log(`radicados revisados: ${radicados.length}; rellenados: ${tocados}`)

// ── 2. Informes ──
const informes = await prisma.informe.findMany({
  select: { id: true, alcance: true },
})
const sinAlcance = informes.filter((i) => !i.alcance)
for (const i of sinAlcance) {
  await prisma.informe.update({ where: { id: i.id }, data: { alcance: 'global' } })
}
console.log(`informes revisados: ${informes.length}; marcados 'global': ${sinAlcance.length}`)

await prisma.$disconnect()
