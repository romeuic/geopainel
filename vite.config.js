import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  server: { port: 5190 },
  build: {
    target: ['chrome80', 'safari13', 'firefox78'],
    sourcemap: false,
    // O bundle carrega a malha municipal do IBGE (~200 KB gzip); é esperado.
    chunkSizeWarningLimit: 1000,
  },
});
