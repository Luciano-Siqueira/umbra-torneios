// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VERSAO_PRIVACIDADE } from "../../core/privacidade";
import type { AuthState } from "../../core/auth";
import { useStore } from "../../core/store";
import App from "../../App";

const contas = vi.hoisted(() => ({ atual: {} as AuthState, aceitarPrivacidade: vi.fn(async (_uid: string) => {}) }));

vi.mock("../../core/auth", () => ({
  useAuth: () => contas.atual,
  vincularNome: vi.fn(async () => {}),
  trocarNome: vi.fn(async () => {}),
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
  aceitarPrivacidade: contas.aceitarPrivacidade,
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
    verMesas: false,
    verTempo: false,
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

describe("política de privacidade", () => {
  afterEach(() => { cleanup(); useStore.setState({ tela: "splash" }); localStorage.clear(); });

  it("aparece para quem ainda não aceitou e some ao concordar", async () => {
    contas.atual = conta({ session: sessao });
    render(<App />);
    expect(screen.getByText("🔒 Sua privacidade")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Li e concordo" }));
    await waitFor(() => expect(screen.queryByText("🔒 Sua privacidade")).toBeNull());
    expect(contas.aceitarPrivacidade).toHaveBeenCalledWith("u1");
  });

  it("não aparece para quem já aceitou esta versão, em qualquer aparelho", () => {
    const aceitou = { user: { id: "u2", email: "x@teste.local", user_metadata: { privacidade_versao: VERSAO_PRIVACIDADE } } } as unknown as AuthState["session"];
    contas.atual = conta({ session: aceitou });
    render(<App />);
    expect(screen.queryByText("🔒 Sua privacidade")).toBeNull();
  });

  it("volta a aparecer quando a política muda de versão", () => {
    const antiga = { user: { id: "u3", email: "y@teste.local", user_metadata: { privacidade_versao: "2020-01-01" } } } as unknown as AuthState["session"];
    contas.atual = conta({ session: antiga });
    render(<App />);
    expect(screen.getByText("🔒 Sua privacidade")).toBeTruthy();
  });
});
