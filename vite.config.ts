import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { catalogPlugin } from './scripts/vite-plugin-catalog';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), catalogPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3010,
    proxy: {
      '/docker-hub': {
        target: 'https://hub.docker.com/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/docker-hub/, ''),
      },
      '/ghcr-auth': {
        target: 'https://ghcr.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ghcr-auth/, '/token'),
      },
      '/ghcr': {
        target: 'https://ghcr.io/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ghcr/, ''),
      },
    },
  },
});
