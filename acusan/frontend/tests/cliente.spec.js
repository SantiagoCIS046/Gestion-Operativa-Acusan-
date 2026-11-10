// api/cliente.js — contratos de sesión y de errores.
// - 401 cierra sesión y manda a /login con ?sesion= según el codigo
//   (CUENTA_INACTIVA → inactiva, SESION_CERRADA → cerrada, otro → expirada).
// - 403 DEBE_CAMBIAR_PASSWORD marca la sesión sin cerrarla.
// - Los errores lanzados conservan status, codigo y el cuerpo completo
//   (p. ej. 409 TIENE_PENDIENTES con pendientes).

import { afterEach, describe, expect, it, vi } from 'vitest'

const logout = vi.fn()
const marcarCambioObligatorio = vi.fn()
const push = vi.fn()

vi.mock('@/modules/auth/services/authService.js', () => ({
  default: {
    getToken: () => 'token-de-prueba',
    logout: (...a) => logout(...a),
    marcarCambioObligatorio: (...a) => marcarCambioObligatorio(...a),
  },
}))

// cliente.js importa el router en caliente para redirigir al login
vi.mock('@/router', () => ({
  default: { currentRoute: { value: { path: '/radicados' } }, push: (...a) => push(...a) },
}))

import { cliente } from '@/api/cliente.js'

const responder = (estado, cuerpo = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  logout.mockClear()
  marcarCambioObligatorio.mockClear()
  push.mockClear()
})

describe('401 — cierre de sesión con motivo', () => {
  it.each([
    ['CUENTA_INACTIVA', 'inactiva'],
    ['SESION_CERRADA', 'cerrada'],
  ])('codigo %s → logout + /login?sesion=%s', async (codigo, motivo) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(401, { success: false, codigo })),
    )
    await expect(cliente.get('/radicados')).rejects.toThrow(/sesión/i)
    expect(logout).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/login', query: { sesion: motivo } })
  })

  it('sin codigo conocido → motivo expirada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responder(401, { success: false })))
    await expect(cliente.get('/alertas')).rejects.toThrow(/sesión/i)
    expect(push).toHaveBeenCalledWith({ path: '/login', query: { sesion: 'expirada' } })
  })
})

describe('403 DEBE_CAMBIAR_PASSWORD', () => {
  it('marca la sesión y el error conserva el codigo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        responder(403, { success: false, codigo: 'DEBE_CAMBIAR_PASSWORD', message: 'Debe cambiar su contraseña.' }),
      ),
    )
    await expect(cliente.get('/me')).rejects.toThrow('Debe cambiar su contraseña.')
    expect(marcarCambioObligatorio).toHaveBeenCalledTimes(1)
    expect(logout).not.toHaveBeenCalled()
  })

  it('un 403 de otro tipo NO marca la sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(403, { success: false, message: 'Tu rol no tiene permiso.' })),
    )
    await expect(cliente.get('/estructuras')).rejects.toThrow('permiso')
    expect(marcarCambioObligatorio).not.toHaveBeenCalled()
  })
})

describe('los errores conservan status, codigo y cuerpo', () => {
  it('409 TIENE_PENDIENTES lleva la cantidad de pendientes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        responder(409, { success: false, codigo: 'TIENE_PENDIENTES', message: 'Tiene radicados pendientes.', pendientes: 3 }),
      ),
    )
    const error = await cliente.put('/usuarios/abc', { activo: false }).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(409)
    expect(error.codigo).toBe('TIENE_PENDIENTES')
    expect(error.respuesta.pendientes).toBe(3)
    expect(error.message).toBe('Tiene radicados pendientes.')
  })

  it('sin cuerpo usa el mensaje genérico del estado y codigo null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    const error = await cliente.get('/informes').catch((e) => e)
    expect(error.status).toBe(500)
    expect(error.codigo).toBeNull()
    expect(error.respuesta).toBeNull()
    expect(error.message).toMatch(/Error interno/)
  })
})

describe('respuestas exitosas', () => {
  it('devuelve el data del envoltorio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responder(200, { success: true, data: { hola: 1 } })))
    await expect(cliente.get('/resumen')).resolves.toEqual({ hola: 1 })
  })

  it('adjunta el Bearer del authService', async () => {
    const fetchMock = vi.fn(async () => responder(200, { success: true, data: null }))
    vi.stubGlobal('fetch', fetchMock)
    await cliente.get('/radicados')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer token-de-prueba')
  })
})
