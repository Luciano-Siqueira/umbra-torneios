import { beforeEach, describe, expect, it, vi } from "vitest";

const dados = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => dados.get(k) ?? null,
  setItem: (k: string, v: string) => void dados.set(k, v),
};

// Importar de novo o store equivale a dar F5 na página
async function recarregarPagina() {
  vi.resetModules();
  return (await import("../store")).useStore;
}

describe("F5", () => {
  beforeEach(() => dados.clear());

  it("primeira abertura começa na tela inicial", async () => {
    const useStore = await recarregarPagina();
    expect(useStore.getState().tela).toBe("splash");
    expect(useStore.getState().torneioId).toBeNull();
  });

  it("continua no torneio aberto", async () => {
    (await recarregarPagina()).getState().abrirTorneio("t1");
    const useStore = await recarregarPagina();
    expect(useStore.getState().tela).toBe("torneio");
    expect(useStore.getState().torneioId).toBe("t1");
  });

  it("continua na tela escolhida e mantém o torneio ao navegar", async () => {
    (await recarregarPagina()).getState().irPara("analytics");
    expect((await recarregarPagina()).getState().tela).toBe("analytics");
  });

  it("ao voltar para a lista, esquece o torneio", async () => {
    const antes = await recarregarPagina();
    antes.getState().abrirTorneio("t1");
    antes.getState().voltarParaLista();
    const useStore = await recarregarPagina();
    expect(useStore.getState().tela).toBe("torneios");
    expect(useStore.getState().torneioId).toBeNull();
  });
});
