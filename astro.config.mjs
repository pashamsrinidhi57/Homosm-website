import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://homasm.com',
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
