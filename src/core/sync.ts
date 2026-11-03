// Sincronização bidirecional Supabase ↔ localStorage
import { supabase } from "./supabaseClient";
import * as storage from "./storage";
import type { Torneio } from "./types";

const DEBOUNCE_MS = 800;
const ESPERA_INICIAL_MS = 5_000;
const ESPERA_MAXIMA_MS = 30_000;
const KEY_PENDENTES = "mtg.envios.pendentes";
const KEY_VERSOES = "mtg.torneios.versoes";

const timeouts = new Map<string, number>();
const emAndamento = new Map<string, Promise<boolean>>();
const falhas = new Map<string, number>(); // id → tentativas seguidas sem conexão
const pendentes = new Set<string>(lerPendentes()); // sobrevivem a recarregar a página
const conflitos = new Set<string>(); // esperando o usuário escolher qual versão fica

export type AvisoEnvio =
  | { tipo: "sem-conexao" }
  | { tipo: "recuperado" }
  | { tipo: "recusado"; nome: string; motivo: string }
  | { tipo: "exclusao-falhou"; motivo: string }
  | { tipo: "ao-vivo-falhou"; motivo: string }
  | { tipo: "conflito"; id: string; nome: string };

let avisar: (aviso: AvisoEnvio) => void = () => {};

export function definirAvisoEnvio(fn: (aviso: AvisoEnvio) => void) {
  avisar = fn;
}

export function avisarFalhaAoVivo(motivo: string) {
  avisar({ tipo: "ao-vivo-falhou", motivo });
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

export function temConflito(id: string): boolean {
  return conflitos.has(id);
}

// Versão do servidor em que a cópia deste aparelho se baseia (0 = torneio sem versão ainda)
function lerVersoes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY_VERSOES) || "{}");
  } catch {
    return {};
  }
}

function salvarVersao(id: string, versao: number | null) {
  const versoes = lerVersoes();
  if (versao === null) delete versoes[id];
  else versoes[id] = versao;
  localStorage.setItem(KEY_VERSOES, JSON.stringify(versoes));
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

function enviarPendente(id: string): Promise<boolean> {
  // Um envio por vez: o próximo precisa da versão que o anterior gravou
  const anterior = emAndamento.get(id) ?? Promise.resolve(true);
  const envio: Promise<boolean> = anterior.then(() => enviar(id)).finally(() => {
    if (emAndamento.get(id) === envio) emAndamento.delete(id);
  });
  emAndamento.set(id, envio);
  return envio;
}

// Espera o envio em curso terminar, sem disparar outro
export async function envioConcluido(id: string): Promise<void> {
  await emAndamento.get(id);
}

type ErroEnvio = { code?: string; message: string };

// Só grava se o servidor ainda estiver na versão que este aparelho conhece.
// Assim, a alteração de outro aparelho nunca é sobrescrita sem aviso.
async function gravar(t: Torneio): Promise<{ conflito?: boolean; error?: ErroEnvio }> {
  const base: number | undefined = lerVersoes()[t.id];
  const novaVersao = (base ?? 0) + 1;
  const linha = { id: t.id, nome: t.nome, dados: { ...t, versao: novaVersao }, publico: true };

  if (base !== undefined) {
    const atualizar = supabase.from("torneios").update(linha).eq("id", t.id);
    const { data, error } = await (base === 0
      ? atualizar.is("dados->>versao", null)
      : atualizar.eq("dados->>versao", String(base))
    ).select("id");
    if (error) return { error };
    if (data && data.length > 0) {
      salvarVersao(t.id, novaVersao);
      return {};
    }
  }

  // Nada foi alterado: descobre se o torneio é novo, mudou no servidor ou foi recusado
  const { data: atual, error } = await supabase
    .from("torneios")
    .select("versao:dados->>versao")
    .eq("id", t.id)
    .maybeSingle();
  if (error) return { error };

  if (!atual) {
    const { error: erroInsercao } = await supabase.from("torneios").upsert(linha);
    if (erroInsercao) return { error: erroInsercao };
    salvarVersao(t.id, novaVersao);
    return {};
  }

  const versaoServidor = Number((atual as unknown as { versao: string | null }).versao ?? 0);
  if (base === undefined) {
    // Cópia de antes de existir a versão: não há como saber se está atrasada
    salvarVersao(t.id, versaoServidor);
    return gravar(t);
  }
  if (versaoServidor === base) {
    return { error: { code: "42501", message: "Sem permissão para alterar este torneio" } };
  }
  return { conflito: true };
}

async function enviar(id: string): Promise<boolean> {
  if (conflitos.has(id)) return false;
  const t = storage.listarTorneios().find((x) => x.id === id);
  if (!t) {
    concluir(id);
    return true;
  }

  const { conflito, error } = await gravar(t);

  if (conflito) {
    conflitos.add(id);
    avisar({ tipo: "conflito", id, nome: t.nome });
    return false;
  }

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

// manter: grava a cópia deste aparelho por cima. Senão, descarta e baixa a do servidor.
export async function resolverConflito(id: string, manter: boolean): Promise<void> {
  conflitos.delete(id);
  const { data } = await supabase
    .from("torneios")
    .select("dados")
    .eq("id", id)
    .maybeSingle();
  const dados = data?.dados as Torneio | undefined;
  salvarVersao(id, dados?.versao ?? 0);
  if (manter) {
    await enviarPendente(id);
    return;
  }
  cancelarEnvio(id);
  if (dados) storage.upsertTorneio(dados);
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
      localStorage.setItem(KEY_VERSOES, JSON.stringify(Object.fromEntries(arr.map((t) => [t.id, t.versao ?? 0]))));
    }

    return { torneios: data.length, erros };
  } catch (e: any) {
    erros.push(e.message || String(e));
    return { torneios: 0, erros };
  }
}

// Compara só um resumo com o local, para não baixar os torneios inteiros à toa
export async function listaMudou(): Promise<boolean> {
  if (pendentes.size > 0) return false;
  const { data, error } = await supabase
    .from("torneios")
    .select("id, rodada:dados->>rodadaAtual, finalizado:dados->>finalizado");
  if (error || !data) return false;
  const linhas = data as unknown as { id: string; rodada: string; finalizado: string }[];
  const locais = new Map(storage.listarTorneios().map((t) => [t.id, t]));
  if (linhas.length !== locais.size) return true;
  return linhas.some((l) => {
    const t = locais.get(l.id);
    return !t || String(t.rodadaAtual) !== l.rodada || String(t.finalizado) !== l.finalizado;
  });
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
  if (pendentes.has(id)) return false;
  const { data, error } = await supabase.from("torneios").select("dados").eq("id", id).maybeSingle();
  if (error || !data) return false;
  const t = data.dados as Torneio;
  storage.upsertTorneio(t);
  salvarVersao(id, t.versao ?? 0);
  return true;
}

export function cancelarEnvio(id: string) {
  if (timeouts.has(id)) {
    window.clearTimeout(timeouts.get(id)!);
    timeouts.delete(id);
  }
  falhas.delete(id);
  conflitos.delete(id);
  pendentes.delete(id);
  salvarPendentes();
}

export async function removerTorneio(id: string) {
  cancelarEnvio(id);
  salvarVersao(id, null);
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
  const versoes = lerVersoes();
  const payload = torneios.map((t) => ({
    id: t.id, nome: t.nome, dados: { ...t, versao: (versoes[t.id] ?? 0) + 1 }, publico: true,
  }));
  if (payload.length > 0) {
    const { error } = await supabase.from("torneios").upsert(payload);
    if (error) erros.push(error.message);
    else payload.forEach((p) => salvarVersao(p.id, p.dados.versao));
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
