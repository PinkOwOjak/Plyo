/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.PLYO_SERVER_PORT ?? 8787);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
      '/health': { target: `http://localhost:${SERVER_PORT}` },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
