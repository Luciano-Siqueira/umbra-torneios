// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { AuthState } from "../../core/auth";
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
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
}));
vi.mock("../../core/notificacoes", () => ({
  useAvisos: () => ({ estado: "sem-suporte", ocupado: false, alternar: vi.fn() }),
}));

function conta(parcial: Partial<AuthState> = {}): AuthState {
  return {
    session: { user: { id: "u1", email: "org@teste.local" } } as AuthState["session"],
    isAdmin: false,
    isOrganizador: true,
    nomesJogador: ["Org"],
    nomesPendentes: [],
    verMesas: false,
    verTempo: false,
    criarSenha: false,
    loading: false,
    perfilCarregado: true,
    perfilErro: null,
    ...parcial,
  };
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

// Rede falsa: validade do Pro, preço e a função de pagamento
function rede({ proAte = null as string | null } = {}) {
  const pedidos: any[] = [];
  (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
    if (url.includes("assinaturas_pro")) return json(proAte ? { pro_ate: proAte } : null);
    if (url.includes("config_pro")) return json({ preco_centavos: 990, dias: 30, vendas_abertas: true });
    if (url.includes("functions/v1/pagamento-pro")) {
      const corpo = JSON.parse(String(init?.body));
      pedidos.push(corpo);
      if (corpo.acao === "criar") {
        return json({
          ok: true, id: "123", status: "pending", qr_code: "00020126PIXCOPIAECOLA", qr_code_base64: "iVBORw0KGgo=",
          expira_em: new Date(Date.now() + 30 * 60_000).toISOString(), valor_centavos: 990, dias: 30,
        });
      }
      return json({ ok: true, status: "pending", pro_ate: null });
    }
    return json([]);
  };
  return pedidos;
}

const abrir = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const DAQUI_A_10_DIAS = new Date(Date.now() + 10 * 86_400_000).toISOString();

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); delete (globalThis as any).__rede; });

describe("Organizador Pro", () => {
  it("o organizador abre o Pro pelo menu, vê o preço e gera o Pix", async () => {
    const pedidos = rede();
    contas.atual = conta();
    abrir(<AuthChip auth={conta()} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Organizador Pro/ }));

    expect(await screen.findByText("R$ 9,90")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assinar com Pix" }));
    expect(await screen.findByAltText("QR Code do Pix")).toBeTruthy();
    expect(screen.getByLabelText("Código Pix copia e cola").textContent).toBe("00020126PIXCOPIAECOLA");
    expect(pedidos[0]).toEqual({ acao: "criar" });
  });

  it("jogador sem papel de organizador não vê o item no menu", () => {
    rede();
    contas.atual = conta({ isOrganizador: false });
    abrir(<AuthChip auth={conta({ isOrganizador: false })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByRole("button", { name: /Organizador Pro/ })).toBeNull();
  });

  it("no app da Play Store a compra e o Pix de ajuda somem", async () => {
    registrarOrigemDoApp("android-app://br.com.umbraarena.torneios/");
    rede();
    contas.atual = conta();
    abrir(<AuthChip auth={conta()} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByRole("button", { name: /Organizador Pro/ })).toBeNull();
    cleanup();

    abrir(<DialogoSobre aberto onFechar={() => {}} />);
    expect(screen.queryByText(/Ajude o projeto/)).toBeNull();
  });

  it("mostra até quando o Pro vale", async () => {
    rede({ proAte: DAQUI_A_10_DIAS });
    contas.atual = conta();
    abrir(<AuthChip auth={conta()} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(await screen.findByText(/ativo até/)).toBeTruthy();
  });
});

describe("notificações por torneio", () => {
  const preparar = (auth: Partial<AuthState>) => {
    const t = novoTorneio("Liga", 10);
    useStore.setState({ torneios: [t], torneioId: t.id });
    contas.atual = conta(auth);
    return t;
  };
  const atual = () => useStore.getState().torneios[0];

  it("sem o Pro, as chaves ficam travadas e aparece o convite", async () => {
    rede();
    const t = preparar({});
    abrir(<DialogoAvisosTorneio torneio={t} aberto onFechar={() => {}} />);
    expect(await screen.findByText("Recurso do Organizador Pro")).toBeTruthy();
    expect((screen.getByRole("switch", { name: "Mesa da rodada" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("com o Pro, o organizador desliga o aviso de tempo do torneio", async () => {
    rede({ proAte: DAQUI_A_10_DIAS });
    const t = preparar({});
    const { rerender } = abrir(<DialogoAvisosTorneio torneio={t} aberto onFechar={() => {}} />);
    const tempo = screen.getByRole("switch", { name: "Tempo extra e último turno" }) as HTMLButtonElement;
    await waitFor(() => expect(tempo.disabled).toBe(false));
    fireEvent.click(tempo);
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
