import { describe, expect, it } from "vitest";
import { filtrarPorPeriodo, filtrarTorneios, situacaoDoTorneio, textoDaData } from "../buscaTorneios";
import { novoTorneio, type Torneio } from "../types";

const criar = (nome: string, data: string, criadoPor?: string): Torneio => ({
  ...novoTorneio(nome, 10), nome, dataCriacao: data, criadoPor,
});
const liga = criar("Liga Novembro", "2026-11-08T15:00:00");
const halloween = criar("Torneio de Halloween", "2026-10-31T20:00:00", "u-ana");
const todos = [liga, halloween];

describe("busca de torneios", () => {
  it("acha pelo nome, sem ligar para acento ou maiúscula", () => {
    expect(filtrarTorneios(todos, "halloween")).toEqual([halloween]);
    expect(filtrarTorneios(todos, "LIGA nov")).toEqual([liga]);
  });

  it("acha pela data, pelo mês ou pelo ano", () => {
    expect(filtrarTorneios(todos, "08/11")).toEqual([liga]);
    expect(filtrarTorneios(todos, "31/10/2026")).toEqual([halloween]);
    expect(filtrarTorneios(todos, "outubro")).toEqual([halloween]);
    expect(filtrarTorneios(todos, "2026")).toEqual(todos);
  });

  it("acha por quem organizou, quando a tela informa", () => {
    const organizador = (t: Torneio) => (t.criadoPor === "u-ana" ? "Ana ana@umbraarena.com.br" : "");
    expect(filtrarTorneios(todos, "ana", organizador)).toEqual([halloween]);
    expect(filtrarTorneios(todos, "ana")).toEqual([]);
  });

  it("todas as palavras precisam aparecer; busca vazia mostra tudo", () => {
    expect(filtrarTorneios(todos, "liga outubro")).toEqual([]);
    expect(filtrarTorneios(todos, "   ")).toEqual(todos);
  });

  it("data inválida não quebra a busca", () => {
    expect(textoDaData("")).toBe("");
    expect(textoDaData("2026-03-05T12:00:00")).toContain("março");
  });
});

describe("período pelo calendário", () => {
  it("inclui o primeiro e o último dia, e cada ponta é opcional", () => {
    expect(filtrarPorPeriodo(todos, "2026-11-08", "2026-11-08")).toEqual([liga]);
    expect(filtrarPorPeriodo(todos, "2026-11-01", "")).toEqual([liga]);
    expect(filtrarPorPeriodo(todos, "", "2026-10-31")).toEqual([halloween]);
    expect(filtrarPorPeriodo(todos, "", "")).toEqual(todos);
    expect(filtrarPorPeriodo(todos, "2026-12-01", "2026-12-31")).toEqual([]);
  });
});

describe("situação do torneio", () => {
  it("aberto antes da rodada 1, em andamento depois (mesmo parado), finalizado no fim", () => {
    expect(situacaoDoTorneio({ finalizado: false, rodadaAtual: 0 })).toBe("aberto");
    expect(situacaoDoTorneio({ finalizado: false, rodadaAtual: 2 })).toBe("andamento");
    expect(situacaoDoTorneio({ finalizado: true, rodadaAtual: 3 })).toBe("finalizado");
  });
});
