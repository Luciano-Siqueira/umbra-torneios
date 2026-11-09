import { describe, expect, it } from "vitest";
import { sair } from "../auth";

describe("sair da conta", () => {
  it("apaga do aparelho os torneios, os nomes e o perfil (LGPD)", async () => {
    const pessoais = [
      "mtg.torneios.v1", "mtg.jogadores.v1", "mtg.envios.pendentes", "mtg.torneios.versoes",
      "mtg.torneios.dono", "mtg.modoView", "mtg.perfil.v1",
    ];
    for (const chave of pessoais) localStorage.setItem(chave, "x");
    localStorage.setItem("mtg.decks.colecoes", "fica"); // lista pública de cartas: não é dado pessoal

    await sair();

    for (const chave of pessoais) expect(localStorage.getItem(chave)).toBeNull();
    expect(localStorage.getItem("mtg.decks.colecoes")).toBe("fica");
  });
});
