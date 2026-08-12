import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/permisos/encargado'
  },
  // Módulo Permisos
  {
    path: '/permisos/encargado',
    name: 'PermisosEncargado',
    component: () => import('@/modules/permisos/views/VistaEncargado.vue'),
    meta: { title: 'Permisos - Encargado OCR' }
  },
  {
    path: '/permisos/gerencia',
    name: 'PermisosGerencia',
    component: () => import('@/modules/permisos/views/VistaGerenciaPermisos.vue'),
    meta: { title: 'Permisos - Gerencia' }
  },
  // Módulo Horas Extras
  {
    path: '/horas-extras/gerencia',
    name: 'HorasExtrasGerencia',
    component: () => import('@/modules/horas-extras/views/VistaGerenciaHoras.vue'),
    meta: { title: 'Horas Extras - Gerencia' }
  },
  // Módulo PQR
  {
    path: '/pqr/gestion',
    name: 'PqrGestion',
    component: () => import('@/modules/pqr/views/VistaGestionPQR.vue'),
    meta: { title: 'Gestión PQR Acuasan' }
  },
  // Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/permisos/encargado'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
