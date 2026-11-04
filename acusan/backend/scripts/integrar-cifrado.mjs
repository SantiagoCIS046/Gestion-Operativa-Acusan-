// Integración completa del cifrado de datos, en orden y con frenos.
//
// Uso (desde backend/):  npm run cifrado:integrar
//
// Pasos:
//   1. Llave: si backend/.env no tiene CLAVE_MAESTRA_DATOS, la genera y la guarda.
//   2. npx prisma generate (cliente con los campos nuevos).
//   3. Respaldo local de las colecciones afectadas (backend/respaldos/).
//   4. Simulación de la migración (no escribe) y confirmación.
//   5. Migración: cifra los datos existentes.
//   6. npm run db:push (índice único del número de radicado).
//   7. npm test.
// Se detiene en el primer error. Se puede volver a correr: cada paso es
// idempotente (no regenera la llave, no cifra dos veces).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const BACKEND = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAIZ = path.join(BACKEND, '..')
const ENV = path.join(BACKEND, '.env')

function correr(titulo, comando, cwd = BACKEND) {
  console.log(`\n━━ ${titulo}\n   > ${comando}`)
  const r = spawnSync(comando, { cwd, shell: true, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\n❌ Falló: ${titulo}. No se siguió con los demás pasos.`)
    console.error('   Corrige el error y vuelve a correr npm run cifrado:integrar (los pasos ya hechos no se repiten).')
    process.exit(r.status ?? 1)
  }
}

const tieneLlave = () =>
  fs.existsSync(ENV) && /^\s*CLAVE_MAESTRA_DATOS\s*=\s*\S+/m.test(fs.readFileSync(ENV, 'utf8'))

// 1. Llave
if (tieneLlave()) {
  console.log('━━ 1. Llave: backend/.env ya tiene CLAVE_MAESTRA_DATOS (se conserva).')
} else {
  correr('1. Generar la llave maestra', 'node scripts/generar-clave.mjs --guardar')
}

// 2–4
correr('2. Generar el cliente de Prisma', 'npx prisma generate')
correr('3. Respaldo local antes de migrar', 'node scripts/respaldar-datos.mjs')
correr('4. Simulación (no escribe nada)', 'node scripts/cifrar-datos-existentes.mjs --simular')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const respuesta = (await rl.question('\n¿Cifrar ahora los datos de la base? (s/n): ')).trim().toLowerCase()
rl.close()
if (respuesta !== 's' && respuesta !== 'si' && respuesta !== 'sí') {
  console.log('Cancelado. No se modificó la base.')
  process.exit(0)
}

// 5–7
correr('5. Cifrar los datos existentes', 'node scripts/cifrar-datos-existentes.mjs')
correr('6. Aplicar el esquema (índice único del número)', 'npm run db:push', RAIZ)
correr('7. Pruebas', 'npm test')

console.log(`
✅ Cifrado integrado.

Falta (solo tú puedes hacerlo):
  • Copia CLAVE_MAESTRA_DATOS de backend/.env a tu gestor de contraseñas.
  • Agrégala en Vercel → Settings → Environment Variables (Production y Preview)
    y vuelve a desplegar. Sin ella la versión publicada no arranca.
  • Cuando confirmes que todo funciona, borra la carpeta backend/respaldos/
    (está en texto plano).
`)
