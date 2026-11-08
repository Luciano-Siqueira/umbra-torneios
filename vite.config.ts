import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "privacidade.html", "excluir-conta.html"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webp,png}"], // inclui o banner no cache offline
      },
      manifest: {
        // id, start_url e scope fixos: o app Android (TWA) fica ligado a eles
        id: "/",
        start_url: "/",
        scope: "/",
        name: "Umbra Torneios",
        short_name: "Umbra Torneios",
        lang: "pt-BR",
        description: "Gestão de torneios de MTG multiplayer",
        categories: ["games", "sports", "utilities"],
        prefer_related_applications: false,
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
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
          // O fundo vai até a borda e a lua fica dentro da área segura: serve para o recorte do Android
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
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
