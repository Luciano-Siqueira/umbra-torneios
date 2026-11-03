// Publica o estado da rodada na tabela pequena que o Realtime transmite
import { supabase } from "./supabaseClient";
import { enviarTorneioAgora } from "./sync";
import type { Mesa, TimerRodada, Torneio } from "./types";

export interface LinhaAoVivo {
  torneio_id: string;
  rodada: number;
  finalizado: boolean;
  mesas: Mesa[];
  timer: TimerRodada | null;
}

// enviarAntes: grava o torneio completo primeiro, pois quem recebe vai baixá-lo
export async function publicarAoVivo(t: Torneio, enviarAntes = false): Promise<void> {
  if (enviarAntes) await enviarTorneioAgora(t);
  const { error } = await supabase.from("torneio_ao_vivo").upsert({
    torneio_id: t.id,
    rodada: t.rodadaAtual,
    finalizado: t.finalizado,
    mesas: t.mesas,
    timer: t.timer ?? null,
    atualizado_em: new Date().toISOString(),
  });
  if (error) console.warn("Erro ao publicar ao vivo", error.message);
}

export async function removerAoVivo(id: string): Promise<void> {
  const { error } = await supabase.from("torneio_ao_vivo").delete().eq("torneio_id", id);
  if (error) console.warn("Erro ao remover ao vivo", error.message);
}
