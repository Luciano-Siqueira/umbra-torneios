import { describe, expect, it } from "vitest";
import { parearRodada, tamanhosMesas } from "../pareamento";
import { novoJogador } from "../types";

const jogadores = (n: number) => Array.from({ length: n }, (_, i) => novoJogador(i + 1, `J${i + 1}`));

describe("tamanho das mesas", () => {
  it("usa mesas de 4 e 3", () => {
    expect(tamanhosMesas(3)).toEqual([3]);
    expect(tamanhosMesas(4)).toEqual([4]);
    expect(tamanhosMesas(6)).toEqual([3, 3]);
    expect(tamanhosMesas(7)).toEqual([4, 3]);
    expect(tamanhosMesas(8)).toEqual([4, 4]);
    expect(tamanhosMesas(9)).toEqual([3, 3, 3]);
  });

  it("com 5 jogadores faz mesas de 3 e 2", () => {
    expect(tamanhosMesas(5)).toEqual([3, 2]);
  });

  it("coloca todos em uma mesa de 3 a 60 jogadores", () => {
    for (let n = 3; n <= 60; n++) {
      expect(tamanhosMesas(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe("pareamento", () => {
  it.each([1, 2])("com 5 jogadores na rodada %i ninguém fica de fora nem repete", (rodada) => {
    const mesas = parearRodada(jogadores(5), rodada);
    expect(mesas.map((m) => m.jogadoresIds.length).sort()).toEqual([2, 3]);
    expect(new Set(mesas.flatMap((m) => m.jogadoresIds)).size).toBe(5);
  });

  it("com 60 jogadores ninguém fica de fora nem repete", () => {
    const mesas = parearRodada(jogadores(60), 1);
    expect(mesas).toHaveLength(15);
    expect(new Set(mesas.flatMap((m) => m.jogadoresIds)).size).toBe(60);
  });
});
