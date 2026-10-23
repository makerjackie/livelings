import { defineConfig } from 'vite'

/** Standalone ES module served at /livelings.js: the engine, the family and <live-ling>. */
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'livelings.js' },
    minify: true
  }
})
