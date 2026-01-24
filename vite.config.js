import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/isbar/',
  plugins: [react()],
  server: {
    proxy: {
      '/isbar/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/isbar\/api/, '/api'),
      },
    },
    host: true,
  },
  build: {
    outDir: 'dist'
  }
})
