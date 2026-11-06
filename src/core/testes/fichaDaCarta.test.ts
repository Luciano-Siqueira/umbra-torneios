import { describe, expect, it } from "vitest";
import { fichaDaScryfall, fichaDoMtgjson, partesDoTexto } from "../fichaDaCarta";

describe("ficha da carta", () => {
  const atraxa = {
    name: "Atraxa, Praetors' Voice",
    manaCost: "{G}{W}{U}{B}",
    type: "Legendary Creature — Phyrexian Angel Horror",
    text: "Flying, vigilance, deathtouch, lifelink",
    power: "4",
    toughness: "4",
    rarity: "mythic",
    artist: "Victor Adame Minguez",
    setCode: "C16",
    number: "28",
    foreignData: [
      { language: "French", name: "Atraxa, voix des préteurs" },
      { language: "Portuguese (Brazil)", name: "Atraxa, Voz dos Pretores", type: "Criatura Lendária — Anjo Horror", text: "Voar, vigilância" },
    ],
  };

  it("usa os dados do MTGJSON, com o português do Brasil", () => {
    expect(fichaDoMtgjson(atraxa, atraxa.name)).toEqual({
      nome: "Atraxa, Praetors' Voice",
      nomePt: "Atraxa, Voz dos Pretores",
      custo: "{G}{W}{U}{B}",
      tipo: "Legendary Creature — Phyrexian Angel Horror",
      tipoPt: "Criatura Lendária — Anjo Horror",
      texto: "Flying, vigilance, deathtouch, lifelink",
      textoPt: "Voar, vigilância",
      forca: "4/4",
      lealdade: undefined,
      raridade: "Mítica",
      artista: "Victor Adame Minguez",
      colecao: "C16",
      numero: "28",
    });
  });

  it("sem tradução, a ficha fica só em inglês, e o nome igual não se repete", () => {
    const ficha = fichaDoMtgjson({ name: "Sol Ring", type: "Artifact", text: "{T}: Add {C}{C}.", foreignData: [{ language: "Portuguese (Brazil)", name: "Sol Ring" }] }, "Sol Ring");
    expect(ficha.nomePt).toBeUndefined();
    expect(ficha.textoPt).toBeUndefined();
    expect(ficha.forca).toBeUndefined();
  });

  it("tokens da Scryfall usam a carta do token quando ela veio", () => {
    const parte = { name: "Saproling", type_line: "Token Creature — Saproling" };
    expect(fichaDaScryfall(parte, { power: "1", toughness: "1", artist: "Fulano", set: "tc16", collector_number: "3" })).toMatchObject({
      nome: "Saproling", forca: "1/1", artista: "Fulano", colecao: "TC16", numero: "3", tipo: "Token Creature — Saproling",
    });
    expect(fichaDaScryfall(parte, undefined)).toMatchObject({ nome: "Saproling", forca: undefined });
  });

  it("separa o texto dos símbolos", () => {
    expect(partesDoTexto("{T}: Add {c}{C}.")).toEqual([
      { simbolo: "T" }, { texto: ": Add " }, { simbolo: "C" }, { simbolo: "C" }, { texto: "." },
    ]);
    expect(partesDoTexto("Flying")).toEqual([{ texto: "Flying" }]);
    expect(partesDoTexto("{2}{G/W}")).toEqual([{ simbolo: "2" }, { simbolo: "G/W" }]);
  });
});
