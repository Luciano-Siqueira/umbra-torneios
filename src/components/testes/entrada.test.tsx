// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AuthState } from "../../core/auth";
import { useStore } from "../../core/store";
import App from "../../App";

const contas = vi.hoisted(() => ({ atual: {} as AuthState }));

vi.mock("../../core/auth", () => ({
  useAuth: () => contas.atual,
  vincularNome: vi.fn(async () => {}),
  trocarNome: vi.fn(async () => {}),
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
}));
vi.mock("../../core/useAoVivo", () => ({ useAoVivo: () => null, useListaAtualizada: () => {} }));
vi.mock("../../core/atualizarDecks", () => ({ sincronizarDecks: () => {}, useVersaoDecks: () => 0 }));
vi.mock("../../core/sync", () => ({
  definirAvisoEnvio: () => {},
  puxarDoServidor: async () => ({ erros: [] }),
  resolverConflito: async () => {},
  retomarEnvios: () => {},
}));

function conta(parcial: Partial<AuthState>): AuthState {
  return {
    session: null,
    isAdmin: false,
    isOrganizador: false,
    nomesJogador: ["Ana"],
    nomesPendentes: [],
    loading: false,
    perfilCarregado: true,
    perfilErro: null,
    ...parcial,
  };
}

const sessao = { user: { id: "u1", email: "pessoa@teste.local" } } as AuthState["session"];
const telaDeEntrada = () => screen.queryByText(/◤ ENTRAR ◢/);

describe("entrada no site", () => {
  afterEach(() => { cleanup(); useStore.setState({ tela: "splash" }); });

  it("enquanto confere a sessão salva, não mostra a tela de entrada", () => {
    contas.atual = conta({ loading: true });
    useStore.setState({ tela: "splash" });
    render(<App />);
    expect(telaDeEntrada()).toBeNull();
  });

  it("com sessão salva, vai direto para os torneios, sem passar pela entrada", () => {
    contas.atual = conta({ session: sessao });
    useStore.setState({ tela: "splash" });
    render(<App />);
    expect(telaDeEntrada()).toBeNull();
    expect(useStore.getState().tela).toBe("torneios");
  });

  it("sem sessão, mostra a tela de entrada", () => {
    contas.atual = conta({});
    useStore.setState({ tela: "splash" });
    render(<App />);
    expect(telaDeEntrada()).toBeTruthy();
  });
});
