import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'

// En ESM, __dirname n'existe pas ; on le recrée pour utiliser path.resolve plus bas.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Alias : permet d'importer avec import x from '$lib/...' au lieu de chemins relatifs.
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib')
    }
  },
  plugins: [
    // Plugin Svelte : compilation des .svelte, hot reload.
    svelte(),
    // Plugin PWA : génère un service worker (Workbox) et le manifest pour l'app installable.
    VitePWA({
      // Le SW se met à jour automatiquement quand une nouvelle version est déployée.
      registerType: 'autoUpdate',
      // Fichiers à inclure dans le cache du SW (favicon, robots.txt).
      includeAssets: ['favicon.ico', 'robots.txt'],
      // Manifest : infos affichées quand on "installe" l'app (nom, couleurs, mode standalone).
      manifest: {
        name: 'Zero-Knowledge Facturation',
        short_name: 'ZK Facturation',
        description: 'Facturation local-first, confidentialité totale',
        theme_color: '#0f766e',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        // Ajouter pwa-192x192.png et pwa-512x512.png dans public/ pour les icônes.
        icons: []
      },
      // Workbox : types de fichiers mis en cache par le SW au build (js, css, html, images, fonts).
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ne pas intercepter /paiement/* : la requête part au serveur → page "Paiement effectué" du backend.
        navigateFallbackDenylist: [/^\/paiement/]
      }
    })
  ]
})
