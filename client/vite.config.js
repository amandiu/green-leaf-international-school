import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly when 5173 is occupied instead of silently drifting to
    // the next port. Keeps the public URL stable for Cloudflare docs.
    strictPort: true,
    // Allow Cloudflare quick-tunnel hosts (Phase 2B.7) so the dev server
    // responds when accessed via https://<name>.trycloudflare.com.
    // Localhost access is unaffected.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
