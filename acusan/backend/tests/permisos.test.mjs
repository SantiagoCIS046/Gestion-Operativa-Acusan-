// Matriz de permisos por rol — qué puede ver y gestionar cada uno.

import test from 'node:test'
import assert from 'node:assert/strict'

import { puedeVer, puedeGestionar, areaEfectiva } from '../src/modules/auth/permisos.js'

const AREA_PROPIA = 'area-111'
const AREA_OTRA = 'area-222'

const liderGeneral = { id: 'u1', rol: 'LIDER_GENERAL', areaId: AREA_PROPIA }
const liderArea = { id: 'u2', rol: 'LIDER_AREA', areaId: AREA_PROPIA }
const usuario = { id: 'u3', rol: 'USUARIO', areaId: AREA_PROPIA }

test('puedeVer: lider_general ve todas las áreas', () => {
  assert.equal(puedeVer(liderGeneral, AREA_PROPIA), true)
  assert.equal(puedeVer(liderGeneral, AREA_OTRA), true)
})

test('puedeVer: lider_area y usuario solo ven su área', () => {
  assert.equal(puedeVer(liderArea, AREA_PROPIA), true)
  assert.equal(puedeVer(liderArea, AREA_OTRA), false)
  assert.equal(puedeVer(usuario, AREA_PROPIA), true)
  assert.equal(puedeVer(usuario, AREA_OTRA), false)
})

test('puedeVer: sin usuario o sin área no se ve nada', () => {
  assert.equal(puedeVer(null, AREA_PROPIA), false)
  assert.equal(puedeVer(usuario, null), false)
  assert.equal(puedeVer({}, AREA_PROPIA), false)
})

test('puedeGestionar: lider_general gestiona todas', () => {
  assert.equal(puedeGestionar(liderGeneral, AREA_PROPIA), true)
  assert.equal(puedeGestionar(liderGeneral, AREA_OTRA), true)
})

test('puedeGestionar: lider_area gestiona solo su área', () => {
  assert.equal(puedeGestionar(liderArea, AREA_PROPIA), true)
  assert.equal(puedeGestionar(liderArea, AREA_OTRA), false)
})

test('puedeGestionar: usuario no gestiona ni siquiera su área', () => {
  assert.equal(puedeGestionar(usuario, AREA_PROPIA), false)
  assert.equal(puedeGestionar(usuario, AREA_OTRA), false)
})

test('areaEfectiva: lider_general decide el área (y por defecto la suya)', () => {
  assert.equal(areaEfectiva(liderGeneral, AREA_OTRA), AREA_OTRA)
  assert.equal(areaEfectiva(liderGeneral, undefined), AREA_PROPIA)
})

test('areaEfectiva: el areaId del body se ignora para los demás roles', () => {
  // Manda otra área → queda forzado a la suya (regla clave del token)
  assert.equal(areaEfectiva(liderArea, AREA_OTRA), AREA_PROPIA)
  assert.equal(areaEfectiva(usuario, AREA_OTRA), AREA_PROPIA)
  assert.equal(areaEfectiva(liderArea, undefined), AREA_PROPIA)
})
