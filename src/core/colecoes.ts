// Nome completo das coleções, segundo o MTGJSON. Coleções novas são buscadas ao sincronizar os decks.
const CONHECIDAS: Record<string, string> = {
  "40K": "Warhammer 40,000 Commander",
  AFC: "Forgotten Realms Commander",
  BLC: "Bloomburrow Commander",
  BRC: "The Brothers' War Commander",
  C13: "Commander 2013",
  C14: "Commander 2014",
  C15: "Commander 2015",
  C16: "Commander 2016",
  C17: "Commander 2017",
  C18: "Commander 2018",
  C19: "Commander 2019",
  C20: "Commander 2020",
  C21: "Commander 2021",
  CLB: "Commander Legends: Battle for Baldur's Gate",
  CM2: "Commander Anthology Volume II",
  CMA: "Commander Anthology",
  CMD: "Commander 2011",
  CMM: "Commander Masters",
  CMR: "Commander Legends",
  DMC: "Dominaria United Commander",
  DRC: "Aetherdrift Commander",
  DSC: "Duskmourn: House of Horror Commander",
  ECC: "Lorwyn Eclipsed Commander",
  EOC: "Edge of Eternities Commander",
  FDC: "Foundations Commander",
  FIC: "Final Fantasy Commander",
  FRC: "Reality Fracture Commander",
  KHC: "Kaldheim Commander",
  LCC: "The Lost Caverns of Ixalan Commander",
  LTC: "Tales of Middle-earth Commander",
  M3C: "Modern Horizons 3 Commander",
  MIC: "Midnight Hunt Commander",
  MKC: "Murders at Karlov Manor Commander",
  MOC: "March of the Machine Commander",
  MSC: "Marvel Super Heroes Commander",
  NCC: "New Capenna Commander",
  NEC: "Neon Dynasty Commander",
  ONC: "Phyrexia: All Will Be One Commander",
  OTC: "Outlaws of Thunder Junction Commander",
  PIP: "Fallout",
  SCD: "Starter Commander Decks",
  SLD: "Secret Lair Drop",
  SOC: "Secrets of Strixhaven Commander",
  TD0: "Magic Online Theme Decks",
  TDC: "Tarkir: Dragonstorm Commander",
  TMC: "Teenage Mutant Ninja Turtles Eternal",
  VOC: "Crimson Vow Commander",
  WHO: "Doctor Who",
  WOC: "Wilds of Eldraine Commander",
  ZNC: "Zendikar Rising Commander",
};

const novas = new Map<string, string>();

// Sem o nome, continua aparecendo a sigla
export function nomeDaColecao(sigla: string): string {
  return CONHECIDAS[sigla] ?? novas.get(sigla) ?? sigla;
}

export function colecaoConhecida(sigla: string): boolean {
  return nomeDaColecao(sigla) !== sigla;
}

export function guardarNomesDeColecoes(nomes: Record<string, string>) {
  for (const [sigla, nome] of Object.entries(nomes)) novas.set(sigla, nome);
}
