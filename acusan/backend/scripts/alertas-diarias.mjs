// Revisión diaria de alertas SIN usuario (la misma del POST /api/cron/alertas
// pero para ejecutarla en local: Task Scheduler, cron del sistema, manual).
// Cierra también los informes de periodos vencidos (mismo cron, idempotente).
// Uso:  node scripts/alertas-diarias.mjs   (desde backend/)
//   o   npm run alertas:diarias            (desde acusan/)

import 'dotenv/config'

const { AlertaService } = await import('../src/modules/alertas/alerta.service.js')
const { sincronizarInformes } = await import('../src/services/informes.js')
const prisma = (await import('../src/config/prisma.js')).default

try {
  const resultado = await AlertaService.ejecutarRevision({})
  const e = resultado.ejecucion
  console.log(`Radicados · alcance=${e.alcance} · nuevas=${e.nuevas} reenviadas=${e.reenviadas}`)
  for (const area of resultado.areas) {
    console.log(
      `  ${area.area.codigo} (${area.area.nombre}): ${area.alertas} alertas · ` +
        `${area.vencidos} vencidos · ${area.porVencer} por vencer · ` +
        `notifica a ${area.notificados.lider?.email ?? '—'} y ${area.notificados.encargados.length} encargado(s)` +
        (area.notificados.gerencia ? ' · escalada a gerencia' : ''),
    )
  }
} catch (error) {
  console.error('Falló la revisión de alertas:', error.message)
  process.exitCode = 1
}

// Cierre de informes: aunque la revisión de alertas falle, se intenta
// (cada cosa reporta su propio error).
try {
  const info = await sincronizarInformes()
  if (info.informesCreados || info.informesActualizados || info.avisosCreados) {
    console.log(`Informes · ${info.informesCreados} nuevo(s), ${info.informesActualizados} actualizado(s), ${info.avisosCreados} aviso(s)`)
  } else {
    console.log('Informes · sin periodos pendientes de cierre')
  }
} catch (error) {
  console.error('Falló la sincronización de informes:', error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
