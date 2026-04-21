import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // Docker: 'http://backend:8000' | Local dev: 'http://localhost:8000'
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  // Allow /admin to be served by index.html (SPA fallback)
  appType: 'spa',
});
