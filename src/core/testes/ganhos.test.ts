import { describe, expect, it } from "vitest";
import { calcularDesempenho, calcularGanhos, calcularPremios } from "../desempenho";
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

  it("quem deu drop não recebe, e o prêmio passa para o próximo", () => {
    const t = torneio([9, 6, 3, 0]);
    t.jogadores[0].ativo = false;
    expect(calcularGanhos([t], ["J1"])).toEqual({ total: 0, premiacoes: 0 });
    expect(calcularGanhos([t], ["J2"])).toEqual({ total: 26, premiacoes: 1 });
    expect(calcularGanhos([t], ["J3"])).toEqual({ total: 14, premiacoes: 1 });
  });

  it("valor já registrado como pago conta mesmo depois do drop", () => {
    const t = torneio([9, 6, 3, 0]);
    t.jogadores[0].ativo = false;
    t.jogadores[0].premioPago = { valor: 26, em: "2026-11-03" };
    expect(calcularGanhos([t], ["J1"]).total).toBe(26);
  });

  it("mostra o prêmio de cada torneio e o total no desempenho", () => {
    const t1 = { ...torneio([9, 6, 3, 0]), id: "a" };
    const t2 = { ...torneio([6, 9, 3, 0]), id: "b" };
    const d = calcularDesempenho([t1, t2], "J1")!;
    expect(d.ganhos).toBe(40);
    expect(d.torneiosPremiados).toBe(2);
    expect(Object.fromEntries(d.historico.map((h) => [h.id, h.premio]))).toEqual({ a: 26, b: 14 });

    const so = calcularDesempenho([t2], "J1")!;
    expect(so.ganhos).toBe(14);
    expect(so.historico).toHaveLength(1);
  });

  it("quem só participa usa o prêmio já calculado, sem ver os pagamentos", () => {
    const t = torneio([9, 6, 3, 0]);
    const premios = calcularPremios(t)!;
    const semPagamentos = {
      ...t,
      premios,
      jogadores: t.jogadores.map(({ pago: _pago, ...j }) => j as typeof t.jogadores[number]),
    };
    expect(calcularGanhos([semPagamentos], ["J1"]).total).toBe(26);
    expect(calcularGanhos([semPagamentos], ["J3"]).total).toBe(0);
  });

  it("soma vários torneios e ignora maiúsculas", () => {
    const ganhos = calcularGanhos([torneio([9, 6, 3, 0]), torneio([6, 9, 3, 0])], [" j1 "]);
    expect(ganhos).toEqual({ total: 40, premiacoes: 2 });
  });
});
