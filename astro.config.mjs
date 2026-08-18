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
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare']
    }
  }
});
