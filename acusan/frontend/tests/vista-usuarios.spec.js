// VistaUsuarios — listado y modal de reasignación, con la API simulada.
// Sesión de gerencia (ve todo). El backend no participa: UsuariosAPI y
// AreasAPI están simuladas; la sesión sale del authService simulado.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { listar, actualizar } = vi.hoisted(() => ({
  listar: vi.fn(),
  actualizar: vi.fn(),
}))

vi.mock('@/api/usuarios.js', () => ({
  UsuariosAPI: {
    listar: (...a) => listar(...a),
    actualizar: (...a) => actualizar(...a),
    restablecerPassword: vi.fn(),
    aprobar: vi.fn(),
    rechazar: vi.fn(),
  },
  default: {},
}))

vi.mock('@/api/areas.js', () => ({
  AreasAPI: { listar: vi.fn(async () => [{ id: 'a1', codigo: 'OPE', nombre: 'Operativa', activa: true }]) },
  default: {},
}))

vi.mock('@/modules/auth/services/authService.js', () => ({
  default: {
    getToken: () => 't',
    getUsuarioActual: () => ({
      id: 'yo',
      nombre: 'Gerencia',
      rol: 'LIDER_GENERAL',
      areaId: 'a0',
      area: { id: 'a0', codigo: 'GER', nombre: 'Gerencial' },
    }),
  },
}))

import VistaUsuarios from '@/modules/usuarios/views/VistaUsuarios.vue'

const FIXTURE = {
  usuarios: [
    {
      id: 'yo', nombre: 'Gerencia', email: 'gerencia@acuasan.com', rol: 'LIDER_GENERAL',
      areaId: 'a0', area: { codigo: 'GER' }, estado: 'activo', activo: true,
      radicadosPendientes: 0, ultimoAcceso: null,
    },
    {
      id: 'u2', nombre: 'Laura Martinez', email: 'laura@acuasan.com', rol: 'USUARIO',
      areaId: 'a1', area: { codigo: 'OPE' }, estado: 'activo', activo: true,
      radicadosPendientes: 3, ultimoAcceso: null,
    },
    {
      id: 'u4', nombre: 'Juan Valdez', email: 'juan@acuasan.com', rol: 'USUARIO',
      areaId: 'a1', area: { codigo: 'OPE' }, estado: 'activo', activo: true,
      radicadosPendientes: 0, ultimoAcceso: null,
    },
    {
      id: 'u3', nombre: 'Pendiente Perez', email: 'pendiente@acuasan.com', rol: 'USUARIO',
      areaId: 'a1', area: { codigo: 'OPE' }, estado: 'pendiente', activo: false,
      radicadosPendientes: 0, creado: '2026-11-01T10:00:00Z',
    },
  ],
  solicitudesPendientes: 1,
  correoHabilitado: false,
}

// Los mocks se configuran ANTES de montar: montar() no los toca.
beforeEach(() => {
  listar.mockReset().mockResolvedValue(JSON.parse(JSON.stringify(FIXTURE)))
  actualizar.mockReset()
})

async function montar() {
  const w = mount(VistaUsuarios, { global: { stubs: { teleport: true } } })
  await flushPromises()
  await flushPromises()
  return w
}

describe('listado', () => {
  it('muestra las cuentas activas/inactivas y aparte las solicitudes', async () => {
    const w = await montar()
    const filas = w.findAll('tbody tr')
    expect(filas.length).toBe(3) // la pendiente no va en la tabla
    expect(w.text()).toContain('Laura Martinez')
    expect(w.text()).toContain('3 persona(s)')
    // Panel de solicitudes (solo gerencia) con la pendiente
    expect(w.find('.panel--solicitudes').exists()).toBe(true)
    expect(w.text()).toContain('Pendiente Perez')
    // Aviso de correo sin configurar
    expect(w.find('.aviso-correo').exists()).toBe(true)
    w.unmount()
  })

  it('la propia sesión no tiene acciones (Tú)', async () => {
    const w = await montar()
    expect(w.text()).toContain('Tú')
    w.unmount()
  })
})

describe('desactivar con radicados pendientes', () => {
  it('abre el modal de reasignación y envía activo:false + reasignarA', async () => {
    actualizar.mockResolvedValue({ usuario: {}, reasignados: 3 })
    const w = await montar()

    const boton = w.find('button[title="Desactivar a Laura Martinez"]')
    expect(boton.exists()).toBe(true)
    await boton.trigger('click')

    // El modal avisa los 3 pendientes y exige elegir receptor
    expect(w.text()).toContain('3 radicado(s) pendiente(s)')
    const confirmar = w.findAll('button').find((b) => b.text() === 'Desactivar')
    expect(confirmar.attributes('disabled')).toBeDefined()

    // Solo Juan puede recibirlos (mismo área, activo, no ella)
    const opciones = w.findAll('#u-reasignar option')
    expect(opciones.length).toBe(2) // placeholder + Juan
    await w.find('#u-reasignar').setValue('u4')

    await confirmar.trigger('click')
    await flushPromises()
    expect(actualizar).toHaveBeenCalledWith('u2', { activo: false, reasignarA: 'u4' })
    w.unmount()
  })

  it('TIENE_PENDIENTES del servidor reabre el modal con la cifra real', async () => {
    const error = new Error('Tiene radicados pendientes.')
    error.status = 409
    error.codigo = 'TIENE_PENDIENTES'
    error.respuesta = { pendientes: 5 }
    actualizar.mockRejectedValue(error)

    const w = await montar()
    await w.find('button[title="Desactivar a Laura Martinez"]').trigger('click')
    await w.find('#u-reasignar').setValue('u4')
    await w.findAll('button').find((b) => b.text() === 'Desactivar').trigger('click')
    await flushPromises()

    expect(w.text()).toContain('5 radicado(s) pendiente(s)')
    w.unmount()
  })
})
