import { describe, expect, it } from "vitest";
import { ANOS_DECKS, comandanteDoDeck, coresDoDeck, DECKS, filtrarDecks, sugerirDecks } from "../decks";
import { calcularMetricas } from "../metricas";
import { novoJogador, novoTorneio, type Torneio } from "../types";

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

describe("cores dos comandantes", () => {
  it("todo deck tem cores válidas, na ordem WUBRG", () => {
    for (const d of DECKS) {
      expect(d.cores).toMatch(/^W?U?B?R?G?$/);
      expect(d.cores).toBe(coresDoDeck(d.nome));
    }
  });

  it("diferencia incolor de deck fora da lista", () => {
    expect(coresDoDeck("Eldrazi Unbound")).toBe("");
    expect(coresDoDeck("Meu deck de elfos")).toBeNull();
    expect(coresDoDeck("Breed Lethality")).toBe("WUBG");
  });
});

describe("métricas de decks", () => {
  function torneio(decks: string[]): Torneio {
    const t = novoTorneio("Teste", 10);
    // O primeiro jogador vence as duas mesas
    t.jogadores = decks.map((deck, i) => ({
      ...novoJogador(i + 1, `J${i + 1}`, deck, true),
      pontos: 9 - i,
      historicoColocacoes: [[1, i === 0 ? 1 : 2], [2, i === 0 ? 1 : 2]] as [number, number][],
    }));
    t.finalizado = true;
    return t;
  }

  it("soma por comandante e põe quem mais vence primeiro", () => {
    const m = calcularMetricas([torneio(["Heavenly Inferno", "Breed Lethality", "Breed Lethality"])]);
    expect(m.comandantes.map((c) => c.nome)).toEqual(["Kaalia of the Vast", "Atraxa, Praetors' Voice"]);
    expect(m.comandantes[0]).toMatchObject({ cores: "WBR", usos: 1, vitorias: 2, partidas: 2, campeonatos: 1, winrate: 1 });
    expect(m.comandantes[1]).toMatchObject({ usos: 2, vitorias: 0, partidas: 4, campeonatos: 0, winrate: 0 });
  });

  it("decks diferentes do mesmo comandante somam juntos", () => {
    const m = calcularMetricas([torneio(["Tyranid Swarm", "Tyranid Swarm Collector's Edition"])]);
    expect(m.comandantes).toHaveLength(1);
    expect(m.comandantes[0].usos).toBe(2);
  });

  it("deck de várias cores conta em cada cor, e incolor tem linha própria", () => {
    const m = calcularMetricas([torneio(["Heavenly Inferno", "Eldrazi Unbound"])]);
    const porCor = Object.fromEntries(m.cores.map((c) => [c.cor, c]));
    expect(m.cores.map((c) => c.cor)).toEqual(["W", "B", "R", "C"]);
    expect(porCor.W).toMatchObject({ usos: 1, vitorias: 2, participacao: 0.5 });
    expect(porCor.C).toMatchObject({ usos: 1, vitorias: 0, participacao: 0.5 });
  });

  it("deck próprio fica de fora, mas é informado", () => {
    const m = calcularMetricas([torneio(["Meu deck", "Heavenly Inferno", ""])]);
    expect(m.inscricoesComDeck).toBe(2);
    expect(m.inscricoesSemComandante).toBe(1);
    expect(m.comandantes.map((c) => c.nome)).toEqual(["Kaalia of the Vast"]);
    expect(m.cores.find((c) => c.cor === "W")!.participacao).toBe(1);
  });

  it("sem decks da lista, não há métricas", () => {
    const m = calcularMetricas([torneio(["Meu deck"])]);
    expect(m.cores).toEqual([]);
    expect(m.comandantes).toEqual([]);
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
