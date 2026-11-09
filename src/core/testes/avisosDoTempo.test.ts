import { describe, expect, it } from "vitest";
import { avisoDoMomento } from "../../components/AvisosDoTempo";
import { novoTorneio, type Torneio } from "../types";

// Rodada de 60 + 15 minutos, iniciada "minutosAtras" minutos antes de agora
const AGORA = Date.parse("2026-11-09T20:00:00Z");
function rodada(minutosAtras: number, extra: Partial<Torneio["timer"] & object> = {}, extraMin = 15): Torneio {
  const t = novoTorneio("Liga", 10, 3, 60, extraMin);
  t.rodadaAtual = 1;
  t.timer = { iniciadoEm: new Date(AGORA - minutosAtras * 60_000).toISOString(), pausadoEm: null, segundosPausados: 0, parado: false, ...extra };
  return t;
}

describe("avisos do tempo", () => {
  it("avisa a entrada no tempo extra só perto da hora", () => {
    expect(avisoDoMomento(rodada(59), AGORA)).toBeNull(); // ainda no tempo normal
    expect(avisoDoMomento(rodada(60), AGORA)).toBe("extra"); // acabou o tempo normal
    expect(avisoDoMomento(rodada(61.5), AGORA)).toBe("extra");
    expect(avisoDoMomento(rodada(63), AGORA)).toBeNull(); // passou da hora, não avisa atrasado
  });

  it("avisa o último turno quando o tempo extra acaba, sem atraso", () => {
    expect(avisoDoMomento(rodada(74), AGORA)).toBeNull();
    expect(avisoDoMomento(rodada(75), AGORA)).toBe("ultimo_turno");
    expect(avisoDoMomento(rodada(76), AGORA)).toBe("ultimo_turno");
    expect(avisoDoMomento(rodada(80), AGORA)).toBeNull();
  });

  it("sem tempo extra, só avisa o último turno", () => {
    expect(avisoDoMomento(rodada(59.5, {}, 0), AGORA)).toBeNull();
    expect(avisoDoMomento(rodada(60, {}, 0), AGORA)).toBe("ultimo_turno");
  });

  it("não avisa com o tempo pausado, parado, sem tempo ou com o torneio finalizado", () => {
    expect(avisoDoMomento(rodada(60, { pausadoEm: new Date(AGORA).toISOString() }), AGORA)).toBeNull();
    expect(avisoDoMomento(rodada(75, { parado: true }), AGORA)).toBeNull();
    const semTempo = rodada(60);
    semTempo.timer = null;
    expect(avisoDoMomento(semTempo, AGORA)).toBeNull();
    expect(avisoDoMomento({ ...rodada(75), finalizado: true }, AGORA)).toBeNull();
  });
});
