import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  // Single source of truth for the version shown in-game (menu tag).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false,
  },
});
