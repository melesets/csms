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
      // Point to backend dev server (you are currently running on port 4000)
      '/api': 'http://localhost:4000',
      // Also proxy /isbar/api for dev when app is accessed under /isbar/
      '/isbar/api': 'http://localhost:4000',
    },
  },
});
