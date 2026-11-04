// Middlewares requireAuth / requireRole — unitarios, sin BD ni servidor.

import test from 'node:test'
import assert from 'node:assert/strict'
import 'dotenv/config'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba'

const { default: jwt } = await import('jsonwebtoken')
const { requireAuth, requireRole } = await import('../src/middlewares/auth.middleware.js')

// res espía mínimo con la API que usan los middlewares
function resFake() {
  return {
    statusCode: null,
    cuerpo: null,
    status(codigo) {
      this.statusCode = codigo
      return this
    },
    json(cuerpo) {
      this.cuerpo = cuerpo
      return this
    },
  }
}

function reqConToken(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} }
}

const tokenValido = (payload) => jwt.sign(payload, process.env.JWT_SECRET)

test('requireAuth: sin token → 401 con mensaje claro', () => {
  const req = reqConToken(null)
  const res = resFake()
  requireAuth(req, res, () => assert.fail('no debe continuar'))
  assert.equal(res.statusCode, 401)
  assert.match(res.cuerpo.message, /iniciar sesión/i)
})

test('requireAuth: token basura → 401', () => {
  const res = resFake()
  requireAuth(reqConToken('esto-no-es-un-jwt'), res, () => assert.fail('no debe continuar'))
  assert.equal(res.statusCode, 401)
})

test('requireAuth: token de la era anterior (sin areaId) → 401 y pide re-login', () => {
  const tokenViejo = tokenValido({ id: 'u1', nombre: 'Viejo', email: 'v@x.com', rol: 'ADMIN' })
  const res = resFake()
  requireAuth(reqConToken(tokenViejo), res, () => assert.fail('no debe continuar'))
  assert.equal(res.statusCode, 401)
  assert.match(res.cuerpo.message, /versión anterior/i)
})

test('requireAuth: token válido → popula req.usuario y continúa', () => {
  const token = tokenValido({
    id: 'u9',
    nombre: 'Prueba',
    email: 'p@x.com',
    rol: 'LIDER_AREA',
    areaId: 'area-1',
    extraIgnorado: true,
  })
  const req = reqConToken(token)
  const res = resFake()
  let continuo = false
  requireAuth(req, res, () => (continuo = true))
  assert.ok(continuo, 'debe llamar next()')
  assert.equal(res.statusCode, null)
  // Subset normalizado: ni el campo extra ni nada más pasa a req.usuario
  assert.deepEqual(req.usuario, {
    id: 'u9',
    nombre: 'Prueba',
    email: 'p@x.com',
    rol: 'LIDER_AREA',
    areaId: 'area-1',
  })
})

test('requireRole: sin sesión previa → 401', () => {
  const res = resFake()
  requireRole('LIDER_GENERAL')({ usuario: null }, res, () => assert.fail('no debe continuar'))
  assert.equal(res.statusCode, 401)
})

test('requireRole: rol no incluido → 403 con el mensaje del módulo', () => {
  const res = resFake()
  requireRole('LIDER_GENERAL', 'LIDER_AREA')(
    { usuario: { rol: 'USUARIO' } },
    res,
    () => assert.fail('no debe continuar')
  )
  assert.equal(res.statusCode, 403)
  assert.equal(res.cuerpo.message, 'Tu rol no tiene permiso para esta acción.')
})

test('requireRole: rol incluido → continúa', () => {
  const res = resFake()
  let continuo = false
  requireRole('LIDER_GENERAL', 'LIDER_AREA')(
    { usuario: { rol: 'LIDER_AREA' } },
    res,
    () => (continuo = true)
  )
  assert.ok(continuo, 'debe llamar next()')
  assert.equal(res.statusCode, null)
})
