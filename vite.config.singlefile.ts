import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build single-file COMPATÍVEL com file:// (duplo clique).
// Chave: target "es2015" + format iife → sem ES modules,
// para navegadores não bloquearem o script quando aberto direto do disco.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile({ useRecommendedBuildConfig: false, removeViteModuleLoader: true })],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    target: "es2015",
    rolldownOptions: {
      output: {
        format: "iife",
      },
    },
    emptyOutDir: true,
  },
});
