// Contador de alertas pendientes del rol (badge del layout).
//
// Sale de GET /api/alertas contando las no atendidas: el backend ya recorta
// por área/rol según el token. Singleton: todas las vistas ven el mismo número.

import { ref } from 'vue'

import { cliente } from '@/api/cliente.js'

const pendientes = ref(null) // null = aún sin cargar
const total = ref(null) // incluye las atendidas (lo usa la vista de alertas)
const cargando = ref(false)

async function cargar() {
  if (cargando.value) return
  cargando.value = true
  try {
    const data = await cliente.get('/alertas')
    total.value = (data?.alertas || []).length
    pendientes.value = (data?.alertas || []).filter((a) => !a.atendida).length
  } catch {
    // Sin datos nuevos el badge conserva el último valor conocido; el error
    // concreto lo muestra la vista que esté en pantalla (si hay una abierta).
  } finally {
    cargando.value = false
  }
}

export function useConteoAlertas() {
  return { pendientes, total, cargando, cargar }
}

export default useConteoAlertas
