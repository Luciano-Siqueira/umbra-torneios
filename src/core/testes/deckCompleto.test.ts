import { describe, expect, it } from "vitest";
import { grupoDaCarta, imagemDaCarta, montarDeckCompleto, tokensPelasCartas } from "../deckCompleto";

describe("grupo de cada carta", () => {
  it("separa pelos tipos pedidos", () => {
    expect(grupoDaCarta(["Creature"])).toBe("criaturas");
    expect(grupoDaCarta(["Enchantment"])).toBe("encantamentos");
    expect(grupoDaCarta(["Instant"])).toBe("magicas");
    expect(grupoDaCarta(["Sorcery"])).toBe("magicas");
    expect(grupoDaCarta(["Artifact"])).toBe("artefatos");
    expect(grupoDaCarta(["Land"])).toBe("terrenos");
  });

  it("carta de dois tipos entra em um só grupo", () => {
    expect(grupoDaCarta(["Artifact", "Creature"])).toBe("criaturas");
    expect(grupoDaCarta(["Enchantment", "Creature"])).toBe("criaturas");
    expect(grupoDaCarta(["Land", "Creature"])).toBe("terrenos");
    expect(grupoDaCarta(["Artifact", "Land"])).toBe("terrenos");
    expect(grupoDaCarta(["Enchantment", "Artifact"])).toBe("artefatos");
    expect(grupoDaCarta(["Kindred", "Sorcery"])).toBe("magicas");
  });

  it("planeswalker e tipo desconhecido não somem da lista", () => {
    expect(grupoDaCarta(["Planeswalker"])).toBe("outros");
    expect(grupoDaCarta(["Battle"])).toBe("outros");
    expect(grupoDaCarta([])).toBe("outros");
    expect(grupoDaCarta(undefined)).toBe("outros");
  });
});

describe("imagem da carta", () => {
  it("monta o endereço da Scryfall pelo identificador", () => {
    expect(imagemDaCarta("1d770a59-1c54", "large")).toBe("https://cards.scryfall.io/large/front/1/d/1d770a59-1c54.jpg");
    expect(imagemDaCarta(undefined)).toBeNull();
  });
});

describe("montar o deck", () => {
  const deck = montarDeckCompleto({
    commander: [
      { name: "Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom", count: 1, type: "Legendary Creature", types: ["Creature"], identifiers: { scryfallId: "aa11" } },
      { name: "Esika, God of the Tree // The Prismatic Bridge", count: 1, types: ["Creature"] },
    ],
    mainBoard: [
      { name: "Grande", count: 1, manaValue: 7, types: ["Creature"] },
      { name: "Pequena", count: 1, manaValue: 1, types: ["Creature"] },
      { name: "Abacate", count: 1, manaValue: 1, types: ["Creature"] },
      { name: "Floresta", count: 35, manaValue: 0, types: ["Land"] },
      { name: "Teferi", manaValue: 4, types: ["Planeswalker"] },
    ],
  });

  it("os comandantes ficam fora dos grupos, com o nome limpo", () => {
    expect(deck.comandantes.map((c) => c.nome)).toEqual([
      "Zndrsplt, Eye of Wisdom",
      "Esika, God of the Tree // The Prismatic Bridge",
    ]);
    expect(deck.comandantes[0].imagem).toContain("/large/");
    expect(deck.comandantes[1].imagem).toBeNull();
  });

  it("mostra só os grupos com cartas, na ordem pedida, e soma as quantidades", () => {
    expect(deck.grupos.map((g) => g.id)).toEqual(["criaturas", "terrenos", "outros"]);
    expect(deck.grupos[1].total).toBe(35);
    expect(deck.totalCartas).toBe(41);
  });

  it("ordena por custo de mana e depois por nome", () => {
    expect(deck.grupos[0].cartas.map((c) => c.nome)).toEqual(["Abacate", "Pequena", "Grande"]);
  });

  it("junta impressões diferentes da mesma carta em uma linha", () => {
    const d = montarDeckCompleto({ mainBoard: [
      { name: "Forest", count: 1, types: ["Land"] },
      { name: "Forest", count: 2, types: ["Land"] },
      { name: "Swamp", count: 1, types: ["Land"] },
    ] });
    expect(d.grupos[0].total).toBe(4);
    expect(d.grupos[0].cartas.map((c) => [c.nome, c.quantidade])).toEqual([["Forest", 3], ["Swamp", 1]]);
  });

  it("tokens ficam fora da contagem de cartas e somam as linhas repetidas", () => {
    const d = montarDeckCompleto({
      commander: [{ name: "Comandante", count: 1 }],
      tokens: [
        { name: "Bird", count: 3, power: "1", toughness: "1", identifiers: { scryfallId: "b1" } },
        { name: "Bird", count: 1, power: "1", toughness: "1", identifiers: { scryfallId: "b1" } },
        { name: "Bird", count: 2, power: "3", toughness: "3", identifiers: { scryfallId: "b2" } },
        { name: "Treasure", count: 5, identifiers: { scryfallId: "t1" } },
      ],
    });
    expect(d.totalCartas).toBe(1);
    expect(d.totalTokens).toBe(11);
    expect(d.tokensOrigem).toBe("deck");
    expect(d.tokens.map((t) => [t.nome, t.quantidade, t.forca])).toEqual([
      ["Bird", 4, "1/1"],
      ["Bird", 2, "3/3"],
      ["Treasure", 5, undefined],
    ]);
  });

  it("deck sem dados não quebra a tela", () => {
    expect(montarDeckCompleto({})).toEqual({ comandantes: [], grupos: [], totalCartas: 0, tokens: [], totalTokens: 0, tokensOrigem: null });
  });
});

describe("tokens que as cartas criam", () => {
  const json = (dados: unknown, status = 200) =>
    new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
  const deck = {
    commander: [{ name: "A", identifiers: { scryfallId: "c1" } }],
    mainBoard: [
      { name: "B", identifiers: { scryfallId: "c2" } },
      { name: "B outra", identifiers: { scryfallId: "c2" } },
      { name: "Sem id" },
    ],
  };
  const cartas = [
    { id: "c1", all_parts: [
      { id: "c1", component: "combo_piece", name: "A" },
      { id: "t2", component: "token", name: "Zombie", type_line: "Token Creature — Zombie" },
      { id: "t1", component: "token", name: "Elf", type_line: "Token Creature — Elf" },
    ] },
    { id: "c2", all_parts: [
      { id: "t1", component: "token", name: "Elf", type_line: "Token Creature — Elf" },
      { id: "t3", component: "token", name: "Copy", type_line: "Token" },
    ] },
  ];

  it("junta os tokens sem repetir, ignora Copy e traz poder e resistência", async () => {
    const pedidos: string[][] = [];
    (globalThis as any).__rede = async (_url: string, init: RequestInit) => {
      const ids = JSON.parse(String(init.body)).identifiers.map((i: any) => i.id);
      pedidos.push(ids);
      return json({ data: ids.includes("c1") ? cartas : [{ id: "t1", power: "1", toughness: "1" }, { id: "t2", power: "2", toughness: "2" }] });
    };
    const tokens = await tokensPelasCartas(deck);
    expect(pedidos[0]).toEqual(["c1", "c2"]);
    expect(tokens.map((t) => [t.nome, t.forca, t.tipo])).toEqual([
      ["Elf", "1/1", "Token Creature — Elf"],
      ["Zombie", "2/2", "Token Creature — Zombie"],
    ]);
    expect(tokens[0].imagem).toContain("/t/1/t1.jpg");
  });

  it("se a segunda consulta falhar, a lista sai sem poder e resistência", async () => {
    let chamada = 0;
    (globalThis as any).__rede = async () => (++chamada === 1 ? json({ data: cartas }) : json({}, 500));
    const tokens = await tokensPelasCartas(deck);
    expect(tokens.map((t) => [t.nome, t.forca])).toEqual([["Elf", undefined], ["Zombie", undefined]]);
  });

  it("sem tokens nas cartas, não faz a segunda consulta", async () => {
    let chamadas = 0;
    (globalThis as any).__rede = async () => { chamadas++; return json({ data: [{ id: "c1" }] }); };
    expect(await tokensPelasCartas(deck)).toEqual([]);
    expect(chamadas).toBe(1);
  });

  it("divide em lotes de 75 cartas", async () => {
    const tamanhos: number[] = [];
    (globalThis as any).__rede = async (_url: string, init: RequestInit) => {
      tamanhos.push(JSON.parse(String(init.body)).identifiers.length);
      return json({ data: [] });
    };
    const mainBoard = Array.from({ length: 90 }, (_, i) => ({ identifiers: { scryfallId: `id${i}` } }));
    await tokensPelasCartas({ mainBoard });
    expect(tamanhos).toEqual([75, 15]);
  });
});
