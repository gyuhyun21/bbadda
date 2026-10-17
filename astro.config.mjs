import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bbadda.com',
  output: 'static',
  devToolbar: { enabled: false },
  build: { format: 'directory', inlineStylesheets: 'always' },
});
