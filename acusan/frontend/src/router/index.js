import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // --- MÓDULO DE PERMISOS ---
  {
    path: '/permisos/encargado',
    name: 'PermisosEncargado',
    // El componente se carga SOLO cuando el usuario visita esta ruta (Lazy Loading)
    component: () => import('../modules/permisos/views/VistaEncargado.vue'),
    meta: { title: 'Permisos - Encargado OCR', requiresAuth: true, role: 'ENCARGADO' }
  },
  {
    path: '/permisos/gerencia',
    name: 'PermisosGerencia',
    component: () => import('../modules/permisos/views/VistaGerenciaPermisos.vue'),
    meta: { title: 'Permisos - Decisión Gerencial', requiresAuth: true, role: 'GERENCIA' }
  },

  // --- MÓDULO DE HORAS EXTRAS ---
  {
    path: '/horas-extras/gerencia',
    name: 'HorasExtrasGerencia',
    component: () => import('../modules/horas-extras/views/VistaGerenciaHoras.vue'),
    meta: { title: 'Horas Extras - Control Gerencial', requiresAuth: true, role: 'GERENCIA' }
  },

  // --- MÓDULO DE PQR ---
  {
    path: '/pqr/gestion',
    name: 'GestionPQR',
    component: () => import('../modules/pqr/views/VistaGestionPQR.vue'),
    meta: { title: 'Gestión PQR Acuasan', requiresAuth: true, role: 'OPERATIVO' }
  },

  // --- REDIRECCIÓN POR DEFECTO ---
  {
    path: '/',
    redirect: '/permisos/encargado' // O la vista de login que configures
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/permisos/encargado'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guards (Guardias de Navegación)
// Para verificar roles y permisos (Encargado vs Gerencia) antes de permitir el acceso
router.beforeEach((to, from, next) => {
  // Configuración de título dinámico en el navegador
  if (to.meta && to.meta.title) {
    document.title = `${to.meta.title} | Acuasan E.S.P.`
  }
  
  // Aquí se validaría el token y rol:
  // const userRole = localStorage.getItem('user_role');
  // if (to.meta.requiresAuth && !userRole) return next('/login');
  
  next()
})

export default router
