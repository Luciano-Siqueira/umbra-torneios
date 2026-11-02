// Agrega métricas de todos os torneios (visão semanal/global)
import type { Torneio, Mesa } from "./types";
import { ranking, vitorias, partidasJogadas, gameWinrate } from "./resultados";

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
  torneiosPorMes: Array<{ mes: string; qtd: number; participantes: number }>;
  topDecks: Array<{ nome: string; usos: number }>;
}

export function calcularMetricas(torneios: Torneio[]): MetricasGlobais {
  const finalizados = torneios.filter((t) => t.finalizado);
  const nomesUnicos = new Set<string>();
  const porJogador = new Map<string, {
    nome: string; torneios: number; vitorias: number; partidas: number;
    pontos: number; campeonatos: number;
  }>();
  const porMes = new Map<string, { qtd: number; participantes: number }>();
  const porDeck = new Map<string, number>();

  let totalPartidas = 0;
  let totalArrecadado = 0;
  let empatesPorTempo = 0;

  for (const t of torneios) {
    const data = t.dataCriacao ? new Date(t.dataCriacao) : null;
    const chaveMes = data
      ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
      : "sem-data";
    const bucket = porMes.get(chaveMes) ?? { qtd: 0, participantes: 0 };
    bucket.qtd += 1;
    bucket.participantes += t.jogadores.length;
    porMes.set(chaveMes, bucket);

    totalArrecadado += t.jogadores.filter((j) => j.pago).length * t.taxaInscricao;

    // Mesas e partidas
    const todasMesas: Mesa[] = [
      ...t.rodadasFinalizadas.flatMap((r) => r.mesas),
      ...t.mesas,
    ];
    for (const m of todasMesas) {
      if (m.finalizada) totalPartidas += 1;
      if (m.empateTopoIds.length > 1) empatesPorTempo += 1;
    }

    // Campeões (ranking final só nos finalizados)
    const rank = t.finalizado ? ranking(t) : [];
    const campeaoId = rank[0]?.id;

    for (const j of t.jogadores) {
      nomesUnicos.add(j.nome);
      if (j.deck) porDeck.set(j.deck, (porDeck.get(j.deck) ?? 0) + 1);

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

  const torneiosPorMes = Array.from(porMes.entries())
    .map(([mes, v]) => ({ mes, qtd: v.qtd, participantes: v.participantes }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const topDecks = Array.from(porDeck.entries())
    .map(([nome, usos]) => ({ nome, usos }))
    .sort((a, b) => b.usos - a.usos)
    .slice(0, 10);

  return {
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
    torneiosPorMes,
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
