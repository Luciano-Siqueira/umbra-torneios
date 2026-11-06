// Dados da carta para a ficha do pop-up. Vêm junto com o deck, sem chamada extra
export interface FichaDaCarta {
  nome: string;
  nomePt?: string;
  custo?: string; // no formato "{2}{G}{W}"
  tipo: string;
  tipoPt?: string;
  texto?: string;
  textoPt?: string; // tradução impressa, que pode estar desatualizada
  forca?: string; // poder/resistência
  lealdade?: string;
  raridade?: string;
  artista?: string;
  colecao?: string;
  numero?: string;
}

const RARIDADES: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  mythic: "Mítica",
  special: "Especial",
  bonus: "Bônus",
};

export function nomeDaRaridade(raridade: string | undefined): string | undefined {
  if (!raridade) return undefined;
  return RARIDADES[raridade] ?? raridade;
}

// Texto vazio vira undefined, para a ficha não mostrar linhas em branco
const valor = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export function fichaDoMtgjson(c: any, nome: string): FichaDaCarta {
  const pt = (c.foreignData ?? []).find((f: any) => f.language === "Portuguese (Brazil)");
  return {
    nome,
    nomePt: valor(pt?.name) !== nome ? valor(pt?.name) : undefined,
    custo: valor(c.manaCost),
    tipo: c.type ?? "",
    tipoPt: valor(pt?.type),
    texto: valor(c.text),
    textoPt: valor(pt?.text),
    forca: c.power !== undefined ? `${c.power}/${c.toughness}` : undefined,
    lealdade: valor(c.loyalty),
    raridade: nomeDaRaridade(c.rarity),
    artista: valor(c.artist),
    colecao: valor(c.setCode),
    numero: valor(c.number),
  };
}

// Tokens que só a Scryfall conhece; "detalhe" é a carta do próprio token, quando a consulta deu certo
export function fichaDaScryfall(parte: any, detalhe: any): FichaDaCarta {
  return {
    nome: parte.name,
    tipo: detalhe?.type_line ?? parte.type_line ?? "",
    custo: valor(detalhe?.mana_cost),
    texto: valor(detalhe?.oracle_text),
    forca: detalhe?.power !== undefined ? `${detalhe.power}/${detalhe.toughness}` : undefined,
    lealdade: valor(detalhe?.loyalty),
    raridade: nomeDaRaridade(detalhe?.rarity),
    artista: valor(detalhe?.artist),
    colecao: valor(detalhe?.set)?.toUpperCase(),
    numero: valor(detalhe?.collector_number),
  };
}

export type ParteDoTexto = { texto: string } | { simbolo: string };

// Separa "{T}: Add {G}." em texto e símbolos
export function partesDoTexto(texto: string): ParteDoTexto[] {
  const partes: ParteDoTexto[] = [];
  let resto = 0;
  for (const m of texto.matchAll(/\{([^}]+)\}/g)) {
    if (m.index! > resto) partes.push({ texto: texto.slice(resto, m.index) });
    partes.push({ simbolo: m[1].toUpperCase() });
    resto = m.index! + m[0].length;
  }
  if (resto < texto.length) partes.push({ texto: texto.slice(resto) });
  return partes;
}
