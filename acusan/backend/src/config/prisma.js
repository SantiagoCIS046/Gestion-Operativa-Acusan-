import { PrismaClient } from '@prisma/client'
import logger from './logger.js'
import { extensionCifrado } from '../lib/extensionCifrado.js'

const base = new PrismaClient({
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
