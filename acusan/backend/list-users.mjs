import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/config/prisma.js';

async function main() {
  const users = await prisma.usuario.findMany({
    include: { area: true },
    orderBy: { rol: 'asc' }
  });
  console.log(JSON.stringify(users.map(u => ({
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    area: u.area?.nombre || 'N/A'
  })), null, 2));
  await prisma.$disconnect();
}

main();
