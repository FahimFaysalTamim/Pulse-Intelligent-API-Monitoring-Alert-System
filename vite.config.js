import { defineConfig } from 'vite';
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, proxy: Object.fromEntries(['/monitor', '/alerts', '/health', '/stats'].map(path => [path, 'http://127.0.0.1:3000'])) },
});
