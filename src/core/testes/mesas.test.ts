import { beforeEach, describe, expect, it } from "vitest";
import { calcularMetricas } from "../metricas";
import { encontrarMinhaMesa } from "../minhaMesa";
import { useStore } from "../store";

const s = () => useStore.getState();
const torneio = () => s().torneioAtivo()!;
const pontos = (id: number) => torneio().jogadores.find((j) => j.id === id)!.pontos;
const nomeDe = (id: number) => torneio().jogadores.find((j) => j.id === id)!.nome;

function novoTorneio(jogadores: number) {
  const t = s().criarTorneio("Teste", 10, 3, 75, 15);
  s().abrirTorneio(t.id);
  for (let i = 1; i <= jogadores; i++) s().addJogador(`J${i}`, "", true);
  s().iniciarRodada();
  return t;
}

describe("resultado parcial", () => {
  beforeEach(() => { novoTorneio(8); });

  it("guarda quem saiu sem finalizar nem dar pontos", () => {
    const [a] = torneio().mesas[0].jogadoresIds;
    s().salvarParcialMesa(0, [[a]], []);

    const mesa = torneio().mesas[0];
    expect(mesa.eliminacoes).toEqual([[a]]);
    expect(mesa.finalizada).toBe(false);
    expect(torneio().jogadores.every((j) => j.pontos === 0)).toBe(true);
    expect(torneio().jogadores.every((j) => j.historicoColocacoes.length === 0)).toBe(true);
    expect(calcularMetricas([torneio()]).totalPartidas).toBe(0);
  });

  it("impede resortear enquanto houver parcial", () => {
    const [a] = torneio().mesas[0].jogadoresIds;
    const antes = torneio().mesas.map((m) => m.jogadoresIds);
    s().salvarParcialMesa(0, [[a]], []);
    s().resortearMesas();
    expect(torneio().mesas.map((m) => m.jogadoresIds)).toEqual(antes);
  });

  it("empate parcial não conta nas métricas", () => {
    const [a, b, c, d] = torneio().mesas[0].jogadoresIds;
    s().salvarParcialMesa(0, [[a]], [b, c, d]);
    expect(calcularMetricas([torneio()]).empatesPorTempo).toBe(0);
  });

  it("confirmar conta os pontos uma vez, e editar desfaz", () => {
    const [a, b, c, d] = torneio().mesas[0].jogadoresIds;
    s().salvarParcialMesa(0, [[a]], []);
    s().finalizarMesa(0, [[a], [b], [c]], []);

    expect(torneio().mesas[0].finalizada).toBe(true);
    expect(torneio().mesas[0].vencedorId).toBe(d);
    expect(pontos(d)).toBe(3);
    expect(torneio().jogadores.reduce((x, j) => x + j.pontos, 0)).toBe(3);

    s().salvarParcialMesa(0, [], []);
    expect(torneio().mesas[0].eliminacoes).toHaveLength(3);

    s().editarMesa(0);
    expect(pontos(d)).toBe(0);
  });
});

describe("rodada com 5 jogadores", () => {
  it("funciona na mesa de 3 e na mesa de 2", () => {
    novoTorneio(5);
    const [m3, m2] = torneio().mesas;
    expect(m3.jogadoresIds).toHaveLength(3);
    expect(m2.jogadoresIds).toHaveLength(2);

    const [x, y, z] = m3.jogadoresIds;
    s().finalizarMesa(0, [[x], [y]], []);
    expect(torneio().mesas[0].vencedorId).toBe(z);

    const [p, q] = m2.jogadoresIds;
    s().finalizarMesa(1, [[p]], []);
    expect(torneio().mesas[1].vencedorId).toBe(q);
    expect(pontos(z)).toBe(3);
    expect(pontos(q)).toBe(3);
    expect(torneio().jogadores.find((j) => j.id === p)!.historicoColocacoes[0][1]).toBe(2);
  });
});

describe("mesa do jogador", () => {
  it("acha a mesa ignorando maiúsculas e espaços", () => {
    novoTorneio(8);
    const [, b] = torneio().mesas[0].jogadoresIds;
    const nome = ` ${nomeDe(b).toLowerCase()} `;
    const minha = encontrarMinhaMesa([torneio()], [nome]);
    expect(minha?.jogador.id).toBe(b);
    expect(minha?.mesa?.numero).toBe(1);
    expect(minha?.colocacao).toBeNull();
  });

  it("não mostra nada para quem não está no torneio", () => {
    novoTorneio(8);
    expect(encontrarMinhaMesa([torneio()], ["Outra Pessoa"])).toBeNull();
    expect(encontrarMinhaMesa([torneio()], [])).toBeNull();
  });

  it("mostra a colocação de quem saiu e reconhece o vencedor", () => {
    novoTorneio(8);
    const [a, b, c, d] = torneio().mesas[0].jogadoresIds;
    s().salvarParcialMesa(0, [[a]], []);
    expect(encontrarMinhaMesa([torneio()], [nomeDe(a)])?.colocacao).toBe(4);

    s().finalizarMesa(0, [[a], [b], [c]], []);
    const vencedor = encontrarMinhaMesa([torneio()], [nomeDe(d)]);
    expect(vencedor?.venceu).toBe(true);
    expect(vencedor?.colocacao).toBe(1);
  });

  it("some quando o torneio termina", () => {
    novoTorneio(8);
    s().finalizarTorneio();
    expect(encontrarMinhaMesa([torneio()], ["J1"])).toBeNull();
  });
});
