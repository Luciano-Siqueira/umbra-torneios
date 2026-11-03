// ============================================================
// TYPES do sistema de torneios
// ============================================================

export interface Jogador {
  id: number;
  nome: string;
  deck: string;
  pago: boolean;
  pontos: number;
  adversarios: number[];
  historicoColocacoes: [number, number][]; // (rodada, colocacao)
  historicoGames: [number, number, number][]; // (rodada, ganhos, total)
  ativo: boolean; // false = drop: fica no ranking, mas sai das próximas rodadas
  premioPago?: { valor: number; em: string } | null; // o que foi pago de fato
}

export interface Mesa {
  numero: number;
  rodada: number;
  jogadoresIds: number[];
  eliminacoes: number[][]; // grupos de eliminacao (ids)
  vencedorId: number | null;
  empateTopoIds: number[];
  finalizada: boolean;
}

export interface Rodada {
  numero: number;
  mesas: Mesa[];
  dataInicio: string;
  finalizada: boolean;
}

export interface PremioCadastrado {
  posicao: number;
  descricao: string;
}

export type PremiacaoModo = "top" | "premio";

export interface TimerRodada {
  iniciadoEm: string;
  pausadoEm: string | null;
  segundosPausados: number;
  parado: boolean; // parado pelo botão ■, diferente de pausado
}

export interface Torneio {
  id: string;
  nome: string;
  taxaInscricao: number;
  qtdRodadas: number;
  tempoRodadaMin: number;
  tempoExtraMin: number;
  dataCriacao: string;
  jogadores: Jogador[];
  rodadaAtual: number;
  mesas: Mesa[];
  rodadasFinalizadas: Rodada[];
  finalizado: boolean;
  proximoId: number;
  premiacaoModo: PremiacaoModo;
  premiosCadastrados: PremioCadastrado[];
  dataRodadaAtual: string;
  criadoPor?: string; // user_id de quem criou (torneios antigos não têm)
  timer?: TimerRodada | null; // null até iniciar o tempo da rodada
}

// ============================================================
// Factories
// ============================================================

export function novoTorneio(
  nome: string,
  taxa: number,
  qtdRodadas = 3,
  tempoRodadaMin = 75,
  tempoExtraMin = 15,
): Torneio {
  return {
    id: gerarId(),
    nome,
    taxaInscricao: taxa,
    qtdRodadas,
    tempoRodadaMin,
    tempoExtraMin,
    dataCriacao: new Date().toISOString(),
    jogadores: [],
    rodadaAtual: 0,
    mesas: [],
    rodadasFinalizadas: [],
    finalizado: false,
    proximoId: 1,
    premiacaoModo: "top",
    premiosCadastrados: [],
    dataRodadaAtual: "",
  };
}

export function novoJogador(id: number, nome: string, deck = "", pago = false): Jogador {
  return {
    id,
    nome,
    deck,
    pago,
    pontos: 0,
    adversarios: [],
    historicoColocacoes: [],
    historicoGames: [],
    ativo: true,
  };
}

export function novaMesa(numero: number, rodada: number, jogadoresIds: number[]): Mesa {
  return {
    numero,
    rodada,
    jogadoresIds,
    eliminacoes: [],
    vencedorId: null,
    empateTopoIds: [],
    finalizada: false,
  };
}

function gerarId(): string {
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}
