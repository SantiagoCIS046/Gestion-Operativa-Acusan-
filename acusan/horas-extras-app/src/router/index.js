import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '@/services/api.js'

const routes = [
  {
    path: '/',
    name: 'identificacion',
    component: () => import('@/views/VistaIdentificacion.vue'),
    meta: { publica: true }
  },
  {
    path: '/registrar',
    name: 'registrar',
    component: () => import('@/views/VistaRegistro.vue')
  },
  {
    path: '/evidencias',
    name: 'evidencias',
    component: () => import('@/views/VistaEvidencias.vue')
  },
  {
    path: '/historial',
    name: 'historial',
    component: () => import('@/views/VistaHistorial.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard: si no hay token, redirigir a identificacion
router.beforeEach((to) => {
  if (!to.meta.publica && !authService.estaIdentificado()) {
    return { name: 'identificacion' }
  }
  if (to.name === 'identificacion' && authService.estaIdentificado()) {
    return { name: 'registrar' }
  }
})

export default router