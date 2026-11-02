# Tournament System

Sistema de torneios Multiplayer Table Format (MTG, Commander, Precon).

## Stack
- React 18 + Vite + TypeScript
- TailwindCSS
- Zustand (state)
- Supabase (auth + banco)
- PWA ready

## Rodar local
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

## Build single-file (standalone HTML)
```bash
npm run build:single
```
Gera `dist-single/index.html` — um único arquivo que abre com duplo clique, sem servidor.

## Build para web (deploy)
```bash
npm run build
```
Gera `dist/` otimizado pra servir em CDN (Vercel/Netlify/GitHub Pages).

## Config
Credenciais do Supabase ficam em `src/core/supabaseClient.ts`. A publishable key é segura de commitar.

## Deploy
Pronto pra Vercel. Importe o repo em https://vercel.com/new — detecta Vite automaticamente.
