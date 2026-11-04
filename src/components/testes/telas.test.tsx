// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import type { AuthState } from "../../core/auth";
import { useStore, type ModoView } from "../../core/store";
import { novoJogador, novoTorneio, type Torneio } from "../../core/types";
import { ToastProvider } from "../ui/Toast";
import { TelaTorneios } from "../TelaTorneios";
import { TelaTorneio } from "../TelaTorneio";
import { TelaAnalytics } from "../TelaAnalytics";
import { TelaDecks } from "../TelaDecks";
import { TelaVincularNome } from "../TelaVincularNome";
import { AbaJogadores } from "../abas/AbaJogadores";
import { AuthChip } from "../AuthChip";

const contas = vi.hoisted(() => ({
  atual: {} as AuthState,
  vincularNome: vi.fn(async () => {}),
  trocarNome: vi.fn(async () => {}),
}));

vi.mock("../../core/auth", () => ({
  useAuth: () => contas.atual,
  vincularNome: contas.vincularNome,
  trocarNome: contas.trocarNome,
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
}));
vi.mock("../../core/useAoVivo", () => ({
  useAoVivo: () => null,
  useListaAtualizada: () => {},
}));

function conta(parcial: Partial<AuthState> = {}): AuthState {
  return {
    session: { user: { id: "u1", email: "pessoa@teste.local" } } as AuthState["session"],
    isAdmin: false,
    isOrganizador: false,
    nomesJogador: [],
    nomesPendentes: [],
    loading: false,
    perfilCarregado: true,
    perfilErro: null,
    ...parcial,
  };
}

function preparar(modoView: ModoView, auth: Partial<AuthState>, torneios: Torneio[] = []) {
  contas.atual = conta(auth);
  useStore.setState({ modoView, torneios, torneioId: torneios[0]?.id ?? null, sincronizando: false });
}

const abrir = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

function torneioCom(nome: string): Torneio {
  const t = novoTorneio("Liga", 10);
  t.jogadores = [novoJogador(1, nome, "", true), novoJogador(2, "Outra Pessoa", "", true)];
  return t;
}

beforeEach(() => {
  contas.vincularNome.mockClear();
  contas.trocarNome.mockClear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("barra da lista de torneios", () => {
  it("quem edita tem os menus Torneio e Importar / Exportar", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);

    expect(screen.queryByRole("menuitem", { name: "Editar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Torneio/ }));
    const menu = within(screen.getByRole("menu"));
    expect(menu.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Editar", "Excluir"]);

    const outroMenu = screen.getByRole("button", { name: /Importar \/ Exportar/ });
    fireEvent.pointerDown(outroMenu);
    fireEvent.click(outroMenu);
    const textos = screen.getByRole("menu").textContent;
    expect(textos).toContain("Importar");
    expect(textos).toContain("Exportar");
    expect(textos).toContain("Torneio de teste");
  });

  it("o menu fecha ao clicar fora, com Esc e ao escolher um item", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);
    const botao = screen.getByRole("button", { name: /^Torneio/ });

    fireEvent.click(botao);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(botao);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(botao);
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("jogador só tem Abrir, sem menus de edição", () => {
    preparar("jogador", {});
    abrir(<TelaTorneios />);

    expect(screen.getByRole("button", { name: "Abrir" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Torneio/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Importar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo torneio/ })).toBeNull();
  });

  it("Usuários aparece só para admin no modo admin", () => {
    preparar("organizador", { isAdmin: true, isOrganizador: true });
    abrir(<TelaTorneios />);
    expect(screen.queryByRole("button", { name: /Usuários/ })).toBeNull();
    cleanup();

    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);
    expect(screen.getByRole("button", { name: /Usuários/ })).toBeTruthy();
  });
});

describe("trocar nome", () => {
  const digitar = (nome: string) =>
    fireEvent.change(screen.getByRole("textbox"), { target: { value: nome } });

  it("conta nova vincula o nome e não pode cancelar", async () => {
    preparar("jogador", {});
    const concluido = vi.fn();
    abrir(<TelaVincularNome aberta onConcluido={concluido} />);

    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    digitar("Novo Nome");
    fireEvent.click(screen.getByRole("button", { name: "VINCULAR E CONTINUAR" }));

    await waitFor(() => expect(concluido).toHaveBeenCalled());
    expect(contas.vincularNome).toHaveBeenCalledWith("Novo Nome");
    expect(contas.trocarNome).not.toHaveBeenCalled();
  });

  it("quem já tem nome troca o nome atual e é avisado da aprovação", async () => {
    preparar("jogador", { nomesJogador: ["Nome Antigo"] });
    const concluido = vi.fn();
    abrir(<TelaVincularNome aberta onConcluido={concluido} onCancelar={() => {}} />);

    expect(screen.getByText(/precisa ser aprovado pelo admin/)).toBeTruthy();
    digitar("Nome Novo");
    fireEvent.click(screen.getByRole("button", { name: "TROCAR NOME" }));

    await waitFor(() => expect(concluido).toHaveBeenCalled());
    expect(contas.trocarNome).toHaveBeenCalledWith("Nome Antigo", "Nome Novo");
    expect(contas.vincularNome).not.toHaveBeenCalled();
  });

  it("com vários nomes, troca o que foi escolhido", async () => {
    preparar("jogador", { nomesJogador: ["Primeiro", "Segundo"] });
    const concluido = vi.fn();
    abrir(<TelaVincularNome aberta onConcluido={concluido} onCancelar={() => {}} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Segundo" } });
    digitar("Terceiro");
    fireEvent.click(screen.getByRole("button", { name: "TROCAR NOME" }));

    await waitFor(() => expect(concluido).toHaveBeenCalled());
    expect(contas.trocarNome).toHaveBeenCalledWith("Segundo", "Terceiro");
  });

  it("Cancelar fecha sem alterar nada e limpa o que foi digitado", () => {
    preparar("jogador", { nomesJogador: ["Nome Antigo"] });
    const cancelar = vi.fn();
    const { rerender } = abrir(<TelaVincularNome aberta onConcluido={() => {}} onCancelar={cancelar} />);

    digitar("Rascunho");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancelar).toHaveBeenCalled();
    expect(contas.trocarNome).not.toHaveBeenCalled();

    rerender(<ToastProvider><TelaVincularNome aberta={false} onConcluido={() => {}} onCancelar={cancelar} /></ToastProvider>);
    rerender(<ToastProvider><TelaVincularNome aberta onConcluido={() => {}} onCancelar={cancelar} /></ToastProvider>);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("o menu da conta oferece Trocar nome para quem tem nome, aprovado ou pendente", () => {
    const opcao = (auth: AuthState) => {
      abrir(<AuthChip auth={auth} />);
      fireEvent.click(screen.getByRole("button"));
      const tem = !!screen.queryByRole("button", { name: /Trocar nome/ });
      cleanup();
      return tem;
    };
    preparar("jogador", {});
    expect(opcao(conta({ nomesJogador: ["Alguém"] }))).toBe(true);
    expect(opcao(conta({ nomesPendentes: ["Alguém"] }))).toBe(true);
    expect(opcao(conta({ isAdmin: true }))).toBe(false);
  });
});

describe("abas do torneio", () => {
  const abas = () => screen.getAllByRole("button").map((b) => b.textContent ?? "");

  it("jogador vê só Mesas, Ranking e Histórico", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [torneioCom("Pessoa")]);
    abrir(<TelaTorneio />);
    const textos = abas().join(" | ");

    for (const visivel of ["Mesas", "Ranking", "Histórico"]) expect(textos).toContain(visivel);
    for (const oculta of ["Financeiro", "Premiação", "Sorteios", "Jogadores"]) expect(textos).not.toContain(oculta);
  });

  it("admin vê também as abas de gestão", () => {
    preparar("admin", { isAdmin: true }, [torneioCom("Pessoa")]);
    abrir(<TelaTorneio />);
    const textos = abas().join(" | ");

    for (const aba of ["Jogadores", "Mesas", "Ranking", "Financeiro", "Premiação", "Sorteios", "Histórico"]) {
      expect(textos).toContain(aba);
    }
  });
});

describe("decks", () => {
  it("todos os papéis abrem a tela de decks", () => {
    preparar("jogador", {});
    abrir(<TelaTorneios />);
    fireEvent.click(screen.getByRole("button", { name: /Decks/ }));
    expect(useStore.getState().tela).toBe("decks");
    useStore.getState().voltarParaLista();
  });

  it("a tela busca e filtra a lista", () => {
    preparar("jogador", {});
    abrir(<TelaDecks />);
    const total = screen.getByText(/^\d+ decks$/).textContent!;

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "atraxa" } });
    expect(screen.getByText(new RegExp(`^3 de ${parseInt(total)} decks$`))).toBeTruthy(); // Inclui Ixhel, Scion of Atraxa

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por ano" }), { target: { value: "2018" } });
    expect(screen.getByText(new RegExp(`^1 de ${parseInt(total)} decks$`))).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nada disso" } });
    expect(screen.getByText("Nenhum deck encontrado")).toBeTruthy();
  });

  describe("cadastro de jogadores", () => {
    const ativo = () => {
      const t = torneioCom("Pessoa");
      preparar("admin", { isAdmin: true }, [t]);
      abrir(<AbaJogadores torneio={t} podeEditar />);
      fireEvent.change(screen.getByPlaceholderText("Nome do jogador..."), { target: { value: "Nova Pessoa" } });
      return screen.getByPlaceholderText(/Deck ou comandante/) as HTMLInputElement;
    };
    const ultimoDeck = () => {
      const { torneios, torneioId } = useStore.getState();
      const t = torneios.find((x) => x.id === torneioId)!;
      return t.jogadores[t.jogadores.length - 1];
    };

    it("busca pelo comandante e guarda o nome do deck", () => {
      const campo = ativo();
      fireEvent.change(campo, { target: { value: "atraxa" } });
      fireEvent.mouseDown(screen.getByRole("option", { name: /Breed Lethality/ }));

      expect(campo.value).toBe("Breed Lethality");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("setas e Enter escolhem a sugestão sem adicionar o jogador", () => {
      const campo = ativo();
      const antes = useStore.getState().torneios[0].jogadores.length;
      fireEvent.change(campo, { target: { value: "kaalia" } });
      fireEvent.keyDown(campo, { key: "ArrowDown" });
      fireEvent.keyDown(campo, { key: "Enter" });

      expect(campo.value).toBe("Heavenly Inferno");
      expect(useStore.getState().torneios[0].jogadores).toHaveLength(antes);
    });

    it("aceita um deck próprio que não está na lista", () => {
      const campo = ativo();
      fireEvent.change(campo, { target: { value: "Meu deck de elfos" } });
      fireEvent.keyDown(campo, { key: "Enter" });

      expect(ultimoDeck().nome).toBe("Nova Pessoa");
      expect(ultimoDeck().deck).toBe("Meu deck de elfos");
    });
  });
});

describe("desempenho do jogador", () => {
  it("o histórico de torneios vem depois de Partidas recentes", () => {
    const t = torneioCom("Pessoa");
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [t]);
    abrir(<TelaAnalytics />);

    const recentes = screen.getByRole("heading", { name: /Partidas recentes/ });
    const historico = screen.getByRole("heading", { name: /Histórico de torneios/ });
    expect(recentes.compareDocumentPosition(historico) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Forma recente/)).toBeNull();
  });
});
