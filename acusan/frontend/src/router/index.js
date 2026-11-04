import { createRouter, createWebHistory } from 'vue-router'

import { useSesion } from '@/composables/useSesion.js'

// Rutas del módulo de vencimientos. El login es público; el resto exige
// sesión, y /estructura además rol LIDER_GENERAL (meta.roles).
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../modules/auth/views/VistaLogin.vue'),
    meta: { title: 'Iniciar Sesión', publica: true }
  },

  {
    path: '/',
    component: () => import('../layouts/LayoutApp.vue'),
    children: [
      { path: '', redirect: '/resumen' },
      {
        path: 'resumen',
        name: 'Resumen',
        component: () => import('../modules/resumen/views/VistaResumen.vue'),
        meta: { title: 'Resumen', roles: ['LIDER_GENERAL'] }
      },
      {
        path: 'radicados',
        name: 'Radicados',
        component: () => import('../modules/radicados/views/VistaRadicados.vue'),
        meta: { title: 'Radicados' }
      },
      // Fusión: /archivos dejó de existir — llega con su query (q, área,
      // estado, categoría) para que el filtro no se pierda
      {
        path: 'archivos',
        redirect: (to) => ({ path: '/radicados', query: to.query })
      },
      {
        path: 'informes',
        name: 'Informes',
        component: () => import('../modules/informes/views/VistaInformes.vue'),
        meta: { title: 'Informes', roles: ['LIDER_GENERAL', 'LIDER_AREA'] }
      },
      {
        path: 'alertas',
        name: 'Alertas',
        component: () => import('../modules/alertas/views/VistaAlertas.vue'),
        meta: { title: 'Alertas' }
      },
      {
        path: 'calendario',
        name: 'Calendario',
        component: () => import('../modules/calendario/views/VistaCalendario.vue'),
        meta: { title: 'Calendario', roles: ['LIDER_GENERAL'] }
      },
      {
        path: 'estructura',
        name: 'Estructura',
        component: () => import('../modules/areas/views/VistaEstructura.vue'),
        meta: { title: 'Estructura', roles: ['LIDER_GENERAL'] }
      }
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} | Acuusan E.S.P.`
  }

  const sesion = useSesion()

  // Ruta pública con sesión abierta → adentro
  if (to.meta.publica) {
    return sesion.estaAutenticado.value ? { path: '/resumen' } : true
  }

  // Sin sesión → al login conservando el destino para volver tras entrar
  if (!sesion.estaAutenticado.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Rol insuficiente → a la primera ruta que sí puede ver (las áreas
  // trabajan con radicados y alertas, no con el panel global)
  const roles = to.meta.roles
  if (roles && !roles.includes(sesion.rol.value)) {
    return { path: '/radicados' }
  }

  return true
})

export default router
