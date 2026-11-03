import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,jpg}"], // inclui o banner no cache offline
      },
      manifest: {
        name: "MTG Tournament System",
        short_name: "MTG Torneios",
        description: "Sistema de torneios Rei das Cartinhas",
        theme_color: "#a78bfa",
        background_color: "#0f0e17",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000, // inline pequenos assets pra facilitar portabilidade
  },
});
