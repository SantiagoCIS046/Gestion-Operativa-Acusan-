// Arranca el backend (Express, puerto 3000) y el frontend (Vite, puerto 5173)
// juntos. Sin esto, `npm run dev` solo levanta Vite y todas las llamadas /api
// fallan con ECONNREFUSED porque el proxy no encuentra el backend.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))

const AZUL = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const GRIS = '\x1b[90m'
const RESET = '\x1b[0m'

const procesos = [
  { nombre: 'API', color: AZUL, cmd: 'npm --prefix backend run dev' },
  { nombre: 'WEB', color: MAGENTA, cmd: 'npm run dev:web' },
]

// shell: true es necesario en Windows para resolver npm.cmd (y en *nix no molesta).
const hijos = procesos.map((p) => {
  const hijo = spawn(p.cmd, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: RAIZ,
  })

  const prefijo = `${p.color}[${p.nombre}]${RESET} `

  hijo.stdout.on('data', (chunk) => {
    process.stdout.write(
      chunk
        .toString()
        .split('\n')
        .map((l) => prefijo + l + '\n')
        .join('')
    )
  })
  hijo.stderr.on('data', (chunk) => {
    process.stderr.write(prefijo + chunk.toString())
  })
  hijo.on('exit', (code) => {
    process.stdout.write(`${GRIS}[${p.nombre}] proceso terminado (código ${code})${RESET}\n`)
  })
  return hijo
})

// Ctrl+C en la consola llega a los procesos hijos en Windows (misma consola) y
// via señal en *nix; aquí solo garantizamos no quedar colgados.
process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
