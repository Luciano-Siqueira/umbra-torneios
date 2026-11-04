import { describe, expect, it } from "vitest";
import { contar, formatarNumero, formatarPercentual, formatarReais } from "../formato";

// O espaço do pt-BR pode variar conforme o ambiente; os testes comparam só com espaço comum
const limpo = (texto: string) => texto.replace(/\s/g, " ");

describe("formato brasileiro", () => {
  it("valores em reais usam vírgula e ponto de milhar", () => {
    expect(limpo(formatarReais(25))).toBe("R$ 25,00");
    expect(limpo(formatarReais(1234.5))).toBe("R$ 1.234,50");
    expect(limpo(formatarReais(0))).toBe("R$ 0,00");
  });

  it("percentuais recebem a fração e usam vírgula", () => {
    expect(formatarPercentual(1)).toBe("100,0%");
    expect(formatarPercentual(0.333)).toBe("33,3%");
    expect(formatarPercentual(0.5, 0)).toBe("50%");
  });

  it("números respeitam as casas pedidas", () => {
    expect(formatarNumero(6.5, 1)).toBe("6,5");
    expect(formatarNumero(6.5)).toBe("7");
  });

  it("conta no singular e no plural", () => {
    expect(contar(1, "jogador", "jogadores")).toBe("1 jogador");
    expect(contar(2, "jogador", "jogadores")).toBe("2 jogadores");
    expect(contar(0, "pago")).toBe("0 pagos");
    expect(contar(1, "pago")).toBe("1 pago");
  });
});
