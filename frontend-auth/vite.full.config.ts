import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: {
    outDir: 'dist-full',
    sourcemap: false,
    rollupOptions: { input: fileURLToPath(new URL('./app.html', import.meta.url)) },
  },
});
