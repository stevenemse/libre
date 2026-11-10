import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Libre — Richesse = liberté',
        short_name: 'Libre',
        description:
          'Ton compagnon financier : budget, épargne, répartition et simulation de liberté.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B0F15',
        theme_color: '#0B0F15',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        importScripts: ['push-handler.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
});
