// ============================================================
// Pareamento de mesas
// Prioridade 1: pontuacao proxima
// Prioridade 2: evitar repeticao de adversarios
// ============================================================

import type { Jogador, Mesa } from "./types";
import { novaMesa } from "./types";

export function tamanhosMesas(n: number): number[] {
  if (n < 3) return [];
  if (n === 5) return [3, 2]; // 5 não divide em mesas de 3 e 4: exceção com mesa de 2
  for (let b = 0; b <= Math.floor(n / 3); b++) {
    const resto = n - 3 * b;
    if (resto >= 0 && resto % 4 === 0) {
      const a = resto / 4;
      return [...Array(a).fill(4), ...Array(b).fill(3)];
    }
  }
  return [];
}

export function parearRodada(
  jogadores: Jogador[],
  rodada: number,
): Mesa[] {
  const ativos = jogadores.filter((j) => j.ativo);
  if (rodada === 1) {
    const embaralhados = [...ativos].sort(() => Math.random() - 0.5);
    return criarMesasComTamanhos(embaralhados, tamanhosMesas(embaralhados.length), rodada);
  }
  const ordenados = [...ativos].sort(
    (a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome),
  );
  return parearPorPontuacao(ordenados, rodada);
}

function parearPorPontuacao(ordenados: Jogador[], rodada: number): Mesa[] {
  const tamanhos = tamanhosMesas(ordenados.length);
  if (!tamanhos.length) return [];

  let melhor: Mesa[] | null = null;
  let melhorScore: [number, number] | null = null;

  for (let t = 0; t < 40; t++) {
    const cands = t === 0 ? ordenados : embaralharGruposPontos(ordenados);
    const mesas = criarMesasComTamanhos(cands, tamanhos, rodada);
    const custo = custoPontuacao(mesas, ordenados);
    const reps = contarRepeticoes(mesas, ordenados);
    const score: [number, number] = [custo, reps];
    if (
      !melhorScore ||
      score[0] < melhorScore[0] ||
      (score[0] === melhorScore[0] && score[1] < melhorScore[1])
    ) {
      melhorScore = score;
      melhor = clonarMesas(mesas);
      if (custo === 0 && reps === 0) break;
    }
  }

  return melhorarPorTrocas(melhor!, melhorScore!, ordenados);
}

function embaralharGruposPontos(js: Jogador[]): Jogador[] {
  const res: Jogador[] = [];
  let grupo: Jogador[] = [];
  let pts: number | null = null;
  for (const j of js) {
    if (j.pontos !== pts) {
      if (grupo.length) {
        grupo.sort(() => Math.random() - 0.5);
        res.push(...grupo);
      }
      grupo = [j];
      pts = j.pontos;
    } else grupo.push(j);
  }
  if (grupo.length) {
    grupo.sort(() => Math.random() - 0.5);
    res.push(...grupo);
  }
  return res;
}

function criarMesasComTamanhos(
  js: Jogador[],
  tams: number[],
  rodada: number,
): Mesa[] {
  const mesas: Mesa[] = [];
  let idx = 0;
  tams.forEach((tam, i) => {
    const grupo = js.slice(idx, idx + tam);
    mesas.push(novaMesa(i + 1, rodada, grupo.map((j) => j.id)));
    idx += tam;
  });
  return mesas;
}

function clonarMesas(mesas: Mesa[]): Mesa[] {
  return mesas.map((m) => ({ ...m, jogadoresIds: [...m.jogadoresIds] }));
}

function custoPontuacao(mesas: Mesa[], todos: Jogador[]): number {
  const byId = new Map(todos.map((j) => [j.id, j]));
  let total = 0;
  for (const m of mesas) {
    for (let i = 0; i < m.jogadoresIds.length; i++) {
      for (let j = i + 1; j < m.jogadoresIds.length; j++) {
        const a = byId.get(m.jogadoresIds[i])!;
        const b = byId.get(m.jogadoresIds[j])!;
        total += Math.abs(a.pontos - b.pontos);
      }
    }
  }
  return total;
}

function contarRepeticoes(mesas: Mesa[], todos: Jogador[]): number {
  const byId = new Map(todos.map((j) => [j.id, j]));
  let total = 0;
  for (const m of mesas) {
    for (let i = 0; i < m.jogadoresIds.length; i++) {
      for (let j = i + 1; j < m.jogadoresIds.length; j++) {
        const a = byId.get(m.jogadoresIds[i])!;
        if (a.adversarios.includes(m.jogadoresIds[j])) total++;
      }
    }
  }
  return total;
}

function custoPontuacaoIds(ids: number[], byId: Map<number, Jogador>): number {
  let t = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      t += Math.abs(byId.get(ids[i])!.pontos - byId.get(ids[j])!.pontos);
    }
  }
  return t;
}

function contarRepPares(ids: number[], byId: Map<number, Jogador>): number {
  let t = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (byId.get(ids[i])!.adversarios.includes(ids[j])) t++;
    }
  }
  return t;
}

function melhorarPorTrocas(
  mesas: Mesa[],
  scoreInicial: [number, number],
  todos: Jogador[],
): Mesa[] {
  if (mesas.length < 2) return mesas;
  const byId = new Map(todos.map((j) => [j.id, j]));
  let melhorScore = scoreInicial;
  let melhorou = true;
  let it = 0;
  while (melhorou && it < 20) {
    melhorou = false;
    it++;
    for (let i = 0; i < mesas.length - 1; i++) {
      for (let j = i + 1; j < mesas.length; j++) {
        const m1 = mesas[i];
        const m2 = mesas[j];
        const s1 = [...m1.jogadoresIds];
        const s2 = [...m2.jogadoresIds];
        let melhorTroca: { a: number; b: number; novoM1: number[]; novoM2: number[]; score: [number, number] } | null = null;
        for (const a of s1) {
          for (const b of s2) {
            const novoM1 = s1.filter((x) => x !== a).concat(b);
            const novoM2 = s2.filter((x) => x !== b).concat(a);
            let custo = 0;
            let reps = 0;
            for (let k = 0; k < mesas.length; k++) {
              const ids = k === i ? novoM1 : k === j ? novoM2 : mesas[k].jogadoresIds;
              custo += custoPontuacaoIds(ids, byId);
              reps += contarRepPares(ids, byId);
            }
            if (
              custo < melhorScore[0] ||
              (custo === melhorScore[0] && reps < melhorScore[1])
            ) {
              if (
                !melhorTroca ||
                custo < melhorTroca.score[0] ||
                (custo === melhorTroca.score[0] && reps < melhorTroca.score[1])
              ) {
                melhorTroca = { a, b, novoM1, novoM2, score: [custo, reps] };
              }
            }
          }
        }
        if (melhorTroca) {
          m1.jogadoresIds = melhorTroca.novoM1;
          m2.jogadoresIds = melhorTroca.novoM2;
          melhorScore = melhorTroca.score;
          melhorou = true;
        }
      }
    }
  }
  return mesas;
}
