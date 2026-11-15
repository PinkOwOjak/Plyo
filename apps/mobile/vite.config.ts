import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { aliases } from '../../config/aliases.ts';

const SERVER_PORT = Number(process.env.PLYO_SERVER_PORT ?? 8787);
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  // Relative asset paths so the build works inside the Capacitor WebView.
  base: './',
  plugins: [react()],
  resolve: { alias: aliases },
  assetsInclude: ['**/*.glb'],
  server: {
    host: true,
    // Shared packages live outside the app folder.
    fs: { allow: [here('../..')] },
    port: 5174,
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    target: 'es2022',
    outDir: here('dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
});
