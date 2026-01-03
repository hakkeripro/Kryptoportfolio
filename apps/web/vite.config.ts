import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE:
// We intentionally avoid injectManifest + Workbox imports inside a TS service-worker file.
// The E2E environment (and typical local installs) don't have explicit workbox-* deps,
// which caused "Failed to resolve import workbox-precaching".
// Instead we use GenerateSW (default) and attach our push handlers via workbox.importScripts.

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kryptoportfolio v3',
        short_name: 'Kryptoportfolio',
        theme_color: '#0f172a',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Extra runtime handlers for Web Push.
        // The file lives in /public so it will be copied to the dist root.
        importScripts: ['sw-push.js']
      },
      devOptions: {
        enabled: mode === 'development'
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      // Local dev convenience: the default apiBase is /api (same as hosted),
      // so we proxy to the local Fastify API without CORS.
      '/api': {
        // NOTE: default local API port is 8788 (8787 is commonly taken on Windows by HTTP.sys)
        // Override when needed: set VITE_API_PROXY_TARGET, e.g. http://127.0.0.1:8790
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}));
