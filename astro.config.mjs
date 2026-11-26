import { defineConfig } from 'astro/config';

// Project site: https://crystiepaulette.github.io/ecuador-brief/
export default defineConfig({
  site: 'https://crystiepaulette.github.io',
  base: '/ecuador-brief',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
