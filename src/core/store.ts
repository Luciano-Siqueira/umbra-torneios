// ============================================================
// Store Zustand — estado global (torneio ativo + navegacao)
// Persistencia via localStorage automatica em cada mutacao
// ============================================================

import { create } from "zustand";
import type { Torneio, Mesa } from "./types";
import { novoTorneio, novoJogador, podeAdicionarJogador } from "./types";
import * as storage from "./storage";
import * as sync from "./sync";
import { parearRodada } from "./pareamento";
import { registrarResultado, desfazerResultado } from "./resultados";
import { publicarAoVivo, publicarAoVivoDepois, removerAoVivo, type LinhaAoVivo } from "./aoVivo";
import { alternarPausaTimer, iniciarTimer, pararTimer } from "./timer";

export type Tela = "splash" | "torneios" | "torneio" | "analytics" | "usuarios" | "decks";
export type ModoView = "admin" | "organizador" | "jogador";

interface State {
  tela: Tela;
  modoView: ModoView;
  torneioId: string | null;
  torneios: Torneio[];
  usuarioId: string | null; // grava quem criou cada torneio
  sincronizando: boolean; // buscando os torneios no servidor
  setModoView: (m: ModoView) => void;
  setUsuarioId: (id: string | null) => void;
  setSincronizando: (v: boolean) => void;

  irPara: (tela: Tela) => void;
  abrirTorneio: (id: string) => void;
  voltarParaLista: () => void;

  recarregar: () => void;

  criarTorneio: (
    nome: string, taxa: number, rodadas: number,
    tempoMin: number, tempoExtra: number,
  ) => Torneio;
  criarTorneioTeste: () => Torneio;
  editarTorneio: (id: string, dados: Partial<Torneio>) => void;
  removerTorneio: (id: string) => void;
  importarTorneio: (t: Torneio) => void;

  // Mutacoes no torneio ativo
  torneioAtivo: () => Torneio | null;
  atualizarTorneio: (fn: (t: Torneio) => void) => void;
  // Também avisa quem acompanha; enviarAntes grava o torneio completo primeiro
  atualizarEPublicar: (fn: (t: Torneio) => void, enviarAntes?: boolean) => void;
  atualizarEPublicarDepois: (fn: (t: Torneio) => void) => void;
  aplicarAoVivo: (linha: LinhaAoVivo) => void;

  iniciarTimer: () => void;
  pausarTimer: () => void;
  pararTimer: () => void;
  resetarTimer: () => void;

  addJogador: (nome: string, deck: string, pago: boolean) => void;
  removerJogador: (id: number) => void;
  editarJogador: (id: number, dados: Partial<{ nome: string; deck: string; pago: boolean }>) => void;
  marcarTodosPagos: () => void;
  alternarDrop: (id: number) => void;
  registrarPremio: (id: number, valor: number | null) => void;

  iniciarRodada: () => void;
  resortearMesas: () => void;
  salvarParcialMesa: (mesaIdx: number, ordem: number[][], empateTopo: number[]) => void;
  finalizarMesa: (mesaIdx: number, ordem: number[][], empateTopo: number[]) => void;
  editarMesa: (mesaIdx: number) => void;
  finalizarTorneio: () => void;
  reabrirTorneio: () => void;
  voltarAoInicio: () => void;
}

// Tela aberta, para o F5 voltar ao mesmo lugar (só nesta aba do navegador)
const KEY_NAVEGACAO = "mtg.navegacao";

function lerNavegacao(): { tela: Tela; torneioId: string | null } {
  try {
    const salva = JSON.parse(sessionStorage.getItem(KEY_NAVEGACAO) || "null");
    if (salva?.tela) return { tela: salva.tela, torneioId: salva.torneioId ?? null };
  } catch { /* ignore */ }
  return { tela: "splash", torneioId: null };
}

function salvarNavegacao(tela: Tela, torneioId: string | null) {
  try {
    sessionStorage.setItem(KEY_NAVEGACAO, JSON.stringify({ tela, torneioId }));
  } catch { /* ignore */ }
}

export const useStore = create<State>((set, get) => ({
  ...lerNavegacao(),
  modoView: (localStorage.getItem("mtg.modoView") as ModoView) || "jogador",
  setModoView: (m) => { localStorage.setItem("mtg.modoView", m); set({ modoView: m }); },
  setUsuarioId: (id) => set({ usuarioId: id }),
  setSincronizando: (v) => set({ sincronizando: v }),
  torneios: storage.listarTorneios(),
  usuarioId: null,
  sincronizando: true,

  irPara: (tela) => {
    salvarNavegacao(tela, get().torneioId);
    set({ tela });
  },
  abrirTorneio: (id) => {
    salvarNavegacao("torneio", id);
    set({ torneioId: id, tela: "torneio" });
  },
  voltarParaLista: () => {
    salvarNavegacao("torneios", null);
    set({ torneioId: null, tela: "torneios" });
  },

  recarregar: () => {
    set({ torneios: storage.listarTorneios() });
  },

  criarTorneio: (nome, taxa, rodadas, tempoMin, tempoExtra) => {
    const t = novoTorneio(nome, taxa, rodadas, tempoMin, tempoExtra);
    t.criadoPor = get().usuarioId ?? undefined;
    storage.upsertTorneio(t);
    sync.enviarTorneio(t);
    set({ torneios: storage.listarTorneios() });
    return t;
  },

  criarTorneioTeste: () => {
    // Remove torneio teste existente antes (busca por nome exato) para evitar duplicatas
    const atuais = storage.listarTorneios();
    for (const t of atuais) {
      if (t.nome === "Torneio Teste") get().removerTorneio(t.id);
    }
    const nomes = [
      "Nissa Revane", "Jace Beleren", "Liliana Vess", "Chandra Nalaar",
      "Garruk Wildspeaker", "Teferi", "Elspeth Tirel", "Sorin Markov",
      "Ajani Dourado", "Sarkhan Vol", "Kaya", "Narset", "Ral Zarek",
      "Vraska", "Gideon Jura", "Nicol Bolas", "Karn", "Kiora",
      "Domri Rade", "Tezzeret", "Dovin Baan", "Davriel Cane",
      "Rowan Kenrith", "Will Kenrith", "Oko", "Vivien Reid",
      "Angrath", "Huatli", "Saheeli Rai",
    ];
    const t = novoTorneio("Torneio Teste", 15, 3, 75, 15);
    t.criadoPor = get().usuarioId ?? undefined;
    nomes.forEach((n, i) => {
      const j = novoJogador(i + 1, n, "", i % 2 === 0);
      t.jogadores.push(j);
      storage.registrarNome(n);
    });
    t.proximoId = nomes.length + 1;
    storage.upsertTorneio(t);
    sync.enviarTorneio(t);
    set({ torneios: storage.listarTorneios() });
    return t;
  },

  editarTorneio: (id, dados) => {
    const t = storage.listarTorneios().find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, dados);
    storage.upsertTorneio(t);
    sync.enviarTorneio(t);
    set({ torneios: storage.listarTorneios() });
  },

  removerTorneio: (id) => {
    storage.removerTorneio(id);
    sync.cancelarEnvio(id);
    // Nessa ordem: o RLS confere o dono da linha ao vivo pelo torneio
    removerAoVivo(id).then(() => sync.removerTorneio(id));
    set({ torneios: storage.listarTorneios() });
  },

  importarTorneio: (t) => {
    // Sem criador o RLS recusa: quem importa passa a ser o dono
    t.criadoPor = t.criadoPor ?? get().usuarioId ?? undefined;
    storage.upsertTorneio(t);
    set({ torneios: storage.listarTorneios() });
    sync.enviarImportado(t, get().usuarioId).then((res) => {
      if (!res.torneio) {
        sync.avisarRecusado(t.nome, res.erro ?? "");
      } else if (res.torneio.id !== t.id) {
        storage.removerTorneio(t.id);
        storage.upsertTorneio(res.torneio);
        set({ torneios: storage.listarTorneios() });
      }
    });
  },

  torneioAtivo: () => {
    const id = get().torneioId;
    if (!id) return null;
    return get().torneios.find((t) => t.id === id) || null;
  },

  atualizarTorneio: (fn) => {
    const id = get().torneioId;
    if (!id) return;
    const torneios = get().torneios.map((x) => {
      if (x.id !== id) return x;
      // Deep clone via JSON para garantir novas referências em jogadores/mesas/rodadas
      const clone: Torneio = JSON.parse(JSON.stringify(x));
      fn(clone);
      return clone;
    });
    const atualizado = torneios.find((x) => x.id === id);
    if (atualizado) {
      storage.upsertTorneio(atualizado);
      sync.enviarTorneio(atualizado);
    }
    set({ torneios });
  },

  atualizarEPublicar: (fn, enviarAntes = false) => {
    get().atualizarTorneio(fn);
    const t = get().torneioAtivo();
    if (t) publicarAoVivo(t, enviarAntes);
  },

  atualizarEPublicarDepois: (fn) => {
    get().atualizarTorneio(fn);
    const t = get().torneioAtivo();
    if (t) publicarAoVivoDepois(t);
  },

  // Só atualiza o local: quem recebe não envia nada de volta
  aplicarAoVivo: (linha) => {
    const t = storage.listarTorneios().find((x) => x.id === linha.torneio_id);
    if (!t) return;
    t.rodadaAtual = linha.rodada;
    t.finalizado = linha.finalizado;
    t.mesas = linha.mesas;
    t.timer = linha.timer;
    storage.upsertTorneio(t);
    set({ torneios: storage.listarTorneios() });
  },

  iniciarTimer: () => {
    get().atualizarEPublicar((t) => { t.timer = iniciarTimer(t.timer); }, true);
  },

  pausarTimer: () => {
    get().atualizarEPublicar((t) => { t.timer = alternarPausaTimer(t.timer); }, true);
  },

  pararTimer: () => {
    get().atualizarEPublicar((t) => { t.timer = pararTimer(t.timer); }, true);
  },

  resetarTimer: () => {
    get().atualizarEPublicar((t) => { t.timer = null; }, true);
  },

  addJogador: (nome, deck, pago) => {
    get().atualizarEPublicarDepois((t) => {
      if (!podeAdicionarJogador(t)) return;
      const j = novoJogador(t.proximoId, nome, deck, pago);
      t.proximoId += 1;
      t.jogadores.push(j);
      storage.registrarNome(nome);
    });
  },

  removerJogador: (id) => {
    get().atualizarEPublicarDepois((t) => {
      t.jogadores = t.jogadores.filter((j) => j.id !== id);
    });
  },

  editarJogador: (id, dados) => {
    get().atualizarEPublicarDepois((t) => {
      const j = t.jogadores.find((x) => x.id === id);
      if (!j) return;
      if (dados.nome !== undefined) j.nome = dados.nome;
      if (dados.deck !== undefined) j.deck = dados.deck;
      if (dados.pago !== undefined) j.pago = dados.pago;
    });
  },

  marcarTodosPagos: () => {
    get().atualizarEPublicarDepois((t) => {
      for (const j of t.jogadores) j.pago = true;
    });
  },

  alternarDrop: (id) => {
    get().atualizarEPublicarDepois((t) => {
      const j = t.jogadores.find((x) => x.id === id);
      if (j) j.ativo = !j.ativo;
    });
  },

  registrarPremio: (id, valor) => {
    get().atualizarEPublicarDepois((t) => {
      const j = t.jogadores.find((x) => x.id === id);
      if (j) j.premioPago = valor === null ? null : { valor, em: new Date().toISOString() };
    });
  },

  iniciarRodada: () => {
    get().atualizarEPublicar((t) => {
      if (t.finalizado) return;
      if (t.rodadaAtual >= t.qtdRodadas) return;
      if (t.jogadores.filter((j) => j.ativo).length < 3) return;

      // Arquiva rodada anterior
      if (t.mesas.length) {
        const rodadaAnt = {
          numero: t.rodadaAtual,
          mesas: t.mesas,
          dataInicio: t.dataRodadaAtual || new Date().toISOString(),
          finalizada: t.mesas.every((m: Mesa) => m.finalizada),
        };
        t.rodadasFinalizadas.push(rodadaAnt);
      }

      t.rodadaAtual += 1;
      t.dataRodadaAtual = new Date().toISOString();
      t.mesas = parearRodada(t.jogadores, t.rodadaAtual);
      t.timer = null;
    }, true);
  },

  resortearMesas: () => {
    get().atualizarEPublicar((t) => {
      // Só refaz se NINGUÉM ainda finalizou nenhuma mesa da rodada
      if (!t.mesas.length) return;
      if (t.mesas.some((m: Mesa) => m.finalizada || m.eliminacoes.length > 0 || m.empateTopoIds.length > 0)) return;
      t.mesas = parearRodada(t.jogadores, t.rodadaAtual);
    });
  },

  // Guarda quem já saiu sem finalizar a mesa: pontos só contam ao confirmar o resultado
  salvarParcialMesa: (mesaIdx, ordem, empateTopo) => {
    get().atualizarEPublicar((t) => {
      const mesa = t.mesas[mesaIdx];
      if (!mesa || mesa.finalizada) return;
      mesa.eliminacoes = ordem;
      mesa.empateTopoIds = empateTopo;
    }, true);
  },

  finalizarMesa: (mesaIdx, ordem, empateTopo) => {
    get().atualizarEPublicar((t) => {
      const mesa = t.mesas[mesaIdx];
      if (!mesa) return;
      registrarResultado(t, mesa, ordem, empateTopo);
    }, true);
  },

  editarMesa: (mesaIdx) => {
    get().atualizarEPublicarDepois((t) => {
      const mesa = t.mesas[mesaIdx];
      if (!mesa) return;
      desfazerResultado(t, mesa);
    });
  },

  finalizarTorneio: () => {
    get().atualizarEPublicar((t) => {
      if (t.finalizado) return;
      if (t.mesas.length) {
        t.rodadasFinalizadas.push({
          numero: t.rodadaAtual,
          mesas: t.mesas,
          dataInicio: t.dataRodadaAtual || new Date().toISOString(),
          finalizada: t.mesas.every((m: Mesa) => m.finalizada),
        });
        t.mesas = [];
      }
      t.finalizado = true;
      t.timer = null;
    }, true);
  },

  reabrirTorneio: () => {
    get().atualizarEPublicar((t) => {
      if (!t.finalizado) return;
      t.finalizado = false;
      // Puxa a última rodada arquivada de volta para mesas ativas
      const ult = t.rodadasFinalizadas.pop();
      if (ult) {
        t.rodadaAtual = ult.numero;
        t.mesas = ult.mesas;
        t.dataRodadaAtual = ult.dataInicio;
      }
    }, true);
  },

  // Só na rodada 1: desfaz o início, com os resultados já lançados, para refazer as inscrições
  voltarAoInicio: () => {
    get().atualizarEPublicar((t) => {
      if (t.finalizado || t.rodadaAtual !== 1) return;
      t.rodadaAtual = 0;
      t.mesas = [];
      t.rodadasFinalizadas = [];
      t.dataRodadaAtual = "";
      t.timer = null;
      for (const j of t.jogadores) {
        j.pontos = 0;
        j.adversarios = [];
        j.historicoColocacoes = [];
        j.historicoGames = [];
      }
    }, true);
  },
}));
