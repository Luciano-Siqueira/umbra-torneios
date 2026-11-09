import { describe, expect, it } from "vitest";
import { avisoDoMomento } from "../../components/AvisosDoTempo";
import { novoTorneio, type Torneio } from "../types";

// Rodada de 60 + 15 minutos, iniciada "minutosAtras" minutos antes de agora
const AGORA = Date.parse("2026-11-09T20:00:00Z");
function rodada(minutosAtras: number, extra: Partial<Torneio["timer"] & object> = {}): Torneio {
  const t = novoTorneio("Liga", 10, 3, 60, 15);
  t.rodadaAtual = 1;
  t.timer = { iniciadoEm: new Date(AGORA - minutosAtras * 60_000).toISOString(), pausadoEm: null, segundosPausados: 0, parado: false, ...extra };
  return t;
}

describe("avisos do tempo", () => {
  it("avisa faltam 10 minutos só perto da hora", () => {
    expect(avisoDoMomento(rodada(64), AGORA)).toBeNull(); // faltam 11 min
    expect(avisoDoMomento(rodada(65), AGORA)).toBe("faltam10"); // faltam 10
    expect(avisoDoMomento(rodada(66.5), AGORA)).toBe("faltam10"); // faltam 8,5
    expect(avisoDoMomento(rodada(68), AGORA)).toBeNull(); // faltam 7: passou da hora, não avisa atrasado
  });

  it("avisa tempo esgotado no fim, sem atraso", () => {
    expect(avisoDoMomento(rodada(75), AGORA)).toBe("esgotado");
    expect(avisoDoMomento(rodada(76), AGORA)).toBe("esgotado");
    expect(avisoDoMomento(rodada(80), AGORA)).toBeNull();
  });

  it("não avisa com o tempo pausado, parado, sem tempo ou com o torneio finalizado", () => {
    expect(avisoDoMomento(rodada(65, { pausadoEm: new Date(AGORA).toISOString() }), AGORA)).toBeNull();
    expect(avisoDoMomento(rodada(75, { parado: true }), AGORA)).toBeNull();
    const semTempo = rodada(65);
    semTempo.timer = null;
    expect(avisoDoMomento(semTempo, AGORA)).toBeNull();
    expect(avisoDoMomento({ ...rodada(75), finalizado: true }, AGORA)).toBeNull();
  });
});
