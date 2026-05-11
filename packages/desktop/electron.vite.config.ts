import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    resolve: {
      alias: { '@shared': resolve('../shell/src') },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    resolve: {
      alias: { '@shared': resolve('../shell/src') },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') },
      },
    },
    plugins: [
      react(),
      // Vite 5+ adds a `crossorigin` attribute to <script type="module"> in
      // production index.html. Under Electron's file:// protocol, browsers
      // (Chromium incl.) refuse to execute crossorigin module scripts loaded
      // from file:// — the renderer never bootstraps and the window is blank.
      // Strip the attribute from the built index.html.
      {
        name: 'strip-crossorigin',
        apply: 'build',
        transformIndexHtml(html: string) {
          return html.replace(/\s+crossorigin(=["'][^"']*["'])?/g, '');
        },
      },
    ],
    resolve: {
      alias: { '@shared': resolve('../shell/src') },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
