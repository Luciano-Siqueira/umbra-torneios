import { describe, expect, it } from "vitest";
import { ajustarSelecaoPorDrop } from "../sorteios";

describe("drop nos sorteios", () => {
  it("tira quem acabou de dar drop", () => {
    expect(ajustarSelecaoPorDrop(["A", "B", "C"], [], ["B"])).toEqual(["A", "C"]);
  });

  it("mantém quem deu drop e foi adicionado à mão", () => {
    expect(ajustarSelecaoPorDrop(["A", "B"], ["B"], ["B"])).toEqual(["A", "B"]);
  });

  it("não adiciona sozinho quem já estava fora", () => {
    expect(ajustarSelecaoPorDrop(["A"], ["B"], ["B"])).toEqual(["A"]);
  });

  it("devolve quem desfez o drop, sem repetir", () => {
    expect(ajustarSelecaoPorDrop(["A"], ["B"], [])).toEqual(["A", "B"]);
    expect(ajustarSelecaoPorDrop(["A", "B"], ["B"], [])).toEqual(["A", "B"]);
  });
});
