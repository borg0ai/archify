import { copyFileSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

const SITE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES_REPOSITORY = 'archify';
// 登记在 ws/prj/port.md。避开 Vite 默认 5173。
const SITE_DEV_PORT = 5196;
const SITE_PREVIEW_PORT = 5197;
const STATIC_DIRECTORIES = ['assets', 'gallery', 'cases', 'skill-updates'] as const;
const PAGE_ENTRIES = {
  index: path.join(SITE_ROOT, 'index.html'),
  gallery: path.join(SITE_ROOT, 'gallery.html'),
  guide: path.join(SITE_ROOT, 'guide.html'),
  start: path.join(SITE_ROOT, 'start.html'),
};
const VUE_ENTRY = '<script type="module" src="./src/main.ts"></script>';

function siteBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;
  const publishToPages = process.env.GITHUB_PAGES === 'true';
  const customDomain = process.env.CUSTOM_DOMAIN === 'true';
  if (publishToPages && !customDomain) return `/${PAGES_REPOSITORY}/`;
  return '/';
}

function mountVueRuntime(): Plugin {
  return {
    name: 'mount-vue-runtime',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (html.includes('src/main.ts')) return html;
        return html.replace('</body>', `${VUE_ENTRY}</body>`);
      },
    },
  };
}

function publishStaticSite(): Plugin {
  return {
    name: 'publish-static-site',
    apply: 'build',
    closeBundle() {
      const dist = path.join(SITE_ROOT, 'dist');
      for (const directory of STATIC_DIRECTORIES) {
        cpSync(path.join(SITE_ROOT, directory), path.join(dist, directory), { recursive: true });
      }
      const marker = path.join(SITE_ROOT, '.nojekyll');
      if (existsSync(marker)) copyFileSync(marker, path.join(dist, '.nojekyll'));
    },
  };
}

export default defineConfig({
  base: siteBase(),
  publicDir: false,
  plugins: [vue(), mountVueRuntime(), publishStaticSite()],
  server: {
    port: SITE_DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: SITE_PREVIEW_PORT,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: PAGE_ENTRIES,
    },
  },
});
