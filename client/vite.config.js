import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  /* `npm run dev` and `npm run preview` forward /api to the Django server, so
     the browser sees one origin: the auth cookies are first-party and
     SameSite=Lax needs no exceptions. The Host header is passed through
     unchanged, which is what Django's CSRF origin check compares against. */
  const apiProxy = {
    '/api': { target: env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: false },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
    build: {
      target: 'es2020',
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          manualChunks: { gsap: ['gsap'], lenis: ['lenis'] },
        },
      },
    },
  };
});
