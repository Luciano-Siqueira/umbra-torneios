// Agrega métricas de todos os torneios (visão semanal/global)
import type { Torneio, Mesa } from "./types";
import { ranking, vitorias, partidasJogadas, gameWinrate } from "./resultados";
import { comandanteDoDeck, coresDoDeck } from "./decks";

export interface MetricasGlobais {
  totalTorneios: number;
  torneiosFinalizados: number;
  totalJogadoresUnicos: number;
  totalPartidas: number;
  mediaJogadoresPorTorneio: number;
  totalArrecadado: number;
  empatesPorTempo: number;
  rankingJogadores: Array<{
    nome: string;
    torneios: number;
    vitorias: number;
    partidas: number;
    pontos: number;
    winrate: number; // 0..1
    campeonatos: number; // vezes que terminou em 1º
  }>;
  topDecks: Array<{ nome: string; usos: number }>;
  cores: DesempenhoCor[]; // na ordem WUBRG e incolor
  comandantes: DesempenhoComandante[]; // quem mais vence primeiro
  inscricoesComDeck: number;
  inscricoesSemComandante: number; // deck próprio, fora da lista
}

interface Placar {
  usos: number; // uma inscrição em um torneio
  vitorias: number;
  partidas: number;
  campeonatos: number;
  winrate: number; // 0..1
}

export interface DesempenhoCor extends Placar {
  cor: string; // W, U, B, R, G ou C (incolor)
  participacao: number; // 0..1 das inscrições com comandante conhecido
}

export interface DesempenhoComandante extends Placar {
  nome: string;
  cores: string;
}

const placarVazio = (): Placar => ({ usos: 0, vitorias: 0, partidas: 0, campeonatos: 0, winrate: 0 });

function somarAoPlacar(p: Placar, vitoriasJ: number, partidasJ: number, campeao: boolean) {
  p.usos += 1;
  p.vitorias += vitoriasJ;
  p.partidas += partidasJ;
  if (campeao) p.campeonatos += 1;
  p.winrate = p.partidas > 0 ? p.vitorias / p.partidas : 0;
}

export function calcularMetricas(torneios: Torneio[]): MetricasGlobais {
  const finalizados = torneios.filter((t) => t.finalizado);
  const nomesUnicos = new Set<string>();
  const porJogador = new Map<string, {
    nome: string; torneios: number; vitorias: number; partidas: number;
    pontos: number; campeonatos: number;
  }>();
  const porDeck = new Map<string, number>();
  const porComandante = new Map<string, DesempenhoComandante>();
  const porCor = new Map<string, Placar>();
  let inscricoesComDeck = 0;
  let inscricoesSemComandante = 0;

  let totalPartidas = 0;
  let totalArrecadado = 0;
  let empatesPorTempo = 0;

  for (const t of torneios) {
    totalArrecadado += t.jogadores.filter((j) => j.pago).length * t.taxaInscricao;

    // Mesas e partidas
    const todasMesas: Mesa[] = [
      ...t.rodadasFinalizadas.flatMap((r) => r.mesas),
      ...t.mesas,
    ];
    for (const m of todasMesas) {
      if (m.finalizada) totalPartidas += 1;
      if (m.finalizada && m.empateTopoIds.length > 1) empatesPorTempo += 1;
    }

    // Campeões (ranking final só nos finalizados)
    const rank = t.finalizado ? ranking(t) : [];
    const campeaoId = rank[0]?.id;

    for (const j of t.jogadores) {
      nomesUnicos.add(j.nome);
      if (j.deck) porDeck.set(j.deck, (porDeck.get(j.deck) ?? 0) + 1);

      if (j.deck?.trim()) {
        inscricoesComDeck += 1;
        const cores = coresDoDeck(j.deck);
        if (cores === null) {
          inscricoesSemComandante += 1;
        } else {
          const campeao = j.id === campeaoId;
          const nomeComandante = comandanteDoDeck(j.deck);
          const comandante = porComandante.get(nomeComandante) ?? { ...placarVazio(), nome: nomeComandante, cores };
          somarAoPlacar(comandante, vitorias(j), partidasJogadas(j), campeao);
          porComandante.set(nomeComandante, comandante);
          // Um deck de várias cores conta em cada uma delas
          for (const cor of cores || "C") {
            const placar = porCor.get(cor) ?? placarVazio();
            somarAoPlacar(placar, vitorias(j), partidasJogadas(j), campeao);
            porCor.set(cor, placar);
          }
        }
      }

      const dados = porJogador.get(j.nome) ?? {
        nome: j.nome, torneios: 0, vitorias: 0, partidas: 0, pontos: 0, campeonatos: 0,
      };
      dados.torneios += 1;
      dados.vitorias += vitorias(j);
      dados.partidas += partidasJogadas(j);
      dados.pontos += j.pontos;
      if (j.id === campeaoId) dados.campeonatos += 1;
      porJogador.set(j.nome, dados);
    }
  }

  const rankingJogadores = Array.from(porJogador.values())
    .map((j) => ({
      ...j,
      winrate: j.partidas > 0 ? j.vitorias / j.partidas : 0,
    }))
    .sort((a, b) => {
      if (b.campeonatos !== a.campeonatos) return b.campeonatos - a.campeonatos;
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      return b.winrate - a.winrate;
    });

  const topDecks = Array.from(porDeck.entries())
    .map(([nome, usos]) => ({ nome, usos }))
    .sort((a, b) => b.usos - a.usos)
    .slice(0, 10);

  const comandantes = Array.from(porComandante.values())
    .sort((a, b) => b.vitorias - a.vitorias || b.winrate - a.winrate || b.usos - a.usos || a.nome.localeCompare(b.nome))
    .slice(0, 10);

  const comComandante = inscricoesComDeck - inscricoesSemComandante;
  const cores = Array.from("WUBRGC").flatMap((cor) => {
    const placar = porCor.get(cor);
    return placar ? [{ ...placar, cor, participacao: placar.usos / comComandante }] : [];
  });

  return {
    cores,
    comandantes,
    inscricoesComDeck,
    inscricoesSemComandante,
    totalTorneios: torneios.length,
    torneiosFinalizados: finalizados.length,
    totalJogadoresUnicos: nomesUnicos.size,
    totalPartidas,
    mediaJogadoresPorTorneio: torneios.length > 0
      ? torneios.reduce((s, t) => s + t.jogadores.length, 0) / torneios.length
      : 0,
    totalArrecadado,
    empatesPorTempo,
    rankingJogadores,
    topDecks,
  };
}

// Também usado para "últimos 4 semanas" / tendência
export function metricasRecentes(torneios: Torneio[], diasAtras: number): {
  qtd: number;
  participantes: number;
  partidas: number;
} {
  const limite = new Date(Date.now() - diasAtras * 86400_000);
  const filtrados = torneios.filter((t) => {
    if (!t.dataCriacao) return false;
    return new Date(t.dataCriacao) >= limite;
  });
  let partidas = 0;
  let participantes = 0;
  for (const t of filtrados) {
    participantes += t.jogadores.length;
    for (const m of [...t.rodadasFinalizadas.flatMap((r) => r.mesas), ...t.mesas]) {
      if (m.finalizada) partidas += 1;
    }
  }
  return { qtd: filtrados.length, participantes, partidas };
}
