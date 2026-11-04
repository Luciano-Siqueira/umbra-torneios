// Cartas de um deck, baixadas do MTGJSON só quando alguém abre o deck
import type { DeckCommander } from "./decks";

const MTGJSON = "https://mtgjson.com/api/v5";

export interface CartaDoDeck {
  nome: string;
  quantidade: number;
  tipo: string;
  imagem: string | null;
}

export type IdGrupo = "criaturas" | "encantamentos" | "magicas" | "artefatos" | "terrenos" | "outros";

export interface GrupoDeCartas {
  id: IdGrupo;
  titulo: string;
  icone: string;
  total: number;
  cartas: CartaDoDeck[];
}

export interface DeckCompleto {
  comandantes: CartaDoDeck[];
  grupos: GrupoDeCartas[];
  totalCartas: number;
}

const GRUPOS: { id: IdGrupo; titulo: string; icone: string }[] = [
  { id: "criaturas", titulo: "Criaturas", icone: "🐉" },
  { id: "encantamentos", titulo: "Encantamentos", icone: "✨" },
  { id: "magicas", titulo: "Mágicas", icone: "⚡" },
  { id: "artefatos", titulo: "Artefatos", icone: "⚙️" },
  { id: "terrenos", titulo: "Terrenos", icone: "⛰️" },
  { id: "outros", titulo: "Planeswalkers e outros", icone: "🌀" },
];

// Uma carta entra em um só grupo: criatura artefato conta como criatura, e terreno criatura como terreno
export function grupoDaCarta(tipos: string[] = []): IdGrupo {
  if (tipos.includes("Land")) return "terrenos";
  if (tipos.includes("Creature")) return "criaturas";
  if (tipos.includes("Instant") || tipos.includes("Sorcery")) return "magicas";
  if (tipos.includes("Artifact")) return "artefatos";
  if (tipos.includes("Enchantment")) return "encantamentos";
  return "outros";
}

export function imagemDaCarta(scryfallId: string | undefined, tamanho: "normal" | "large" = "normal"): string | null {
  if (!scryfallId) return null;
  return `https://cards.scryfall.io/${tamanho}/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

// Algumas cartas de uma face só vêm como "Nome // Nome"
function nomeDaCarta(nome: string): string {
  const [frente, verso] = nome.split(" // ");
  return frente === verso ? frente : nome;
}

function daCarta(c: any, tamanho: "normal" | "large"): CartaDoDeck {
  return {
    nome: nomeDaCarta(c.name),
    quantidade: c.count ?? 1,
    tipo: c.type ?? "",
    imagem: imagemDaCarta(c.identifiers?.scryfallId, tamanho),
  };
}

export function montarDeckCompleto(deck: any): DeckCompleto {
  const porGrupo = new Map<IdGrupo, any[]>();
  for (const carta of deck.mainBoard ?? []) {
    const id = grupoDaCarta(carta.types);
    porGrupo.set(id, [...(porGrupo.get(id) ?? []), carta]);
  }

  const grupos = GRUPOS.flatMap((g) => {
    const cartas = porGrupo.get(g.id);
    if (!cartas) return [];
    const ordenadas = [...cartas].sort((a, b) =>
      (a.manaValue ?? 0) - (b.manaValue ?? 0) || a.name.localeCompare(b.name)
    );
    // Cada impressão vem separada (vários "Forest"): na lista, é uma linha com a soma
    const unicas = new Map<string, CartaDoDeck>();
    for (const c of ordenadas) {
      const existente = unicas.get(c.name);
      if (existente) existente.quantidade += c.count ?? 1;
      else unicas.set(c.name, daCarta(c, "normal"));
    }
    return [{
      ...g,
      total: cartas.reduce((soma, c) => soma + (c.count ?? 1), 0),
      cartas: Array.from(unicas.values()),
    }];
  });

  const comandantes = (deck.commander ?? []).map((c: any) => daCarta(c, "large"));
  return {
    comandantes,
    grupos,
    totalCartas: grupos.reduce((soma, g) => soma + g.total, 0)
      + comandantes.reduce((soma: number, c: CartaDoDeck) => soma + c.quantidade, 0),
  };
}

async function baixarJson(url: string): Promise<any> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`O MTGJSON respondeu ${resposta.status}`);
  return resposta.json();
}

let indice: Promise<Map<string, string>> | null = null;
const abertos = new Map<string, Promise<DeckCompleto>>();

function nomeDoArquivo(colecao: string, nome: string): Promise<string | undefined> {
  indice ??= baixarJson(`${MTGJSON}/DeckList.json`).then(({ data }) =>
    new Map<string, string>(data.map((d: any) => [`${d.code}|${d.name}`, d.fileName]))
  );
  // Um erro de rede não pode ficar guardado para as próximas tentativas
  indice.catch(() => { indice = null; });
  return indice.then((mapa) => mapa.get(`${colecao}|${nome}`));
}

export function buscarDeckCompleto(deck: Pick<DeckCommander, "colecao" | "nome">): Promise<DeckCompleto> {
  const chave = `${deck.colecao}|${deck.nome}`;
  const guardado = abertos.get(chave);
  if (guardado) return guardado;

  const busca = (async () => {
    const arquivo = await nomeDoArquivo(deck.colecao, deck.nome);
    if (!arquivo) throw new Error("Este deck não foi encontrado no MTGJSON");
    const { data } = await baixarJson(`${MTGJSON}/decks/${encodeURIComponent(arquivo)}.json`);
    return montarDeckCompleto(data);
  })();
  abertos.set(chave, busca);
  busca.catch(() => abertos.delete(chave));
  return busca;
}
