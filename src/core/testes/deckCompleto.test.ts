import { describe, expect, it } from "vitest";
import { grupoDaCarta, imagemDaCarta, montarDeckCompleto } from "../deckCompleto";

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

  it("deck sem dados não quebra a tela", () => {
    expect(montarDeckCompleto({})).toEqual({ comandantes: [], grupos: [], totalCartas: 0 });
  });
});
