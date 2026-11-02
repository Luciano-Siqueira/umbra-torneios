// Sincronização bidirecional Supabase ↔ localStorage
import { supabase } from "./supabaseClient";
import * as storage from "./storage";
import type { Torneio } from "./types";

const DEBOUNCE_MS = 800;
const timeouts = new Map<string, number>();

// Puxa TODOS os torneios do servidor para o localStorage
export async function puxarDoServidor(): Promise<{ torneios: number; erros: string[] }> {
  const erros: string[] = [];
  try {
    const { data, error } = await supabase
      .from("torneios")
      .select("id, dados")
      .order("criado_em", { ascending: false });
    if (error) {
      erros.push(error.message);
      return { torneios: 0, erros };
    }
    if (!data) return { torneios: 0, erros };

    // Puxa também os nomes cadastrados
    const { data: nomes } = await supabase.from("nomes_cadastrados").select("nome");
    const nomesLocais = new Set(storage.carregarNomes().map((n) => n.toLowerCase()));
    const todosNomes = [...storage.carregarNomes()];
    (nomes || []).forEach((row: any) => {
      if (!nomesLocais.has(row.nome.toLowerCase())) {
        todosNomes.push(row.nome);
        nomesLocais.add(row.nome.toLowerCase());
      }
    });
    todosNomes.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    localStorage.setItem("mtg.jogadores.v1", JSON.stringify(todosNomes));

    // SUBSTITUI o localStorage pelo que veio do servidor (já filtrado por RLS)
    // Isso garante que, se mudar de usuário, só vê o que ESSE usuário pode ver.
    const arr = (data as any[]).map((row) => row.dados as Torneio);
    arr.sort((a, b) => (b.dataCriacao || "").localeCompare(a.dataCriacao || ""));
    localStorage.setItem("mtg.torneios.v1", JSON.stringify(arr));

    return { torneios: data.length, erros };
  } catch (e: any) {
    erros.push(e.message || String(e));
    return { torneios: 0, erros };
  }
}

// Envia um torneio pro servidor (debounced por id para agrupar updates rápidos)
export function enviarTorneio(t: Torneio) {
  const chave = `torneio-${t.id}`;
  if (timeouts.has(chave)) window.clearTimeout(timeouts.get(chave)!);
  const to = window.setTimeout(async () => {
    try {
      await supabase.from("torneios").upsert({
        id: t.id,
        nome: t.nome,
        dados: t,
        publico: true,
      });
    } catch {}
    timeouts.delete(chave);
  }, DEBOUNCE_MS);
  timeouts.set(chave, to);
}

export async function removerTorneio(id: string) {
  try { await supabase.from("torneios").delete().eq("id", id); } catch {}
}

export async function enviarNome(nome: string) {
  try { await supabase.from("nomes_cadastrados").upsert({ nome }); } catch {}
}

// Empurra TODO o localStorage pro servidor (migração inicial)
export async function empurrarTudo(): Promise<{ enviados: number; erros: string[] }> {
  const erros: string[] = [];
  const torneios = storage.listarTorneios();
  const payload = torneios.map((t) => ({
    id: t.id, nome: t.nome, dados: t, publico: true,
  }));
  if (payload.length > 0) {
    const { error } = await supabase.from("torneios").upsert(payload);
    if (error) erros.push(error.message);
  }
  const nomes = storage.carregarNomes();
  if (nomes.length > 0) {
    const { error } = await supabase
      .from("nomes_cadastrados")
      .upsert(nomes.map((n) => ({ nome: n })));
    if (error) erros.push(error.message);
  }
  return { enviados: payload.length, erros };
}
