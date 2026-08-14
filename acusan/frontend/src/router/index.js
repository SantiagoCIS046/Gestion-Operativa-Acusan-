import { createRouter, createWebHistory } from 'vue-router'
import authService from '../modules/auth/services/authService.js'

const routes = [
  // --- LOGIN (PÚBLICO) ---
  {
    path: '/login',
    name: 'Login',
    component: () => import('../modules/auth/views/VistaLogin.vue'),
    meta: { title: 'Iniciar Sesión', public: true }
  },

  // --- MÓDULO DE PERMISOS ---
  {
    path: '/permisos/encargado',
    name: 'PermisosEncargado',
    component: () => import('../modules/permisos/views/VistaEncargado.vue'),
    meta: { title: 'Permisos - Encargado OCR', requiresAuth: true, roles: ['ENCARGADO', 'ADMIN'] }
  },
  {
    path: '/permisos/gerencia',
    name: 'PermisosGerencia',
    component: () => import('../modules/permisos/views/VistaGerenciaPermisos.vue'),
    meta: { title: 'Permisos - Consulta Gerencial', requiresAuth: true, roles: ['GERENCIA', 'ADMIN'] }
  },

  // --- MÓDULO DE HORAS EXTRAS ---
  {
    path: '/horas-extras/gerencia',
    name: 'HorasExtrasGerencia',
    component: () => import('../modules/horas-extras/views/VistaGerenciaHoras.vue'),
    meta: { title: 'Horas Extras - Control Operativo', requiresAuth: true, roles: ['ENCARGADO', 'GERENCIA', 'ADMIN'] }
  },

  // --- MÓDULO DE PQR ---
  {
    path: '/pqr/gestion',
    name: 'GestionPQR',
    component: () => import('../modules/pqr/views/VistaGestionPQR.vue'),
    meta: { title: 'Gestión PQR Acuasan', requiresAuth: true, roles: ['OPERATIVO', 'GERENCIA', 'ADMIN'] }
  },

  // --- MÓDULO DE RADICADOS ---
  {
    path: '/radicados/gestion',
    name: 'GestionRadicados',
    component: () => import('../modules/radicados/views/VistaRadicados.vue'),
    meta: { title: 'Gestión de Radicados | Acuasan', requiresAuth: true, roles: ['RADICADOS', 'ENCARGADO', 'ADMIN'] }
  },



  // --- REDIRECCIÓN POR DEFECTO ---
  {
    path: '/',
    redirect: () => {
      if (authService.estaAutenticado()) {
        const rol = authService.getRol()
        return authService.getRutaInicioPorRol(rol)
      }
      return '/login'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guards — Control de Acceso por Autenticación y Rol
router.beforeEach((to, from, next) => {
  // Título dinámico en el navegador
  if (to.meta?.title) {
    document.title = `${to.meta.title} | Acuasan E.S.P.`
  }

  const estaAutenticado = authService.estaAutenticado()
  const rolActual = authService.getRol()

  // Si la ruta es pública, dejar pasar
  if (to.meta?.public) {
    // Si ya está autenticado y va al login, redirigir al módulo correspondiente
    if (estaAutenticado && to.name === 'Login') {
      return next(authService.getRutaInicioPorRol(rolActual))
    }
    return next()
  }

  // Ruta privada sin sesión → login
  if (to.meta?.requiresAuth && !estaAutenticado) {
    return next('/login')
  }

  // Verificar que el rol del usuario tenga acceso a esta ruta
  if (to.meta?.roles && !to.meta.roles.includes(rolActual)) {
    // Redirigir al módulo que le corresponde según su rol
    const rutaCorrecta = authService.getRutaInicioPorRol(rolActual)
    return next(rutaCorrecta)
  }

  next()
})

export default router
