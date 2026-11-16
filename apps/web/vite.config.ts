import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { aliases } from '../../config/aliases.ts';

const SERVER_PORT = Number(process.env.PLYO_SERVER_PORT ?? 8787);
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  plugins: [react()],
  resolve: { alias: aliases },
  assetsInclude: ['**/*.glb'],
  server: {
    host: true,
    // Shared packages live outside the app folder.
    fs: { allow: [here('../..')] },
    port: 5173,
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
      '/health': { target: `http://localhost:${SERVER_PORT}` },
    },
  },
  build: {
    target: 'es2022',
    outDir: here('dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: { main: here('index.html') },
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
});
