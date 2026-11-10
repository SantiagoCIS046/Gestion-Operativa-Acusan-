// Deja el proyecto listo para correr en un computador nuevo con UN comando.
// Pensado para quien clona el repo por primera vez (p. ej. un revisor).
//
// Uso desde la raíz acusan/:
//   npm run preparar                         → pregunta la cadena de Atlas
//   npm run preparar -- "mongodb+srv://..."  → la toma del argumento
//   npm run preparar -- --si                 → no pide confirmar el borrado
//
// Qué hace, en orden:
//   1. Verifica Node ≥ 22.12 (lo exige Vite 8).
//   2. Instala dependencias si faltan (raíz, backend/ y frontend/).
//   3. Crea backend/.env desde .env.example con JWT_SECRET, CLAVE_MAESTRA_DATOS
//      y CRON_SECRET nuevos y la DATABASE_URL que se le indique.
//      Si backend/.env YA existe no lo toca (protege llaves y datos reales).
//   4. Aplica el esquema (prisma db push) y siembra los datos de prueba
//      (borra lo que haya en esa base: úsese con una base vacía o de pruebas).

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BACKEND = path.join(RAIZ, 'backend')
const RUTA_ENV = path.join(BACKEND, '.env')
const RUTA_EJEMPLO = path.join(BACKEND, '.env.example')

const VERDE = '\x1b[32m'
const AMARILLO = '\x1b[33m'
const ROJO = '\x1b[31m'
const NEGRITA = '\x1b[1m'
const RESET = '\x1b[0m'

const args = process.argv.slice(2)
const sinConfirmar = args.includes('--si')
const urlArgumento = args.find((a) => a.startsWith('mongodb'))

const paso = (n, texto) => console.log(`\n${NEGRITA}[${n}/4] ${texto}${RESET}`)
const ok = (texto) => console.log(`${VERDE}  ✔ ${texto}${RESET}`)
const aviso = (texto) => console.log(`${AMARILLO}  ⚠ ${texto}${RESET}`)
// Una sola interfaz de preguntas para todo el script. Las líneas que llegan
// antes de que se haga la pregunta (p. ej. respuestas pegadas de una vez) se
// guardan en cola en vez de perderse.
let rl
const lineas = []
const esperando = []
function preguntar(texto) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.on('line', (l) => (esperando.length ? esperando.shift()(l) : lineas.push(l)))
    rl.on('close', () => esperando.splice(0).forEach((r) => r('')))
  }
  process.stdout.write(texto)
  if (lineas.length) return Promise.resolve(lineas.shift())
  return new Promise((r) => esperando.push(r))
}
function cerrarPreguntas() {
  rl?.close()
}

function fallar(texto) {
  cerrarPreguntas()
  console.error(`\n${ROJO}✖ ${texto}${RESET}\n`)
  process.exit(1)
}

// shell: true es necesario en Windows para resolver npm.cmd / npx.cmd.
function correr(cmd, cwd = RAIZ) {
  const r = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit' })
  return r.status === 0
}

// ── 1. Node ──────────────────────────────────────────────────────────────────
paso(1, 'Versión de Node')
const [mayor, menor] = process.versions.node.split('.').map(Number)
if (mayor < 22 || (mayor === 22 && menor < 12)) {
  fallar(
    `Tienes Node ${process.versions.node} y el proyecto necesita 22.12 o superior.\n` +
      '  Instala la versión LTS desde https://nodejs.org y vuelve a correr: npm run preparar',
  )
}
ok(`Node ${process.versions.node}`)

// ── 2. Dependencias ──────────────────────────────────────────────────────────
paso(2, 'Dependencias')
const faltan = ['.', 'backend', 'frontend'].filter(
  (d) => !fs.existsSync(path.join(RAIZ, d, 'node_modules')),
)
if (faltan.length) {
  console.log('  Instalando (puede tardar unos minutos la primera vez)…')
  // El postinstall de la raíz instala también backend/ y frontend/.
  if (!correr('npm install')) fallar('npm install falló. Revisa tu conexión y vuelve a intentarlo.')
  ok('Dependencias instaladas')
} else {
  ok('Ya estaban instaladas')
}

// ── 3. backend/.env ──────────────────────────────────────────────────────────
paso(3, 'Configuración (backend/.env)')
let envNuevo = false
if (fs.existsSync(RUTA_ENV)) {
  ok('backend/.env ya existe: se usa tal cual (no se modifica)')
} else {
  let url = urlArgumento
  if (!url) {
    console.log(
      '\n  Necesitas una base MongoDB Atlas propia (el plan gratuito sirve):\n' +
        '    1. Crea una cuenta y un cluster gratis en https://www.mongodb.com/cloud/atlas\n' +
        '    2. Database Access → crea un usuario con contraseña\n' +
        '    3. Network Access → Add IP Address → "Allow access from anywhere"\n' +
        '    4. Database → Connect → Drivers → copia la cadena "mongodb+srv://..."\n' +
        '       (reemplaza <db_password> por la contraseña del paso 2)\n',
    )
    url = (await preguntar('  Pega aquí tu cadena de conexión: ')).trim()
  }
  url = url.replace(/^["']|["']$/g, '')
  if (!/^mongodb(\+srv)?:\/\/[^\s]+@[^\s]+/.test(url)) {
    fallar('Eso no parece una cadena de MongoDB (debe empezar por mongodb+srv://usuario:clave@...).')
  }
  if (url.includes('<db_password>')) {
    fallar('La cadena todavía tiene <db_password>: reemplázalo por la contraseña real del usuario.')
  }
  // Prisma exige el nombre de la base en la ruta: si no viene, se usa acuusan_db.
  const u = new URL(url)
  if (!u.pathname || u.pathname === '/') u.pathname = '/acuusan_db'
  url = u.toString()

  const hex = (n) => crypto.randomBytes(n).toString('hex')
  const valores = {
    DATABASE_URL: `"${url}"`,
    JWT_SECRET: hex(48),
    CLAVE_MAESTRA_DATOS: hex(32),
    CRON_SECRET: hex(24),
  }
  let contenido = fs.readFileSync(RUTA_EJEMPLO, 'utf8')
  for (const [clave, valor] of Object.entries(valores)) {
    contenido = contenido.replace(new RegExp(`^${clave}=.*$`, 'm'), () => `${clave}=${valor}`)
  }
  fs.writeFileSync(RUTA_ENV, contenido)
  envNuevo = true
  ok('backend/.env creado con claves nuevas')
}

// ── 4. Base de datos ─────────────────────────────────────────────────────────
paso(4, 'Base de datos (esquema + datos de prueba)')
if (!sinConfirmar) {
  aviso('Esto BORRA lo que haya en la base configurada y la llena con datos de prueba.')
  if (!envNuevo) aviso('Estás usando un backend/.env que ya existía: confirma que NO es la base real.')
  const r = (await preguntar('  ¿Continuar? (s/n): ')).trim().toLowerCase()
  cerrarPreguntas()
  if (r !== 's' && r !== 'si' && r !== 'sí') {
    console.log('\n  Se omitió la base. Cuando quieras: npm run db:push && npm run db:seed\n')
    process.exit(0)
  }
}
// db push también genera el cliente de Prisma.
if (!correr('npx prisma db push', BACKEND)) {
  fallar(
    'No se pudo aplicar el esquema (mira el error de arriba). Si es de conexión, revisa en Atlas:\n' +
      '  - que la contraseña de la cadena sea la correcta\n' +
      '  - Network Access → que tu IP esté permitida\n' +
      '  Corrige DATABASE_URL en backend/.env y vuelve a correr: npm run preparar',
  )
}
if (!correr('node prisma/seed.mjs', BACKEND)) fallar('El sembrado de datos falló (mira el error de arriba).')

console.log(
  `\n${VERDE}${NEGRITA}✅ Listo.${RESET} Arranca el sistema con:  ${NEGRITA}npm run dev${RESET}\n` +
    '   y abre http://localhost:5173 en el navegador.\n',
)
