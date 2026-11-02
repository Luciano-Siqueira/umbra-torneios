// ============================================================
// Tabela de premiacao por faixas de participantes
// ============================================================

export type Faixa = { max: number; topN: number; percs: number[] };

export const FAIXAS: Faixa[] = [
  { max: 8, topN: 2, percs: [0.65, 0.35] },
  { max: 16, topN: 4, percs: [0.4, 0.3, 0.15, 0.15] },
  { max: 32, topN: 8, percs: [0.25, 0.18, 0.14, 0.12, 0.08, 0.08, 0.075, 0.075] },
  {
    max: 48,
    topN: 12,
    percs: [0.2, 0.14, 0.1, 0.1, 0.08, 0.08, 0.07, 0.07, 0.04, 0.04, 0.04, 0.04],
  },
  {
    max: 64,
    topN: 16,
    percs: [
      0.16, 0.12, 0.09, 0.08, 0.07, 0.07, 0.06, 0.06,
      0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.025, 0.025,
    ],
  },
];

export function faixaPorQtd(n: number): Faixa {
  for (const f of FAIXAS) if (n <= f.max) return f;
  return FAIXAS[FAIXAS.length - 1];
}

export interface PremioCalculado {
  posicao: number;
  percentual: number;
  valor: number;
}

export function calcularPremiacao(n: number, arrecadado: number): PremioCalculado[] {
  if (n < 2) return [];
  const f = faixaPorQtd(n);
  return f.percs.map((p, i) => ({
    posicao: i + 1,
    percentual: p,
    valor: Math.round(arrecadado * p * 100) / 100,
  }));
}

export function descricaoFaixa(n: number): string {
  const f = faixaPorQtd(n);
  if (f.max === 8) return `Até 8 jogadores — Top ${f.topN}`;
  const idx = FAIXAS.indexOf(f);
  const piso = idx > 0 ? FAIXAS[idx - 1].max + 1 : 1;
  return `${piso} a ${f.max} jogadores — Top ${f.topN}`;
}
