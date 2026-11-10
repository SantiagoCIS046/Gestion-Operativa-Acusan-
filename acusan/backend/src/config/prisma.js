// Carga backend/.env aquí también: los scripts y pruebas que importan el
// cliente sin pasar por app.js (p. ej. calendarioCO.test) necesitan DATABASE_URL.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import logger from './logger.js'
import { extensionCifrado } from '../lib/extensionCifrado.js'

const base = new PrismaClient({
  // Las transacciones que guardan un PDF pueden subirlo a un almacén externo
  // (Vercel Blob): el límite por defecto de Prisma (5 s) se queda corto.
  transactionOptions: { timeout: 30_000, maxWait: 10_000 },
  log: [
    { level: 'warn',  emit: 'event' },
    { level: 'error', emit: 'event' }
  ]
})

// Capturar eventos de Prisma y canalizarlos al logger centralizado
base.$on('warn', (e) => {
  logger.warn('DB', 'PRISMA WARN', e.message)
})

base.$on('error', (e) => {
  logger.error('DB', 'PRISMA ERROR', e.message)
})

// Cliente con cifrado transparente de los datos sensibles (ver
// lib/extensionCifrado.js): TODO el backend usa este. El cliente `base` sin
// extensión solo lo usa el script de migración de datos existentes.
const prisma = base.$extends(extensionCifrado)

export { base as prismaSinCifrado }
export default prisma
