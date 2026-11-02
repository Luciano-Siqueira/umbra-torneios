// ============================================================
// Timer com fases (normal + extra) e 3 avisos sonoros
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { beepCurto, beepLongo, beepFinal } from "./audio";

export interface TimerState {
  restante: number;      // segundos totais restantes
  emExtra: boolean;      // true quando esta na fase extra
  rodando: boolean;
  pausado: boolean;
}

export function useTimer(tempoNormalMin: number, tempoExtraMin: number) {
  const normalSeg = tempoNormalMin * 60;
  const extraSeg = tempoExtraMin * 60;
  const totalSeg = normalSeg + extraSeg;

  const [restante, setRestante] = useState(totalSeg);
  const [rodando, setRodando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const restanteRef = useRef(totalSeg);
  const rodandoRef = useRef(false);
  const pausadoRef = useRef(false);
  const avisou10 = useRef(false);
  const avisouNormal = useRef(false);
  const onFimNormalRef = useRef<(() => void) | null>(null);
  const onFimTotalRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    restanteRef.current = restante;
  }, [restante]);
  useEffect(() => { rodandoRef.current = rodando; }, [rodando]);
  useEffect(() => { pausadoRef.current = pausado; }, [pausado]);

  // Reseta quando muda configuracao
  useEffect(() => {
    setRestante(totalSeg);
    avisou10.current = false;
    avisouNormal.current = false;
    setRodando(false);
    setPausado(false);
  }, [totalSeg]);

  // Loop principal 1s
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!rodandoRef.current || pausadoRef.current) return;
      const r = restanteRef.current - 1;
      restanteRef.current = r;
      setRestante(r);

      // Aviso 10 min antes do fim normal
      if (!avisou10.current && r === extraSeg + 10 * 60) {
        avisou10.current = true;
        beepCurto();
      }
      // Fim do tempo normal
      if (!avisouNormal.current && r === extraSeg) {
        avisouNormal.current = true;
        beepLongo();
        onFimNormalRef.current?.();
      }
      // Fim total
      if (r <= 0) {
        setRodando(false);
        rodandoRef.current = false;
        beepFinal();
        onFimTotalRef.current?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [extraSeg]);

  const iniciar = useCallback(() => {
    if (rodandoRef.current) return;
    setRodando(true);
    setPausado(false);
  }, []);
  const pausar = useCallback(() => setPausado((p) => !p), []);
  const parar = useCallback(() => {
    setRodando(false);
    setPausado(false);
  }, []);
  const resetar = useCallback(() => {
    setRestante(totalSeg);
    restanteRef.current = totalSeg;
    avisou10.current = false;
    avisouNormal.current = false;
    setRodando(false);
    setPausado(false);
  }, [totalSeg]);

  const emExtra = restante <= extraSeg;
  const restanteFase = emExtra ? restante : restante - extraSeg;

  return {
    restante,
    restanteFase,
    emExtra,
    rodando,
    pausado,
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
