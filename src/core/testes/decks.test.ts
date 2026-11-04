import { describe, expect, it } from "vitest";
import { ANOS_DECKS, comandanteDoDeck, DECKS, filtrarDecks, sugerirDecks } from "../decks";

describe("lista de decks", () => {
  it("toda linha tem os dados completos", () => {
    for (const d of DECKS) {
      expect(d.lancamento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.colecao).toBeTruthy();
      expect(d.nome).toBeTruthy();
      expect(d.comandantes).toBeTruthy();
      expect(d.cartas).toBe(100);
      expect(Number.isFinite(d.tokens)).toBe(true);
    }
  });

  it("não repete o mesmo deck na mesma coleção", () => {
    const chaves = DECKS.map((d) => `${d.colecao}|${d.nome}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("começa pelos mais recentes", () => {
    const datas = DECKS.map((d) => d.lancamento);
    expect(datas).toEqual([...datas].sort().reverse());
    expect(ANOS_DECKS[0]).toBe("2026");
    expect(ANOS_DECKS[ANOS_DECKS.length - 1]).toBe("2009");
  });
});

describe("comandante do deck", () => {
  it("encontra pelo nome, sem ligar para maiúsculas", () => {
    expect(comandanteDoDeck("Multiverse Reforged")).toBe("Jace, Multiverse Architect");
    expect(comandanteDoDeck(" guided by nature ")).toBe("Freyalise, Llanowar's Fury");
  });

  it("deck próprio ou vazio não tem comandante", () => {
    expect(comandanteDoDeck("Meu deck de elfos")).toBe("");
    expect(comandanteDoDeck("")).toBe("");
  });

  it("o mesmo nome de deck nunca aponta para comandantes diferentes", () => {
    for (const d of DECKS) expect(comandanteDoDeck(d.nome)).toBe(d.comandantes);
  });
});

describe("busca de decks", () => {
  it("encontra por deck, comandante e coleção, sem ligar para acentos", () => {
    expect(filtrarDecks("breed lethality").map((d) => d.colecao).sort()).toEqual(["C16", "CM2"]);
    expect(filtrarDecks("atraxa praetors").length).toBe(2);
    expect(filtrarDecks("eowyn")[0].nome).toBe("Riders of Rohan");
    expect(filtrarDecks("c13")).toHaveLength(5);
  });

  it("filtra por ano e aceita palavras em qualquer ordem", () => {
    expect(filtrarDecks("", "2009")).toHaveLength(2);
    expect(filtrarDecks("kaalia", "2017")[0].colecao).toBe("CMA");
    expect(filtrarDecks("vast kaalia")).toHaveLength(2);
    expect(filtrarDecks("nao existe")).toEqual([]);
  });

  it("sugere só a partir de duas letras", () => {
    expect(sugerirDecks("a")).toEqual([]);
    expect(sugerirDecks("at").length).toBeGreaterThan(0);
  });

  it("junta reimpressões do mesmo deck, mesmo com maiúsculas diferentes", () => {
    const [s, ...resto] = sugerirDecks("guided by nature");
    expect(resto).toEqual([]);
    expect(s.colecoes.sort()).toEqual(["C14", "CMA"]);
  });

  it("mantém a edição de colecionador separada", () => {
    expect(sugerirDecks("tyranid swarm").map((s) => s.nome).sort()).toEqual([
      "Tyranid Swarm",
      "Tyranid Swarm Collector's Edition",
    ]);
  });

  it("mostra primeiro o que começa com o texto e respeita o limite", () => {
    expect(sugerirDecks("atraxa")[0].comandantes).toBe("Atraxa, Praetors' Voice");
    expect(sugerirDecks("the", 3)).toHaveLength(3);
  });
});
