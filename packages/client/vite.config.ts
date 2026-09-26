import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Percorsi relativi: la stessa build funziona alla radice (server Node) e in una sottocartella (GitHub Pages).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // App installabile: icona sul telefono, schermo intero, e si apre anche con rete debole.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icona.svg'],
      manifest: {
        name: 'Lupus in Tabula',
        short_name: 'Lupus',
        description: 'Il Master fa da tavolo, gli amici giocano con il loro telefono.',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        background_color: '#070a18',
        theme_color: '#0b1026',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        // Le chiamate al server (quando c'è) non vanno mai prese dalla cache.
        navigateFallbackDenylist: [/\/api\//, /\/socket\.io\//],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
