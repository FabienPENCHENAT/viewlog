import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Mode hors ligne : le build est mis en cache par un service worker, donc
    // l'app reste utilisable sans réseau (avion, poste isolé, salle serveur).
    // Rien de neuf côté données : le parsing était déjà 100 % local.
    VitePWA({
      // Le nouveau build prend la main tout seul au prochain chargement
      // (déploiement continu : pas de version figée à gérer).
      registerType: "autoUpdate",
      // Service worker enregistré à la main (lib/pwa.js) pour pouvoir couper
      // les vérifications de mise à jour en mode hors ligne forcé.
      injectRegister: null,
      manifest: {
        name: "ViewLog · Local Log Viewer",
        short_name: "ViewLog",
        description:
          "Read, search and analyze your log files entirely in your browser. Nothing leaves your device.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0f1116",
        background_color: "#0f1116",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // og.png ne sert qu'aux aperçus sociaux : inutile hors ligne.
        globIgnores: ["**/og.png"],
        // Les routes SPA retombent sur index.html, sauf /api/* qui doit rester
        // du réseau pur (analytics, dashboard privé).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Aucun runtimeCaching : ce qui n'est pas préchargé part au réseau, et
        // rien n'est mis en file d'attente pour un rejeu ultérieur.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    // Autorise l'import de docs/CHANGELOG.md (hors racine Vite) via ?raw.
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
  },
});
