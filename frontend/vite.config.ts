import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/isbar/', // ensure assets load correctly when hosted at /isbar
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0', // Allow access from LAN
    proxy: {
      '/api': 'http://localhost:4000',
      '/isbar/api': {
        target: 'http://localhost:4000',
        rewrite: (path: string) => path.replace(/^\/isbar/, ''),
      },
      '/uploads': 'http://localhost:4000',
    },
  },
});
