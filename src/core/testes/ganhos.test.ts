import { describe, expect, it } from "vitest";
import { calcularGanhos } from "../desempenho";
import { novoJogador, novoTorneio, type Torneio } from "../types";

// 4 jogadores pagantes a R$ 10 (R$ 40): 65% para o 1º e 35% para o 2º
function torneio(pontos: number[], finalizado = true): Torneio {
  const t = novoTorneio("Teste", 10);
  t.jogadores = pontos.map((p, i) => ({ ...novoJogador(i + 1, `J${i + 1}`, "", true), pontos: p }));
  t.finalizado = finalizado;
  return t;
}

describe("prêmios do jogador", () => {
  it("soma o prêmio de quem ficou na faixa premiada", () => {
    const t = torneio([9, 6, 3, 0]);
    expect(calcularGanhos([t], ["J1"])).toEqual({ total: 26, premiacoes: 1 });
    expect(calcularGanhos([t], ["J2"])).toEqual({ total: 14, premiacoes: 1 });
  });

  it("não dá prêmio fora da faixa", () => {
    expect(calcularGanhos([torneio([9, 6, 3, 0])], ["J3"])).toEqual({ total: 0, premiacoes: 0 });
  });

  it("ignora torneio em andamento e quem não jogou", () => {
    expect(calcularGanhos([torneio([9, 6, 3, 0], false)], ["J1"])).toEqual({ total: 0, premiacoes: 0 });
    expect(calcularGanhos([torneio([9, 6, 3, 0])], ["Outra Pessoa"])).toEqual({ total: 0, premiacoes: 0 });
  });

  it("soma vários torneios e ignora maiúsculas", () => {
    const ganhos = calcularGanhos([torneio([9, 6, 3, 0]), torneio([6, 9, 3, 0])], [" j1 "]);
    expect(ganhos).toEqual({ total: 40, premiacoes: 2 });
  });
});
