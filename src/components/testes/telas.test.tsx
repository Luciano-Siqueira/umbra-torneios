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
import { AbaFinanceiro } from "../abas/AbaFinanceiro";
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

describe("encerrar torneio", () => {
  const emAndamento = (rodada: number, finalizada: boolean) => {
    const t = torneioCom("Pessoa");
    t.jogadores.push(novoJogador(3, "Terceira Pessoa", "", true));
    t.qtdRodadas = 4;
    t.rodadaAtual = rodada;
    t.mesas = [{
      numero: 1, rodada, jogadoresIds: [1, 2, 3], finalizada, vencedorId: finalizada ? 1 : null,
      eliminacoes: finalizada ? [[3], [2]] : [], empateTopoIds: [],
    } as unknown as Torneio["mesas"][number]];
    return t;
  };
  const botao = (nome: RegExp) => screen.queryByRole("button", { name: nome });

  it("a tela do torneio não tem mais botão de encerrar fora da aba Mesas", () => {
    const t = emAndamento(2, false);
    preparar("admin", { isAdmin: true }, [t]);
    sessionStorage.setItem(`mtg.aba.${t.id}`, "ranking");
    abrir(<TelaTorneio />);
    expect(botao(/Finalizar torneio/)).toBeNull();
    expect(botao(/Encerrar antes/)).toBeNull();
  });

  it("antes do fim, a aba Mesas oferece encerrar e avisa das mesas sem resultado", async () => {
    const t = emAndamento(2, false);
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<AbaMesas torneio={t} podeEditar />);

    expect(botao(/Finalizar torneio/)).toBeNull();
    fireEvent.click(botao(/Encerrar antes do previsto/)!);
    expect(await screen.findByText(/rodada 2 de 4/)).toBeTruthy();
    expect(screen.getByText(/1 mesa sem resultado ficará sem pontos/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(useStore.getState().torneios[0].finalizado).toBe(false);
  });

  it("com a última rodada concluída, aparece só Finalizar torneio", () => {
    const t = emAndamento(4, true);
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<AbaMesas torneio={t} podeEditar />);
    expect(botao(/Finalizar torneio/)).toBeTruthy();
    expect(botao(/Encerrar antes/)).toBeNull();
  });

  it("jogador não vê nenhum dos dois", () => {
    const t = emAndamento(2, false);
    preparar("jogador", {}, [t]);
    abrir(<AbaMesas torneio={t} podeEditar={false} />);
    expect(botao(/Encerrar antes/)).toBeNull();
    expect(botao(/Finalizar torneio/)).toBeNull();
  });

  it("copiar para o WhatsApp é só de quem organiza", () => {
    const t = emAndamento(2, false);
    preparar("jogador", {}, [t]);
    abrir(<AbaMesas torneio={t} podeEditar={false} />);
    expect(botao(/Copiar \(WhatsApp\)/)).toBeNull();
    cleanup();

    preparar("organizador", { isOrganizador: true }, [t]);
    abrir(<AbaMesas torneio={t} podeEditar />);
    expect(botao(/Copiar \(WhatsApp\)/)).toBeTruthy();
  });

  it("no torneio finalizado, os atalhos levam para as abas", () => {
    const t = { ...torneioCom("Pessoa"), finalizado: true, rodadaAtual: 4 };
    preparar("admin", { isAdmin: true }, [t]);
    const irPara = vi.fn();
    abrir(<AbaMesas torneio={t} podeEditar onIrParaAba={irPara} />);
    fireEvent.click(screen.getByRole("button", { name: /Ranking final/ }));
    expect(irPara).toHaveBeenCalledWith("ranking");
  });
});

describe("padrões das telas", () => {
  it("valores e contagens em português, no singular quando é um", () => {
    const t = { ...torneioCom("Pessoa"), taxaInscricao: 25 };
    t.jogadores = [novoJogador(1, "Pessoa", "", true)];
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<AbaFinanceiro torneio={t} />);
    expect(screen.getByText("1 pago · 0 pendentes")).toBeTruthy();
    expect(screen.getAllByText(/25,00/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/d.d{2}/);
    cleanup();

    abrir(<AbaJogadores torneio={t} podeEditar />);
    expect(screen.getByText(/1 jogador · 1 pago · 1 ativo/)).toBeTruthy();
  });

  it("marcar pagamento usa o mesmo controle em Financeiro e Jogadores", () => {
    const t = torneioCom("Pessoa");
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<AbaFinanceiro torneio={t} />);
    expect(screen.getAllByRole("button", { name: /Pessoa: pago/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();

    abrir(<AbaJogadores torneio={t} podeEditar />);
    expect(screen.getAllByRole("button", { name: /Pessoa: pago/ }).length).toBeGreaterThan(0);
  });

  it("o menu da conta fecha ao clicar fora, mesmo dentro da barra", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);
    fireEvent.click(screen.getByRole("button", { name: /ADMIN/ }));
    expect(screen.getByText("Ver como:")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Ver como:")).toBeNull();
  });

  it("a mensagem da lista vazia não fala de torneios públicos", () => {
    preparar("jogador", {});
    abrir(<TelaTorneios />);
    expect(screen.queryByText(/públicos/)).toBeNull();
    expect(screen.getByText("Nenhum torneio para mostrar")).toBeTruthy();
  });
});

describe("rodadas e desempate", () => {
  it("o card mostra a rodada atual e o total, inclusive no finalizado", () => {
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
    expect(rodadasDe("Acabou")).toContain("4/4");
  });

  it("a regra de desempate aparece em vermelho acima da tabela, para todos", () => {
    render(<AbaRanking torneio={torneioCom("Pessoa")} />);

    const aviso = screen.getByText(/Desempate oficial MTG/);
    expect(aviso.style.color).toBe("var(--critical)");
    expect(aviso.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Vincular e continuar" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Trocar nome" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Trocar nome" }));

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

describe("cores depois do comandante", () => {
  // Símbolos desenhados dentro do elemento que também tem o nome, depois dele
  const coresVemDepois = (nome: string) => {
    const el = screen.getAllByText(new RegExp(nome))[0];
    const texto = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.includes(nome))!;
    const pips = el.querySelector("[aria-hidden='true']");
    return !!pips && !!(texto.compareDocumentPosition(pips) & Node.DOCUMENT_POSITION_FOLLOWING);
  };

  it("na aba Decks", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaDecks />);
    expect(coresVemDepois("Lathliss, Dragon Queen")).toBe(true);
  });

  it("nas mesas, na lista de jogadores e nas sugestões, e deck próprio fica sem cores", () => {
    const t = torneioCom("Pessoa");
    t.jogadores[0].deck = "Breed Lethality";
    t.jogadores[1].deck = "Meu deck";
    t.rodadaAtual = 1;
    t.mesas = [{
      numero: 1, jogadoresIds: [1, 2], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [],
    } as unknown as Torneio["mesas"][number]];
    preparar("jogador", {}, [t]);
    abrir(<AbaMesas torneio={t} podeEditar={false} />);
    expect(coresVemDepois("Atraxa, Praetors' Voice")).toBe(true);
    expect(screen.getByText("Meu deck").querySelector("[aria-hidden='true']")).toBeNull();
    cleanup();

    abrir(<AbaJogadores torneio={t} podeEditar={false} />);
    expect(coresVemDepois("Atraxa, Praetors' Voice")).toBe(true);
    cleanup();

    preparar("admin", { isAdmin: true }, [{ ...t, mesas: [], rodadaAtual: 0 }]);
    abrir(<AbaJogadores torneio={{ ...t, mesas: [], rodadaAtual: 0 }} podeEditar />);
    fireEvent.change(screen.getByPlaceholderText(/Deck ou comandante/), { target: { value: "kaalia" } });
    expect(coresVemDepois("Kaalia of the Vast")).toBe(true);
  });
});

describe("decks", () => {
  it("só o admin no modo admin vê o botão e a página de decks", () => {
    const entra = (modo: ModoView, auth: Partial<AuthState>) => {
      preparar(modo, auth);
      abrir(<TelaTorneios />);
      const temBotao = !!screen.queryByRole("button", { name: /Decks/ });
      cleanup();
      abrir(<TelaDecks />);
      const restrito = !!screen.queryByText("🔒 Acesso restrito");
      const temLista = !!screen.queryByRole("searchbox");
      cleanup();
      return { temBotao, restrito, temLista };
    };
    const bloqueado = { temBotao: false, restrito: true, temLista: false };
    expect(entra("jogador", {})).toEqual(bloqueado);
    expect(entra("organizador", { isOrganizador: true })).toEqual(bloqueado);
    expect(entra("organizador", { isAdmin: true, isOrganizador: true })).toEqual(bloqueado);
    expect(entra("admin", { isAdmin: true })).toEqual({ temBotao: true, restrito: false, temLista: true });
  });

  it("organizador continua buscando decks no cadastro de jogadores", () => {
    const t = torneioCom("Pessoa");
    preparar("organizador", { isOrganizador: true }, [t]);
    abrir(<AbaJogadores torneio={t} podeEditar />);
    fireEvent.change(screen.getByPlaceholderText(/Deck ou comandante/), { target: { value: "atraxa" } });
    expect(screen.getByRole("option", { name: /Breed Lethality/ })).toBeTruthy();
  });

  describe("detalhe do deck", () => {
    const json = (dados: unknown, status = 200) =>
      new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
    const lista = { data: [{ code: "CM2", name: "Breed Lethality", fileName: "Arquivo_C16", type: "Commander Deck" }] };
    const deck = { data: {
      commander: [{ name: "Atraxa, Praetors' Voice", count: 1, type: "Legendary Creature", types: ["Creature"], identifiers: { scryfallId: "abcd1234" } }],
      mainBoard: [
        { name: "Bicho", count: 1, type: "Creature", types: ["Creature"] },
        { name: "Floresta", count: 30, type: "Basic Land", types: ["Land"] },
        { name: "Raio", count: 1, type: "Instant", types: ["Instant"] },
      ],
      tokens: [{ name: "Saproling", count: 5, type: "Token Creature", power: "1", toughness: "1" }],
    } };

    beforeEach(() => { window.scrollTo = (() => {}) as typeof window.scrollTo; });
    afterEach(() => { delete (globalThis as any).__rede; });

    const abrirDeck = (nome: RegExp) => {
      preparar("admin", { isAdmin: true });
      abrir(<TelaDecks />);
      fireEvent.click(screen.getAllByRole("button", { name: nome })[0]);
    };

    it("clicar no deck mostra o comandante em destaque e as cartas por tipo", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);

      const comandante = within(await screen.findByRole("region", { name: "Comandante" }));
      const imagem = comandante.getByRole("img", { name: "Atraxa, Praetors' Voice" }) as HTMLImageElement;
      expect(imagem.src).toBe("https://cards.scryfall.io/large/front/a/b/abcd1234.jpg");

      expect(within(screen.getByRole("region", { name: "Criaturas" })).getByText("Bicho")).toBeTruthy();
      expect(within(screen.getByRole("region", { name: "Mágicas" })).getByText("Raio")).toBeTruthy();
      const terrenos = within(screen.getByRole("region", { name: "Terrenos" }));
      expect(terrenos.getByText("Floresta")).toBeTruthy();
      expect(terrenos.getAllByText("30").length).toBeGreaterThan(0);
      expect(screen.queryByRole("region", { name: "Artefatos" })).toBeNull();
      expect(within(screen.getByRole("region", { name: "Tokens" })).getByText("Saproling")).toBeTruthy();
      expect(within(screen.getByRole("region", { name: "Tokens" })).getByText("1/1")).toBeTruthy();
      expect(screen.getByText(/33 cartas/)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /Todos os decks/ }));
      expect(screen.getByRole("searchbox")).toBeTruthy();
    });

    it("sem conexão, avisa e permite tentar de novo", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : json({}, 503);
      abrirDeck(/^Heavenly Inferno$/);
      expect(await screen.findByText(/Não foi possível abrir o deck/)).toBeTruthy();

      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json({ data: [{ code: "CMA", name: "Heavenly Inferno", fileName: "Inferno_CMA", type: "Commander Deck" }] }) : json(deck);
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      expect(screen.getByText("Carregando as cartas do deck...")).toBeTruthy();
    });
  });

  it("a lista troca Cartas por Cores e filtra pela combinação", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaDecks />);

    const titulos = within(screen.getAllByRole("row")[0]).getAllByRole("columnheader").map((c) => c.textContent);
    expect(titulos).toContain("Cores");
    expect(titulos).not.toContain("Cartas");

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por cores" }), { target: { value: "WUB" } });
    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) expect(l.textContent).toContain("Esper");

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por cores" }), { target: { value: "" } });
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
    expect(screen.getByText(/Eldrazi Unbound/)).toBeTruthy();
  });

  it("a tela busca e filtra a lista", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaDecks />);
    const total = screen.getByText(/^\d+ decks$/).textContent!;

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "atraxa" } });
    expect(screen.getByText(new RegExp(`^3 de ${parseInt(total)} decks$`))).toBeTruthy(); // Inclui Ixhel, Scion of Atraxa

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por ano" }), { target: { value: "2018" } });
    expect(screen.getByText(new RegExp(`^1 de ${parseInt(total)} decks$`))).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nada disso" } });
    expect(screen.getByText("Nenhum deck encontrado")).toBeTruthy();
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
    expect(screen.getByRole("heading", { name: /Combinações de cores/ })).toBeTruthy();
    expect(screen.getByText("Combinação mais usada")).toBeTruthy();
    expect(screen.getAllByText("Witch-Maw").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 de 2 inscrições com deck ficaram de fora/)).toBeTruthy();
  });

  it("os decks do jogador vêm logo acima do histórico de torneios", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [comDeck()]);
    abrir(<TelaAnalytics />);

    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    const decks = titulos.findIndex((t) => t.includes("Decks mais usados"));
    expect(titulos[decks + 1]).toContain("Histórico de torneios");
  });

  it("jogador vê os próprios decks, com o atual marcado, sem as métricas gerais", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [comDeck()]);
    abrir(<TelaAnalytics />);

    const secao = within(screen.getByRole("heading", { name: /Decks mais usados/ }).closest(".ds-card") as HTMLElement);
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
