// Pruebas del calendario hábil de Colombia — correr con:
//   cd backend && npm test   (o node --test src/lib/calendarioCO.test.mjs)
// Las funciones de periodo son async (consultan los días no laborales
// extra de la BD; en pruebas la colección está vacía).

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  festivosDelAnio,
  esFestivo,
  nombreFestivo,
  tipoDia,
  esHabil,
  ultimoDiaHabil,
  siguienteDiaHabil,
  diasHabilesEntre,
  sumarDiasHabiles,
  diasHabilesDelMes,
  periodoDe,
  periodoAnterior,
  periodosCerradosPendientes,
  etiquetaPeriodo,
  semanasDelMesHabil,
  TIPO_SEMANAL,
  TIPO_MENSUAL,
} from './calendarioCO.js'

const dia = (d) => d.toISOString().slice(0, 10)

test('Pascua (indirecta): fechas de Jueves/Viernes Santo y trasladados', () => {
  // La posición de los móviles confirma la Pascua de cada año
  const juevesSanto = (anio) => festivosDelAnio(anio).find((f) => f.nombre === 'Jueves Santo').fecha
  const viernesSanto = (anio) => festivosDelAnio(anio).find((f) => f.nombre === 'Viernes Santo').fecha
  assert.equal(juevesSanto(2024), '2024-03-28') // Pascua 31 mar
  assert.equal(juevesSanto(2025), '2025-04-17') // Pascua 20 abr
  assert.equal(juevesSanto(2026), '2026-04-02') // Pascua 5 abr
  assert.equal(juevesSanto(2027), '2027-03-25') // Pascua 28 mar
  assert.equal(juevesSanto(2028), '2028-04-13') // Pascua 16 abr
  assert.equal(viernesSanto(2026), '2026-04-03')
})

test('festivos 2026 exactos (18 fechas)', () => {
  const fechas = festivosDelAnio(2026).map((f) => f.fecha).sort()
  assert.deepEqual(fechas, [
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
    '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
    '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
    '2026-11-16', '2026-12-08', '2026-12-25',
  ])
})

test('2025: 17 fechas distintas y el 30 jun trae dos nombres', () => {
  const f2025 = festivosDelAnio(2025)
  assert.equal(new Set(f2025.map((f) => f.fecha)).size, 17)
  const jun30 = f2025.filter((f) => f.fecha === '2025-06-30').map((f) => f.nombre).sort()
  assert.deepEqual(jun30, ['Sagrado Corazón', 'San Pedro y San Pablo'])
})

test('1990–2200: 17 o 18 fechas distintas y todos los trasladables caen en lunes', () => {
  const EMILIANI = new Set(['Reyes Magos', 'San José', 'San Pedro y San Pablo', 'Asunción de la Virgen', 'Día de la Raza', 'Todos los Santos', 'Independencia de Cartagena', 'Ascensión del Señor', 'Corpus Christi', 'Sagrado Corazón'])
  for (let anio = 1990; anio <= 2200; anio += 13) { // muestra determinista de todo el rango
    const fs = festivosDelAnio(anio)
    const distintas = new Set(fs.map((f) => f.fecha)).size
    assert.ok(distintas === 17 || distintas === 18, `${anio}: ${distintas} fechas distintas`)
    for (const f of fs.filter((x) => EMILIANI.has(x.nombre))) {
      const dow = new Date(`${f.fecha}T00:00:00.000Z`).getUTCDay()
      assert.equal(dow, 1, `${anio} ${f.nombre} (${f.fecha}) no es lunes`)
    }
  }
})

test('clasificación de días de octubre 2026', async () => {
  assert.equal((await tipoDia('2026-10-20')), 'habil') // martes 20 hábil
  assert.ok(await esHabil('2026-10-20'))
  assert.equal((await tipoDia('2026-10-12')), 'festivo') // Día de la Raza (lunes)
  assert.equal(await nombreFestivo('2026-10-12'), 'Día de la Raza')
  assert.equal((await tipoDia('2026-10-31')), 'fin_de_semana') // sábado
  assert.equal((await tipoDia('2026-11-01')), 'fin_de_semana') // domingo
  // 1 nov es domingo pero Todos los Santos es Emiliani → se traslada al
  // lunes 2 nov; el 1 queda como fin de semana sin nombre. Un FIJO en
  // sábado (1 may 2027) sí conserva su nombre siendo fin_de_semana:
  assert.equal(await nombreFestivo('2026-11-01'), null)
  assert.equal((await tipoDia('2027-05-01')), 'fin_de_semana')
  assert.equal(await nombreFestivo('2027-05-01'), 'Día del Trabajo')
  assert.equal((await tipoDia('2026-10-24')), 'fin_de_semana') // sábado
})

test('último y siguiente día hábil, días hábiles entre y sumar', async () => {
  assert.equal(dia(await ultimoDiaHabil('2026-10-18')), '2026-10-16') // domingo → viernes
  assert.equal(dia(await ultimoDiaHabil('2026-10-12')), '2026-10-09') // festivo lunes → viernes previo
  assert.equal(dia(await siguienteDiaHabil('2026-10-17')), '2026-10-19') // sábado → lunes
  assert.equal(dia(await siguienteDiaHabil('2026-10-16')), '2026-10-16') // viernes hábil → él mismo
  assert.equal(await diasHabilesEntre('2026-10-12', '2026-10-16'), 4) // lunes festivo
  assert.equal(await diasHabilesEntre('2026-10-05', '2026-10-09'), 5)
  assert.equal(dia(await sumarDiasHabiles('2026-10-16', 1)), '2026-10-19') // viernes +1 → lunes
  assert.equal(dia(await sumarDiasHabiles('2026-10-19', -1)), '2026-10-16')
  assert.equal(await diasHabilesDelMes(2026, 10), 21)
  assert.equal(await diasHabilesDelMes(2026, 2), 20) // feb 2026: 4 semanas exactas
})

test('periodoDe: semana con festivo el lunes y semana con viernes festivo', async () => {
  // Semana del lunes 12 oct 2026 (festivo): lunes→jueves hábiles 13-16, 4 días
  const s = await periodoDe(TIPO_SEMANAL, '2026-10-14')
  assert.equal(dia(s.clave), '2026-10-12')
  assert.equal(dia(s.hastaDia), '2026-10-16')
  assert.equal(s.diasHabiles, 4)
  assert.deepEqual(s.festivosIncluidos.map((f) => f.fecha), ['2026-10-12'])
  // Semana santa 2026: jueves 2 y viernes 3 abr son festivos → cierra el
  // miércoles 1 de abril
  const santo = await periodoDe(TIPO_SEMANAL, '2026-03-31')
  assert.equal(dia(santo.hastaDia), '2026-04-01')
  assert.equal(santo.diasHabiles, 3) // lun 30, mar 31, mié 1
})

test('periodoDe: octubre 2026 termina el viernes 30; el 31/1nov/2nov van a noviembre', async () => {
  const o = await periodoDe(TIPO_MENSUAL, '2026-10-20')
  assert.equal(dia(o.clave), '2026-10-01')
  assert.equal(dia(o.hastaDia), '2026-10-30') // 31 oct es sábado
  assert.equal(o.diasHabiles, 21)
  // El sábado 31 y el festivo lunes 2 nov pertenecen al periodo de noviembre
  const p31 = await periodoDe(TIPO_SEMANAL, '2026-10-31')
  assert.equal(dia(p31.clave), '2026-11-02')
  const n = await periodoDe(TIPO_MENSUAL, '2026-11-02')
  assert.ok(n.festivosIncluidos.some((f) => f.fecha === '2026-11-02'))
})

test('sábado 11:30 p. m. de Bogotá cae en el periodo siguiente aunque en UTC sea domingo', async () => {
  const instante = new Date('2026-10-25T04:30:00Z') // sáb 24 oct 23:30 Bogotá
  const p = await periodoDe(TIPO_SEMANAL, instante)
  assert.equal(dia(p.clave), '2026-10-26') // semana del lunes 26, no la del 19
})

test('cambio de año: continuidad de instantes entre periodos consecutivos (2 años)', async () => {
  const MS_DIA = 86400000
  for (const tipo of [TIPO_SEMANAL, TIPO_MENSUAL]) {
    let clave = (await periodoDe(tipo, '2025-12-15')).clave
    let actual = await periodoDe(tipo, clave)
    for (let i = 0; i < 110; i++) {
      // +7/+31 días desde la clave cae dentro del periodo siguiente
      const claveSig = new Date(clave.getTime() + (tipo === TIPO_SEMANAL ? 7 : 31) * MS_DIA)
      const siguiente = await periodoDe(tipo, claveSig)
      assert.equal(actual.hastaInstante.getTime(), siguiente.desdeInstante.getTime(),
        `${tipo} ${dia(clave)}: hasta ${actual.hastaInstante.toISOString()} ≠ desde ${siguiente.desdeInstante.toISOString()}`)
      clave = siguiente.clave
      actual = siguiente
    }
  }
})

test('periodosCerradosPendientes: hoy nunca cerrado; el periodo que corta hoy tampoco', async () => {
  // Jueves 15 oct 2025 10:00 Bogotá: la semana 6–10 oct ya cerró (viernes 10 23:59)
  const cerradas = await periodosCerradosPendientes(TIPO_SEMANAL, '2025-10-01', new Date('2025-10-15T15:00:00Z'))
  const claves = cerradas.map(dia)
  // desde 1 oct (miércoles) cae en la semana del 29 sep, que también cerró
  assert.deepEqual(claves, ['2025-09-29', '2025-10-06'])
  // Viernes 10 oct 23:30 Bogotá (ya 11 en UTC parcial… 04:30Z del 11 = 23:30 del 10):
  // el corte es la medianoche del sábado → aún NO está cerrada
  const antesDelCorte = await periodosCerradosPendientes(TIPO_SEMANAL, '2025-10-06', new Date('2025-10-10T23:30:00-05:00'))
  assert.deepEqual(antesDelCorte.map(dia), [])
  // A las 00:30 del sábado ya cerró
  const despuesDelCorte = await periodosCerradosPendientes(TIPO_SEMANAL, '2025-10-06', new Date('2025-10-11T00:30:00-05:00'))
  assert.deepEqual(despuesDelCorte.map(dia), ['2025-10-06'])
  // Meses: con hoy 3 oct 2026, septiembre cerró y octubre no
  const meses = await periodosCerradosPendientes(TIPO_MENSUAL, '2026-08-01', new Date('2026-10-03T15:00:00Z'))
  assert.deepEqual(meses.map(dia), ['2026-08-01', '2026-09-01'])
})

test('periodoAnterior y etiquetas con días hábiles', async () => {
  assert.equal(dia(await periodoAnterior(TIPO_SEMANAL, '2026-10-12')), '2026-10-05')
  assert.equal(dia(await periodoAnterior(TIPO_MENSUAL, '2026-01-01')), '2025-12-01')
  assert.equal(await etiquetaPeriodo(TIPO_SEMANAL, '2026-10-12'), 'Semana 12–16 oct 2026 · 4 días hábiles')
  assert.equal(await etiquetaPeriodo(TIPO_MENSUAL, '2026-10-01'), 'Octubre 2026 · 21 días hábiles')
})

// ── Semanas del mes con corte hábil (regla de informes) ──

const resumenSemanas = (semanas) => semanas.map((s) => `S${s.numero} ${s.inicioISO}→${s.finISO} (${s.diasHabiles})`)

test('semanasDelMesHabil: octubre 2026 con el lunes 12 festivo (ejemplo exacto de la regla)', async () => {
  const semanas = await semanasDelMesHabil(2026, 10)
  assert.deepEqual(resumenSemanas(semanas), [
    'S1 2026-10-01→2026-10-02 (2)', // mes arranca jueves: jue 1 – vie 2
    'S2 2026-10-05→2026-10-09 (5)',
    'S3 2026-10-13→2026-10-16 (4)', // lunes 12 festivo corta: mar 13 – vie 16
    'S4 2026-10-19→2026-10-23 (5)',
    'S5 2026-10-26→2026-10-30 (5)', // 31 oct sábado → noviembre
  ])
  // Las semanas suman exactamente el mes: sus hábiles = los del mes
  assert.equal(semanas.reduce((s, x) => s + x.diasHabiles, 0), await diasHabilesDelMes(2026, 10))
})

test('semanasDelMesHabil: agosto 2026 (festivo lunes 17) y febrero (4 semanas exactas)', async () => {
  assert.deepEqual(resumenSemanas(await semanasDelMesHabil(2026, 8)), [
    'S1 2026-08-03→2026-08-06 (4)', // 1–2 ago fin de semana y VIE 7 festivo fijo
    'S2 2026-08-10→2026-08-14 (5)',
    'S3 2026-08-18→2026-08-21 (4)', // 15 ago sábado → Emiliani lunes 17
    'S4 2026-08-24→2026-08-28 (5)',
    'S5 2026-08-31→2026-08-31 (1)', // lunes 31 solo
  ])
  assert.deepEqual(resumenSemanas(await semanasDelMesHabil(2026, 2)), [
    'S1 2026-02-02→2026-02-06 (5)',
    'S2 2026-02-09→2026-02-13 (5)',
    'S3 2026-02-16→2026-02-20 (5)',
    'S4 2026-02-23→2026-02-27 (5)',
  ])
})

test('semanasDelMesHabil: contigüidad de cortes [desde, hasta) entre bloques', async () => {
  for (const [anio, mes] of [[2026, 10], [2026, 12], [2027, 1]]) {
    const semanas = await semanasDelMesHabil(anio, mes)
    assert.ok(semanas.length >= 4, `${anio}-${mes}: muy pocas semanas`)
    for (let i = 1; i < semanas.length; i++) {
      assert.ok(
        semanas[i - 1].hastaInstante.getTime() <= semanas[i].desdeInstante.getTime(),
        `${anio}-${mes}: S${i} se solapa con S${i + 1}`,
      )
    }
    assert.equal(semanas.reduce((s, x) => s + x.diasHabiles, 0), await diasHabilesDelMes(anio, mes))
  }
})
