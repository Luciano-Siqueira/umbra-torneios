// ============================================================
// Store Zustand — estado global (torneio ativo + navegacao)
// Persistencia via localStorage automatica em cada mutacao
// ============================================================

import { create } from "zustand";
import type { Torneio, Mesa } from "./types";
import { novoTorneio, novoJogador } from "./types";
import * as storage from "./storage";
import * as sync from "./sync";
import { parearRodada } from "./pareamento";
import { registrarResultado, desfazerResultado } from "./resultados";

export type Tela = "splash" | "torneios" | "torneio" | "analytics" | "usuarios";
export type ModoView = "admin" | "organizador" | "jogador";

interface State {
  tela: Tela;
  modoView: ModoView;
  torneioId: string | null;
  torneios: Torneio[];
  setModoView: (m: ModoView) => void;

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

  addJogador: (nome: string, deck: string, pago: boolean) => void;
  removerJogador: (id: number) => void;
  editarJogador: (id: number, dados: Partial<{ nome: string; deck: string; pago: boolean }>) => void;
  marcarTodosPagos: () => void;

  iniciarRodada: () => void;
  resortearMesas: () => void;
  finalizarMesa: (mesaIdx: number, ordem: number[][], empateTopo: number[]) => void;
  editarMesa: (mesaIdx: number) => void;
  finalizarTorneio: () => void;
  reabrirTorneio: () => void;
}

export const useStore = create<State>((set, get) => ({
  tela: "splash",
  modoView: (localStorage.getItem("mtg.modoView") as ModoView) || "jogador",
  setModoView: (m) => { localStorage.setItem("mtg.modoView", m); set({ modoView: m }); },
  torneioId: null,
  torneios: storage.listarTorneios(),

  irPara: (tela) => set({ tela }),
  abrirTorneio: (id) => set({ torneioId: id, tela: "torneio" }),
  voltarParaLista: () => set({ torneioId: null, tela: "torneios" }),

  recarregar: () => {
    // Migração: renomeia jogadores do "Torneio Teste" se tiverem nomes antigos
    const antigos = ["Jowrel","Zaangas","Camila","Ana","Wendler","Alex Cardoso","Bruno Bora","Loch","Ruaniktos Bullet","Carlos","Theo","Leonardo","Wellington","Thaís","Dezao","Andril","Chaca","Bruno Lapa","Adriano Alves","Bea","Rafa","Oscar","Onirva","Melk","Metusa","Castanhari","Oz","Oyafuso","Luciano Siqueira"];
    const novos = ["Nissa Revane","Jace Beleren","Liliana Vess","Chandra Nalaar","Garruk Wildspeaker","Teferi","Elspeth Tirel","Sorin Markov","Ajani Dourado","Sarkhan Vol","Kaya","Narset","Ral Zarek","Vraska","Gideon Jura","Nicol Bolas","Karn","Kiora","Domri Rade","Tezzeret","Dovin Baan","Davriel Cane","Rowan Kenrith","Will Kenrith","Oko","Vivien Reid","Angrath","Huatli","Saheeli Rai"];
    const mapa = new Map(antigos.map((a, i) => [a, novos[i]]));
    let mudou = false;
    const atualizados = storage.listarTorneios().map((t) => {
      if (t.nome !== "Torneio Teste") return t;
      const tem = t.jogadores.some((j: any) => mapa.has(j.nome));
      if (!tem) return t;
      mudou = true;
      const clone = JSON.parse(JSON.stringify(t));
      clone.jogadores = clone.jogadores.map((j: any) => {
        const novo = mapa.get(j.nome);
        return novo ? { ...j, nome: novo } : j;
      });
      storage.upsertTorneio(clone);
      storage.registrarNome && clone.jogadores.forEach((j: any) => storage.registrarNome(j.nome));
      return clone;
    });
    set({ torneios: mudou ? storage.listarTorneios() : atualizados });
  },

  criarTorneio: (nome, taxa, rodadas, tempoMin, tempoExtra) => {
    const t = novoTorneio(nome, taxa, rodadas, tempoMin, tempoExtra);
    storage.upsertTorneio(t);
    sync.enviarTorneio(t);
    set({ torneios: storage.listarTorneios() });
    return t;
  },

  criarTorneioTeste: () => {
    // Remove torneio teste existente antes (busca por nome exato) para evitar duplicatas
    const atuais = storage.listarTorneios();
    for (const t of atuais) {
      if (t.nome === "Torneio Teste") storage.removerTorneio(t.id);
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
    sync.removerTorneio(id);
    set({ torneios: storage.listarTorneios() });
  },

  importarTorneio: (t) => {
    storage.upsertTorneio(t);
    sync.enviarTorneio(t);
    set({ torneios: storage.listarTorneios() });
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

  addJogador: (nome, deck, pago) => {
    get().atualizarTorneio((t) => {
      const j = novoJogador(t.proximoId, nome, deck, pago);
      t.proximoId += 1;
      t.jogadores.push(j);
      storage.registrarNome(nome);
    });
  },

  removerJogador: (id) => {
    get().atualizarTorneio((t) => {
      t.jogadores = t.jogadores.filter((j) => j.id !== id);
    });
  },

  editarJogador: (id, dados) => {
    get().atualizarTorneio((t) => {
      const j = t.jogadores.find((x) => x.id === id);
      if (!j) return;
      if (dados.nome !== undefined) j.nome = dados.nome;
      if (dados.deck !== undefined) j.deck = dados.deck;
      if (dados.pago !== undefined) j.pago = dados.pago;
    });
  },

  marcarTodosPagos: () => {
    get().atualizarTorneio((t) => {
      for (const j of t.jogadores) j.pago = true;
    });
  },

  iniciarRodada: () => {
    get().atualizarTorneio((t) => {
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
    });
  },

  resortearMesas: () => {
    get().atualizarTorneio((t) => {
      // Só refaz se NINGUÉM ainda finalizou nenhuma mesa da rodada
      if (!t.mesas.length) return;
      if (t.mesas.some((m: Mesa) => m.finalizada)) return;
      t.mesas = parearRodada(t.jogadores, t.rodadaAtual);
    });
  },

  finalizarMesa: (mesaIdx, ordem, empateTopo) => {
    get().atualizarTorneio((t) => {
      const mesa = t.mesas[mesaIdx];
      if (!mesa) return;
      registrarResultado(t, mesa, ordem, empateTopo);
    });
  },

  editarMesa: (mesaIdx) => {
    get().atualizarTorneio((t) => {
      const mesa = t.mesas[mesaIdx];
      if (!mesa) return;
      desfazerResultado(t, mesa);
    });
  },

  finalizarTorneio: () => {
    get().atualizarTorneio((t) => {
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
    });
  },

  reabrirTorneio: () => {
    get().atualizarTorneio((t) => {
      if (!t.finalizado) return;
      t.finalizado = false;
      // Puxa a última rodada arquivada de volta para mesas ativas
      const ult = t.rodadasFinalizadas.pop();
      if (ult) {
        t.rodadaAtual = ult.numero;
        t.mesas = ult.mesas;
        t.dataRodadaAtual = ult.dataInicio;
      }
    });
  },
}));
