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
  // Enlace del correo de recuperación / invitación (?token=…)
  {
    path: '/restablecer',
    name: 'Restablecer',
    component: () => import('../modules/auth/views/VistaLogin.vue'),
    meta: { title: 'Crear contraseña', publica: true }
  },

  {
    path: '/',
    component: () => import('../layouts/LayoutApp.vue'),
    children: [
      { path: '', redirect: () => inicioPorRol() },
      {
        path: 'resumen',
        name: 'Resumen',
        component: () => import('../modules/resumen/views/VistaResumen.vue'),
        meta: { title: 'Resumen', roles: ['LIDER_GENERAL', 'LIDER_AREA'] }
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
        path: 'usuarios',
        name: 'Usuarios',
        component: () => import('../modules/usuarios/views/VistaUsuarios.vue'),
        meta: { title: 'Usuarios', roles: ['LIDER_GENERAL', 'LIDER_AREA'] }
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

// Primera vista tras entrar: gerencia y líderes de área arrancan en su panel
// de rendimiento; un usuario del área, directo a los radicados que atiende.
function inicioPorRol() {
  const sesion = useSesion()
  return sesion.rol.value === 'USUARIO' ? '/radicados' : '/resumen'
}

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} | Acuusan E.S.P.`
  }

  const sesion = useSesion()

  // Ruta pública con sesión abierta → adentro
  if (to.meta.publica) {
    // El enlace del correo siempre se puede usar (aunque haya otra sesión)
    if (to.path === '/restablecer') return true
    return sesion.estaAutenticado.value ? { path: inicioPorRol() } : true
  }

  // Sin sesión → al login conservando el destino para volver tras entrar
  if (!sesion.estaAutenticado.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Rol insuficiente → a la primera ruta que sí puede ver (un usuario del
  // área trabaja con radicados y alertas, no con los paneles de líder)
  const roles = to.meta.roles
  if (roles && !roles.includes(sesion.rol.value)) {
    return { path: '/radicados' }
  }

  return true
})

export default router
