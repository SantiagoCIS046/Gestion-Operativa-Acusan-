// Verificación por bytes + corrección puntual (temporal, borrar tras correr):
// detecta emails con dominio distinto a "acuusan.com" de 7 letras y los normaliza.
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const CANONICO = 'acuusan.com' // 7 letras: a-c-u-a-s-a-n

const usuarios = await p.usuario.findMany({ select: { id: true, email: true, rol: true } })

let cambios = 0
for (const u of usuarios) {
  const [local, dominio] = u.email.split('@')
  if (dominio === CANONICO) continue

  const bytes = [...dominio].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
  const corregido = `${local}@${dominio.replace(/acu{2,}san/, 'acuasan')}`
  console.log(`MAL [${u.rol}] ${u.email}  (dominio hex: ${bytes})`)

  const choca = await p.usuario.findFirst({ where: { email: corregido }, select: { id: true } })
  if (choca) {
    console.log(`  !! ya existe ${corregido} (id ${choca.id}) — NO se corrige, revisar a mano`)
    continue
  }
  await p.usuario.update({ where: { id: u.id }, data: { email: corregido } })
  console.log(`  -> corregido a ${corregido}`)
  cambios++
}

console.log(`\n${cambiasCorrectas(cambios)}`)

function cambiasCorrectas(n) {
  return n === 0
    ? 'todos los dominios ya eran acuusan.com (7 letras) — sin cambios'
    : `${n} email(s) normalizados a acuusan.com`
}

await p.$disconnect()
