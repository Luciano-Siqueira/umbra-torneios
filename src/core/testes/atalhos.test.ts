// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { telaDoAtalho, tirarAtalhoDoEndereco } from "../atalhos";

describe("atalhos do ícone do app", () => {
  it("aceita só as telas dos atalhos", () => {
    expect(telaDoAtalho("?tela=decks")).toBe("decks");
    expect(telaDoAtalho("?tela=analytics")).toBe("analytics");
    expect(telaDoAtalho("?tela=usuarios")).toBeNull();
    expect(telaDoAtalho("?tela=qualquer")).toBeNull();
    expect(telaDoAtalho("")).toBeNull();
  });

  it("tira o atalho da barra de endereço e mantém o resto", () => {
    window.history.replaceState(null, "", "/?tela=decks&x=1#topo");
    tirarAtalhoDoEndereco();
    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#topo");
    window.history.replaceState(null, "", "/");
  });
});
