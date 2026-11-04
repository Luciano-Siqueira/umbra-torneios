import { beforeEach, describe, expect, it } from "vitest";
import { atualizarDecks, sincronizarDecks } from "../atualizarDecks";
import { aplicarDecksExtras, comandanteDoDeck, coresDoDeck, DECKS, filtrarDecks } from "../decks";
import { nomeDaColecao } from "../colecoes";

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });

const LISTA_NOVA = [
  { code: "C16", name: "Breed Lethality", fileName: "BreedLethality_C16", releaseDate: "2016-11-11", type: "Commander Deck" },
  { code: "TST", name: "Deck Novo", fileName: "DeckNovo_TST", releaseDate: "2027-01-15", type: "Commander Deck" },
  { code: "TST", name: "Deck Quebrado", fileName: "DeckQuebrado_TST", releaseDate: "2027-01-15", type: "Commander Deck" },
  { code: "TST", name: "Deck Sem Scryfall", fileName: "DeckSemScryfall_TST", releaseDate: "2027-01-15", type: "Commander Deck" },
  { code: "TST", name: "Outro Formato", fileName: "OutroFormato_TST", releaseDate: "2027-01-15", type: "Intro Pack" },
];

function rede(opcoes: { falhaAoGravar?: { code: string; message: string } } = {}) {
  const gravados: any[] = [];
  const urls: string[] = [];
  (globalThis as any).__rede = async (url: string, init: RequestInit) => {
    urls.push(url);
    if (url.endsWith("/DeckList.json")) return json({ data: LISTA_NOVA });
    if (url.endsWith("/decks/DeckNovo_TST.json")) {
      return json({ data: {
        commander: [{ name: "Carta Um // Verso", count: 1 }, { name: "Carta Dois", count: 1 }],
        mainBoard: [{ name: "Terreno", count: 98 }],
        tokens: [{ name: "Ficha", count: 3 }],
      } });
    }
    if (url.endsWith("/decks/DeckSemScryfall_TST.json")) {
      return json({ data: { commander: [{ name: "Carta Futura", count: 1 }], mainBoard: [], tokens: [] } });
    }
    if (url.includes("/decks/")) return json({}, 500);
    if (url.includes("scryfall")) {
      return json({
        data: [
          { name: "Carta Um // Verso", color_identity: ["G", "W"] },
          { name: "Carta Dois", color_identity: ["U"] },
        ],
        not_found: [{ name: "Carta Futura" }],
      });
    }
    if (url.includes("decks_commander")) {
      if (init.method === "POST") {
        if (opcoes.falhaAoGravar) return json(opcoes.falhaAoGravar, 404);
        gravados.push(...JSON.parse(String(init.body)));
        return json([], 201);
      }
      return json(gravados);
    }
    return json([]);
  };
  return { gravados, urls };
}

beforeEach(() => {
  aplicarDecksExtras([]);
  localStorage.removeItem("mtg.decks.extras");
});

describe("atualizar decks", () => {
  it("grava só os novos, com total de cartas, cores e comandantes", async () => {
    const { gravados, urls } = rede();
    const progresso: number[] = [];
    const r = await atualizarDecks((feitos) => progresso.push(feitos));

    expect(r.adicionados).toEqual(["Deck Novo"]);
    expect(gravados).toEqual([{
      lancamento: "2027-01-15", colecao: "TST", nome: "Deck Novo",
      comandantes: "Carta Um // Verso, Carta Dois", cartas: 100, tokens: 3, cores: "WUG",
    }]);
    expect(progresso).toEqual([0, 1, 2, 3]);
    // O deck já conhecido e o de outro formato não são baixados
    expect(urls.some((u) => u.includes("BreedLethality"))).toBe(false);
    expect(urls.some((u) => u.includes("OutroFormato"))).toBe(false);
  });

  it("informa o que falhou, sem impedir os demais nem gravar cor errada", async () => {
    const { gravados } = rede();
    const r = await atualizarDecks();

    expect(r.falhas.map((f) => f.nome).sort()).toEqual(["Deck Quebrado", "Deck Sem Scryfall"]);
    expect(r.falhas.find((f) => f.nome === "Deck Sem Scryfall")!.motivo).toContain("Carta Futura");
    expect(gravados.map((d) => d.nome)).toEqual(["Deck Novo"]);
  });

  it("o deck novo já aparece na lista e nas buscas", async () => {
    rede();
    const total = DECKS.length;
    await atualizarDecks();

    expect(DECKS).toHaveLength(total + 1);
    expect(DECKS[0].nome).toBe("Deck Novo");
    expect(comandanteDoDeck("deck novo")).toBe("Carta Um // Verso, Carta Dois");
    expect(coresDoDeck("Deck Novo")).toBe("WUG");
  });

  it("explica quando a tabela ainda não existe", async () => {
    rede({ falhaAoGravar: { code: "PGRST205", message: "not found" } });
    await expect(atualizarDecks()).rejects.toThrow(/decks_commander\.sql/);
  });

  it("não grava nada quando a lista já está em dia", async () => {
    (globalThis as any).__rede = async (url: string) =>
      url.endsWith("/DeckList.json") ? json({ data: [LISTA_NOVA[0]] }) : json({}, 500);
    await expect(atualizarDecks()).resolves.toEqual({ adicionados: [], falhas: [] });
  });

  it("avisa quando o MTGJSON está fora do ar", async () => {
    (globalThis as any).__rede = async () => json({}, 503);
    await expect(atualizarDecks()).rejects.toThrow(/503/);
  });
});

describe("sincronizar decks", () => {
  it("traz do banco os decks adicionados e guarda neste aparelho", async () => {
    (globalThis as any).__rede = async () => json([{
      colecao: "TST", nome: "Do Banco", lancamento: "2027-02-01", comandantes: "Alguém", cartas: 100, tokens: 0, cores: "",
    }]);
    await sincronizarDecks();

    expect(comandanteDoDeck("Do Banco")).toBe("Alguém");
    expect(coresDoDeck("Do Banco")).toBe("");
    expect(JSON.parse(localStorage.getItem("mtg.decks.extras")!)).toHaveLength(1);
  });

  it("busca o nome de uma coleção nova e guarda neste aparelho", async () => {
    localStorage.removeItem("mtg.colecoes.extras");
    (globalThis as any).__rede = async (url: string) => url.includes("SetList.json")
      ? json({ data: [{ code: "NOVA", name: "Coleção Nova Commander" }, { code: "OUTRA", name: "Não deve guardar" }] })
      : json([{ colecao: "NOVA", nome: "Deck Novo", lancamento: "2027-03-01", comandantes: "Alguém", cartas: 100, tokens: 0, cores: "W" }]);
    await sincronizarDecks();

    expect(nomeDaColecao("NOVA")).toBe("Coleção Nova Commander");
    expect(filtrarDecks("coleção nova").map((d) => d.nome)).toEqual(["Deck Novo"]);
    expect(JSON.parse(localStorage.getItem("mtg.colecoes.extras")!)).toEqual({ NOVA: "Coleção Nova Commander" });
  });

  it("se os nomes falharem, o deck novo entra com a sigla", async () => {
    (globalThis as any).__rede = async (url: string) => url.includes("SetList.json")
      ? json({}, 500)
      : json([{ colecao: "SEMNOME", nome: "Outro Deck", lancamento: "2027-03-01", comandantes: "Alguém", cartas: 100, tokens: 0, cores: "W" }]);
    await sincronizarDecks();

    expect(nomeDaColecao("SEMNOME")).toBe("SEMNOME");
    expect(comandanteDoDeck("Outro Deck")).toBe("Alguém");
  });

  it("sem a tabela, mantém a lista que acompanha o site", async () => {
    const total = DECKS.length;
    (globalThis as any).__rede = async () => json({ code: "PGRST205", message: "not found" }, 404);
    await sincronizarDecks();
    expect(DECKS).toHaveLength(total);
    expect(comandanteDoDeck("Breed Lethality")).toBe("Atraxa, Praetors' Voice");
  });
});
