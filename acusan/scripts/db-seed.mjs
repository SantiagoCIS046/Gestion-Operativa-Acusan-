// Siembra datos de ejemplo del módulo de vencimientos en MongoDB Atlas.
// Uso desde la raíz acusan/:  npm run db:seed
// Corre `node prisma/seed.mjs` DENTRO de backend/ para que dotenv cargue
// backend/.env con DATABASE_URL (npm --prefix falla en Windows local).

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const BACKEND = join(RAIZ, 'backend')

const hijo = spawn('node prisma/seed.mjs', {
  shell: true,
  cwd: BACKEND,
  stdio: 'inherit',
})

hijo.on('exit', (code) => process.exit(code ?? 1))
