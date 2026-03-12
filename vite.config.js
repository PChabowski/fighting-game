import { defineConfig } from 'vite'; 
import react from '@vitejs/plugin-react'; 
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({ 
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // using prompt so we can show UpdateModal
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Blood Honor',
        short_name: 'Blood Honor',
        description: 'A modular 2D fighting game.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mp3,wav}']
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  }
});
