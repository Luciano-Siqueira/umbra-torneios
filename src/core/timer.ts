// Timer da rodada gravado no torneio: todos os aparelhos calculam o mesmo tempo
import { supabase } from "./supabaseClient";
import type { TimerRodada } from "./types";

let diferencaMs = 0; // relógio do servidor - relógio do aparelho

export async function sincronizarRelogio(): Promise<void> {
  const inicio = Date.now();
  const { data, error } = await supabase.rpc("agora_servidor");
  if (error || !data) return;
  const latencia = (Date.now() - inicio) / 2;
  diferencaMs = Date.parse(data as string) + latencia - Date.now();
}

export function agoraMs(): number {
  return Date.now() + diferencaMs;
}

export function segundosRestantes(
  timer: TimerRodada | null | undefined,
  totalSeg: number,
  agora: number = agoraMs(),
): number {
  if (!timer) return totalSeg;
  const fim = timer.pausadoEm ? Date.parse(timer.pausadoEm) : agora;
  const decorrido = (fim - Date.parse(timer.iniciadoEm)) / 1000 - timer.segundosPausados;
  return Math.min(totalSeg, Math.max(0, Math.ceil(totalSeg - decorrido)));
}

function retomar(timer: TimerRodada, agora: number): TimerRodada {
  if (!timer.pausadoEm) return { ...timer, parado: false };
  return {
    ...timer,
    pausadoEm: null,
    parado: false,
    segundosPausados: timer.segundosPausados + (agora - Date.parse(timer.pausadoEm)) / 1000,
  };
}

export function iniciarTimer(timer: TimerRodada | null | undefined, agora: number = agoraMs()): TimerRodada {
  if (timer) return retomar(timer, agora);
  return { iniciadoEm: new Date(agora).toISOString(), pausadoEm: null, segundosPausados: 0, parado: false };
}

export function alternarPausaTimer(timer: TimerRodada | null | undefined, agora: number = agoraMs()): TimerRodada | null {
  if (!timer) return null;
  if (timer.pausadoEm) return retomar(timer, agora);
  return { ...timer, pausadoEm: new Date(agora).toISOString() };
}

export function pararTimer(timer: TimerRodada | null | undefined, agora: number = agoraMs()): TimerRodada | null {
  if (!timer) return null;
  return { ...timer, pausadoEm: timer.pausadoEm ?? new Date(agora).toISOString(), parado: true };
}
