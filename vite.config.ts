import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Appen publiceras på https://<användare>.github.io/hundappen/
const base = '/hundappen/'

export default defineConfig({
  define: {
    // Visas i appen så att man ser vilken version som är installerad.
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  base,
  plugins: [
    react(),
    VitePWA({
      // Egen service worker (src/sw.ts) så att vi kan hantera pushnotiser senare.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Hundappen',
        short_name: 'Hundappen',
        description: 'Rastning, mat och schema för hela familjen',
        lang: 'sv',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f1e7',
        theme_color: '#2f6f4f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
})
