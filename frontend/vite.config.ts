import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/csms/', // ensure assets load correctly when hosted at /csms
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0', // Allow access from LAN
    proxy: {
      '/api': 'http://localhost:3777',
      '/csms/api': {
        target: 'http://localhost:3777',
        rewrite: (path: string) => path.replace(/^\/csms/, ''),
      },
      '/csms/uploads': {
        target: 'http://localhost:3777',
        rewrite: (path: string) => path.replace(/^\/csms/, ''),
      },
      '/uploads': 'http://localhost:3777',
    },
  },
});
