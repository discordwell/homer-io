import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'HOMER.io — AI-Powered Logistics',
        short_name: 'HOMER.io',
        description: 'AI-powered logistics platform for route optimization, fleet management, and delivery tracking',
        // Matches --bg / the meta theme-color that theme-init.js stamps for the
        // dark default. Installed PWAs get one static value, so it tracks the
        // product default rather than the user's chosen theme.
        theme_color: '#06090F',
        background_color: '#06090F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/demo/, /^\/api/, /^\/stripe/, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'homer-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(js|css|woff2?|png|svg|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'homer-static-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'homer-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 86400 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Zustand must live in its own chunk. Left to itself, Rollup inlines
        // it into whichever chunk reaches it first — often the entry — and the
        // lazily-loaded store chunks then import `create` back *from* the
        // entry. That is a circular chunk dependency: the store chunk
        // evaluates before the entry has finished defining `create`, and every
        // `create(...)` call at module scope throws "is not a function",
        // blanking the app in production only (dev is unbundled, so it never
        // reproduces there).
        manualChunks(id) {
          if (id.includes('node_modules/zustand')) return 'vendor-zustand';
        },
      },
    },
  },
});
