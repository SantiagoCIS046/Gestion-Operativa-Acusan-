// Notificaciones efímeras (toasts). Singleton: la cola la renderiza
// ToastContenedor montado una sola vez en App.vue.

import { ref } from 'vue'

const toasts = ref([])
let secuencia = 1

function cerrar(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function mostrar(tipo, mensaje, duracion) {
  const id = secuencia++
  toasts.value.push({ id, tipo, mensaje })
  setTimeout(() => cerrar(id), duracion)
  return id
}

export function useToast() {
  return {
    toasts,
    cerrar,
    exito: (mensaje) => mostrar('exito', mensaje, 4200),
    error: (mensaje) => mostrar('error', mensaje, 5600),
    info: (mensaje) => mostrar('info', mensaje, 4200),
  }
}

export default useToast
