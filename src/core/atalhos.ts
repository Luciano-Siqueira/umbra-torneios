// Atalhos do ícone do app (manifest "shortcuts"): abrem o app em /?tela=decks, por exemplo.
// As telas do app não têm endereço próprio, então o parâmetro é lido uma vez e tirado da barra.
import type { Tela } from "./store";

const TELAS_DE_ATALHO: Tela[] = ["torneios", "decks", "analytics"];

export function telaDoAtalho(busca: string): Tela | null {
  const tela = new URLSearchParams(busca).get("tela");
  return TELAS_DE_ATALHO.includes(tela as Tela) ? (tela as Tela) : null;
}

export function tirarAtalhoDoEndereco(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("tela")) return;
  url.searchParams.delete("tela");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
