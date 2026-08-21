import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

const prisma = new PrismaClient({
  log: [
    { level: 'warn',  emit: 'event' },
    { level: 'error', emit: 'event' }
  ]
})

// Capturar eventos de Prisma y canalizarlos al logger centralizado
prisma.$on('warn', (e) => {
  logger.warn('DB', 'PRISMA WARN', e.message)
})

prisma.$on('error', (e) => {
  logger.error('DB', 'PRISMA ERROR', e.message)
})

export default prisma
