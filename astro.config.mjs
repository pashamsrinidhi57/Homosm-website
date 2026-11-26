import { defineConfig } from 'astro/config';

// Old homasm.com URLs -> new routes (keeps inbound links and SEO)
const redirects = {
  '/project': '/work', '/projects': '/work', '/projects/gallery': '/work',
  '/project/2-bhk-project': '/work/2-bhk-project',
  '/project/4-bhk-project': '/work/4-bhk-project',
  '/project/5-bhk-project': '/work/5-bhk-project',
  '/project/villa-project': '/work/villa-project',
  '/project/kitchen-project-01': '/work/studio-apartment',
  '/project/kitchen-project-05': '/work/3-bhk-project',
  '/project-cat/modern': '/work?style=modern',
  '/project-cat/minimalist': '/work?style=minimalist',
  '/project-cat/contemporary-style': '/work?style=contemporary',
  '/project-cat/indian-classic-style': '/work?style=indian%20classic',
  '/project-cat/indian-traditional-style': '/work?style=indian%20traditional',
  '/project-cat/small-space': '/work?style=small%20space',
  '/project-cat/top-sellers': '/work?style=top%20sellers',
  '/project-cat/vintage': '/work?style=vintage',
};

export default defineConfig({
  redirects,
  site: 'https://homasm.com',
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
