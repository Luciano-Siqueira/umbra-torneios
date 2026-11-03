import { describe, expect, it } from "vitest";
import { alternarPausaTimer, iniciarTimer, pararTimer, segundosRestantes } from "../timer";

const base = Date.parse("2026-11-03T20:00:00Z");
const seg = (s: number) => base + s * 1000;
const TOTAL = 90 * 60;

describe("timer da rodada", () => {
  it("mostra o tempo cheio antes de iniciar", () => {
    expect(segundosRestantes(null, TOTAL, base)).toBe(TOTAL);
  });

  it("conta, pausa, retoma e para", () => {
    let t = iniciarTimer(null, base);
    expect(segundosRestantes(t, TOTAL, seg(60))).toBe(TOTAL - 60);

    t = alternarPausaTimer(t, seg(60))!;
    expect(segundosRestantes(t, TOTAL, seg(600))).toBe(TOTAL - 60);

    t = iniciarTimer(t, seg(600));
    expect(segundosRestantes(t, TOTAL, seg(660))).toBe(TOTAL - 120);

    t = pararTimer(t, seg(660))!;
    expect(t.parado).toBe(true);
    expect(segundosRestantes(t, TOTAL, seg(1000))).toBe(TOTAL - 120);

    t = iniciarTimer(t, seg(1000));
    expect(t.parado).toBe(false);
    expect(segundosRestantes(t, TOTAL, seg(1000))).toBe(TOTAL - 120);
  });

  it("mantém o tempo depois de salvar e recarregar", () => {
    const t = iniciarTimer(null, base);
    expect(segundosRestantes(JSON.parse(JSON.stringify(t)), TOTAL, seg(100))).toBe(TOTAL - 100);
  });

  it("fica sempre entre zero e o total", () => {
    const t = iniciarTimer(null, base);
    expect(segundosRestantes(t, TOTAL, seg(99999))).toBe(0);
    expect(segundosRestantes(t, TOTAL, base - 5000)).toBe(TOTAL);
  });
});
