// Busca no MTGJSON os decks de Commander que faltam, com as cores da Scryfall.
// Roda no navegador do admin; o banco só aceita a gravação de quem é admin (RLS).
import { create } from "zustand";
import { aplicarDecksExtras, DECKS, type DeckCommander } from "./decks";
import { supabase } from "./supabaseClient";

const MTGJSON = "https://mtgjson.com/api/v5";
const SCRYFALL_COLECAO = "https://api.scryfall.com/cards/collection";
const KEY_CACHE = "mtg.decks.extras";
const LOTE_SCRYFALL = 75; // limite da API

export interface ResultadoAtualizacao {
  adicionados: string[];
  falhas: { nome: string; motivo: string }[];
}

// Avisa as telas de que a lista mudou
export const useVersaoDecks = create<number>(() => 0);

function aplicar(extras: DeckCommander[]) {
  aplicarDecksExtras(extras);
  useVersaoDecks.setState((v) => v + 1, true);
}

// Mostra na hora os decks já baixados neste aparelho, antes de consultar o banco
try {
  const cache = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
  if (Array.isArray(cache)) aplicarDecksExtras(cache);
} catch { /* ignore */ }

const daLinha = (r: any): DeckCommander => ({
  lancamento: String(r.lancamento).slice(0, 10),
  colecao: r.colecao,
  nome: r.nome,
  comandantes: r.comandantes,
  cartas: r.cartas,
  tokens: r.tokens,
  cores: r.cores,
});

// Enquanto a tabela não existir, ou sem conexão, segue com a lista que acompanha o site
export async function sincronizarDecks(): Promise<void> {
  const { data, error } = await supabase.from("decks_commander").select("*");
  if (error || !data) return;
  const extras = data.map(daLinha);
  localStorage.setItem(KEY_CACHE, JSON.stringify(extras));
  aplicar(extras);
}

async function baixarJson(url: string, init?: RequestInit): Promise<any> {
  const resposta = await fetch(url, init);
  if (!resposta.ok) throw new Error(`${new URL(url).hostname} respondeu ${resposta.status}`);
  return resposta.json();
}

const somarCartas = (lista: any[] = []) => lista.reduce((soma, c) => soma + (c.count ?? 1), 0);
// Cartas de duas faces vêm como "Frente // Verso"; a Scryfall encontra pela frente
const nomeDaCarta = (nome: string) => nome.split(" // ")[0].trim();
const ORDEM_CORES = "WUBRG";

async function buscarCores(nomes: string[]): Promise<Map<string, string[]>> {
  const unicos = Array.from(new Set(nomes));
  const cores = new Map<string, string[]>();
  for (let i = 0; i < unicos.length; i += LOTE_SCRYFALL) {
    const { data } = await baixarJson(SCRYFALL_COLECAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: unicos.slice(i, i + LOTE_SCRYFALL).map((name) => ({ name })) }),
    });
    for (const carta of data) cores.set(nomeDaCarta(carta.name).toLowerCase(), carta.color_identity);
  }
  return cores;
}

function mensagemDoBanco(erro: { code?: string; message: string }): string {
  if (erro.code === "42P01" || erro.code === "PGRST205") {
    return "A tabela de decks não existe. Rode supabase/decks_commander.sql no Supabase.";
  }
  return erro.message;
}

export async function atualizarDecks(
  aoProgredir?: (feitos: number, total: number) => void
): Promise<ResultadoAtualizacao> {
  // A lista do MTGJSON é pequena: só os decks novos precisam ser baixados inteiros
  const { data: indice } = await baixarJson(`${MTGJSON}/DeckList.json`);
  const conhecidos = new Set(DECKS.map((d) => `${d.colecao}|${d.nome}`));
  const novos = (indice as any[]).filter(
    (d) => String(d.type ?? "").includes("Commander") && !conhecidos.has(`${d.code}|${d.name}`)
  );

  const falhas: ResultadoAtualizacao["falhas"] = [];
  const baixados: { base: Omit<DeckCommander, "cores">; cartas: string[] }[] = [];

  for (let i = 0; i < novos.length; i++) {
    const item = novos[i];
    aoProgredir?.(i, novos.length);
    try {
      const { data: deck } = await baixarJson(`${MTGJSON}/decks/${encodeURIComponent(item.fileName)}.json`);
      const comandantes: any[] = deck.commander ?? [];
      if (comandantes.length === 0) throw new Error("sem comandante no MTGJSON");
      baixados.push({
        cartas: comandantes.map((c) => nomeDaCarta(c.name)),
        base: {
          lancamento: item.releaseDate,
          colecao: item.code,
          nome: item.name,
          comandantes: comandantes.map((c) => c.name).join(", "),
          cartas: somarCartas(comandantes) + somarCartas(deck.mainBoard),
          tokens: somarCartas(deck.tokens),
        },
      });
    } catch (e: any) {
      falhas.push({ nome: item.name, motivo: e.message });
    }
  }
  aoProgredir?.(novos.length, novos.length);

  if (baixados.length === 0) return { adicionados: [], falhas };

  const cores = await buscarCores(baixados.flatMap((d) => d.cartas));
  const linhas: DeckCommander[] = [];
  for (const d of baixados) {
    const faltando = d.cartas.find((c) => !cores.has(c.toLowerCase()));
    if (faltando) {
      // Sem a cor certa, o deck fica para a próxima atualização em vez de entrar errado
      falhas.push({ nome: d.base.nome, motivo: `${faltando} ainda não está na Scryfall` });
      continue;
    }
    const identidade = new Set(d.cartas.flatMap((c) => cores.get(c.toLowerCase())!));
    linhas.push({
      ...d.base,
      cores: Array.from(ORDEM_CORES).filter((c) => identidade.has(c)).join(""),
    });
  }

  if (linhas.length > 0) {
    const { error } = await supabase.from("decks_commander").upsert(linhas);
    if (error) throw new Error(mensagemDoBanco(error));
    await sincronizarDecks();
  }
  return { adicionados: linhas.map((d) => d.nome), falhas };
}
