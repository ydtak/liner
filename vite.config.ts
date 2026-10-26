import { createReadStream, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Serves the Stockfish lite single-threaded engine at /engine/ in dev and emits it
 * into the build, straight from node_modules. The .js expects its .wasm alongside.
 */
function stockfishEngine(): Plugin {
  const dir = resolve('node_modules/stockfish/bin');
  const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];
  const type = (f: string) => (f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
  return {
    name: 'liner-stockfish-engine',
    configureServer(server) {
      server.middlewares.use('/engine/', (req, res, next) => {
        const file = (req.url ?? '').slice(1).split('?')[0];
        if (!files.includes(file)) return next();
        res.setHeader('Content-Type', type(file));
        createReadStream(join(dir, file)).pipe(res);
      });
    },
    generateBundle() {
      for (const file of files) {
        this.emitFile({ type: 'asset', fileName: `engine/${file}`, source: readFileSync(join(dir, file)) });
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets BASE_PATH. Local dev stays at /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    stockfishEngine(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // The engine is optional and large: cache it on first use instead of precaching.
        globIgnores: ['engine/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/engine/'),
            handler: 'CacheFirst',
            options: { cacheName: 'liner-engine', expiration: { maxEntries: 4 } },
          },
        ],
      },
      manifest: {
        name: 'Liner',
        short_name: 'Liner',
        description: 'Learn chess openings visually.',
        theme_color: '#2f3b33',
        background_color: '#f6f3ec',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
});
