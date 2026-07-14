/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// Two modes:
//  - `vite` / `vite dev`  → serves the demo (index.html + src/demo)
//  - `vite build`         → builds the library (src/index.js) with Vue external
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build:
    command === 'build'
      ? {
          lib: {
            entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
            name: 'ScrambleEditor',
            fileName: 'scramble-editor',
          },
          rollupOptions: {
            external: ['vue'],
            output: { globals: { vue: 'Vue' } },
          },
        }
      : undefined,
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}));
