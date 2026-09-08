import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import App from './App.vue'
import router from './router'
import authService from './modules/auth/services/authService.js'
import { conectarSocketPQR } from './services/socket.service.js'

// Limpieza automática de claves obsoletas con datos de prueba antiguos en cualquier máquina
try {
  const legacyKeys = ['acuasan_permisos_db', 'acuasan_radicados_db', 'acuasan_horas_db', 'acuasan_pqr_db']
  legacyKeys.forEach(k => localStorage.removeItem(k))
} catch (e) {}

const app = createApp(App)
const pinia = createPinia()

// Pinia debe montarse antes de que socket.service use usePqrStore()
app.use(pinia)
app.use(router)
app.mount('#app')

// Si el operario ya tenía sesión (F5 / pestaña restaurada), reabrir el
// WebSocket de alertas PQR sin pasar por el login
if (authService.estaAutenticado()) {
  conectarSocketPQR(authService.getToken())
}

