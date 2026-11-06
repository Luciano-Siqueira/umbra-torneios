import { COMBINACOES, nomeDaCombinacao, type CombinacaoDeCores } from "./coresMagic";
import { nomeDaColecao } from "./colecoes";

// Decks de Commander lançados. Cada linha: lançamento|coleção|nome|comandante(s)|cartas|tokens|cores
// Cores: identidade de cor do comandante segundo a Scryfall (WUBRG; vazio = incolor)
const TABELA = `
2009-08-26|TD0|Deathdancer Xira|Xira Arien|100|0|BRG
2009-08-26|TD0|Enchantress Rubinia|Rubinia Soulsinger|100|0|WUG
2011-06-17|CMD|Devour for Power|The Mimeoplasm|100|0|UBG
2011-06-17|CMD|Heavenly Inferno|Kaalia of the Vast|100|0|WBR
2011-06-17|CMD|Counterpunch|Ghave, Guru of Spores|100|0|WBG
2011-06-17|CMD|Mirror Mastery|Riku of Two Reflections|100|0|URG
2011-06-17|CMD|Political Puppets|Zedruu the Greathearted|100|0|WUR
2013-11-01|C13|Nature of the Beast|Marath, Will of the Wild|100|0|WRG
2013-11-01|C13|Evasive Maneuvers|Derevi, Empyrial Tactician|100|0|WUG
2013-11-01|C13|Power Hungry|Prossh, Skyraider of Kher|100|0|BRG
2013-11-01|C13|Mind Seize|Jeleva, Nephalia's Scourge|100|0|UBR
2013-11-01|C13|Eternal Bargain|Oloro, Ageless Ascetic|100|0|WUB
2014-11-07|C14|Guided By Nature|Freyalise, Llanowar's Fury|100|0|G
2014-11-07|C14|Forged In Stone|Nahiri, the Lithomancer|100|0|W
2014-11-07|C14|Built From Scratch|Daretti, Scrap Savant|100|0|R
2014-11-07|C14|Peer Through Time|Teferi, Temporal Archmage|100|0|U
2014-11-07|C14|Sworn To Darkness|Ob Nixilis of the Black Oath|100|0|B
2015-11-13|C15|Seize Control|Mizzix of the Izmagnus|100|0|UR
2015-11-13|C15|Call the Spirits|Daxos the Returned|100|0|WB
2015-11-13|C15|Plunder the Graves|Meren of Clan Nel Toth|100|0|BG
2015-11-13|C15|Swell the Host|Ezuri, Claw of Progress|100|0|UG
2015-11-13|C15|Wade into Battle|Kalemne, Disciple of Iroas|100|0|WR
2016-11-11|C16|Open Hostility|Saskia the Unyielding|100|10|WBRG
2016-11-11|C16|Breed Lethality|Atraxa, Praetors' Voice|100|10|WUBG
2016-11-11|C16|Entropic Uprising|Yidris, Maelstrom Wielder|100|10|UBRG
2016-11-11|C16|Invent Superiority|Breya, Etherium Shaper|100|10|WUBR
2016-11-11|C16|Stalwart Unity|Kynaios and Tiro of Meletis|100|10|WURG
2017-06-09|CMA|Plunder the Graves|Meren of Clan Nel Toth|100|0|BG
2017-06-09|CMA|Heavenly Inferno|Kaalia of the Vast|100|0|WBR
2017-06-09|CMA|Evasive Maneuvers|Derevi, Empyrial Tactician|100|0|WUG
2017-06-09|CMA|Guided by Nature|Freyalise, Llanowar's Fury|100|0|G
2017-08-25|C17|Feline Ferocity|Arahbo, Roar of the World|100|0|WG
2017-08-25|C17|Vampiric Bloodlust|Edgar Markov|100|0|WBR
2017-08-25|C17|Arcane Wizardry|Inalla, Archmage Ritualist|100|0|UBR
2017-08-25|C17|Draconic Domination|The Ur-Dragon|100|0|WUBRG
2018-06-08|CM2|Built From Scratch|Daretti, Scrap Savant|100|0|R
2018-06-08|CM2|Wade into Battle|Kalemne, Disciple of Iroas|100|0|WR
2018-06-08|CM2|Devour for Power|The Mimeoplasm|100|0|UBG
2018-06-08|CM2|Breed Lethality|Atraxa, Praetors' Voice|100|0|WUBG
2018-08-10|C18|Subjective Reality|Aminatou, the Fateshifter|100|0|WUB
2018-08-10|C18|Adaptive Enchantment|Estrid, the Masked|100|0|WUG
2018-08-10|C18|Nature's Vengeance|Lord Windgrace|100|0|BRG
2018-08-10|C18|Exquisite Invention|Saheeli, the Gifted|100|0|UR
2019-08-23|C19|Faceless Menace|Kadena, Slinking Sorcerer|100|0|UBG
2019-08-23|C19|Mystic Intellect|Sevinne, the Chronoclasm|100|0|WUR
2019-08-23|C19|Primal Genesis|Ghired, Conclave Exile|100|0|WRG
2019-08-23|C19|Merciless Rage|Anje Falkenrath|100|0|BR
2020-04-17|C20|Ruthless Regiment|Jirina Kudro|100|10|WBR
2020-04-17|C20|Arcane Maelstrom|Kalamax, the Stormsire|100|10|URG
2020-04-17|C20|Timeless Wisdom|Gavi, Nest Warden|100|10|WUR
2020-04-17|C20|Enhanced Evolution|Otrimi, the Ever-Playful|100|10|UBG
2020-04-17|C20|Symbiotic Swarm|Kathril, Aspect Warper|100|10|WBG
2020-09-25|ZNC|Sneak Attack|Anowon, the Ruin Thief|100|0|UB
2020-09-25|ZNC|Land's Wrath|Obuun, Mul Daya Ancestor|100|0|WRG
2020-11-20|CMR|Arm for Battle|Wyleth, Soul of Steel|100|0|WR
2020-11-20|CMR|Reap the Tides|Aesi, Tyrant of Gyre Strait|100|0|UG
2021-02-05|KHC|Phantom Premonition|Ranar the Ever-Watchful|100|0|WU
2021-02-05|KHC|Elven Empire|Lathril, Blade of the Elves|100|0|BG
2021-04-23|C21|Prismari Performance|Zaffai, Thunder Conductor|100|0|UR
2021-04-23|C21|Silverquill Statement|Breena, the Demagogue|100|0|WB
2021-04-23|C21|Witherbloom Witchcraft|Willowdusk, Essence Seer|100|0|BG
2021-04-23|C21|Lorehold Legacies|Osgir, the Reconstructor|100|0|WR
2021-04-23|C21|Quantum Quandrix|Adrix and Nev, Twincasters|100|0|UG
2021-07-23|AFC|Draconic Rage|Vrondiss, Rage of Ancients|100|0|RG
2021-07-23|AFC|Planar Portal|Prosper, Tome-Bound|100|0|BR
2021-07-23|AFC|Aura of Courage|Galea, Kindler of Hope|100|0|WUG
2021-07-23|AFC|Dungeons of Death|Sefris of the Hidden Ways|100|0|WUB
2021-09-24|MIC|Coven Counters|Leinore, Autumn Sovereign|100|0|WG
2021-09-24|MIC|Undead Unleashed|Wilhelt, the Rotcleaver|100|0|UB
2021-11-19|VOC|Vampiric Bloodline|Strefan, Maurer Progenitor|100|0|BR
2021-11-19|VOC|Spirit Squadron|Millicent, Restless Revenant|100|0|WU
2022-02-18|NEC|Upgrades Unleashed|Chishiro, the Shattered Blade|100|0|RG
2022-02-18|NEC|Buckle Up|Kotori, Pilot Prodigy|100|0|WU
2022-04-22|SLD|Heads I Win, Tails You Lose|Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom, Okaun, Eye of Chaos // Okaun, Eye of Chaos|100|0|UR
2022-04-29|NCC|Bedecked Brokers|Perrie, the Pulverizer|100|0|WUG
2022-04-29|NCC|Maestros Massacre|Anhelo, the Painter|100|0|UBR
2022-04-29|NCC|Obscura Operation|Kamiz, Obscura Oculus|100|0|WUB
2022-04-29|NCC|Riveteers Rampage|Henzie "Toolbox" Torre|100|0|BRG
2022-04-29|NCC|Cabaretti Cacophony|Kitt Kanto, Mayhem Diva|100|0|WRG
2022-06-10|CLB|Mind Flayarrrs|Captain N'ghathrod|100|0|UB
2022-06-10|CLB|Exit from Exile|Faldorn, Dread Wolf Herald|100|0|RG
2022-06-10|CLB|Party Time|Nalia de'Arnise|100|0|WB
2022-06-10|CLB|Draconic Dissent|Firkraag, Cunning Instigator|100|0|UR
2022-09-09|DMC|Legends' Legacy|Dihada, Binder of Wills|100|0|WBR
2022-09-09|DMC|Painbow|Jared Carthalion|100|0|WUBRG
2022-10-07|40K|Tyranid Swarm Collector's Edition|The Swarmlord|100|0|URG
2022-10-07|40K|Necron Dynasties|Szarekh, the Silent King|100|0|B
2022-10-07|40K|Forces of the Imperium Collector's Edition|Inquisitor Greyfax|100|0|WUB
2022-10-07|40K|The Ruinous Powers|Abaddon the Despoiler|100|0|UBR
2022-10-07|40K|Forces of the Imperium|Inquisitor Greyfax|100|0|WUB
2022-10-07|40K|The Ruinous Powers Collector's Edition|Abaddon the Despoiler|100|0|UBR
2022-10-07|40K|Necron Dynasties Collector's Edition|Szarekh, the Silent King|100|0|B
2022-10-07|40K|Tyranid Swarm|The Swarmlord|100|0|URG
2022-11-18|BRC|Mishra's Burnished Banner|Mishra, Eminent One|100|10|UBR
2022-11-18|BRC|Urza's Iron Alliance|Urza, Chief Artificer|100|0|WUB
2022-12-02|SCD|Chaos Incarnate|Kardur, Doomscourge|100|0|BR
2022-12-02|SCD|First Flight|Isperia, Supreme Judge|100|0|WU
2022-12-02|SCD|Draconic Destruction|Atarka, World Render|100|0|RG
2022-12-02|SCD|Token Triumph|Emmara, Soul of the Accord|100|0|WG
2022-12-02|SCD|Grave Danger|Gisa and Geralf|100|0|UB
2023-02-10|ONC|Rebellion Rising|Neyali, Suns' Vanguard|100|0|WR
2023-02-10|ONC|Corrupting Influence|Ixhel, Scion of Atraxa|100|0|WBG
2023-04-21|MOC|Growing Threat|Brimaz, Blight of Oreskos|100|0|WB
2023-04-21|MOC|Divine Convocation|Kasla, the Broken Halo|100|0|WUR
2023-04-21|MOC|Tinker Time|Gimbal, Gremlin Prodigy|100|0|URG
2023-04-21|MOC|Cavalry Charge|Sidar Jabari of Zhalfir|100|0|WUB
2023-04-21|MOC|Call for Backup|Bright-Palm, Soul Awakener|100|0|WRG
2023-05-08|SLD|From Cute to Brute|Esika, God of the Tree // The Prismatic Bridge|100|0|WUBRG
2023-06-23|LTC|Elven Council|Galadriel, Elven-Queen|100|0|UG
2023-06-23|LTC|Food and Fellowship|Frodo, Adventurous Hobbit, Sam, Loyal Attendant|100|0|WBG
2023-06-23|LTC|Riders of Rohan|Éowyn, Shieldmaiden|100|0|WUR
2023-06-23|LTC|The Hosts of Mordor|Sauron, Lord of the Rings|100|0|UBR
2023-08-04|CMM|Sliver Swarm|Sliver Gravemother|100|0|WUBRG
2023-08-04|CMM|Planeswalker Party|Commodore Guff|100|0|WUR
2023-08-04|CMM|Eldrazi Unbound|Zhulodok, Void Gorger|100|0|
2023-08-04|CMM|Enduring Enchantments|Anikthea, Hand of Erebos|100|0|WBG
2023-08-14|SLD|Angels: They're Just Like Us but Cooler and with Wings|Gisela, the Broken Blade // Brisela, Voice of Nightmares|100|2|W
2023-09-08|WOC|Fae Dominion|Tegwyll, Duke of Splendor|100|0|UB
2023-09-08|WOC|Virtue and Valor|Ellivere of the Wild Court|100|0|WG
2023-10-13|WHO|Blast from the Past|The Fourth Doctor, Sarah Jane Smith|100|0|WUG
2023-10-13|WHO|Timey-Wimey|The Tenth Doctor, Rose Tyler|100|0|WUR
2023-10-13|WHO|Masters of Evil|Davros, Dalek Creator|100|0|UBR
2023-10-13|WHO|Paradox Power|The Thirteenth Doctor, Yasmin Khan|100|0|URG
2023-11-17|LCC|Explorers of the Deep|Hakbal of the Surging Soul|100|0|UG
2023-11-17|LCC|Blood Rites|Clavileño, First of the Blessed|100|0|WB
2023-11-17|LCC|Ahoy Mateys|Admiral Brass, Unsinkable|100|0|UBR
2023-11-17|LCC|Veloci-Ramp-Tor|Pantlaza, Sun-Favored|100|0|WRG
2024-01-22|SLD|Raining Cats and Dogs|Rin and Seri, Inseparable // Rin and Seri, Inseparable|100|2|WRG
2024-02-09|MKC|Deep Clue Sea|Morska, Undersea Sleuth|100|0|WUG
2024-02-09|MKC|Blame Game|Nelly Borca, Impulsive Accuser|100|0|WR
2024-02-09|MKC|Revenant Recon|Mirko, Obsessive Theorist|100|0|UB
2024-02-09|MKC|Deadly Disguise|Kaust, Eyes of the Glade|100|0|WRG
2024-03-08|PIP|Hail, Caesar|Caesar, Legion's Emperor|100|0|WBR
2024-03-08|PIP|Scrappy Survivors|Dogmeat, Ever Loyal|100|0|WRG
2024-03-08|PIP|Science!|Dr. Madison Li|100|0|WUR
2024-03-08|PIP|Mutant Menace|The Wise Mothman|100|0|UBG
2024-04-19|OTC|Desert Bloom|Yuma, Proud Protector|100|0|WRG
2024-04-19|OTC|Quick Draw|Stella Lee, Wild Card|100|0|UR
2024-04-19|OTC|Grand Larceny|Gonti, Canny Acquisitor|100|0|UBG
2024-04-19|OTC|Most Wanted|Olivia, Opulent Outlaw|100|0|WBR
2024-06-14|M3C|Tricky Terrain Collector's Edition|Omo, Queen of Vesuva|100|0|UG
2024-06-14|M3C|Creative Energy|Satya, Aetherflux Genius|100|0|WUR
2024-06-14|M3C|Eldrazi Incursion|Ulalek, Fused Atrocity|100|0|WUBRG
2024-06-14|M3C|Graveyard Overdrive Collector's Edition|Disa the Restless|100|0|BRG
2024-06-14|M3C|Eldrazi Incursion Collector's Edition|Ulalek, Fused Atrocity|100|0|WUBRG
2024-06-14|M3C|Creative Energy Collector's Edition|Satya, Aetherflux Genius|100|0|WUR
2024-06-14|M3C|Graveyard Overdrive|Disa the Restless|100|0|BRG
2024-06-14|M3C|Tricky Terrain|Omo, Queen of Vesuva|100|0|UG
2024-08-02|BLC|Squirreled Away|Hazel of the Rootbloom|100|0|BG
2024-08-02|BLC|Family Matters|Zinnia, Valley's Voice|100|0|WUR
2024-08-02|BLC|Peace Offering|Ms. Bumbleflower|100|0|WUG
2024-08-02|BLC|Animated Army|Bello, Bard of the Brambles|100|0|RG
2024-09-27|DSC|Death Toll|Winter, Cynical Opportunist|100|10|BG
2024-09-27|DSC|Miracle Worker|Aminatou, Veil Piercer|100|10|WUB
2024-09-27|DSC|Jump Scare!|Zimone, Mystery Unraveler|100|10|UG
2024-09-27|DSC|Endless Punishment|Valgavoth, Harrower of Souls|100|10|BR
2024-12-04|SLD|20 Ways to Win|Go-Shintai of Life's Origin|100|5|WUBRG
2025-02-14|DRC|Living Energy|Saheeli, Radiant Creator|100|9|URG
2025-02-14|DRC|Eternal Might|Temmet, Naktamun's Will|100|10|WUB
2025-04-11|TDC|Sultai Arisen|Teval, the Balanced Scale|100|0|UBG
2025-04-11|TDC|Jeskai Striker|Shiko and Narset, Unified|100|0|WUR
2025-04-11|TDC|Mardu Surge|Zurgo Stormrender|100|0|WBR
2025-04-11|TDC|Temur Roar|Eshki, Temur's Roar|100|0|URG
2025-04-11|TDC|Abzan Armor|Felothar the Steadfast|100|0|WBG
2025-05-12|SLD|Everyone's Invited!|Morophon, the Boundless|100|4|WUBRG
2025-06-13|FIC|Counter Blitz (FINAL FANTASY X)|Tidus, Yuna's Guardian|100|0|WUG
2025-06-13|FIC|Limit Break (FINAL FANTASY VII)|Cloud, Ex-SOLDIER|100|0|WRG
2025-06-13|FIC|Revival Trance Collector's Edition (FINAL FANTASY VI)|Terra, Herald of Hope|100|0|WBR
2025-06-13|FIC|Limit Break Collector's Edition (FINAL FANTASY VII)|Cloud, Ex-SOLDIER|100|0|WRG
2025-06-13|FIC|Revival Trance (FINAL FANTASY VI)|Terra, Herald of Hope|100|0|WBR
2025-06-13|FIC|Scions & Spellcraft Collector's Edition (FINAL FANTASY XIV)|Y'shtola, Night's Blessed|100|0|WUB
2025-06-13|FIC|Counter Blitz Collector's Edition (FINAL FANTASY X)|Tidus, Yuna's Guardian|100|0|WUG
2025-06-13|FIC|Scions & Spellcraft (FINAL FANTASY XIV)|Y'shtola, Night's Blessed|100|0|WUB
2025-08-01|EOC|World Shaper|Hearthhull, the Worldseed|100|10|BRG
2025-08-01|EOC|Counter Intelligence|Inspirit, Flagship Vessel|100|10|WUR
2026-01-23|ECC|Blight Curse|Auntie Ool, Cursewretch|100|0|BRG
2026-01-23|ECC|Dance of the Elements|Ashling, the Limitless|100|0|WUBRG
2026-03-06|TMC|Turtle Power!|Heroes in a Half Shell|100|0|WUBRG
2026-04-24|SOC|Lorehold Spirit|Quintorius, History Chaser|100|0|WR
2026-04-24|SOC|Prismari Artistry|Rootha, Mastering the Moment|100|0|UR
2026-04-24|SOC|Silverquill Influence|Killian, Decisive Mentor|100|0|WB
2026-04-24|SOC|Quandrix Unlimited|Zimone, Infinite Analyst|100|0|UG
2026-04-24|SOC|Witherbloom Pestilence|Dina, Essence Brewer|100|0|BG
2026-05-18|SLD|Goblin Storm|Zada, Hedron Grinder|100|5|R
2026-06-26|MSC|The Fantastic Four Collector's Edition|Invisible Woman|100|10|WURG
2026-06-26|MSC|Avengers Assemble Collector's Edition|Captain America, Team Leader|100|10|WUR
2026-06-26|MSC|Wakanda Forever Collector's Edition|T'Challa, the Black Panther|100|10|WG
2026-06-26|MSC|Doom Prevails Collector's Edition|Doctor Doom, King of Latveria|100|10|UBR
2026-06-26|MSC|Avengers Assemble|Captain America, Team Leader|100|10|WUR
2026-06-26|MSC|Wakanda Forever|T'Challa, the Black Panther|100|10|WG
2026-06-26|MSC|Doom Prevails|Doctor Doom, King of Latveria|100|10|UBR
2026-06-26|MSC|The Fantastic Four|Invisible Woman|100|10|WURG
2026-08-10|SLD|Hatsune Miku|Trostani, Selesnya's Voice|100|3|WG
2026-09-28|SLD|Odds and Ends|Yennett, Cryptic Sovereign|100|10|WUB
2026-10-02|FDC|Keen Engineering|Sai, Master Thopterist|100|10|U
2026-10-02|FRC|Multiverse Reforged|Jace, Multiverse Architect|100|9|WUBR
2026-10-02|FDC|Wretched Ranks|Ghoulcaller Gisa|100|10|B
2026-10-02|FDC|Calling All Angels|Giada, Font of Hope|100|10|W
2026-10-02|FDC|Tramplesaurus Rex|Ghalta, Primal Hunger|100|10|G
2026-10-02|FDC|Reign of Dragons|Lathliss, Dragon Queen|100|10|R
`;

export interface DeckCommander {
  lancamento: string;
  colecao: string;
  nome: string;
  comandantes: string;
  cartas: number;
  tokens: number;
  cores: string; // WUBRG; vazio = incolor
}

// Sugestão do cadastro: reimpressões do mesmo deck viram uma só, com todas as coleções
export interface SugestaoDeck {
  nome: string;
  comandantes: string;
  cores: string;
  colecoes: string[];
}

const DECKS_BASE: DeckCommander[] = TABELA.trim()
  .split("\n")
  .map((linha) => {
    const [lancamento, colecao, nome, comandantes, cartas, tokens, cores] = linha.trim().split("|");
    return { lancamento, colecao, nome, comandantes, cartas: Number(cartas), tokens: Number(tokens), cores };
  })
  .reverse();

// Sem acentos e sem maiúsculas: "eowyn" encontra "Éowyn"
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Lista em uso: a que acompanha o site mais os lançamentos guardados no banco
export let DECKS: DeckCommander[] = [];
export let ANOS_DECKS: string[] = [];
let textoDeBusca = new Map<DeckCommander, string>();
let decksPorNome = new Map<string, DeckCommander>();

export function aplicarDecksExtras(extras: DeckCommander[]) {
  const unicos = new Map(DECKS_BASE.map((d) => [`${d.colecao}|${d.nome}`, d]));
  for (const d of extras) unicos.set(`${d.colecao}|${d.nome}`, d);
  // Mais recentes primeiro
  const lista = Array.from(unicos.values()).sort((a, b) => b.lancamento.localeCompare(a.lancamento));
  const busca = new Map(
    lista.map((d) => [d, normalizar(`${d.nome} ${d.comandantes} ${d.colecao} ${nomeDaColecao(d.colecao)} ${d.lancamento.slice(0, 4)} ${nomeDaCombinacao(d.cores)}`)])
  );

  DECKS = lista;
  ANOS_DECKS = Array.from(new Set(lista.map((d) => d.lancamento.slice(0, 4))));
  textoDeBusca = busca;
  decksPorNome = new Map(lista.map((d) => [normalizar(d.nome), d]));
}

aplicarDecksExtras([]);

// Os comandantes vêm juntos em um texto, e os nomes também têm vírgula. Estes são os decks com mais de uma carta
const CARTAS_DOS_COMANDANTES: Record<string, string[]> = {
  "Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom, Okaun, Eye of Chaos // Okaun, Eye of Chaos": ["Zndrsplt, Eye of Wisdom", "Okaun, Eye of Chaos"],
  "Frodo, Adventurous Hobbit, Sam, Loyal Attendant": ["Frodo, Adventurous Hobbit", "Sam, Loyal Attendant"],
  "The Fourth Doctor, Sarah Jane Smith": ["The Fourth Doctor", "Sarah Jane Smith"],
  "The Tenth Doctor, Rose Tyler": ["The Tenth Doctor", "Rose Tyler"],
  "The Thirteenth Doctor, Yasmin Khan": ["The Thirteenth Doctor", "Yasmin Khan"],
};

// Nome de cada carta de comandante, pela frente das cartas de duas faces
export function cartasDoComandante(comandantes: string): string[] {
  return CARTAS_DOS_COMANDANTES[comandantes] ?? [comandantes.split(" // ")[0].trim()];
}

// Imagem pela Scryfall, sem precisar consultar antes. Tenta a impressão do próprio deck e, sem ela, qualquer uma
export function imagensDoComandante(deck: Pick<DeckCommander, "comandantes" | "colecao">): { src: string; reserva: string }[] {
  const base = "https://api.scryfall.com/cards/named?format=image&version=normal&exact=";
  return cartasDoComandante(deck.comandantes).map((nome) => ({
    src: `${base}${encodeURIComponent(nome)}&set=${deck.colecao.toLowerCase()}`,
    reserva: `${base}${encodeURIComponent(nome)}`,
  }));
}

// Vem da lista, sem ficar salvo no torneio: um deck próprio não tem comandante conhecido
export function comandanteDoDeck(nome: string): string {
  return decksPorNome.get(normalizar(nome))?.comandantes ?? "";
}

// null: deck fora da lista, com cores desconhecidas. Vazio: comandante incolor
export function coresDoDeck(nome: string): string | null {
  return decksPorNome.get(normalizar(nome))?.cores ?? null;
}

// Todas as palavras precisam aparecer, em qualquer ordem
// cores: combinação exata, como "WUB"; vazio é incolor e null não filtra
export function filtrarDecks(termo: string, ano = "", cores: string | null = null): DeckCommander[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return DECKS.filter(
    (d) =>
      (!ano || d.lancamento.startsWith(ano)) &&
      (cores === null || d.cores === cores) &&
      palavras.every((p) => textoDeBusca.get(d)!.includes(p))
  );
}

// Opções do filtro: só as combinações que existem na lista, com a quantidade de decks
export function opcoesDeCores(): { grupo: string; opcoes: (CombinacaoDeCores & { qtd: number })[] }[] {
  const qtd = new Map<string, number>();
  for (const d of DECKS) qtd.set(d.cores, (qtd.get(d.cores) ?? 0) + 1);
  const grupos: { grupo: string; opcoes: (CombinacaoDeCores & { qtd: number })[] }[] = [];
  for (const c of COMBINACOES) {
    const n = qtd.get(c.cores);
    if (!n) continue;
    const grupo = grupos.find((g) => g.grupo === c.grupo);
    if (grupo) grupo.opcoes.push({ ...c, qtd: n });
    else grupos.push({ grupo: c.grupo, opcoes: [{ ...c, qtd: n }] });
  }
  return grupos;
}

export function sugerirDecks(termo: string, limite = 8): SugestaoDeck[] {
  const inicio = normalizar(termo);
  if (inicio.length < 2) return [];

  const unicos = new Map<string, SugestaoDeck>();
  for (const d of filtrarDecks(termo)) {
    const chave = `${normalizar(d.nome)}|${normalizar(d.comandantes)}`;
    const existente = unicos.get(chave);
    if (existente) existente.colecoes.push(d.colecao);
    else unicos.set(chave, { nome: d.nome, comandantes: d.comandantes, cores: d.cores, colecoes: [d.colecao] });
  }

  // Quem começa com o que foi digitado vem antes; o resto mantém os mais recentes primeiro
  const prioridade = (s: SugestaoDeck) =>
    normalizar(s.nome).startsWith(inicio) ? 0 : normalizar(s.comandantes).startsWith(inicio) ? 1 : 2;
  return Array.from(unicos.values())
    .map((s, i) => ({ s, i }))
    .sort((a, b) => prioridade(a.s) - prioridade(b.s) || a.i - b.i)
    .slice(0, limite)
    .map(({ s }) => s);
}
