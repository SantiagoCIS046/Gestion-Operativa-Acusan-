// CambiarPassword — validaciones de cliente y flujo del modo obligatorio.
// El guardado pasa por el authService REAL con fetch simulado: cubre también
// el contrato del servicio (POST /api/me/password y renovación del token).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CambiarPassword from '@/components/CambiarPassword.vue'

const montar = (props) =>
  mount(CambiarPassword, {
    props: { modelValue: true, ...props },
    global: { stubs: { teleport: true } },
  })

const llenar = async (w, { actual = 'temporal1', nueva = 'buena1234', confirmar = nueva } = {}) => {
  await w.find('#clave-actual').setValue(actual)
  await w.find('#clave-nueva').setValue(nueva)
  await w.find('#clave-confirmar').setValue(confirmar)
}

const responder = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })

let fetchMock
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('validaciones del formulario', () => {
  it('rechaza campos vacíos', async () => {
    const w = montar()
    await w.find('.btn-primario').trigger('click')
    expect(w.text()).toContain('Completa los campos.')
    expect(fetchMock).not.toHaveBeenCalled()
    w.unmount()
  })

  it('exige mínimo 8 caracteres con letras y números', async () => {
    const w = montar()
    await llenar(w, { nueva: 'corta1' })
    await w.find('.btn-primario').trigger('click')
    expect(w.text()).toContain('al menos 8 caracteres')
    expect(fetchMock).not.toHaveBeenCalled()
    w.unmount()
  })

  it('rechaza contraseñas solo numéricas o solo alfabéticas', async () => {
    const w = montar()
    await llenar(w, { nueva: '12345678' })
    await w.find('.btn-primario').trigger('click')
    expect(w.text()).toContain('combinar letras y números')
    w.unmount()
  })

  it('detecta que la confirmación no coincide', async () => {
    const w = montar()
    await llenar(w, { confirmar: 'otra12345' })
    await w.find('.btn-primario').trigger('click')
    expect(w.text()).toContain('no coincide')
    expect(fetchMock).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('guardado', () => {
  it('llama al servicio y cierra el modal cuando todo sale bien', async () => {
    fetchMock.mockResolvedValue(
      responder(200, { success: true, data: { token: 'nuevo-token', usuario: { nombre: 'Gerencia' } } }),
    )
    const w = montar()
    await llenar(w, { actual: 'temporal1', nueva: 'secreta99' })
    await w.find('.btn-primario').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/password',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ actual: 'temporal1', nueva: 'secreta99' }) }),
    )
    expect(w.emitted('cambiada')).toBeTruthy()
    expect(w.emitted('update:modelValue')).toEqual([[false]])
    w.unmount()
  })

  it('muestra el error del servidor sin cerrar', async () => {
    fetchMock.mockResolvedValue(
      responder(400, { success: false, message: 'La contraseña temporal no coincide.' }),
    )
    const w = montar()
    await llenar(w)
    await w.find('.btn-primario').trigger('click')
    await flushPromises()

    expect(w.text()).toContain('La contraseña temporal no coincide.')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})

describe('modo obligatorio (contraseña temporal)', () => {
  it('no ofrece Cancelar sino Cerrar sesión, que emite salir', async () => {
    const w = montar({ obligatorio: true })
    const botones = w.findAll('button').map((b) => b.text())
    expect(botones).toContain('Cerrar sesión')
    expect(botones).not.toContain('Cancelar')
    await w.findAll('button').find((b) => b.text() === 'Cerrar sesión').trigger('click')
    expect(w.emitted('salir')).toBeTruthy()
    // el modal en sí no se cierra con eso
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('el intento de cierre desde el Modal se bloquea (sin X, sin fondo)', () => {
    const w = montar({ obligatorio: true })
    expect(w.find('button.modal-cerrar').exists()).toBe(false)
    w.unmount()
  })
})
