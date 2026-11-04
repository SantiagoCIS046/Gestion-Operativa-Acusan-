// Revisión diaria de alertas sin usuario. Uso desde la raíz acusan/:
//   npm run alertas:diarias
// Corre el script DENTRO de backend/ (npm --prefix falla en Windows local,
// por eso el salto de directorio en vez de --prefix).

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const BACKEND = join(RAIZ, 'backend')

const hijo = spawn('node scripts/alertas-diarias.mjs', {
  shell: true, // necesario en Windows para resolver node.exe
  cwd: BACKEND,
  stdio: 'inherit',
})

hijo.on('exit', (code) => process.exit(code ?? 1))
