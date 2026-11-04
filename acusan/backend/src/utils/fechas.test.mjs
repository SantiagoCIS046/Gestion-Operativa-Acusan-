// Pruebas simples de las utilidades de fechas — correr con:
//   cd backend && npm run test:fechas

import test from 'node:test'
import assert from 'node:assert/strict'

import { hoyBogota, diasHasta, enDias } from './fechas.js'

test('hoyBogota devuelve una fecha YYYY-MM-DD', () => {
  assert.match(hoyBogota(), /^\d{4}-\d{2}-\d{2}$/)
})

test('hoyBogota respeta la hora de Bogotá (UTC-5)', () => {
  // 03:30 UTC del 16 de octubre = 22:30 del 15 en Bogotá
  assert.equal(hoyBogota(new Date('2026-10-16T03:30:00Z')), '2026-10-15')
  // 23:30 UTC del 15 = 18:30 del mismo día en Bogotá
  assert.equal(hoyBogota(new Date('2026-10-15T23:30:00Z')), '2026-10-15')
})

test('diasHasta cuenta días de calendario', () => {
  assert.equal(diasHasta('2026-10-16', '2026-10-16'), 0)
  assert.equal(diasHasta('2026-10-21', '2026-10-16'), 5)
  assert.equal(diasHasta('2026-10-10', '2026-10-16'), -6)
  assert.equal(diasHasta('2027-10-16', '2026-10-16'), 365)
})

test('diasHasta normaliza fechas con hora al calendario de Bogotá', () => {
  // 02:00 UTC del 21 = 21:00 del 20 en Bogotá → cuenta como día 20, no 21
  assert.equal(diasHasta(new Date('2026-10-21T02:00:00Z'), '2026-10-16'), 4)
})

test('diasHasta respeta la convención de almacenamiento (medianoche Bogotá = 05:00Z)', () => {
  // Un límite de 04:59:59Z todavía pertenece al día anterior en Bogotá
  assert.equal(diasHasta(new Date('2026-10-21T04:59:59Z'), '2026-10-16'), 4)
  // La medianoche de Bogotá del 21 (05:00Z) ya cuenta como día 21
  assert.equal(diasHasta(new Date('2026-10-21T05:00:00Z'), '2026-10-16'), 5)
})

test('enDias produce fechas en la medianoche de Bogotá del día correcto', () => {
  const hoy = '2026-10-16'
  assert.equal(diasHasta(enDias(0, hoy), hoy), 0)
  assert.equal(diasHasta(enDias(7, hoy), hoy), 7)
  assert.equal(diasHasta(enDias(-30, hoy), hoy), -30)
  // El instante exacto: hoy a las 05:00Z
  assert.equal(enDias(0, hoy).toISOString(), '2026-10-16T05:00:00.000Z')
})
