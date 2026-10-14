import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Hot reload is for editing code. Behind the shared proxy it is a
    // liability: whenever its websocket drops (idle timeout, phone asleep,
    // Wi-Fi blip) the Vite client reloads the page, which throws away
    // whatever the player was doing — a card photo mid-upload, for one.
    // The shared stack sets AIA_DISABLE_HMR=1; local `npm run dev` keeps it.
    hmr: process.env.AIA_DISABLE_HMR === '1' ? false : undefined,
    allowedHosts: ['frontend', 'localhost', '127.0.0.1'],
    fs: {
      strict: true,
      allow: [projectRoot],
    },
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
