// Sincronização bidirecional Supabase ↔ localStorage
import { supabase } from "./supabaseClient";
import * as storage from "./storage";
import type { Torneio } from "./types";

const DEBOUNCE_MS = 800;
const ESPERA_INICIAL_MS = 5_000;
const ESPERA_MAXIMA_MS = 30_000;
const KEY_PENDENTES = "mtg.envios.pendentes";

const timeouts = new Map<string, number>();
const falhas = new Map<string, number>(); // id → tentativas seguidas sem conexão
const pendentes = new Set<string>(lerPendentes()); // sobrevivem a recarregar a página

export type AvisoEnvio =
  | { tipo: "sem-conexao" }
  | { tipo: "recuperado" }
  | { tipo: "recusado"; nome: string; motivo: string }
  | { tipo: "exclusao-falhou"; motivo: string };

let avisar: (aviso: AvisoEnvio) => void = () => {};

export function definirAvisoEnvio(fn: (aviso: AvisoEnvio) => void) {
  avisar = fn;
}

function lerPendentes(): string[] {
  try {
    const lista = JSON.parse(localStorage.getItem(KEY_PENDENTES) || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function salvarPendentes() {
  localStorage.setItem(KEY_PENDENTES, JSON.stringify(Array.from(pendentes)));
}

export function temEnviosPendentes(): boolean {
  return pendentes.size > 0;
}

// Sem código é falha de rede; PGRST0xx/PGRST30x são banco fora do ar ou sessão expirada.
// Os demais (como RLS) o servidor recusou de verdade: tentar de novo não adianta.
export function erroDeConexao(error: { code?: string }): boolean {
  const codigo = error.code ?? "";
  return !codigo || codigo.startsWith("PGRST0") || codigo.startsWith("PGRST30");
}

function agendar(id: string, ms: number) {
  if (timeouts.has(id)) window.clearTimeout(timeouts.get(id)!);
  timeouts.set(id, window.setTimeout(() => {
    timeouts.delete(id);
    enviarPendente(id);
  }, ms));
}

function concluir(id: string) {
  falhas.delete(id);
  // Se o torneio mudou durante o envio, ainda há outro envio agendado
  if (timeouts.has(id)) return;
  pendentes.delete(id);
  salvarPendentes();
}

async function enviarPendente(id: string): Promise<boolean> {
  const t = storage.listarTorneios().find((x) => x.id === id);
  if (!t) {
    concluir(id);
    return true;
  }

  const { error } = await supabase.from("torneios").upsert({
    id: t.id,
    nome: t.nome,
    dados: t,
    publico: true,
  });

  if (!error) {
    const estavaFalhando = falhas.has(id);
    concluir(id);
    if (estavaFalhando && falhas.size === 0) avisar({ tipo: "recuperado" });
    return true;
  }

  if (erroDeConexao(error)) {
    const tentativas = falhas.get(id) ?? 0;
    if (falhas.size === 0) avisar({ tipo: "sem-conexao" });
    falhas.set(id, tentativas + 1);
    if (!timeouts.has(id)) agendar(id, Math.min(ESPERA_INICIAL_MS * 2 ** tentativas, ESPERA_MAXIMA_MS));
    return false;
  }

  console.error("Envio recusado pelo servidor", error);
  concluir(id);
  avisar({ tipo: "recusado", nome: t.nome, motivo: error.message });
  return false;
}

// Tenta de novo o que ficou guardado: ao entrar e quando a internet volta
export function retomarEnvios() {
  pendentes.forEach((id) => agendar(id, 0));
}

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
    // Com envio pendente, mantém o local para não apagar a alteração que ainda não subiu.
    if (pendentes.size === 0) {
      const arr = (data as any[]).map((row) => row.dados as Torneio);
      arr.sort((a, b) => (b.dataCriacao || "").localeCompare(a.dataCriacao || ""));
      localStorage.setItem("mtg.torneios.v1", JSON.stringify(arr));
    }

    return { torneios: data.length, erros };
  } catch (e: any) {
    erros.push(e.message || String(e));
    return { torneios: 0, erros };
  }
}

// Envia um torneio pro servidor (debounced por id para agrupar updates rápidos)
export function enviarTorneio(t: Torneio) {
  pendentes.add(t.id);
  salvarPendentes();
  agendar(t.id, DEBOUNCE_MS);
}

// Envia na hora, cancelando o envio agendado: usado antes de avisar quem acompanha ao vivo
export async function enviarTorneioAgora(t: Torneio): Promise<void> {
  if (timeouts.has(t.id)) {
    window.clearTimeout(timeouts.get(t.id)!);
    timeouts.delete(t.id);
  }
  pendentes.add(t.id);
  salvarPendentes();
  await enviarPendente(t.id);
}

// Baixa um único torneio para o localStorage
export async function puxarTorneio(id: string): Promise<boolean> {
  if (pendentes.size > 0) return false;
  const { data, error } = await supabase.from("torneios").select("dados").eq("id", id).maybeSingle();
  if (error || !data) return false;
  storage.upsertTorneio(data.dados as Torneio);
  return true;
}

export async function removerTorneio(id: string) {
  if (timeouts.has(id)) {
    window.clearTimeout(timeouts.get(id)!);
    timeouts.delete(id);
  }
  falhas.delete(id);
  pendentes.delete(id);
  salvarPendentes();
  const { error } = await supabase.from("torneios").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir torneio", error);
    avisar({ tipo: "exclusao-falhou", motivo: error.message });
  }
}

export async function enviarNome(nome: string) {
  try { await supabase.from("nomes_cadastrados").upsert({ nome }); } catch {}
}

// Empurra o localStorage inteiro pro servidor (migração inicial)
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
