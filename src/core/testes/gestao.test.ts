import { describe, expect, it } from "vitest";
import { ehPublicacaoMinha, publicarAoVivo } from "../aoVivo";
import { calcularGanhos } from "../desempenho";
import { useStore } from "../store";
import { listaMudou } from "../sync";
import { novoTorneio } from "../types";
import { torneioParado } from "../visibilidade";

const s = () => useStore.getState();
const torneio = () => s().torneioAtivo()!;
const jogador = (id: number) => torneio().jogadores.find((j) => j.id === id)!;

function iniciar(jogadores: number) {
  const t = s().criarTorneio("Gestão", 10, 3, 75, 15);
  s().abrirTorneio(t.id);
  for (let i = 1; i <= jogadores; i++) s().addJogador(`J${i}`, "", true);
  s().iniciarRodada();
  return t;
}

const concluirRodada = () => torneio().mesas.forEach((m, i) => {
  s().finalizarMesa(i, m.jogadoresIds.slice(0, -1).map((id) => [id]), []);
});

describe("drop de jogador", () => {
  it("sai das próximas rodadas e continua no ranking", () => {
    iniciar(9);
    const [saiu] = torneio().mesas[0].jogadoresIds;
    s().alternarDrop(saiu);
    expect(torneio().mesas[0].jogadoresIds).toContain(saiu);

    concluirRodada();
    s().iniciarRodada();
    expect(torneio().mesas.flatMap((m) => m.jogadoresIds)).not.toContain(saiu);
    expect(torneio().mesas.flatMap((m) => m.jogadoresIds)).toHaveLength(8);
    expect(torneio().jogadores).toHaveLength(9);
    expect(jogador(saiu).historicoColocacoes).toHaveLength(1);
  });

  it("desfazer devolve o jogador às rodadas", () => {
    iniciar(8);
    const [id] = torneio().mesas[0].jogadoresIds;
    s().alternarDrop(id);
    s().alternarDrop(id);
    concluirRodada();
    s().iniciarRodada();
    expect(torneio().mesas.flatMap((m) => m.jogadoresIds)).toContain(id);
  });
});

describe("rodada 1 ainda aceita mudanças", () => {
  it("adiciona jogador na rodada 1, mas não a partir da 2", () => {
    iniciar(4);
    s().addJogador("Atrasado", "", true);
    expect(torneio().jogadores).toHaveLength(5);

    concluirRodada();
    s().iniciarRodada();
    s().addJogador("Muito atrasado", "", true);
    expect(torneio().jogadores).toHaveLength(5);
  });

  it("voltar ao início apaga mesas e resultados e mantém os inscritos", () => {
    iniciar(4);
    concluirRodada();
    s().voltarAoInicio();
    expect(torneio().rodadaAtual).toBe(0);
    expect(torneio().mesas).toHaveLength(0);
    expect(torneio().jogadores).toHaveLength(4);
    expect(torneio().jogadores.every((j) => j.pontos === 0 && j.historicoColocacoes.length === 0 && j.adversarios.length === 0)).toBe(true);

    s().addJogador("J5", "", true);
    s().iniciarRodada();
    expect(torneio().mesas.flatMap((m) => m.jogadoresIds)).toHaveLength(5);
  });

  it("da rodada 2 em diante não volta ao início", () => {
    iniciar(4);
    concluirRodada();
    s().iniciarRodada();
    s().voltarAoInicio();
    expect(torneio().rodadaAtual).toBe(2);
  });
});

describe("prêmio pago", () => {
  it("registra, desfaz e tem prioridade sobre a estimativa", () => {
    iniciar(4);
    concluirRodada();
    s().finalizarTorneio();
    const campeao = torneio().mesas.length ? 0 : torneio().rodadasFinalizadas[0].mesas[0].vencedorId!;
    const nome = jogador(campeao).nome;
    expect(calcularGanhos([torneio()], [nome]).total).toBe(26);

    s().registrarPremio(campeao, 20);
    expect(jogador(campeao).premioPago?.valor).toBe(20);
    expect(calcularGanhos([torneio()], [nome])).toEqual({ total: 20, premiacoes: 1 });

    s().registrarPremio(campeao, null);
    expect(jogador(campeao).premioPago).toBeNull();
    expect(calcularGanhos([torneio()], [nome]).total).toBe(26);
  });
});

describe("torneio parado", () => {
  const agora = Date.parse("2026-11-10T12:00:00Z");
  const base = () => ({
    ...novoTorneio("X", 10),
    rodadaAtual: 1,
    dataCriacao: "2026-11-01T12:00:00Z",
    dataRodadaAtual: "2026-11-01T13:00:00Z",
  });

  it("marca só o iniciado, sem finalizar e sem atividade há mais de 3 dias", () => {
    expect(torneioParado(base(), agora)).toBe(true);
    expect(torneioParado({ ...base(), finalizado: true }, agora)).toBe(false);
    expect(torneioParado({ ...base(), rodadaAtual: 0 }, agora)).toBe(false);
    expect(torneioParado({ ...base(), dataRodadaAtual: "2026-11-09T12:00:00Z" }, agora)).toBe(false);
  });

  it("o tempo iniciado conta como atividade", () => {
    const timer = { iniciadoEm: "2026-11-09T12:00:00Z", pausadoEm: null, segundosPausados: 0, parado: false };
    expect(torneioParado({ ...base(), timer }, agora)).toBe(false);
  });
});

describe("segundo aparelho", () => {
  it("reconhece o que o próprio aparelho publicou, mas não a publicação de outro", async () => {
    const t = s().criarTorneio("Eco", 10, 3, 75, 15);
    const linha = { torneio_id: t.id, rodada: 0, finalizado: false, mesas: [], timer: null };
    await publicarAoVivo(t);
    expect(ehPublicacaoMinha({ ...linha, atualizado_em: new Date(Date.now() - 60_000).toISOString() })).toBe(true);
    expect(ehPublicacaoMinha({ ...linha, atualizado_em: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(ehPublicacaoMinha({ ...linha, torneio_id: "outro", atualizado_em: new Date().toISOString() })).toBe(false);
  });

  it("publica com a versão mais nova do torneio, mesmo vinda de antes", async () => {
    const pedidos: any[] = [];
    (globalThis as any).__rede = (url: string, init: RequestInit) => {
      if (url.includes("torneio_ao_vivo") && init.method === "POST") pedidos.push(JSON.parse(init.body as string));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    iniciar(4);
    const antiga = torneio();
    s().iniciarTimer();
    await publicarAoVivo(antiga);
    expect(pedidos[pedidos.length - 1].timer).toBeTruthy();
    delete (globalThis as any).__rede;
  });
});

describe("lista", () => {
  const responder = (linhas: unknown[]) => {
    (globalThis as any).__rede = () =>
      new Response(JSON.stringify(linhas), { status: 200, headers: { "content-type": "application/json" } });
  };
  const espera = () => new Promise((r) => setTimeout(r, 1000));

  it("percebe torneio novo, nova rodada e reabertura", async () => {
    localStorage.removeItem("mtg.torneios.v1");
    responder([]);
    const t = s().criarTorneio("Lista", 10, 3, 75, 15);
    await espera();
    const igual = { id: t.id, rodada: "0", finalizado: "false" };

    responder([igual]);
    expect(await listaMudou()).toBe(false);
    responder([igual, { id: "novo", rodada: "0", finalizado: "false" }]);
    expect(await listaMudou()).toBe(true);
    responder([{ ...igual, rodada: "1" }]);
    expect(await listaMudou()).toBe(true);
    responder([{ ...igual, finalizado: "true" }]);
    expect(await listaMudou()).toBe(true);
    delete (globalThis as any).__rede;
  });
});
