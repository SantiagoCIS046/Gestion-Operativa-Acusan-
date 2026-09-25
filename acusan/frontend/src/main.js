import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { mantenerDespiertoMotorOCR } from './services/ocrWarmup.service.js'

import SpecularButton from './components/SpecularButton.vue'

// Limpieza automática de claves obsoletas con datos de prueba antiguos en cualquier máquina
try {
  const legacyKeys = ['acuasan_permisos_db', 'acuasan_radicados_db', 'acuasan_horas_db', 'acuasan_pqr_db']
  legacyKeys.forEach(k => localStorage.removeItem(k))
} catch (e) {}

const app = createApp(App)

// Registro global de componente SpecularButton
app.component('SpecularButton', SpecularButton)

app.use(router)
app.mount('#app')

// Motor OCR (Render free) despierto mientras la app esté en uso: primer ping
// al abrir y latido cada 10 min — ningún escaneo paga el arranque en frío
mantenerDespiertoMotorOCR()

// Seguimiento dinámico de luz especular al mover el cursor sobre cualquier botón
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    const btn = e.target && e.target.closest && e.target.closest(
      '.btn, .btn-login, .specular-button, .btn-nuevo, .btn-save, .btn-cancel, .btn-del-confirm, .btn-retry, .btn-secundario, button'
    )
    if (btn) {
      const rect = btn.getBoundingClientRect()
      if (rect.width && rect.height) {
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        btn.style.setProperty('--btn-mx', `${x.toFixed(1)}%`)
        btn.style.setProperty('--btn-my', `${y.toFixed(1)}%`)
      }
    }
  }, { passive: true })
}


