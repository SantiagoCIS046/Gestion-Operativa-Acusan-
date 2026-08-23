import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: 'acusan/frontend',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./acusan/frontend/src', import.meta.url))
    }
  },
  // Proxy para que las llamadas /api lleguen al backend Express (puerto 3000)
  // tanto en desarrollo como en pruebas locales. Sin esto, los datos solo
  // se guardan en localStorage y nunca llegan a MongoDB Atlas.
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  }
})
