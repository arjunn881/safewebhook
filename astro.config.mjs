// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://safewebhook.com',
  server: {
    port: 3000,
    host: true
  },
  // Disable Astro's built-in CSRF origin check so that webhook receiver endpoints
  // (/api/r/*, /api/email/*) can accept cross-origin form-encoded and multipart POSTs
  // from external services (Stripe, GitHub, Shopify, etc.). CORS is managed explicitly
  // per-route via CORS_HEADERS.
  security: {
    checkOrigin: false,
  },
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare', 'wrangler', 'miniflare'],
      include: ['astro/assets/services/noop', 'astro/app/manifest'],
    },
    ssr: {
      optimizeDeps: {
        include: ['astro/assets/services/noop', 'astro/app/manifest'],
      },
    },
    build: {
      emptyOutDir: true,
    },
    server: {
      watch: {
        ignored: ['**/.wrangler/**', '**/dist/**'],
      },
    },
  },
});
