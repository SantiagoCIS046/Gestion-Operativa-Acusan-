// Modal — comportamiento de cierre.
// cerrable=true (por defecto): X, clic afuera y Escape cierran.
// cerrable=false (cambio obligatorio de contraseña): nada cierra; solo el
// componente padre decide (update:modelValue nunca llega en false).

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import Modal from '@/components/Modal.vue'

const montar = (props) =>
  mount(Modal, {
    props: { modelValue: true, titulo: 'Prueba', ...props },
    slots: { default: '<p>cuerpo</p>' },
    global: { stubs: { teleport: true } },
    attachTo: document.body,
  })

describe('Modal cerrable (por defecto)', () => {
  it('muestra el botón X y al pulsarlo emite update:modelValue false', async () => {
    const w = montar()
    const cerrar = w.find('button.modal-cerrar')
    expect(cerrar.exists()).toBe(true)
    await cerrar.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[false]])
    w.unmount()
  })

  it('cierra con clic en el fondo (fuera de la caja)', async () => {
    const w = montar()
    await w.find('.modal-overlay').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[false]])
    w.unmount()
  })

  it('cierra con la tecla Escape', async () => {
    const w = montar()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await Promise.resolve()
    expect(w.emitted('update:modelValue')).toEqual([[false]])
    w.unmount()
  })
})

describe('Modal NO cerrable (cerrable: false)', () => {
  it('no muestra el botón X', () => {
    const w = montar({ cerrable: false })
    expect(w.find('button.modal-cerrar').exists()).toBe(false)
    w.unmount()
  })

  it('el clic en el fondo no emite cierre', async () => {
    const w = montar({ cerrable: false })
    await w.find('.modal-overlay').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('Escape no emite cierre', async () => {
    const w = montar({ cerrable: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('un clic DENTRO de la caja nunca cierra (ni cerrable ni no cerrable)', async () => {
    const w = montar()
    await w.find('.modal-caja').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})
