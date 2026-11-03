// ============================================================
// Registro de resultado, pontos, colocacao e games
// ============================================================

import type { Mesa, Torneio } from "./types";

export function registrarResultado(
  torneio: Torneio,
  mesa: Mesa,
  ordemEliminacao: number[][], // grupos de ids
  empateTopoIds: number[] = [],
): void {
  mesa.eliminacoes = ordemEliminacao;
  mesa.empateTopoIds = empateTopoIds;

  const total = mesa.jogadoresIds.length;
  aplicarColocacoes(torneio, mesa, total);
  aplicarPontos(torneio, mesa);
  aplicarGames(torneio, mesa);
  registrarAdversarios(torneio, mesa);

  mesa.finalizada = true;
}

export function desfazerResultado(torneio: Torneio, mesa: Mesa): void {
  if (!mesa.finalizada) return;

  const jByid = jogadorMap(torneio);
  const rodadaId = mesa.rodada || mesa.numero;

  // Reverte pontos
  if (mesa.empateTopoIds.length) {
    for (const id of mesa.empateTopoIds) jByid.get(id)!.pontos -= 1;
  } else if (mesa.vencedorId !== null) {
    jByid.get(mesa.vencedorId)!.pontos -= 3;
  }

  // Remove colocacoes e games desta rodada
  for (const id of mesa.jogadoresIds) {
    const j = jByid.get(id)!;
    j.historicoColocacoes = j.historicoColocacoes.filter(([r]) => r !== rodadaId);
    j.historicoGames = j.historicoGames.filter(([r]) => r !== rodadaId);
  }

  // Reconstroi adversarios (remove esta mesa, mantem os das outras)
  const idsMesa = new Set(mesa.jogadoresIds);
  const todasMesas: Mesa[] = [];
  for (const r of torneio.rodadasFinalizadas) todasMesas.push(...r.mesas);
  todasMesas.push(...torneio.mesas);

  for (const id of mesa.jogadoresIds) {
    const j = jByid.get(id)!;
    j.adversarios = j.adversarios.filter((oid) => !idsMesa.has(oid));
    for (const outra of todasMesas) {
      if (outra === mesa || !outra.finalizada) continue;
      if (!outra.jogadoresIds.includes(id)) continue;
      for (const oid of outra.jogadoresIds) {
        if (oid !== id && !j.adversarios.includes(oid)) j.adversarios.push(oid);
      }
    }
  }

  mesa.eliminacoes = [];
  mesa.vencedorId = null;
  mesa.empateTopoIds = [];
  mesa.finalizada = false;
}

// Colocação de cada jogador (respeita empates por grupo e empate no topo)
export function calcularColocacoes(mesa: Mesa): Map<number, number> {
  const total = mesa.jogadoresIds.length;
  const col = new Map<number, number>();
  let colAtual = total;
  let ultimaColGrupo: number | null = null;
  for (const g of mesa.eliminacoes) {
    for (const id of g) col.set(id, colAtual);
    ultimaColGrupo = colAtual;
    colAtual -= g.length;
  }
  if (mesa.empateTopoIds.length) {
    const colEmpate = ultimaColGrupo !== null ? ultimaColGrupo - 1 : total;
    for (const id of mesa.empateTopoIds) col.set(id, colEmpate);
  } else if (mesa.vencedorId !== null) {
    col.set(mesa.vencedorId, 1);
  }
  return col;
}

function aplicarColocacoes(torneio: Torneio, mesa: Mesa, total: number): void {
  let colocacaoAtual = total;
  const colocacoes = new Map<number, number>();
  let ultimaColGrupo: number | null = null;

  for (const grupo of mesa.eliminacoes) {
    for (const id of grupo) colocacoes.set(id, colocacaoAtual);
    ultimaColGrupo = colocacaoAtual;
    colocacaoAtual -= grupo.length;
  }

  if (mesa.empateTopoIds.length) {
    // Empate por tempo sobe SO 1 posicao apos ultimo grupo
    const colEmpate = ultimaColGrupo !== null ? ultimaColGrupo - 1 : total;
    for (const id of mesa.empateTopoIds) colocacoes.set(id, colEmpate);
  } else {
    // Vencedor unico
    for (const id of mesa.jogadoresIds) {
      if (!colocacoes.has(id)) {
        colocacoes.set(id, colocacaoAtual);
        mesa.vencedorId = id;
      }
    }
  }

  const jByid = jogadorMap(torneio);
  const rodadaId = mesa.rodada || mesa.numero;
  for (const id of mesa.jogadoresIds) {
    jByid.get(id)!.historicoColocacoes.push([rodadaId, colocacoes.get(id)!]);
  }
}

function aplicarPontos(torneio: Torneio, mesa: Mesa): void {
  const jByid = jogadorMap(torneio);
  if (mesa.empateTopoIds.length) {
    for (const id of mesa.empateTopoIds) jByid.get(id)!.pontos += 1;
  } else if (mesa.vencedorId !== null) {
    jByid.get(mesa.vencedorId)!.pontos += 3;
  }
}

function aplicarGames(torneio: Torneio, mesa: Mesa): void {
  const jByid = jogadorMap(torneio);
  const rodadaId = mesa.rodada || mesa.numero;

  if (mesa.empateTopoIds.length) {
    const k = mesa.empateTopoIds.length;
    const g = 1.0 / k;
    const empSet = new Set(mesa.empateTopoIds);
    for (const id of mesa.jogadoresIds) {
      const ganhos = empSet.has(id) ? g : 0;
      jByid.get(id)!.historicoGames.push([rodadaId, ganhos, 1]);
    }
  } else if (mesa.vencedorId !== null) {
    for (const id of mesa.jogadoresIds) {
      const ganhos = id === mesa.vencedorId ? 1 : 0;
      jByid.get(id)!.historicoGames.push([rodadaId, ganhos, 1]);
    }
  }
}

function registrarAdversarios(torneio: Torneio, mesa: Mesa): void {
  const jByid = jogadorMap(torneio);
  for (const id of mesa.jogadoresIds) {
    const j = jByid.get(id)!;
    for (const oid of mesa.jogadoresIds) {
      if (oid !== id && !j.adversarios.includes(oid)) j.adversarios.push(oid);
    }
  }
}

// ============================================================
// Metricas (MW, GW, OMW, OGW)
// ============================================================

export function vitorias(j: { historicoColocacoes: [number, number][] }): number {
  return j.historicoColocacoes.filter(([, c]) => c === 1).length;
}

export function partidasJogadas(j: { historicoColocacoes: [number, number][] }): number {
  return j.historicoColocacoes.length;
}

export function matchWinrate(j: { historicoColocacoes: [number, number][] }): number {
  const pj = partidasJogadas(j);
  return pj === 0 ? 0 : vitorias(j) / pj;
}

export function gameWinrate(j: {
  historicoGames: [number, number, number][];
  historicoColocacoes: [number, number][];
}): number {
  if (!j.historicoGames.length) {
    const pj = partidasJogadas(j);
    return pj === 0 ? 0 : vitorias(j) / pj;
  }
  let ganhos = 0, tot = 0;
  for (const [, g, t] of j.historicoGames) { ganhos += g; tot += t; }
  return tot > 0 ? ganhos / tot : 0;
}

export function omwJogador(torneio: Torneio, j: { adversarios: number[] }): number {
  if (!j.adversarios.length) return 0;
  const byId = jogadorMap(torneio);
  let soma = 0;
  for (const oid of j.adversarios) {
    const op = byId.get(oid);
    if (!op) continue;
    soma += Math.max(matchWinrate(op), 0.33);
  }
  return soma / j.adversarios.length;
}

export function ogwJogador(torneio: Torneio, j: { adversarios: number[] }): number {
  if (!j.adversarios.length) return 0;
  const byId = jogadorMap(torneio);
  let soma = 0, n = 0;
  for (const oid of j.adversarios) {
    const op = byId.get(oid);
    if (!op) continue;
    soma += Math.max(gameWinrate(op), 0.33);
    n++;
  }
  return n > 0 ? soma / n : 0;
}

export function ranking(torneio: Torneio) {
  return [...torneio.jogadores].sort((a, b) => {
    if (a.pontos !== b.pontos) return b.pontos - a.pontos;
    const omwA = omwJogador(torneio, a);
    const omwB = omwJogador(torneio, b);
    if (omwA !== omwB) return omwB - omwA;
    const gwA = gameWinrate(a);
    const gwB = gameWinrate(b);
    if (gwA !== gwB) return gwB - gwA;
    const ogwA = ogwJogador(torneio, a);
    const ogwB = ogwJogador(torneio, b);
    if (ogwA !== ogwB) return ogwB - ogwA;
    return a.nome.localeCompare(b.nome);
  });
}

// Quem deu drop continua no ranking, mas não concorre aos prêmios
export function rankingPremiavel(torneio: Torneio) {
  return ranking(torneio).filter((j) => j.ativo);
}

function jogadorMap(t: Torneio) {
  return new Map(t.jogadores.map((j) => [j.id, j]));
}
