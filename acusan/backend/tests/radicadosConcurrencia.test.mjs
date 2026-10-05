/**
 * radicadosConcurrencia.test.mjs — Prueba de concurrencia de la numeración RAD-AAAA-NNNNN
 * ─────────────────────────────────────────────────────────────────────────────
 * Dispara N creaciones SIMULTÁNEAS de radicados: todas leen el mismo conteo
 * del año y compiten por el mismo consecutivo, así que el unique de
 * numeroRadicado (P2002) se dispara seguro. Con el reintento de crear() las
 * N deben resolver con números ÚNICOS y consecutivos — ninguna falla con 500.
 *
 * También verifica la atomicidad de crearRespuesta(): la respuesta archivada
 * y el estado Resuelto del radicado padre quedan escritos juntos.
 *
 * Escribe en la BD REAL (la del .env) marcando todo con registradoPor
 * "test-concurrencia" y BORRA lo creado al terminar: el conteo de radicados
 * del año queda exactamente como estaba.
 *
 * Ejecutar:  cd acusan/backend && node --env-file=.env tests/radicadosConcurrencia.test.mjs
 */

const MARCA = 'test-concurrencia'
const N_SIMULTANEOS = 12

const { RadicadosService } = await import('../src/modules/radicados/radicados.service.js')
const { default: prisma } = await import('../src/config/prisma.js')

let fallos = 0
const verificar = (condicion, mensaje) => {
  if (condicion) {
    console.log(`  ✓ ${mensaje}`)
  } else {
    fallos++
    console.error(`  ✗ FALLO: ${mensaje}`)
  }
}

// ─── 1. Carrera de numeración: N creaciones simultáneas ─────────────────────
console.log(`\n[1] ${N_SIMULTANEOS} radicaciones simultáneas (competencia por el consecutivo)…`)

const anio = new Date().getFullYear()
const antes = await prisma.radicado.count({ where: { fechaRadicacion: { gte: new Date(`${anio}-01-01T00:00:00.000Z`) } } })

const datosPrueba = (i) => ({
  peticionario: `PRUEBA CONCURRENCIA ${i} (BORRAR)`,
  dependencia: 'ACUASAN E.S.P.',
  asunto: 'Prueba automatizada de concurrencia',
  registradoPor: MARCA,
  diasParaVencer: 15
})

let creados = []
try {
  // Sin el reintento del P2002, varias de estas promesas rechazan; con él,
  // las 12 deben resolverse cada una con su número único.
  const resultados = await Promise.allSettled(
    Array.from({ length: N_SIMULTANEOS }, (_, i) => RadicadosService.crear(datosPrueba(i)))
  )
  const exitosos = resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const fallidos = resultados.filter((r) => r.status === 'rejected')
  creados = exitosos

  verificar(fallidos.length === 0,
    `las ${N_SIMULTANEOS} radicaciones simultáneas se crearon (0 rechazadas${fallidos.length ? ` — ${fallidos.length} fallaron: ${fallidos[0].reason?.message}` : ''})`)

  const numeros = exitosos.map((r) => r.numeroRadicado)
  verificar(new Set(numeros).size === numeros.length, `los ${numeros.length} números son únicos: ${numeros.slice().sort().join(', ')}`)
  verificar(numeros.every((n) => new RegExp(`^RAD-${anio}-\\d{5}$`).test(n)), 'todos con formato RAD-AAAA-NNNNN del año corriente')
  verificar(exitosos.every((r) => r.estado === 'Pendiente' && r.peticionario.startsWith('PRUEBA CONCURRENCIA')),
    'cada radicado nace Pendiente y con sus datos intactos')

  // La numeración no deja huecos: los N números son consecutivos entre sí.
  const consecutivos = numeros
    .map((n) => parseInt(n.split('-')[2], 10))
    .sort((a, b) => a - b)
  verificar(consecutivos[N_SIMULTANEOS - 1] - consecutivos[0] === N_SIMULTANEOS - 1,
    `los consecutivos quedaron contiguos (${consecutivos[0]}…${consecutivos[N_SIMULTANEOS - 1]}), sin huecos por la carrera`)
} finally {
  // ─── 2. Limpieza inmediata de lo creado por la prueba ──────────────────────
  const borrados = await prisma.radicado.deleteMany({ where: { registradoPor: MARCA } })
  verificar(borrados.count === creados.length,
    `limpieza: ${borrados.count} radicados de prueba eliminados (creados: ${creados.length})`)
  const despues = await prisma.radicado.count({ where: { fechaRadicacion: { gte: new Date(`${anio}-01-01T00:00:00.000Z`) } } })
  verificar(despues === antes, `la BD queda como estaba (antes: ${antes}, después: ${despues})`)
}

// ─── 3. Atomicidad de crearRespuesta: respuesta + Resuelto juntos ────────────
console.log('\n[2] archivar respuesta → radicado pasa a Resuelto en la misma transacción…')

const radPrueba = await RadicadosService.crear({ ...datosPrueba(99), asunto: 'Padre para prueba de respuesta' })
try {
  verificar(radPrueba.estado === 'Pendiente', 'el radicado padre nace Pendiente')

  const respuesta = await RadicadosService.crearRespuesta({
    radicadoId: radPrueba.id,
    numeroOficio: 'OF-TEST-001',
    destinatario: 'Peticionario de Prueba',
    registradoPor: MARCA
  })

  verificar(!!respuesta?.id && respuesta.numeroRadicado === radPrueba.numeroRadicado,
    `respuesta archivada y vinculada al padre (${respuesta.numeroRadicado} / ${respuesta.numeroOficio})`)

  const padre = await prisma.radicado.findUnique({ where: { id: radPrueba.id }, select: { estado: true } })
  verificar(padre.estado === 'Resuelto', 'el padre quedó Resuelto junto con la respuesta (atómico)')

  const leidas = await RadicadosService.listarRespuestas(radPrueba.id)
  verificar(leidas.length === 1 && leidas[0].numeroOficio === 'OF-TEST-001',
    'listarRespuestas(radicadoId) devuelve exactamente la archivada')
} finally {
  await prisma.respuestaRadicado.deleteMany({ where: { radicadoId: radPrueba.id } })
  await prisma.radicado.delete({ where: { id: radPrueba.id } })
  console.log('  ✓ limpieza: radicado padre y su respuesta eliminados')
}

// ─── Resultado ───────────────────────────────────────────────────────────────
console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS DE CONCURRENCIA PASARON\n' : `\n${fallos} PRUEBAS FALLARON\n`)
await prisma.$disconnect()
process.exit(fallos === 0 ? 0 : 1)
