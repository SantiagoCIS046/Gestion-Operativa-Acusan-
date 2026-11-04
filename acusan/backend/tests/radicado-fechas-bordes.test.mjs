// Bordes exactos de las utilidades de radicados (spec R1):
// día límite = por_vencer / a_tiempo · día siguiente = vencido / con_retraso
// 7 días antes = por_vencer · 8 días antes = sano.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  enDias,
  diasRestantes,
  estadoRadicado,
  resultadoRespuesta,
  RADICADO_DIAS_POR_VENCER,
} from '../src/utils/fechas.js'

test('constante: la ventana de por vencer de radicados es 7 días', () => {
  assert.equal(RADICADO_DIAS_POR_VENCER, 7)
})

test('vence hoy → por_vencer con 0 días restantes', () => {
  const limite = enDias(0)
  assert.equal(diasRestantes(limite), 0)
  assert.equal(estadoRadicado(limite), 'por_vencer')
})

test('venció ayer → vencido con -1 días', () => {
  const limite = enDias(-1)
  assert.equal(diasRestantes(limite), -1)
  assert.equal(estadoRadicado(limite), 'vencido')
})

test('vence en 7 días → por_vencer: borde superior incluido', () => {
  const limite = enDias(7)
  assert.equal(diasRestantes(limite), 7)
  assert.equal(estadoRadicado(limite), 'por_vencer')
})

test('vence en 8 días → sano', () => {
  const limite = enDias(8)
  assert.equal(diasRestantes(limite), 8)
  assert.equal(estadoRadicado(limite), 'sano')
})

test('respuesta el mismo día de la límite → a_tiempo', () => {
  const limite = enDias(0)
  assert.equal(resultadoRespuesta(enDias(0), limite), 'a_tiempo')
})

test('respuesta el día anterior a la límite → a_tiempo', () => {
  const limite = enDias(5)
  assert.equal(resultadoRespuesta(enDias(4), limite), 'a_tiempo')
})

test('respuesta el día siguiente a la límite → con_retraso', () => {
  const limite = enDias(0)
  assert.equal(resultadoRespuesta(enDias(1), limite), 'con_retraso')
})

test('respuesta al día de una límite futura lejana → a_tiempo (compara días, no instantes)', () => {
  const limite = enDias(20)
  assert.equal(resultadoRespuesta(enDias(20), limite), 'a_tiempo')
  assert.equal(resultadoRespuesta(enDias(21), limite), 'con_retraso')
})

// La respuesta y la límite se normalizan a días de calendario bogotanos:
// una límite almacenada como medianoche de Bogotá (05:00Z) y la misma fecha
// escrita como 'YYYY-MM-DD' deben clasificar idéntico.
test('acepta fechas como Date (medianoche Bogotá) y como texto YYYY-MM-DD', () => {
  const limite = enDias(3)
  assert.equal(estadoRadicado(limite.toISOString().slice(0, 10)), estadoRadicado(limite))
  assert.equal(resultadoRespuesta(enDias(3), limite.toISOString().slice(0, 10)), 'a_tiempo')
  assert.equal(resultadoRespuesta(enDias(4), limite.toISOString().slice(0, 10)), 'con_retraso')
})
