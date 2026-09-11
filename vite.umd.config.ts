import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/umd.ts', import.meta.url)),
      formats: ['umd'],
      name: 'AiEditor',
      fileName: () => 'aieditor.umd.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      output: {exports: 'default'},
    },
    sourcemap: true,
  },
})
