import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        output: fileURLToPath(new URL('./output.html', import.meta.url)),
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
});
