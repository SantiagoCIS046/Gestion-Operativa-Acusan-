// Aplica el esquema de Prisma a MongoDB Atlas (mongodb no usa migraciones).
// Uso desde la raíz acusan/:  npm run db:push
// Corre `npx prisma db push` DENTRO de backend/ (npm --prefix falla en
// Windows local, por eso el salto de directorio en vez de --prefix).

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const BACKEND = join(RAIZ, 'backend')

const hijo = spawn('npx prisma db push', {
  shell: true, // necesario en Windows para resolver npx.cmd
  cwd: BACKEND,
  stdio: 'inherit',
})

hijo.on('exit', (code) => process.exit(code ?? 1))
