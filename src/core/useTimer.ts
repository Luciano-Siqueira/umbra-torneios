// ============================================================
// Timer com fases (normal + extra) e 3 avisos sonoros
// ============================================================

import { useEffect, useRef, useState } from "react";
import { beepCurto, beepLongo, beepFinal } from "./audio";
import { useStore } from "./store";
import { agoraMs, segundosRestantes, sincronizarRelogio } from "./timer";
import type { TimerRodada } from "./types";

// Só exibe o tempo: usado por quem acompanha a rodada
export function useContagem(
  tempoNormalMin: number,
  tempoExtraMin: number,
  timer: TimerRodada | null | undefined,
) {
  const extraSeg = tempoExtraMin * 60;
  const totalSeg = tempoNormalMin * 60 + extraSeg;
  const [agora, setAgora] = useState(agoraMs);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(agoraMs()), 500);
    return () => window.clearInterval(id);
  }, []);

  const restante = segundosRestantes(timer, totalSeg, agora);
  const emExtra = restante <= extraSeg;
  const restanteFase = emExtra ? restante : restante - extraSeg;

  return {
    restante,
    restanteFase,
    emExtra,
    rodando: !!timer && !timer.parado && restante > 0,
    pausado: !!timer?.pausadoEm && !timer.parado,
    iniciado: !!timer,
  };
}

// Vibra o celular de quem está jogando quando o tempo da rodada acaba.
// Não funciona no iPhone nem com o app fechado ou a tela bloqueada.
export function useVibrarFimDaRodada(
  tempoNormalMin: number,
  tempoExtraMin: number,
  timer: TimerRodada | null | undefined,
) {
  const { restante } = useContagem(tempoNormalMin, tempoExtraMin, timer);
  const anteriorRef = useRef(restante);

  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = restante;
    if (anterior > 0 && restante === 0) navigator.vibrate?.([1000, 300, 1000, 300, 2000]);
  }, [restante]);
}

// Controles e avisos sonoros: usado por quem organiza a rodada
export function useTimer(
  tempoNormalMin: number,
  tempoExtraMin: number,
  timer: TimerRodada | null | undefined,
  comAvisos: boolean,
) {
  const extraSeg = tempoExtraMin * 60;
  const contagem = useContagem(tempoNormalMin, tempoExtraMin, timer);
  const { restante } = contagem;

  const iniciar = useStore((s) => s.iniciarTimer);
  const pausar = useStore((s) => s.pausarTimer);
  const parar = useStore((s) => s.pararTimer);
  const resetar = useStore((s) => s.resetarTimer);

  const anteriorRef = useRef(restante);
  const onFimNormalRef = useRef<(() => void) | null>(null);
  const onFimTotalRef = useRef<(() => void) | null>(null);

  useEffect(() => { sincronizarRelogio(); }, []);

  // Avisa ao cruzar cada marca, sem repetir quando a tela é reaberta depois dela
  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = restante;
    if (!comAvisos || restante >= anterior) return;
    const cruzou = (marca: number) => anterior > marca && restante <= marca;

    if (cruzou(extraSeg + 10 * 60)) beepCurto();
    if (cruzou(extraSeg)) {
      beepLongo();
      onFimNormalRef.current?.();
    }
    if (cruzou(0)) {
      beepFinal();
      onFimTotalRef.current?.();
    }
  }, [restante, extraSeg, comAvisos]);

  return {
    ...contagem,
    iniciar, pausar, parar, resetar,
    setOnFimNormal: (fn: () => void) => { onFimNormalRef.current = fn; },
    setOnFimTotal: (fn: () => void) => { onFimTotalRef.current = fn; },
  };
}

export function formatarTempo(seg: number): string {
  seg = Math.max(0, seg);
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
