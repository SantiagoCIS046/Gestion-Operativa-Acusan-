import { createRouter, createWebHistory } from 'vue-router'

// Sistema reducido al módulo de login (2026-10-16): el login es la única
// vista; cualquier otra ruta redirige allí.
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../modules/auth/views/VistaLogin.vue'),
    meta: { title: 'Iniciar Sesión', public: true }
  },

  // --- REDIRECCIÓN POR DEFECTO ---
  { path: '/', redirect: '/login' },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  // Título dinámico en el navegador
  if (to.meta?.title) {
    document.title = `${to.meta.title} | Acuusan E.S.P.`
  }
  next()
})

export default router
