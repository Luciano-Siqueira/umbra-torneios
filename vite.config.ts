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
        globIgnores: ["screenshots/**"], // só para a instalação e a loja; não precisam ficar no aparelho
      },
      manifest: {
        // id, start_url e scope fixos: o app Android (TWA) fica ligado a eles
        id: "/",
        start_url: "/",
        scope: "/",
        name: "Umbra Torneios",
        short_name: "Umbra Torneios",
        lang: "pt-BR",
        dir: "ltr",
        description: "Gestão de torneios de MTG multiplayer",
        categories: ["games", "sports", "utilities"],
        prefer_related_applications: false,
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        display_override: ["standalone"],
        // Reabrir o app traz a janela que já está aberta, em vez de abrir outra
        launch_handler: { client_mode: "focus-existing" },
        // Ao segurar o ícone no celular: abre direto na tela (o app lê ?tela= em src/core/atalhos.ts)
        shortcuts: [
          { name: "Torneios", short_name: "Torneios", url: "/?tela=torneios", icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Decks", short_name: "Decks", url: "/?tela=decks", icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Meu desempenho", short_name: "Desempenho", url: "/?tela=analytics", icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] },
        ],
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
        // Prints em 1080x1920 com dados de exemplo: aparecem na tela de instalação do Android
        screenshots: [
          { src: "screenshots/splash.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Tela inicial" },
          { src: "screenshots/lista.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Seus torneios e o que está em andamento" },
          { src: "screenshots/mesas.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Mesas da rodada com o tempo correndo" },
          { src: "screenshots/ranking.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Ranking com o desempate oficial" },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000, // inline pequenos assets pra facilitar portabilidade
  },
});
