// Publica o estado da rodada na tabela pequena que o Realtime transmite
import { supabase } from "./supabaseClient";
import { enviarTorneioAgora, erroDeConexao } from "./sync";
import type { Mesa, TimerRodada, Torneio } from "./types";

export interface LinhaAoVivo {
  torneio_id: string;
  rodada: number;
  finalizado: boolean;
  mesas: Mesa[];
  timer: TimerRodada | null;
}

const ESPERA_REPUBLICAR_MS = 5_000;
const republicacoes = new Map<string, number>();

// enviarAntes: grava o torneio completo primeiro, pois quem recebe vai baixá-lo
export async function publicarAoVivo(t: Torneio, enviarAntes = false): Promise<void> {
  // Uma publicação nova substitui a que estava esperando a internet voltar
  if (republicacoes.has(t.id)) {
    window.clearTimeout(republicacoes.get(t.id)!);
    republicacoes.delete(t.id);
  }
  if (enviarAntes) await enviarTorneioAgora(t);

  const { error } = await supabase.from("torneio_ao_vivo").upsert({
    torneio_id: t.id,
    rodada: t.rodadaAtual,
    finalizado: t.finalizado,
    mesas: t.mesas,
    timer: t.timer ?? null,
    atualizado_em: new Date().toISOString(),
  });
  if (!error) return;

  console.warn("Erro ao publicar ao vivo", error.message);
  if (erroDeConexao(error)) {
    republicacoes.set(t.id, window.setTimeout(() => {
      republicacoes.delete(t.id);
      publicarAoVivo(t);
    }, ESPERA_REPUBLICAR_MS));
  }
}

export async function removerAoVivo(id: string): Promise<void> {
  if (republicacoes.has(id)) {
    window.clearTimeout(republicacoes.get(id)!);
    republicacoes.delete(id);
  }
  const { error } = await supabase.from("torneio_ao_vivo").delete().eq("torneio_id", id);
  if (error) console.warn("Erro ao remover ao vivo", error.message);
}
