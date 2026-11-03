// Desempenho individual de um jogador somando todos os torneios
import type { Mesa, Torneio } from "./types";
import { ranking } from "./resultados";

export type ResultadoMesa = "vitoria" | "empate" | "derrota";

export interface TorneioDoJogador {
  id: string;
  nome: string;
  data: string;
  deck: string;
  pontos: number;
  vitorias: number;
  partidas: number;
  finalizado: boolean;
  posicao: number | null; // só em torneios finalizados
  total: number;
}

export interface EvolucaoJogador {
  nome: string;
  data: string;
  posicao: number;
  total: number;
  percentil: number; // 0..1, parcela dos jogadores que ficaram atrás
}

export interface RivalJogador {
  nome: string;
  mesas: number;
  minhasVitorias: number;
  vitoriasDele: number;
}

export interface DeckDoJogador {
  nome: string;
  torneios: number;
  partidas: number;
  vitorias: number;
  campeonatos: number;
  winrate: number; // 0..1
}

export interface Conquista {
  icone: string;
  titulo: string;
  descricao: string;
  obtida: boolean;
}

export interface DesempenhoJogador {
  nome: string;
  torneios: number;
  finalizados: number;
  campeonatos: number;
  podios: number;
  melhorPosicao: number | null;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  winrate: number; // 0..1
  vitoriasEsperadas: number; // soma de 1/tamanho da mesa em cada partida
  fatorVitoria: number; // vitórias / vitórias esperadas
  colocacoes: { posicao: number; qtd: number }[]; // derrotas por colocação na mesa
  forma: ResultadoMesa[]; // últimas 10 partidas, da mais antiga para a mais recente
  sequenciaAtual: number;
  melhorSequencia: number;
  historico: TorneioDoJogador[]; // do mais recente para o mais antigo
  evolucao: EvolucaoJogador[]; // do mais antigo para o mais recente
  rivais: RivalJogador[];
  carrasco: RivalJogador | null; // quem mais venceu mesas com o jogador
  fregues: RivalJogador | null; // quem o jogador mais venceu
  decks: DeckDoJogador[];
  conquistas: Conquista[];
}

const chave = (nome: string) => nome.trim().toLowerCase();

export function mesmoJogador(a: string, b: string): boolean {
  return chave(a) === chave(b);
}

// Nomes únicos (sem diferenciar maiúsculas) em ordem alfabética
export function listarNomesJogadores(torneios: Torneio[]): string[] {
  const nomes = new Map<string, string>();
  for (const t of torneios) {
    for (const j of t.jogadores) {
      if (!nomes.has(chave(j.nome))) nomes.set(chave(j.nome), j.nome.trim());
    }
  }
  return Array.from(nomes.values()).sort((a, b) => a.localeCompare(b));
}

function mesasFinalizadas(t: Torneio): Mesa[] {
  return [...t.rodadasFinalizadas.flatMap((r) => r.mesas), ...t.mesas]
    .filter((m) => m.finalizada)
    .sort((a, b) => (a.rodada || a.numero) - (b.rodada || b.numero));
}

export function calcularDesempenho(torneios: Torneio[], nome: string): DesempenhoJogador | null {
  const alvo = chave(nome);
  const ordenados = [...torneios].sort((a, b) =>
    (a.dataCriacao || "").localeCompare(b.dataCriacao || "")
  );

  const historico: TorneioDoJogador[] = [];
  const evolucao: EvolucaoJogador[] = [];
  const resultados: ResultadoMesa[] = [];
  const colocacoes = new Map<number, number>();
  const rivais = new Map<string, RivalJogador>();
  const decks = new Map<string, Omit<DeckDoJogador, "winrate">>();

  let nomeExibido = nome.trim();
  let campeonatos = 0;
  let podios = 0;
  let melhorPosicao: number | null = null;
  let pontos = 0;
  let vitoriasEsperadas = 0;
  let invicto = false;

  for (const t of ordenados) {
    const j = t.jogadores.find((x) => chave(x.nome) === alvo);
    if (!j) continue;
    nomeExibido = j.nome.trim();
    pontos += j.pontos;

    const porId = new Map(t.jogadores.map((x) => [x.id, x]));
    const mesas = mesasFinalizadas(t).filter((m) => m.jogadoresIds.includes(j.id));
    let vitoriasTorneio = 0;

    for (const m of mesas) {
      const venceu = m.vencedorId === j.id;
      const empatou = m.empateTopoIds.includes(j.id);
      resultados.push(venceu ? "vitoria" : empatou ? "empate" : "derrota");
      vitoriasEsperadas += 1 / m.jogadoresIds.length;

      if (venceu) {
        vitoriasTorneio += 1;
      } else if (!empatou) {
        const rodadaId = m.rodada || m.numero;
        const posicao = j.historicoColocacoes.find(([r]) => r === rodadaId)?.[1] ?? m.jogadoresIds.length;
        colocacoes.set(posicao, (colocacoes.get(posicao) ?? 0) + 1);
      }

      for (const outroId of m.jogadoresIds) {
        const outro = porId.get(outroId);
        if (!outro || outroId === j.id) continue;
        const rival = rivais.get(chave(outro.nome)) ?? {
          nome: outro.nome.trim(), mesas: 0, minhasVitorias: 0, vitoriasDele: 0,
        };
        rival.mesas += 1;
        if (venceu) rival.minhasVitorias += 1;
        if (m.vencedorId === outroId) rival.vitoriasDele += 1;
        rivais.set(chave(outro.nome), rival);
      }
    }

    if (mesas.length >= 2 && vitoriasTorneio === mesas.length) invicto = true;

    let posicao: number | null = null;
    if (t.finalizado) {
      const rank = ranking(t);
      posicao = rank.findIndex((x) => x.id === j.id) + 1;
      if (posicao === 1) campeonatos += 1;
      if (posicao <= 3) podios += 1;
      if (melhorPosicao === null || posicao < melhorPosicao) melhorPosicao = posicao;
      evolucao.push({
        nome: t.nome,
        data: t.dataCriacao,
        posicao,
        total: rank.length,
        percentil: rank.length > 1 ? (rank.length - posicao) / (rank.length - 1) : 1,
      });
    }

    const nomeDeck = j.deck.trim();
    if (nomeDeck) {
      const deck = decks.get(chave(nomeDeck)) ?? {
        nome: nomeDeck, torneios: 0, partidas: 0, vitorias: 0, campeonatos: 0,
      };
      deck.torneios += 1;
      deck.partidas += mesas.length;
      deck.vitorias += vitoriasTorneio;
      if (posicao === 1) deck.campeonatos += 1;
      decks.set(chave(nomeDeck), deck);
    }

    historico.unshift({
      id: t.id,
      nome: t.nome,
      data: t.dataCriacao,
      deck: nomeDeck,
      pontos: j.pontos,
      vitorias: vitoriasTorneio,
      partidas: mesas.length,
      finalizado: t.finalizado,
      posicao,
      total: t.jogadores.length,
    });
  }

  if (historico.length === 0) return null;

  const vitorias = resultados.filter((r) => r === "vitoria").length;
  const empates = resultados.filter((r) => r === "empate").length;

  let melhorSequencia = 0;
  let sequenciaAtual = 0;
  for (const r of resultados) {
    sequenciaAtual = r === "vitoria" ? sequenciaAtual + 1 : 0;
    melhorSequencia = Math.max(melhorSequencia, sequenciaAtual);
  }

  const listaRivais = Array.from(rivais.values()).sort((a, b) =>
    b.mesas - a.mesas || a.nome.localeCompare(b.nome)
  );
  const carrasco = [...listaRivais]
    .filter((r) => r.vitoriasDele > 0)
    .sort((a, b) => b.vitoriasDele - a.vitoriasDele || a.minhasVitorias - b.minhasVitorias)[0] ?? null;
  const fregues = [...listaRivais]
    .filter((r) => r.minhasVitorias > 0)
    .sort((a, b) => b.minhasVitorias - a.minhasVitorias || a.vitoriasDele - b.vitoriasDele)[0] ?? null;

  const listaDecks = Array.from(decks.values())
    .map((d) => ({ ...d, winrate: d.partidas > 0 ? d.vitorias / d.partidas : 0 }))
    .sort((a, b) => b.torneios - a.torneios || b.winrate - a.winrate);

  const conquistas: Conquista[] = [
    { icone: "🏆", titulo: "Campeão", descricao: "Vença um torneio", obtida: campeonatos >= 1 },
    { icone: "👑", titulo: "Dinastia", descricao: "Vença 3 torneios", obtida: campeonatos >= 3 },
    { icone: "🥉", titulo: "No pódio", descricao: "Termine um torneio no top 3", obtida: podios >= 1 },
    { icone: "⚔️", titulo: "Invicto", descricao: "Vença todas as suas mesas em um torneio", obtida: invicto },
    { icone: "🔥", titulo: "Em chamas", descricao: "Vença 3 mesas seguidas", obtida: melhorSequencia >= 3 },
    { icone: "🎯", titulo: "Freguesia", descricao: "Vença 3 mesas contra o mesmo jogador", obtida: (fregues?.minhasVitorias ?? 0) >= 3 },
    { icone: "🎖️", titulo: "Veterano", descricao: "Jogue 10 torneios", obtida: historico.length >= 10 },
    { icone: "🧙", titulo: "Maratonista", descricao: "Jogue 50 mesas", obtida: resultados.length >= 50 },
  ];

  return {
    nome: nomeExibido,
    torneios: historico.length,
    finalizados: evolucao.length,
    campeonatos,
    podios,
    melhorPosicao,
    partidas: resultados.length,
    vitorias,
    empates,
    derrotas: resultados.length - vitorias - empates,
    pontos,
    winrate: resultados.length > 0 ? vitorias / resultados.length : 0,
    vitoriasEsperadas,
    fatorVitoria: vitoriasEsperadas > 0 ? vitorias / vitoriasEsperadas : 0,
    colocacoes: Array.from(colocacoes.entries())
      .map(([posicao, qtd]) => ({ posicao, qtd }))
      .sort((a, b) => a.posicao - b.posicao),
    forma: resultados.slice(-10),
    sequenciaAtual,
    melhorSequencia,
    historico,
    evolucao,
    rivais: listaRivais.slice(0, 8),
    carrasco,
    fregues,
    decks: listaDecks,
    conquistas,
  };
}
