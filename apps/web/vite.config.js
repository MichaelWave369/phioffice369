import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/phioffice369/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
