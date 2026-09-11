import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'browser.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      output: {codeSplitting: false},
    },
    sourcemap: true,
  },
})
