// Cifra los datos sensibles que estén en texto plano en la base (migración
// inicial del 2026-11-03 y, desde el 2026-11-04, también cualquier documento
// que se haya metido por fuera de la aplicación). La lógica vive en
// src/services/barridoCifrado.js, el mismo barrido que corre solo en el cron
// diario y al arrancar el servidor.
//
// Uso (desde backend/, con CLAVE_MAESTRA_DATOS en .env):
//   npm run datos:cifrar                    → cifra lo que falte (rápido: solo lo pendiente)
//   npm run datos:cifrar -- --simular       → solo cuenta, no escribe
//   npm run datos:cifrar -- --todo          → revisa documento por documento (más lento)
//   npm run datos:cifrar -- --revertir      → descifra todo de vuelta (plan B, misma llave)
//
// Es IDEMPOTENTE: lo ya cifrado se salta; si se corta, se vuelve a correr.

import 'dotenv/config'

import { prismaSinCifrado as db } from '../src/config/prisma.js'
import { cifrarPendientes } from '../src/services/barridoCifrado.js'

const SIMULAR = process.argv.includes('--simular')
const REVERTIR = process.argv.includes('--revertir')
const TODO = process.argv.includes('--todo')

const resumen = await cifrarPendientes({ simular: SIMULAR, revertir: REVERTIR, todo: TODO })

console.log(`\n${SIMULAR ? '🔎 SIMULACIÓN (no se escribió nada)' : REVERTIR ? '↩️  Datos descifrados' : '🔐 Datos cifrados'}`)
console.table(resumen)
if (SIMULAR) console.log('Si los números se ven bien, corre el mismo comando sin --simular.\n')

await db.$disconnect()
