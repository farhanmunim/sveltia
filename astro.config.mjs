// @ts-check
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

// While Site Settings → "Allow search engines to index this site" is off (the default),
// send X-Robots-Tag: noindex on every response (including images, PDFs and preview deployments).
// Cloudflare Pages reads the generated `_headers` file.
const blockIndexing = {
  name: 'block-indexing-headers',
  hooks: {
    'astro:build:done': (/** @type {{ dir: URL }} */ { dir }) => {
      const settings = readFileSync(new URL('./src/content/settings/site.yml', import.meta.url), 'utf8');
      if (/^allow_indexing:\s*true\s*$/m.test(settings)) return;
      writeFileSync(new URL('_headers', dir), '/*\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet\n');
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // Update this to the site's production URL (used for canonical links and sitemaps).
  site: 'https://sveltia.farhan.app',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [blockIndexing],
});
