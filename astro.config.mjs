import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://bbadda.com',
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  devToolbar: { enabled: false },
  build: { format: 'directory', inlineStylesheets: 'always' },
});
