// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { formatarPreco, proAtivo } from "../pro";
import { abertoPeloAppDaLoja, podeVenderNoApp, registrarOrigemDoApp } from "../plataforma";
import { avisoLigadoNoTorneio } from "../types";

describe("Organizador Pro", () => {
  it("vale até a data, sem incluir o depois", () => {
    const agora = Date.parse("2026-11-09T12:00:00Z");
    expect(proAtivo("2026-11-10T00:00:00Z", agora)).toBe(true);
    expect(proAtivo("2026-11-09T11:59:59Z", agora)).toBe(false);
    expect(proAtivo(null, agora)).toBe(false);
  });

  it("formata o preço em reais", () => {
    expect(formatarPreco(990).replace(/\s/g, " ")).toBe("R$ 9,90");
  });

  it("a escolha do torneio liga tudo quando não existe", () => {
    expect(avisoLigadoNoTorneio({}, "mesa")).toBe(true);
    expect(avisoLigadoNoTorneio({ avisos: { tempo: false } }, "tempo")).toBe(false);
    expect(avisoLigadoNoTorneio({ avisos: { tempo: false } }, "finalizado")).toBe(true);
  });
});

describe("app da Play Store", () => {
  beforeEach(() => sessionStorage.clear());

  it("reconhece a abertura pelo app (TWA) e esconde a venda", () => {
    registrarOrigemDoApp("https://www.google.com/");
    expect(abertoPeloAppDaLoja()).toBe(false);
    expect(podeVenderNoApp()).toBe(true);

    registrarOrigemDoApp("android-app://br.com.umbraarena.torneios/");
    expect(abertoPeloAppDaLoja()).toBe(true);
    expect(podeVenderNoApp()).toBe(false);

    // Navegações seguintes não apagam a marca
    registrarOrigemDoApp("");
    expect(abertoPeloAppDaLoja()).toBe(true);
  });
});

describe("planos", () => {
  const futuro = new Date(Date.now() + 86_400_000).toISOString();
  const passado = new Date(Date.now() - 86_400_000).toISOString();

  it("o Organizador Pro inclui o Jogador Pro; admin tem os dois", async () => {
    const { statusPro } = await import("../pro");
    expect(statusPro({ isAdmin: false, proAte: { jogador: futuro, organizador: null } })).toMatchObject({ jogador: true, organizador: false });
    expect(statusPro({ isAdmin: false, proAte: { jogador: null, organizador: futuro } })).toMatchObject({ jogador: true, organizador: true });
    expect(statusPro({ isAdmin: false, proAte: { jogador: passado, organizador: null } })).toMatchObject({ jogador: false, organizador: false });
    expect(statusPro({ isAdmin: true, proAte: undefined })).toMatchObject({ jogador: true, organizador: true });
  });
});
