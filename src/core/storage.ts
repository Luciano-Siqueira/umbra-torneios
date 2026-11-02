// ============================================================
// Persistencia local (localStorage) - torneios + cadastro global
// ============================================================

import type { Torneio } from "./types";

const KEY_TORNEIOS = "mtg.torneios.v1";
const KEY_JOGADORES = "mtg.jogadores.v1";

export function listarTorneios(): Torneio[] {
  try {
    const raw = localStorage.getItem(KEY_TORNEIOS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Torneio[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function salvarTorneios(torneios: Torneio[]): void {
  try {
    localStorage.setItem(KEY_TORNEIOS, JSON.stringify(torneios));
  } catch (e) {
    console.error("Erro ao salvar torneios", e);
  }
}

export function upsertTorneio(t: Torneio): void {
  const lista = listarTorneios();
  const idx = lista.findIndex((x) => x.id === t.id);
  if (idx >= 0) lista[idx] = t;
  else lista.push(t);
  lista.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
  salvarTorneios(lista);
}

export function removerTorneio(id: string): void {
  const lista = listarTorneios().filter((t) => t.id !== id);
  salvarTorneios(lista);
}

// Cadastro global de nomes (para autocomplete entre torneios)
export function carregarNomes(): string[] {
  try {
    const raw = localStorage.getItem(KEY_JOGADORES);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function registrarNome(nome: string): void {
  const n = nome.trim();
  if (!n) return;
  const nomes = carregarNomes();
  const lower = nomes.map((x) => x.toLowerCase());
  if (!lower.includes(n.toLowerCase())) {
    nomes.push(n);
    nomes.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    localStorage.setItem(KEY_JOGADORES, JSON.stringify(nomes));
  }
}

export function sugerirNomes(prefixo: string, limite = 8): string[] {
  const p = prefixo.trim().toLowerCase();
  if (!p) return [];
  return carregarNomes()
    .filter((n) => n.toLowerCase().startsWith(p))
    .slice(0, limite);
}

// Export/import JSON individual (compat pendrive)
export function exportarJSON(t: Torneio): string {
  return JSON.stringify(t, null, 2);
}

export function importarJSON(json: string): Torneio | null {
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object" && obj.id && obj.nome) {
      return obj as Torneio;
    }
  } catch { /* ignore */ }
  return null;
}
