import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineShell } from './pwa/offlineShell.js';

export default defineConfig({
  plugins: [react(), offlineShell()],
  base: '/phioffice369/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
