// Recalcula los informes YA guardados con el calendario/indicadores
// actuales (p. ej. tras registrar días no laborales que cambian el corte
// de periodos cerrados, o tras un cambio en las definiciones).
//
// - BORRA los informes PARCIALES (fotos tomadas con el periodo en curso;
//   el cierre automático los volverá a crear definitivos, y el parcial
//   del periodo en curso se recrea solo si gerencia lo vuelve a generar).
// - RECALCULA los informes CERRADOS (globales y por área — el alcance de
//   cada informe se conserva) manteniendo revisadoEn/revisadoPorId (un
//   informe revisado sigue revisado) y dejando rastro en
//   regeneradoEn/regeneradoPorId (sin usuario: origen del script).
//
// Uso:  npm run informes:recalcular            (desde backend/)
//       npm run informes:recalcular -- --dry-run   → solo muestra, no escribe

import 'dotenv/config'

const SECO = process.argv.includes('--dry-run')

const { guardarInforme } = await import('../src/services/informes.js')
const prisma = (await import('../src/config/prisma.js')).default

try {
  const informes = await prisma.informe.findMany({ orderBy: { periodoInicio: 'asc' } })
  const parciales = informes.filter((i) => i.parcial)
  const cerrados = informes.filter((i) => !i.parcial)

  console.log(`Informes: ${informes.length} (${cerrados.length} cerrados, ${parciales.length} parciales)${SECO ? ' · DRY-RUN (no se escribe nada)' : ''}`)

  for (const i of parciales) {
    console.log(`  BORRAR   ${i.tipo.padEnd(8)} ${i.etiqueta}`)
    if (!SECO) await prisma.informe.delete({ where: { id: i.id } })
  }

  for (const i of cerrados) {
    const areaId = i.alcance !== 'global' ? i.alcance : undefined
    console.log(`  RECALCULAR ${i.tipo.padEnd(8)} ${i.etiqueta}${areaId ? ' · área' : ' · global'}${i.revisadoEn ? ' · conserva revisado' : ''}`)
    if (!SECO) await guardarInforme(null, i.tipo === 'SEMANAL' ? 'semanal' : 'mensual', i.periodoInicio, 'AUTOMATICO', { areaId })
  }

  console.log(SECO ? 'Dry-run terminado: nada se escribió.' : 'Recálculo terminado.')
} catch (error) {
  console.error('Falló el recálculo de informes:', error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
