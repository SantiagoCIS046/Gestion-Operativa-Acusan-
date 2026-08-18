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
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  }
})
