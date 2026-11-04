// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CorridaPatinhos, type PatinhosHandle } from "../sorteios/CorridaPatinhos";

// Sem navegador, o desenho é simulado e o relógio da animação é controlado pelo teste
let filaDeQuadros: FrameRequestCallback[] = [];
let agora = 0;

function avancar(quadros: number) {
  for (let i = 0; i < quadros; i++) {
    agora += 40;
    const fila = filaDeQuadros;
    filaDeQuadros = [];
    act(() => fila.forEach((cb) => cb(agora)));
  }
}

const contexto = new Proxy({}, {
  get: (_, nome) => (["createLinearGradient", "createRadialGradient"].includes(String(nome))
    ? () => ({ addColorStop: () => {} })
    : () => {}),
  set: () => true,
});

beforeEach(() => {
  filaDeQuadros = [];
  agora = 1000;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { filaDeQuadros.push(cb); return 1; });
  vi.spyOn(performance, "now").mockImplementation(() => agora);
  HTMLCanvasElement.prototype.getContext = (() => contexto) as never;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const estado = () => document.body.textContent!.match(/CORRENDO|FINALIZADA|PRONTA/)?.[0];
const naPista = () => Number(document.body.textContent!.match(/(\d+) patinhos/)?.[1]);

// Roda até terminar; sem fim em 3.000 quadros (cerca de 2 minutos), a corrida travou
function correrAteOFim() {
  let quadros = 0;
  while (estado() !== "FINALIZADA" && quadros < 3000) {
    avancar(1);
    quadros += 1;
  }
  return quadros;
}

describe("corrida de patinhos", () => {
  it("com 3 jogadores, todas as corridas terminam", () => {
    const ref = createRef<PatinhosHandle>();
    render(<CorridaPatinhos ref={ref} nomes={["Ana", "Bia", "Cris"]} torneioId="t1" estado={new Map()} />);

    for (const restantes of [3, 2, 1]) {
      expect(naPista()).toBe(restantes);
      act(() => ref.current!.iniciar());
      expect(estado()).toBe("CORRENDO");
      const quadros = correrAteOFim();
      expect(estado(), `corrida com ${restantes}: ${quadros} quadros`).toBe("FINALIZADA");
      act(() => ref.current!.proximaCorrida());
    }
    expect(screen.getByText("3/3")).toBeTruthy();
  });

  it("o pato mais lento possível também chega", () => {
    // Velocidade e variação mínimas: o passo fica menor que a folga perto da chegada
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ref = createRef<PatinhosHandle>();
    render(<CorridaPatinhos ref={ref} nomes={["Ana"]} torneioId="t2" estado={new Map()} />);

    act(() => ref.current!.iniciar());
    correrAteOFim();
    expect(estado()).toBe("FINALIZADA");
    expect(document.body.textContent).toContain("Ana");
  });

  it("com vários patos lentos, só um vence por corrida", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ref = createRef<PatinhosHandle>();
    render(<CorridaPatinhos ref={ref} nomes={["Ana", "Bia"]} torneioId="t3" estado={new Map()} />);

    act(() => ref.current!.iniciar());
    correrAteOFim();
    expect(estado()).toBe("FINALIZADA");
    expect(screen.getByText("1/2")).toBeTruthy();
  });
});
