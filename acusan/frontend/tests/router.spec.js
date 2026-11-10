// Guardas de rol del router.
// - Sin sesión → /login conservando el destino (?redirect=).
// - Rol insuficiente (meta.roles) → /radicados.
// - /resumen solo LIDER_GENERAL y LIDER_AREA; /estructura y /calendario solo
//   LIDER_GENERAL; /radicados y /alertas para todos.
// - El inicio por rol: USUARIO entra a /radicados; los líderes a /resumen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Las vistas reales arrastran assets (svg, ogl) que Vitest no resuelve: se
// simulan con componentes vacíos — la guardia decide ANTES de montar nada,
// así que para estas pruebas solo importa la resolución de la ruta.
vi.mock('@/layouts/LayoutApp.vue', () => ({ default: { name: 'LayoutApp', template: '<div /><router-view />' } }))
vi.mock('@/modules/auth/views/VistaLogin.vue', () => ({ default: { name: 'Login', template: '<div />' } }))
vi.mock('@/modules/resumen/views/VistaResumen.vue', () => ({ default: { name: 'Resumen', template: '<div />' } }))
vi.mock('@/modules/radicados/views/VistaRadicados.vue', () => ({ default: { name: 'Radicados', template: '<div />' } }))
vi.mock('@/modules/informes/views/VistaInformes.vue', () => ({ default: { name: 'Informes', template: '<div />' } }))
vi.mock('@/modules/alertas/views/VistaAlertas.vue', () => ({ default: { name: 'Alertas', template: '<div />' } }))
vi.mock('@/modules/calendario/views/VistaCalendario.vue', () => ({ default: { name: 'Calendario', template: '<div />' } }))
vi.mock('@/modules/usuarios/views/VistaUsuarios.vue', () => ({ default: { name: 'Usuarios', template: '<div />' } }))
vi.mock('@/modules/areas/views/VistaEstructura.vue', () => ({ default: { name: 'Estructura', template: '<div />' } }))

// El authService lee localStorage al importarse: cada escenario reinicia
// módulos y sesión antes de importar el router.
async function routerConSesion(usuario) {
  vi.resetModules()
  localStorage.clear()
  if (usuario) {
    localStorage.setItem('acuasan_token', 'token-falso')
    localStorage.setItem('acuasan_usuario', JSON.stringify(usuario))
  }
  const { default: router } = await import('@/router')
  await router.push('/login') // arranca en un punto conocido
  return router
}

const gerencia = { id: 'u1', nombre: 'Gerencia', rol: 'LIDER_GENERAL', areaId: 'a0' }
const lider = { id: 'u2', nombre: 'Líder', rol: 'LIDER_AREA', areaId: 'a1' }
const usuarioArea = { id: 'u3', nombre: 'Juan', rol: 'USUARIO', areaId: 'a1' }

beforeEach(() => {
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  localStorage.clear()
})

describe('sin sesión', () => {
  it('cualquier ruta privada manda a /login con redirect', async () => {
    const router = await routerConSesion(null)
    await router.push('/radicados')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/radicados')
  })
})

describe('roles insuficientes', () => {
  it('USUARIO no entra a /resumen: cae a /radicados', async () => {
    const router = await routerConSesion(usuarioArea)
    await router.push('/resumen')
    expect(router.currentRoute.value.path).toBe('/radicados')
  })

  it('LIDER_AREA no entra a /estructura ni /calendario', async () => {
    const router = await routerConSesion(lider)
    await router.push('/estructura')
    expect(router.currentRoute.value.path).toBe('/radicados')
    await router.push('/calendario')
    expect(router.currentRoute.value.path).toBe('/radicados')
  })

  it('USUARIO no entra a /informes', async () => {
    const router = await routerConSesion(usuarioArea)
    await router.push('/informes')
    expect(router.currentRoute.value.path).toBe('/radicados')
  })
})

describe('accesos permitidos', () => {
  it('LIDER_AREA entra a /resumen y a /usuarios', async () => {
    const router = await routerConSesion(lider)
    await router.push('/resumen')
    expect(router.currentRoute.value.name).toBe('Resumen')
    await router.push('/usuarios')
    expect(router.currentRoute.value.name).toBe('Usuarios')
  })

  it('USUARIO entra a /radicados y /alertas', async () => {
    const router = await routerConSesion(usuarioArea)
    await router.push('/radicados')
    expect(router.currentRoute.value.name).toBe('Radicados')
    await router.push('/alertas')
    expect(router.currentRoute.value.name).toBe('Alertas')
  })

  it('LIDER_GENERAL entra a /estructura', async () => {
    const router = await routerConSesion(gerencia)
    await router.push('/estructura')
    expect(router.currentRoute.value.name).toBe('Estructura')
  })
})

describe('inicio por rol', () => {
  it('la raíz manda a gerencia y líderes a /resumen', async () => {
    for (const u of [gerencia, lider]) {
      const router = await routerConSesion(u)
      await router.push('/')
      expect(router.currentRoute.value.path).toBe('/resumen')
    }
  })

  it('la raíz manda a un USUARIO a /radicados', async () => {
    const router = await routerConSesion(usuarioArea)
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/radicados')
  })
})

describe('rutas públicas', () => {
  it('/login con sesión abierta redirige al inicio del rol', async () => {
    const router = await routerConSesion(usuarioArea)
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/radicados')
  })

  it('/restablecer se puede usar incluso con sesión abierta', async () => {
    const router = await routerConSesion(gerencia)
    await router.push({ path: '/restablecer', query: { token: 'x' } })
    expect(router.currentRoute.value.path).toBe('/restablecer')
  })
})
