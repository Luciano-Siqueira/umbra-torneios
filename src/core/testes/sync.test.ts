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

// Servidor falso: guarda cada torneio e aplica o filtro de versão como o banco
const servidor = new Map<string, any>();

(globalThis as any).__rede = (url: string, init: RequestInit) => {
  if (modo === "sem-internet") throw new TypeError("Failed to fetch");
  const metodo = init.method ?? "GET";
  const emTorneios = url.includes("/torneios");
  const escrita = metodo === "POST" || metodo === "PATCH";
  if (modo === "recusa" && escrita && emTorneios) {
    return json({ code: "42501", message: "violates row-level security", details: null, hint: null }, 403);
  }
  const corpo = init.body ? JSON.parse(init.body as string) : null;
  pedidos.push({ url, metodo, corpo });
  if (!emTorneios) return json([]);

  const filtros = new URL(url).searchParams;
  const id = filtros.get("id")?.replace("eq.", "");
  const linhaDe = (d: any) => ({ id: d.id, dados: d, versao: d.versao === undefined ? null : String(d.versao) });

  if (metodo === "GET") {
    if (!id) return json([{ id: "x", dados: { id: "x", nome: "Do servidor", dataCriacao: "2020" } }]);
    return json(servidor.has(id) ? [linhaDe(servidor.get(id))] : []);
  }
  if (metodo === "POST") {
    servidor.set(corpo.id, corpo.dados);
    return json([]);
  }
  if (metodo === "PATCH") {
    const atual = servidor.get(id!);
    const filtro = filtros.get("dados->>versao");
    const bate = atual && (filtro === "is.null" ? atual.versao === undefined : filtro === `eq.${atual.versao}`);
    if (!bate) return json([]);
    servidor.set(id!, corpo.dados);
    return json([{ id }]);
  }
  servidor.delete(id!);
  return json([]);
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const s = () => useStore.getState();
const local = () => JSON.parse(localStorage.getItem("mtg.torneios.v1") || "[]");
const envios = () => pedidos.filter((p) => (p.metodo === "POST" || p.metodo === "PATCH") && p.url.includes("/torneios"));
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
    await esperar(1200);
    pedidos = [];
  });

  it("nova rodada grava o torneio antes de avisar e não envia o torneio inteiro", async () => {
    s().iniciarRodada();
    await esperar(50);
    const ordem = pedidos.filter((p) => p.metodo !== "GET").map((p) => p.url.includes("torneio_ao_vivo"));
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
    expect(pedidos.filter((p) => p.metodo !== "GET")).toHaveLength(0);
  });
});

describe("importar", () => {
  const recusaDeOutro = (rede: any) => (url: string, init: RequestInit) => {
    if (init.method === "POST" && url.includes("/torneios") && JSON.parse(init.body as string).dados.criadoPor === "u2") {
      return json({ code: "42501", message: "violates row-level security", details: null, hint: null }, 403);
    }
    return rede(url, init);
  };

  it("torneio de outra conta vira cópia de quem importou, sem travar os outros", async () => {
    modo = "ok";
    s().setUsuarioId("u1");
    const rede = (globalThis as any).__rede;
    (globalThis as any).__rede = recusaDeOutro(rede);
    const base = { ...s().criarTorneio("Base", 10, 3, 75, 15), nome: "Backup" };
    const meu = await sync.enviarImportado({ ...base, id: "meu", criadoPor: "u1" }, "u1");
    const semDono = await sync.enviarImportado({ ...base, id: "sem", criadoPor: undefined }, "u1");
    const deOutro = await sync.enviarImportado({ ...base, id: "outro", criadoPor: "u2" }, "u1");
    (globalThis as any).__rede = rede;

    expect(meu.torneio?.id).toBe("meu");
    expect(semDono.torneio?.criadoPor).toBe("u1");
    expect(deOutro.torneio?.id).toMatch(/^outro_imp_/);
    expect(deOutro.torneio?.criadoPor).toBe("u1");
    expect(servidor.has("outro")).toBe(false);
    expect(servidor.get(deOutro.torneio!.id).nome).toBe("Backup");
    await esperar(900);
  });

  it("sem internet fica pendente e não vira cópia", async () => {
    s().setUsuarioId("u1");
    const base = { ...s().criarTorneio("Base 2", 10, 3, 75, 15) };
    await esperar(900);
    modo = "sem-internet";
    const res = await sync.enviarImportado({ ...base, id: "off", criadoPor: "u1" }, "u1");
    expect(res.torneio?.id).toBe("off");
    expect(sync.temEnviosPendentes()).toBe(true);
    modo = "ok";
    sync.retomarEnvios();
    await esperar(300);
    expect(servidor.has("off")).toBe(true);
    expect(sync.temEnviosPendentes()).toBe(false);
  });
});

describe("conflito entre aparelhos", () => {
  // Outro aparelho grava direto no servidor, subindo a versão
  const outroAparelhoGrava = (id: string, nome: string) => {
    const atual = servidor.get(id);
    servidor.set(id, { ...atual, nome, versao: (atual.versao ?? 0) + 1 });
  };

  async function preparar() {
    modo = "ok";
    avisos = [];
    sync.definirAvisoEnvio((a) => avisos.push(a));
    const t = s().criarTorneio("Conflito", 10, 3, 75, 15);
    s().abrirTorneio(t.id);
    await esperar(900);
    s().addJogador("Kaya", "", true);
    await esperar(1300);
    pedidos = [];
    avisos = [];
    return t.id;
  }

  it("gravações em sequência no mesmo aparelho não dão conflito", async () => {
    const id = await preparar();
    s().addJogador("Oko", "", true);
    await esperar(1300);
    s().iniciarRodada();
    s().pausarTimer();
    s().iniciarTimer();
    s().pausarTimer();
    await esperar(200);
    expect(avisos.filter((a) => a.tipo === "conflito")).toHaveLength(0);
    expect(servidor.get(id).jogadores).toHaveLength(2);
    expect(servidor.get(id).versao).toBeGreaterThan(2);
    expect(sync.temEnviosPendentes()).toBe(false);
  });

  it("avisa uma vez, não sobrescreve e não publica ao vivo", async () => {
    const id = await preparar();
    outroAparelhoGrava(id, "Mudou no outro");

    s().addJogador("Oko", "", true);
    await esperar(1300);
    s().addJogador("Karn", "", true);
    await esperar(1300);

    expect(avisos.filter((a) => a.tipo === "conflito")).toHaveLength(1);
    expect(servidor.get(id).nome).toBe("Mudou no outro");
    expect(servidor.get(id).jogadores).toHaveLength(1);
    expect(sync.temConflito(id)).toBe(true);
    expect(sync.temEnviosPendentes()).toBe(true);
    expect(aoVivo()).toHaveLength(0);

    await sync.resolverConflito(id, false);
  });

  it("manter a deste aparelho grava por cima", async () => {
    const id = await preparar();
    outroAparelhoGrava(id, "Mudou no outro");
    s().addJogador("Oko", "", true);
    await esperar(1300);

    await sync.resolverConflito(id, true);
    expect(servidor.get(id).nome).toBe("Conflito");
    expect(servidor.get(id).jogadores).toHaveLength(2);
    expect(sync.temConflito(id)).toBe(false);
    expect(sync.temEnviosPendentes()).toBe(false);
  });

  it("usar a do outro aparelho descarta a local", async () => {
    const id = await preparar();
    outroAparelhoGrava(id, "Mudou no outro");
    s().addJogador("Oko", "", true);
    await esperar(1300);

    await sync.resolverConflito(id, false);
    s().recarregar();
    expect(local().find((t: any) => t.id === id).nome).toBe("Mudou no outro");
    expect(local().find((t: any) => t.id === id).jogadores).toHaveLength(1);
    expect(sync.temEnviosPendentes()).toBe(false);

    // A próxima alteração já parte da versão certa
    s().addJogador("Karn", "", true);
    await esperar(1300);
    expect(avisos.filter((a) => a.tipo === "conflito")).toHaveLength(1);
    expect(servidor.get(id).nome).toBe("Mudou no outro");
    expect(servidor.get(id).jogadores).toHaveLength(2);
  });

  it("sem conflito, atualização recusada pelo RLS vira erro", async () => {
    const id = await preparar();
    const rede = (globalThis as any).__rede;
    (globalThis as any).__rede = (url: string, init: RequestInit) =>
      init.method === "PATCH" ? json([]) : rede(url, init);
    s().addJogador("Oko", "", true);
    await esperar(1300);
    (globalThis as any).__rede = rede;
    expect(avisos.some((a) => a.tipo === "recusado")).toBe(true);
    expect(avisos.some((a) => a.tipo === "conflito")).toBe(false);
    expect(servidor.get(id).jogadores).toHaveLength(1);
  });

  it("torneio antigo sem versão continua gravando", async () => {
    modo = "ok";
    const t = s().criarTorneio("Antigo", 10, 3, 75, 15);
    s().abrirTorneio(t.id);
    await esperar(900);
    const { versao: _v, ...semVersao } = servidor.get(t.id);
    servidor.set(t.id, semVersao);
    await sync.puxarTorneio(t.id);
    s().recarregar();
    s().addJogador("Oko", "", true);
    await esperar(1300);
    expect(servidor.get(t.id).jogadores).toHaveLength(1);
    expect(servidor.get(t.id).versao).toBe(1);
  });
});
