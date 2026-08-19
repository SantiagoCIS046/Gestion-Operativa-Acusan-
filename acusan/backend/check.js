import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const data = await prisma.permiso.findMany({ orderBy: { createdAt: 'desc' }, take: 2 })
  console.log(JSON.stringify(data, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
