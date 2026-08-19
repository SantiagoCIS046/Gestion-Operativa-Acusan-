import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import App from './App.vue'
import router from './router'

// Limpieza automática de claves obsoletas con datos de prueba antiguos en cualquier máquina
try {
  const legacyKeys = ['acuasan_permisos_db', 'acuasan_radicados_db', 'acuasan_horas_db', 'acuasan_pqr_db']
  legacyKeys.forEach(k => localStorage.removeItem(k))
} catch (e) {}

const app = createApp(App)
app.use(router)
app.mount('#app')

