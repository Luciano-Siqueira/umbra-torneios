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
import { AbaMesas } from "../abas/AbaMesas";
import { AbaRanking } from "../abas/AbaRanking";
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

describe("rodadas e desempate", () => {
  it("o card mostra a rodada atual, e o finalizado mostra só o total", () => {
    const criar = (nome: string, rodada: number, finalizado: boolean) => ({
      ...torneioCom("Pessoa"), id: nome, nome, qtdRodadas: 4, rodadaAtual: rodada, finalizado,
    });
    preparar("admin", { isAdmin: true }, [criar("Parado", 0, false), criar("Jogando", 2, false), criar("Acabou", 4, true)]);
    abrir(<TelaTorneios />);

    const rodadasDe = (nome: string) => {
      const card = screen.getAllByRole("heading", { level: 3, name: nome })[0].parentElement!;
      return within(card).getByText("RODADAS").parentElement!.textContent;
    };
    expect(rodadasDe("Parado")).toContain("0/4");
    expect(rodadasDe("Jogando")).toContain("2/4");
    expect(rodadasDe("Acabou")).toContain("4");
    expect(rodadasDe("Acabou")).not.toContain("/");
  });

  it("a regra de desempate aparece em vermelho acima da tabela, para todos", () => {
    render(<AbaRanking torneio={torneioCom("Pessoa")} />);

    const aviso = screen.getByText(/Desempate oficial MTG/);
    expect(aviso.style.color).toBe("var(--critical)");
    expect(aviso.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("decks mais usados na lista de torneios", () => {
  it("mostra os 5 primeiros acima dos cards, com a quantidade de usos", () => {
    const t = torneioCom("Pessoa");
    const decks = ["Breed Lethality", "Breed Lethality", "A", "B", "C", "D", "E"];
    t.jogadores = decks.map((d, i) => novoJogador(i + 1, `J${i}`, d, true));
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<TelaTorneios />);

    const secao = screen.getByRole("region", { name: "Decks mais usados" });
    const itens = within(secao).getAllByRole("listitem");
    expect(itens).toHaveLength(5);
    expect(itens[0].textContent).toContain("Breed Lethality");
    expect(itens[0].textContent).toContain("2 usos");
    expect(itens[1].textContent).toContain("1 uso");
    expect(secao.compareDocumentPosition(screen.getByRole("heading", { level: 3, name: "Liga" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sem decks informados, a seção não aparece", () => {
    preparar("admin", { isAdmin: true }, [torneioCom("Pessoa")]);
    abrir(<TelaTorneios />);
    expect(screen.queryByRole("region", { name: "Decks mais usados" })).toBeNull();
  });
});

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

  it("o botão Atualizar decks é só do admin no modo admin", () => {
    const botao = () => screen.queryByRole("button", { name: /Atualizar decks/ });

    preparar("jogador", {});
    abrir(<TelaDecks />);
    expect(botao()).toBeNull();
    cleanup();

    preparar("organizador", { isOrganizador: true });
    abrir(<TelaDecks />);
    expect(botao()).toBeNull();
    cleanup();

    preparar("organizador", { isAdmin: true, isOrganizador: true });
    abrir(<TelaDecks />);
    expect(botao()).toBeNull();
    cleanup();

    preparar("admin", { isAdmin: true });
    abrir(<TelaDecks />);
    expect(botao()).toBeTruthy();
  });

  it("as mesas mostram o deck e o comandante de cada jogador", () => {
    const t = torneioCom("Pessoa");
    t.jogadores.push(novoJogador(3, "Terceira Pessoa", "", true));
    t.jogadores[0].deck = "Breed Lethality";
    t.jogadores[1].deck = "Meu deck de elfos";
    t.rodadaAtual = 1;
    t.mesas = [{
      numero: 1, jogadoresIds: [1, 2, 3], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [],
    } as unknown as Torneio["mesas"][number]];
    preparar("jogador", {}, [t]);
    abrir(<AbaMesas torneio={t} podeEditar={false} />);

    expect(screen.getByText("Breed Lethality · Atraxa, Praetors' Voice")).toBeTruthy();
    expect(screen.getByText("Meu deck de elfos")).toBeTruthy();
    expect(screen.getByText("Terceira Pessoa")).toBeTruthy();
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

    it("com rodada em andamento, o deck pode mudar e o comandante acompanha", () => {
      const t = torneioCom("Pessoa");
      t.rodadaAtual = 1;
      t.mesas = [{ id: 1 } as unknown as Torneio["mesas"][number]];
      preparar("admin", { isAdmin: true }, [t]);
      const Tela = () => <AbaJogadores torneio={useStore((s) => s.torneios[0])} podeEditar />;
      abrir(<Tela />);

      const linha = within(screen.getByText("Pessoa").closest("tr")!);
      const campo = linha.getByRole("combobox") as HTMLInputElement;
      expect(campo.disabled).toBe(false);

      fireEvent.change(campo, { target: { value: "atraxa" } });
      fireEvent.mouseDown(screen.getByRole("option", { name: /Breed Lethality/ }));
      expect(linha.getAllByText("Atraxa, Praetors' Voice").length).toBeGreaterThan(0);

      fireEvent.change(campo, { target: { value: "Meu deck" } });
      fireEvent.keyDown(campo, { key: "Enter" });
      expect(linha.queryByText("Atraxa, Praetors' Voice")).toBeNull();
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

describe("métricas de decks no Analytics", () => {
  const comDeck = () => {
    const t = torneioCom("Pessoa");
    t.jogadores[0].deck = "Breed Lethality";
    t.jogadores[0].historicoColocacoes = [[1, 1]];
    t.jogadores[1].deck = "Meu deck";
    return t;
  };

  it("quem organiza vê cores e comandantes na visão geral", () => {
    preparar("admin", { isAdmin: true }, [comDeck()]);
    abrir(<TelaAnalytics />);

    expect(screen.getByRole("heading", { name: /Cores dos comandantes/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Comandantes que mais ganham/ })).toBeTruthy();
    expect(screen.getByText("Atraxa, Praetors' Voice")).toBeTruthy();
    expect(screen.getByText("Verde")).toBeTruthy();
    expect(screen.getByText(/1 de 2 inscrições com deck ficaram de fora/)).toBeTruthy();
  });

  it("jogador vê os próprios decks, com o atual marcado, sem as métricas gerais", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [comDeck()]);
    abrir(<TelaAnalytics />);

    const secao = within(screen.getByRole("heading", { name: /Decks usados/ }).closest(".ds-card") as HTMLElement);
    expect(secao.getByText(/Breed Lethality/)).toBeTruthy();
    expect(secao.getByText("Atraxa, Praetors' Voice")).toBeTruthy();
    expect(secao.getByText("ATUAL")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Comandantes que mais ganham/ })).toBeNull();
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
