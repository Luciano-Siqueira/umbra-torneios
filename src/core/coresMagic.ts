// Nomes das combinações de cores de Magic. As cores seguem sempre a ordem WUBRG; vazio = incolor
export interface CombinacaoDeCores {
  cores: string;
  nome: string;
  grupo: string;
}

const COM_GRUPO = (grupo: string, itens: [string, string][]): CombinacaoDeCores[] =>
  itens.map(([cores, nome]) => ({ cores, nome, grupo }));

export const COMBINACOES: CombinacaoDeCores[] = [
  ...COM_GRUPO("Incolor", [["", "Incolor"]]),
  ...COM_GRUPO("Uma cor", [["W", "Branco"], ["U", "Azul"], ["B", "Preto"], ["R", "Vermelho"], ["G", "Verde"]]),
  ...COM_GRUPO("Duas cores (guildas)", [
    ["WU", "Azorius"], ["UB", "Dimir"], ["BR", "Rakdos"], ["RG", "Gruul"], ["WG", "Selesnya"],
    ["WB", "Orzhov"], ["UR", "Izzet"], ["BG", "Golgari"], ["WR", "Boros"], ["UG", "Simic"],
  ]),
  ...COM_GRUPO("Três cores (fragmentos)", [
    ["WUG", "Bant"], ["WUB", "Esper"], ["UBR", "Grixis"], ["BRG", "Jund"], ["WRG", "Naya"],
  ]),
  ...COM_GRUPO("Três cores (cunhas)", [
    ["WBG", "Abzan"], ["WUR", "Jeskai"], ["UBG", "Sultai"], ["WBR", "Mardu"], ["URG", "Temur"],
  ]),
  ...COM_GRUPO("Quatro cores", [
    ["UBRG", "Glint-Eye"], ["WBRG", "Dune-Brood"], ["WURG", "Ink-Treader"], ["WUBG", "Witch-Maw"], ["WUBR", "Yore-Tiller"],
  ]),
  ...COM_GRUPO("Cinco cores", [["WUBRG", "Cinco cores"]]),
];

const POR_CORES = new Map(COMBINACOES.map((c) => [c.cores, c]));

export function nomeDaCombinacao(cores: string): string {
  return POR_CORES.get(cores)?.nome ?? cores;
}
