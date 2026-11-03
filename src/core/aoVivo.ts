// Publica o estado da rodada na tabela pequena que o Realtime transmite
import { supabase } from "./supabaseClient";
import * as storage from "./storage";
import { avisarFalhaAoVivo, envioConcluido, enviarTorneioAgora, erroDeConexao, temConflito } from "./sync";
import { agoraMs } from "./timer";
import type { Mesa, TimerRodada, Torneio } from "./types";

export interface LinhaAoVivo {
  torneio_id: string;
  rodada: number;
  finalizado: boolean;
  mesas: Mesa[];
  timer: TimerRodada | null;
  atualizado_em?: string;
}

const ESPERA_REPUBLICAR_MS = 5_000;
const ESPERA_AGRUPAR_MS = 1_000;
const republicacoes = new Map<string, number>();
const ultimasPublicacoes = new Map<string, number>();

function cancelarAgendada(id: string) {
  if (republicacoes.has(id)) {
    window.clearTimeout(republicacoes.get(id)!);
    republicacoes.delete(id);
  }
}

// O Realtime devolve ao aparelho o que ele mesmo publicou: isso não é novidade
export function ehPublicacaoMinha(linha: LinhaAoVivo): boolean {
  const quando = Date.parse(linha.atualizado_em ?? "");
  return quando <= (ultimasPublicacoes.get(linha.torneio_id) ?? -1);
}

// enviarAntes: grava o torneio completo primeiro, pois quem recebe vai baixá-lo
export async function publicarAoVivo(t: Torneio, enviarAntes = false): Promise<void> {
  // Uma publicação nova substitui a que estava agendada
  cancelarAgendada(t.id);
  if (enviarAntes) await enviarTorneioAgora(t);
  // Em conflito, a cópia deste aparelho ainda não vale para os outros
  if (temConflito(t.id)) return;

  // O torneio pode ter mudado durante o envio ou a espera
  const atual = storage.listarTorneios().find((x) => x.id === t.id) ?? t;
  const quando = agoraMs();
  ultimasPublicacoes.set(t.id, quando);

  const { error } = await supabase.from("torneio_ao_vivo").upsert({
    torneio_id: atual.id,
    rodada: atual.rodadaAtual,
    finalizado: atual.finalizado,
    mesas: atual.mesas,
    timer: atual.timer ?? null,
    atualizado_em: new Date(quando).toISOString(),
  });
  if (!error) return;

  console.warn("Erro ao publicar ao vivo", error.message);
  if (erroDeConexao(error)) {
    republicacoes.set(t.id, window.setTimeout(() => {
      republicacoes.delete(t.id);
      publicarAoVivo(t);
    }, ESPERA_REPUBLICAR_MS));
  } else {
    avisarFalhaAoVivo(error.message);
  }
}

// Agrupa alterações em sequência, como cadastrar vários jogadores.
// Avisa depois do envio agendado do torneio, pois quem recebe vai baixá-lo.
export function publicarAoVivoDepois(t: Torneio): void {
  cancelarAgendada(t.id);
  republicacoes.set(t.id, window.setTimeout(async () => {
    republicacoes.delete(t.id);
    await envioConcluido(t.id);
    publicarAoVivo(t);
  }, ESPERA_AGRUPAR_MS));
}

export async function removerAoVivo(id: string): Promise<void> {
  cancelarAgendada(id);
  const { error } = await supabase.from("torneio_ao_vivo").delete().eq("torneio_id", id);
  if (error) console.warn("Erro ao remover ao vivo", error.message);
}
