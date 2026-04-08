import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/games': 'http://backend:8000',
      '/players': 'http://backend:8000',
      '/stats': 'http://backend:8000',
      '/upload': 'http://backend:8000',
      '/images': 'http://backend:8000',
      '/docs': 'http://backend:8000',
      '/openapi.json': 'http://backend:8000',
    },
  },
});
