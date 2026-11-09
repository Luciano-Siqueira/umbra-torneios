// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { AuthState, ProAte } from "../../core/auth";
import { useStore } from "../../core/store";
import { novoTorneio } from "../../core/types";
import { ToastProvider } from "../ui/Toast";
import { AuthChip } from "../AuthChip";
import { DialogoAvisosTorneio } from "../DialogoAvisosTorneio";
import { DialogoSobre } from "../DialogoSobre";
import { registrarOrigemDoApp } from "../../core/plataforma";

const contas = vi.hoisted(() => ({ atual: {} as AuthState }));
vi.mock("../../core/auth", () => ({
  useAuth: () => contas.atual,
  atualizarPerfil: vi.fn(),
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
}));
vi.mock("../../core/notificacoes", () => ({
  useAvisos: () => ({ estado: "sem-suporte", ocupado: false, alternar: vi.fn() }),
}));

const DAQUI_A_10_DIAS = new Date(Date.now() + 10 * 86_400_000).toISOString();
const ONTEM = new Date(Date.now() - 86_400_000).toISOString();
const SEM_PRO: ProAte = { jogador: null, organizador: null };

function conta(parcial: Partial<AuthState> = {}): AuthState {
  return {
    session: { user: { id: "u1", email: "pessoa@teste.local" } } as AuthState["session"],
    isAdmin: false,
    isOrganizador: false,
    nomesJogador: ["Pessoa"],
    nomesPendentes: [],
    verMesas: false,
    verTempo: false,
    proAte: SEM_PRO,
    criarSenha: false,
    loading: false,
    perfilCarregado: true,
    perfilErro: null,
    ...parcial,
  };
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

// Rede falsa: preço e a função de pagamento
function rede({ vendasAbertas = true } = {}) {
  const pedidos: any[] = [];
  (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
    if (url.includes("config_pro")) return json({ preco_centavos: 990, dias: 30, vendas_abertas: vendasAbertas });
    if (url.includes("functions/v1/pagamento-pro")) {
      const corpo = JSON.parse(String(init?.body));
      pedidos.push(corpo);
      return json({
        ok: true, id: "123", status: "pending", qr_code: "00020126PIXCOPIAECOLA", qr_code_base64: "iVBORw0KGgo=",
        expira_em: new Date(Date.now() + 30 * 60_000).toISOString(), valor_centavos: 990, dias: 30,
      });
    }
    return json([]);
  };
  return pedidos;
}

const abrir = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const abrirMenu = (auth: AuthState) => {
  contas.atual = auth;
  abrir(<AuthChip auth={auth} />);
  fireEvent.click(screen.getAllByRole("button")[0]);
};

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); delete (globalThis as any).__rede; });

describe("planos Pro no menu", () => {
  it("o jogador vê só o Jogador Pro; o organizador vê os dois", () => {
    rede();
    abrirMenu(conta());
    expect(screen.getByRole("button", { name: /Jogador Pro/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Organizador Pro/ })).toBeNull();
    cleanup();

    abrirMenu(conta({ isOrganizador: true }));
    expect(screen.getByRole("button", { name: /Jogador Pro/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Organizador Pro/ })).toBeTruthy();
  });

  it("o jogador assina o Jogador Pro por Pix", async () => {
    const pedidos = rede();
    abrirMenu(conta());
    fireEvent.click(screen.getByRole("button", { name: /Jogador Pro/ }));

    expect(await screen.findByText("R$ 9,90")).toBeTruthy();
    expect(screen.getByText(/Decks: todos os decks/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Assinar com Pix" }));
    expect(await screen.findByAltText("QR Code do Pix")).toBeTruthy();
    expect(screen.getByLabelText("Código Pix copia e cola").textContent).toBe("00020126PIXCOPIAECOLA");
    expect(pedidos[0]).toEqual({ acao: "criar", plano: "jogador" });
  });

  it("o organizador assina o Organizador Pro", async () => {
    const pedidos = rede();
    abrirMenu(conta({ isOrganizador: true }));
    fireEvent.click(screen.getByRole("button", { name: /Organizador Pro/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Assinar com Pix" }));
    await screen.findByAltText("QR Code do Pix");
    expect(pedidos[0]).toEqual({ acao: "criar", plano: "organizador" });
  });

  it("com as vendas fechadas, o botão fica desativado", async () => {
    rede({ vendasAbertas: false });
    abrirMenu(conta());
    fireEvent.click(screen.getByRole("button", { name: /Jogador Pro/ }));
    expect(await screen.findByText("As assinaturas abrem em breve.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Assinar com Pix" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("mostra a validade, e o Organizador Pro inclui o Jogador Pro", () => {
    rede();
    abrirMenu(conta({ isOrganizador: true, proAte: { jogador: ONTEM, organizador: DAQUI_A_10_DIAS } }));
    expect(screen.getAllByText(/ativo até/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Jogador Pro/ }));
    expect(screen.getByText(/Incluído no seu Organizador Pro/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Assinar com Pix" })).toBeNull();
  });

  it("no app da Play Store a compra e o Pix de ajuda somem", () => {
    registrarOrigemDoApp("android-app://br.com.umbraarena.torneios/");
    rede();
    abrirMenu(conta({ isOrganizador: true }));
    expect(screen.queryByRole("button", { name: /Jogador Pro/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Organizador Pro/ })).toBeNull();
    cleanup();

    abrir(<DialogoSobre aberto onFechar={() => {}} />);
    expect(screen.queryByText(/Ajude o projeto/)).toBeNull();
  });
});

describe("notificações por torneio", () => {
  const preparar = (auth: Partial<AuthState>) => {
    const t = novoTorneio("Liga", 10);
    useStore.setState({ torneios: [t], torneioId: t.id });
    contas.atual = conta({ isOrganizador: true, ...auth });
    return t;
  };
  const atual = () => useStore.getState().torneios[0];

  it("sem o Organizador Pro, as chaves ficam travadas e aparece o convite", () => {
    rede();
    const t = preparar({ proAte: { jogador: DAQUI_A_10_DIAS, organizador: null } });
    abrir(<DialogoAvisosTorneio torneio={t} aberto onFechar={() => {}} />);
    expect(screen.getByText("Recurso do Organizador Pro")).toBeTruthy();
    expect((screen.getByRole("switch", { name: "Mesa da rodada" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("com o Organizador Pro, desliga o aviso de tempo do torneio", () => {
    rede();
    const t = preparar({ proAte: { jogador: null, organizador: DAQUI_A_10_DIAS } });
    const { rerender } = abrir(<DialogoAvisosTorneio torneio={t} aberto onFechar={() => {}} />);
    fireEvent.click(screen.getByRole("switch", { name: "Tempo extra e último turno" }));
    expect(atual().avisos).toEqual({ tempo: false });
    rerender(<ToastProvider><DialogoAvisosTorneio torneio={atual()} aberto onFechar={() => {}} /></ToastProvider>);
    expect(screen.getByRole("switch", { name: "Tempo extra e último turno" }).getAttribute("aria-checked")).toBe("false");
  });

  it("administrador usa sem pagar", () => {
    rede();
    const t = preparar({ isAdmin: true });
    abrir(<DialogoAvisosTorneio torneio={t} aberto onFechar={() => {}} />);
    expect((screen.getByRole("switch", { name: "Torneio finalizado" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
