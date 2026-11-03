import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store";
import * as sync from "../sync";
import type { AvisoEnvio } from "../sync";

type Modo = "ok" | "sem-internet" | "recusa";
let modo: Modo = "ok";
let pedidos: { url: string; metodo: string; corpo: any }[] = [];
let avisos: AvisoEnvio[] = [];

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

(globalThis as any).__rede = (url: string, init: RequestInit) => {
  if (modo === "sem-internet") throw new TypeError("Failed to fetch");
  const metodo = init.method ?? "GET";
  const emTorneios = url.includes("/torneios");
  if (modo === "recusa" && metodo === "POST" && emTorneios) {
    return json({ code: "42501", message: "violates row-level security", details: null, hint: null }, 403);
  }
  pedidos.push({ url, metodo, corpo: init.body ? JSON.parse(init.body as string) : null });
  if (metodo === "GET" && emTorneios) {
    return json([{ id: "x", dados: { id: "x", nome: "Do servidor", dataCriacao: "2020" } }]);
  }
  return json([]);
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const s = () => useStore.getState();
const local = () => JSON.parse(localStorage.getItem("mtg.torneios.v1") || "[]");
const envios = () => pedidos.filter((p) => p.metodo === "POST" && p.url.includes("/torneios"));
const aoVivo = () => pedidos.filter((p) => p.metodo === "POST" && p.url.includes("torneio_ao_vivo"));
const ultimo = <T,>(lista: T[]) => lista[lista.length - 1];

describe("envio ao servidor", () => {
  beforeEach(async () => {
    modo = "ok";
    await esperar(0);
    pedidos = [];
    avisos = [];
    sync.definirAvisoEnvio((a) => avisos.push(a));
    const t = s().criarTorneio("Teste", 10, 3, 75, 15);
    s().abrirTorneio(t.id);
    await esperar(900);
    pedidos = [];
  });

  it("guarda a alteração sem internet e envia a mais nova ao voltar", async () => {
    const id = s().torneioId!;
    modo = "sem-internet";
    s().addJogador("Kaya", "", true);
    await esperar(1000);
    expect(avisos.filter((a) => a.tipo === "sem-conexao")).toHaveLength(1);
    expect(sync.temEnviosPendentes()).toBe(true);
    expect(JSON.parse(localStorage.getItem("mtg.envios.pendentes")!)).toContain(id);

    s().addJogador("Oko", "", true);
    await esperar(1000);
    expect(avisos.filter((a) => a.tipo === "sem-conexao")).toHaveLength(1);

    modo = "ok";
    await sync.puxarDoServidor();
    expect(local().find((t: any) => t.id === id).jogadores).toHaveLength(2);

    sync.retomarEnvios();
    await esperar(100);
    expect(ultimo(envios()).corpo.dados.jogadores).toHaveLength(2);
    expect(avisos.some((a) => a.tipo === "recuperado")).toBe(true);
    expect(sync.temEnviosPendentes()).toBe(false);

    await sync.puxarDoServidor();
    expect(local().map((t: any) => t.id)).toEqual(["x"]);
    s().recarregar();
  });

  it("reenvia sozinho depois de 5 segundos", async () => {
    modo = "sem-internet";
    s().addJogador("Narset", "", true);
    await esperar(1000);
    modo = "ok";
    await esperar(5300);
    expect(envios()).toHaveLength(1);
    expect(sync.temEnviosPendentes()).toBe(false);
  });

  it("recusa do servidor avisa o motivo e não repete", async () => {
    modo = "recusa";
    s().addJogador("Karn", "", true);
    await esperar(1000);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ tipo: "recusado", motivo: "violates row-level security" });
    expect(sync.temEnviosPendentes()).toBe(false);
  });

  it("remover o Torneio Teste antigo também apaga no servidor", async () => {
    const antigo = s().criarTorneioTeste();
    await esperar(900);
    pedidos = [];
    const novo = s().criarTorneioTeste();
    await esperar(50);
    const apagados = pedidos.filter((p) => p.metodo === "DELETE" && p.url.includes("/torneios"));
    expect(apagados.some((p) => p.url.includes(antigo.id))).toBe(true);
    expect(local().filter((t: any) => t.nome === "Torneio Teste").map((t: any) => t.id)).toEqual([novo.id]);
    await esperar(900);
  });
});

describe("donos e exclusão", () => {
  beforeEach(() => {
    modo = "ok";
    s().setUsuarioId("u1");
  });

  it("torneio criado ou importado sem dono fica com quem está logado", () => {
    expect(s().criarTorneio("Novo", 10, 3, 75, 15).criadoPor).toBe("u1");

    const importado = { ...s().criarTorneio("Base", 10, 3, 75, 15), id: "imp", criadoPor: undefined };
    s().importarTorneio(importado);
    expect(local().find((t: any) => t.id === "imp").criadoPor).toBe("u1");
  });

  it("importar mantém o dono que já existe", () => {
    const importado = { ...s().criarTorneio("Base", 10, 3, 75, 15), id: "imp2", criadoPor: "u2" };
    s().importarTorneio(importado);
    expect(local().find((t: any) => t.id === "imp2").criadoPor).toBe("u2");
  });

  it("excluir apaga a linha ao vivo antes do torneio e cancela o envio", async () => {
    await esperar(900);
    pedidos = [];
    const t = s().criarTorneio("Apagar", 10, 3, 75, 15);
    s().removerTorneio(t.id);
    await esperar(1000);
    const apagados = pedidos.filter((p) => p.metodo === "DELETE").map((p) => p.url.includes("torneio_ao_vivo"));
    expect(apagados).toEqual([true, false]);
    expect(envios().filter((p) => p.corpo.id === t.id)).toHaveLength(0);
  });
});

describe("ao vivo", () => {
  beforeEach(async () => {
    modo = "ok";
    const t = s().criarTorneio("Ao vivo", 10, 3, 75, 15);
    s().abrirTorneio(t.id);
    for (let i = 1; i <= 8; i++) s().addJogador(`J${i}`, "", true);
    await esperar(900);
    pedidos = [];
  });

  it("nova rodada grava o torneio antes de avisar e não envia o torneio inteiro", async () => {
    s().iniciarRodada();
    await esperar(50);
    const ordem = pedidos.filter((p) => p.metodo === "POST").map((p) => p.url.includes("torneio_ao_vivo"));
    expect(ordem).toEqual([false, true]);
    const linha = aoVivo()[0].corpo;
    expect(linha.rodada).toBe(1);
    expect(linha.mesas).toHaveLength(2);
    expect(linha).not.toHaveProperty("dados");
    expect(linha).not.toHaveProperty("jogadores");
  });

  it("controles do timer gravam e publicam, e nova rodada zera", async () => {
    s().iniciarRodada();
    await esperar(50);
    pedidos = [];

    s().iniciarTimer();
    await esperar(20);
    expect(s().torneioAtivo()!.timer).toBeTruthy();
    expect(ultimo(aoVivo()).corpo.timer).toBeTruthy();

    s().pausarTimer();
    expect(s().torneioAtivo()!.timer!.pausadoEm).toBeTruthy();
    s().pausarTimer();
    expect(s().torneioAtivo()!.timer!.pausadoEm).toBeNull();
    s().pararTimer();
    expect(s().torneioAtivo()!.timer!.parado).toBe(true);
    s().resetarTimer();
    expect(s().torneioAtivo()!.timer).toBeNull();

    s().iniciarTimer();
    s().torneioAtivo()!.mesas.forEach((m, i) => {
      s().finalizarMesa(i, m.jogadoresIds.slice(0, -1).map((id) => [id]), []);
    });
    s().iniciarRodada();
    expect(s().torneioAtivo()!.timer).toBeNull();
    expect(s().torneioAtivo()!.rodadaAtual).toBe(2);
  });

  it("receber ao vivo atualiza o local e não envia nada de volta", async () => {
    s().iniciarRodada();
    await esperar(900);
    const t = s().torneioAtivo()!;
    const mesas = JSON.parse(JSON.stringify(t.mesas));
    mesas[0].eliminacoes = [[mesas[0].jogadoresIds[0]]];
    pedidos = [];

    s().aplicarAoVivo({ torneio_id: t.id, rodada: 1, finalizado: false, timer: null, mesas });
    await esperar(900);

    expect(s().torneioAtivo()!.mesas[0].eliminacoes).toHaveLength(1);
    expect(pedidos.filter((p) => p.metodo === "POST")).toHaveLength(0);
  });
});
