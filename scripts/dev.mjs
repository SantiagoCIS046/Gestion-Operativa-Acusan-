// Arranca el backend (Express, puerto 3000) y el frontend (Vite, puerto 5173)
// juntos. Sin esto, `npm run dev` solo levanta Vite y todas las llamadas /api
// fallan con ECONNREFUSED porque el proxy no encuentra el backend en el puerto 3000.
import { spawn } from 'node:child_process'

const AZUL = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const GRIS = '\x1b[90m'
const RESET = '\x1b[0m'

const procesos = [
  {
    nombre: 'API',
    color: AZUL,
    cmd: 'npm --prefix acusan/backend run dev',
  },
  {
    nombre: 'WEB',
    color: MAGENTA,
    cmd: 'npm run dev:web',
  },
]

// shell: true es necesario en Windows para resolver npm.cmd (y en *nix no molesta).
const hijos = procesos.map((p) => {
  const hijo = spawn(p.cmd, {
    shell: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const prefijo = `${p.color}[${p.nombre}]${RESET} `
  const filtrarSalidaNpm = (linea) =>
    linea.replace(/^> [^\n]*\n?/, '').trim().length > 0 ? linea : ''

  hijo.stdout.on('data', (chunk) => {
    process.stdout.write(
      chunk
        .toString()
        .split('\n')
        .filter((l) => filtrarSalidaNpm(l) !== '')
        .map((l) => prefijo + l + '\n')
        .join('')
    )
  })
  hijo.stderr.on('data', (chunk) => {
    process.stderr.write(prefijo + chunk.toString())
  })
  hijo.on('exit', (code) => {
    process.stdout.write(
      `${GRIS}[${p.nombre}] proceso terminado (código ${code})${RESET}\n`
    )
  })
  return hijo
})

// Ctrl+C en la consola llega a los procesos hijos en Windows (misma consola) y
// via señal en *nix; aquí solo garantizamos no quedar colgados.
const salir = () => process.exit(0)
process.on('SIGINT', salir)
process.on('SIGTERM', salir)
