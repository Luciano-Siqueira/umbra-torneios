import { useEffect, useRef, useState } from "react";
import { enviarAviso, type TipoAviso } from "../core/notificacoes";
import { agoraMs, segundosRestantes } from "../core/timer";
import type { Torneio } from "../core/types";

// Janela para não avisar atrasado: quem abre o app bem depois da hora não dispara nada
const JANELA_SEG = 2 * 60;

// Segundos até o fim da rodada; negativo depois do fim (segundosRestantes para em zero)
export function segundosAteOFim(torneio: Torneio, agora: number): number | null {
  const timer = torneio.timer;
  if (!timer || timer.parado || timer.pausadoEm || torneio.finalizado) return null;
  const totalSeg = (torneio.tempoRodadaMin + torneio.tempoExtraMin) * 60;
  const folga = 1_000_000;
  return segundosRestantes(timer, totalSeg + folga, agora) - folga;
}

export function avisoDoMomento(torneio: Torneio, agora: number): TipoAviso | null {
  const ate = segundosAteOFim(torneio, agora);
  if (ate === null) return null;
  const extraSeg = torneio.tempoExtraMin * 60;
  // Fim do tempo extra: cada jogador ainda tem um turno
  if (ate <= 0 && ate > -JANELA_SEG) return "ultimo_turno";
  // Fim do tempo normal: começa o tempo extra
  if (extraSeg > 0 && ate <= extraSeg && ate > extraSeg - JANELA_SEG) return "extra";
  return null;
}

// Reserva do aviso que o banco já manda a cada minuto (supabase/avisos_do_tempo.sql): fica no aparelho
// de quem organiza, com o torneio aberto, e pede os avisos de tempo extra e de último turno. A função só manda cada aviso uma vez, mesmo com vários aparelhos abertos.
export function AvisosDoTempo({ torneio }: { torneio: Torneio }) {
  const [agora, setAgora] = useState(agoraMs);
  const pedidos = useRef(new Set<string>());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(agoraMs()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const tipo = avisoDoMomento(torneio, agora);
    if (!tipo) return;
    const chave = `${torneio.id}-${torneio.rodadaAtual}-${tipo}`;
    if (pedidos.current.has(chave)) return;
    pedidos.current.add(chave);
    enviarAviso({ tipo, torneio_id: torneio.id, rodada: torneio.rodadaAtual }).catch(() => {});
  }, [agora, torneio]);

  return null;
}
