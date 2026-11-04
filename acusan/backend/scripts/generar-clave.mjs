// Genera la llave maestra del cifrado de datos (CLAVE_MAESTRA_DATOS).
//
// Uso (desde backend/):
//   npm run claves:generar             → la muestra en pantalla
//   npm run claves:generar -- --guardar → además la agrega a backend/.env
//
// Reglas de oro (léelas antes de usarla):
// - Se genera UNA sola vez. Si cambias la llave, todo lo cifrado con la
//   anterior queda ilegible. Por eso --guardar NUNCA reemplaza una llave que
//   ya exista en .env.
// - Guarda una copia en un lugar seguro FUERA del proyecto (un gestor de
//   contraseñas). Si se pierde la llave, los datos no se recuperan.
// - En producción va en Vercel → Settings → Environment Variables, nunca en
//   el repositorio ni en la base de datos.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RUTA_ENV = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
const VARIABLE = 'CLAVE_MAESTRA_DATOS'

const llave = crypto.randomBytes(32).toString('hex')

if (!process.argv.includes('--guardar')) {
  console.log(`\n${VARIABLE}=${llave}\n`)
  console.log('Cópiala en backend/.env y en Vercel. Guarda una copia segura: sin ella los datos no se recuperan.')
  console.log('Para escribirla directo en backend/.env: npm run claves:generar -- --guardar\n')
  process.exit(0)
}

const actual = fs.existsSync(RUTA_ENV) ? fs.readFileSync(RUTA_ENV, 'utf8') : ''
if (new RegExp(`^\\s*${VARIABLE}\\s*=\\s*\\S+`, 'm').test(actual)) {
  console.error(`\n❌ backend/.env ya tiene ${VARIABLE}. No se reemplaza: cambiarla dejaría ilegibles los datos cifrados.\n`)
  process.exit(1)
}

const salto = actual && !actual.endsWith('\n') ? '\n' : ''
fs.appendFileSync(
  RUTA_ENV,
  `${salto}\n# Llave maestra del cifrado de datos (radicados, PDFs, alertas, eventos).\n` +
    `# NO la cambies ni la compartas. Copia segura fuera del proyecto + misma variable en Vercel.\n` +
    `${VARIABLE}=${llave}\n`,
)
console.log(`\n✅ ${VARIABLE} agregada a backend/.env`)
console.log('   Ahora: 1) guarda una copia en tu gestor de contraseñas')
console.log('          2) agrégala en Vercel → Settings → Environment Variables (Production y Preview)\n')
