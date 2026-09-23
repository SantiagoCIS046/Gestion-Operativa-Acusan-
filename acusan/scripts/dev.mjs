// Arranca el backend (Express, puerto 3000), el frontend (Vite, puerto 5173)
// y el motor OCR Python (Flask, puerto 5001) juntos. Sin esto, `npm run dev`
// solo levanta Vite y todas las llamadas /api fallan con ECONNREFUSED porque
// el proxy no encuentra el backend en el puerto 3000. El OCR Python es
// opcional: si no logra arrancar, el OCR del navegador toma el relevo.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))


const AZUL = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const VERDE = '\x1b[32m'
const AMARILLO = '\x1b[33m'
const GRIS = '\x1b[90m'
const RESET = '\x1b[0m'

const procesos = [
  {
    nombre: 'API',
    color: AZUL,
    cmd: 'npm --prefix backend run dev',
  },
  {
    nombre: 'WEB',
    color: MAGENTA,
    cmd: 'npm run dev:web',
  },
]

// Motor OCR Python: prefiere el venv de acusan/; si no existe, python del PATH.
const pythonVenv = join(RAIZ, '.venv', 'Scripts', 'python.exe')
const servidorOcr = join('backend', 'acuusan_ocr', 'server.py')
const cmdPython = `"${pythonVenv}" ${servidorOcr}`

if (existsSync(pythonVenv)) {
  procesos.push({
    nombre: 'OCR-PY',
    color: VERDE,
    cmd: cmdPython,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PORT_OCR: '5001' },
    opcional: true,
  })
} else {
  process.stdout.write(
    `${AMARILLO}[OCR-PY] sin .venv en acusan/ — motor Python no arrancado (el OCR del navegador queda como motor).${RESET}\n`
  )
}

// shell: true es necesario en Windows para resolver npm.cmd (y en *nix no molesta).
const hijos = procesos.map((p) => {
  const hijo = spawn(p.cmd, {
    shell: true,
    env: p.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: RAIZ,
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

  const arranque = Date.now()
  hijo.on('exit', (code) => {
    // Un opcional que muere al instante (venv sin dependencias, puerto
    // tomado) no debe sepultar la consola: un aviso y a correr.
    if (p.opcional && Date.now() - arranque < 3000) {
      process.stdout.write(
        `${AMARILLO}[OCR-PY] no disponible (código ${code}) — el OCR del navegador queda como motor. Instale con (desde acusan/): .venv\\Scripts\\python -m pip install -r backend/acuusan_ocr/requirements.txt${RESET}\n`
      )
    } else {
      process.stdout.write(
        `${GRIS}[${p.nombre}] proceso terminado (código ${code})${RESET}\n`
      )
    }
  })
  return hijo
})

// Ctrl+C en la consola llega a los procesos hijos en Windows (misma consola) y
// via señal en *nix; aquí solo garantizamos no quedar colgados.
const salir = () => process.exit(0)
process.on('SIGINT', salir)
process.on('SIGTERM', salir)
