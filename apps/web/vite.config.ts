import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PocketBase serves the built app from pb_public on the same origin as the API, so the app
// never needs an API URL baked in (Amvera env vars exist only at runtime — CLAUDE.md).
const POCKETBASE = 'http://127.0.0.1:8090';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'CatHub — уход за котом',
        short_name: 'CatHub',
        description: 'Кто покормил кота, когда менять лоток и когда прививка',
        lang: 'ru',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff8f0',
        theme_color: '#fff8f0',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Never let the service worker answer PocketBase API, realtime or admin UI requests.
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': POCKETBASE,
      '/_': POCKETBASE,
    },
  },
});
