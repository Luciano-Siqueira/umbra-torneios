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
import { TelaUsuarios } from "../TelaUsuarios";
import { SegredoUmbra } from "../ui/SegredoUmbra";
import { VERSAO_PRIVACIDADE } from "../../core/privacidade";
import { TelaVincularNome } from "../TelaVincularNome";
import { AbaJogadores } from "../abas/AbaJogadores";
import { AbaMesas } from "../abas/AbaMesas";
import { AbaRanking } from "../abas/AbaRanking";
import { AbaFinanceiro } from "../abas/AbaFinanceiro";
import { AuthChip } from "../AuthChip";
import { BarraInferior } from "../ui/BarraInferior";

const contas = vi.hoisted(() => ({
  atual: {} as AuthState,
  vincularNome: vi.fn(async () => {}),
  trocarNome: vi.fn(async () => {}),
  excluirMinhaConta: vi.fn(async (_senha: string) => {}),
}));

vi.mock("../../core/auth", () => ({
  useAuth: () => contas.atual,
  vincularNome: contas.vincularNome,
  trocarNome: contas.trocarNome,
  excluirMinhaConta: contas.excluirMinhaConta,
  desvincularNome: vi.fn(async () => {}),
  sair: vi.fn(async () => {}),
}));
const avisos = vi.hoisted(() => ({
  atual: { estado: "sem-suporte" as string, ocupado: false, alternar: vi.fn(async () => {}) },
  avisarMesas: vi.fn(async (_id: string, _rodada: number) => ({ enviados: 3, contas: 3 })),
}));
vi.mock("../../core/notificacoes", () => ({
  useAvisos: () => avisos.atual,
  avisarMesas: avisos.avisarMesas,
  suportaAvisos: () => avisos.atual.estado !== "sem-suporte",
}));
vi.mock("../../core/useAoVivo", () => ({
  useAoVivo: () => null,
  useListaAtualizada: () => {},
}));

// Jogador Pro em dia: libera Decks e Analytics do jogador
const PRO_JOGADOR = { jogador: new Date(Date.now() + 10 * 86_400_000).toISOString(), organizador: null };

function conta(parcial: Partial<AuthState> = {}): AuthState {
  return {
    session: { user: { id: "u1", email: "pessoa@teste.local" } } as AuthState["session"],
    isAdmin: false,
    isOrganizador: false,
    nomesJogador: [],
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

  it("voltar ao início só aparece na rodada 1", () => {
    preparar("admin", { isAdmin: true }, [emAndamento(1, false)]);
    const { unmount } = abrir(<AbaMesas torneio={emAndamento(1, false)} podeEditar />);
    expect(botao(/Voltar ao início/)).toBeTruthy();
    unmount();

    abrir(<AbaMesas torneio={emAndamento(2, false)} podeEditar />);
    expect(botao(/Voltar ao início/)).toBeNull();
  });

  it("no torneio finalizado a caixa de quem pagou fica travada", () => {
    const t = { ...emAndamento(1, true), finalizado: true };
    t.jogadores[1] = { ...t.jogadores[1], pago: false };
    preparar("admin", { isAdmin: true }, [t]);
    abrir(<AbaJogadores torneio={t} podeEditar />);
    expect((screen.getByRole("button", { name: "Pessoa: pago" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Outra Pessoa: não pago" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("adicionar jogador fica liberado na rodada 1 e travado na 2", () => {
    preparar("admin", { isAdmin: true });
    const { unmount } = abrir(<AbaJogadores torneio={emAndamento(1, false)} podeEditar />);
    expect((botao(/Adicionar/) as HTMLButtonElement).disabled).toBe(false);
    unmount();

    abrir(<AbaJogadores torneio={emAndamento(2, false)} podeEditar />);
    expect((botao(/Adicionar/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Depois da rodada 1 não dá mais/)).toBeTruthy();
  });

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

describe("criado por no card", () => {
  const contasNaRede = () => {
    const pedidos: string[] = [];
    (globalThis as any).__rede = async (url: string) => {
      pedidos.push(url);
      return new Response(JSON.stringify([
        { user_id: "dono", email: "dono@teste.local", nomes_jogador: ["Nome Vinculado", "Outro Nome"] },
        { user_id: "sem-nome", email: "semnome@teste.local", nomes_jogador: [] },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    };
    return pedidos;
  };
  const criado = (criadoPor: string) => ({ ...torneioCom("Pessoa"), id: criadoPor, nome: `De ${criadoPor}`, criadoPor });
  afterEach(() => { delete (globalThis as any).__rede; });

  it("o admin vê o primeiro nome vinculado de quem criou", async () => {
    contasNaRede();
    preparar("admin", { isAdmin: true }, [criado("dono")]);
    abrir(<TelaTorneios />);
    expect(await screen.findByText("Criado por Nome Vinculado")).toBeTruthy();
  });

  it("conta sem nome vinculado não mostra a linha nem o email", async () => {
    const pedidos = contasNaRede();
    preparar("admin", { isAdmin: true }, [criado("sem-nome")]);
    abrir(<TelaTorneios />);
    await waitFor(() => expect(pedidos.some((u) => u.includes("listar_usuarios"))).toBe(true));
    await new Promise((fim) => setTimeout(fim, 20));
    expect(screen.queryByText(/Criado por/)).toBeNull();
    expect(screen.queryByText(/semnome/)).toBeNull();
  });

  it("fora do modo admin, nem consulta a lista de contas", async () => {
    const pedidos = contasNaRede();
    preparar("organizador", { isAdmin: true, isOrganizador: true }, [criado("dono")]);
    abrir(<TelaTorneios />);
    await new Promise((fim) => setTimeout(fim, 20));
    expect(screen.queryByText(/Criado por/)).toBeNull();
    expect(pedidos.some((u) => u.includes("listar_usuarios"))).toBe(false);
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

  it("o selo do card destaca em dourado o torneio em andamento", () => {
    const criar = (nome: string, rodada: number, finalizado: boolean, dataCriacao = new Date().toISOString()) => ({
      ...torneioCom("Pessoa"), id: nome, nome, qtdRodadas: 4, rodadaAtual: rodada, finalizado, dataCriacao, dataRodadaAtual: dataCriacao,
    });
    const antigo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    preparar("admin", { isAdmin: true }, [
      criar("Novo", 0, false), criar("Jogando", 2, false), criar("Esquecido", 1, false, antigo), criar("Acabou", 4, true),
    ]);
    abrir(<TelaTorneios />);

    const selo = (nome: string) => {
      const card = screen.getAllByRole("heading", { level: 3, name: nome })[0].parentElement!;
      return within(card).getByText(/^(ABERTO|RODADA \d|PARADO|FINALIZADO)/);
    };
    expect(selo("Novo").textContent).toContain("ABERTO");
    expect(selo("Jogando").textContent).toContain("RODADA 2 DE 4");
    expect(selo("Jogando").style.background).toBe("var(--brand-1)");
    expect(selo("Esquecido").textContent).toContain("PARADO");
    expect(selo("Esquecido").style.color).toBe("var(--warn)");
    expect(selo("Acabou").textContent).toContain("FINALIZADO");
    expect(selo("Acabou").querySelector("svg")).toBeTruthy(); // a coroa agora é ícone, não emoji
  });

  it("a regra de desempate aparece em vermelho acima da tabela, para todos", () => {
    render(<AbaRanking torneio={torneioCom("Pessoa")} />);

    const aviso = screen.getByText(/Desempate oficial MTG/);
    expect(aviso.style.color).toBe("var(--critical)");
    expect(aviso.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("barra inferior do celular", () => {
  const barra = () => screen.queryByRole("navigation", { name: "Navegação principal" });
  const itens = () => within(barra()!).getAllByRole("button").map((b) => b.textContent);
  afterEach(() => useStore.setState({ tela: "torneios" }));

  it("mostra só o que cada papel pode abrir", () => {
    preparar("admin", { isAdmin: true });
    useStore.setState({ tela: "torneios" });
    abrir(<BarraInferior />);
    expect(itens()).toEqual(["Torneios", "Analytics", "Decks", "Usuários"]);
    cleanup();

    preparar("organizador", { isOrganizador: true });
    abrir(<BarraInferior />);
    expect(itens()).toEqual(["Torneios", "Analytics"]);
    cleanup();

    preparar("jogador", {});
    abrir(<BarraInferior />);
    expect(itens()).toEqual(["Torneios", "Desempenho"]);
  });

  it("navega e marca a tela aberta", () => {
    preparar("admin", { isAdmin: true });
    useStore.setState({ tela: "torneios" });
    abrir(<BarraInferior />);

    fireEvent.click(screen.getByRole("button", { name: "Decks" }));
    expect(useStore.getState().tela).toBe("decks");
    expect(screen.getByRole("button", { name: "Decks" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Torneios" }).getAttribute("aria-current")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Torneios" }));
    expect(useStore.getState().tela).toBe("torneios");
  });

  it("o ícone de decks só fica dourado com a tela de decks aberta", () => {
    preparar("admin", { isAdmin: true });
    useStore.setState({ tela: "torneios" });
    abrir(<BarraInferior />);
    const corDoIcone = () => screen.getByRole("button", { name: "Decks" }).querySelector("svg")!.getAttribute("stroke");
    expect(corDoIcone()).toBe("currentColor");

    fireEvent.click(screen.getByRole("button", { name: "Decks" }));
    expect(corDoIcone()).toBe("var(--brand-1)");
  });

  it("some dentro de um torneio e sem login", () => {
    preparar("admin", { isAdmin: true });
    useStore.setState({ tela: "torneio" });
    abrir(<BarraInferior />);
    expect(barra()).toBeNull();
    cleanup();

    preparar("admin", { session: null });
    useStore.setState({ tela: "torneios" });
    abrir(<BarraInferior />);
    expect(barra()).toBeNull();
  });

  it("o botão redondo abre o novo torneio, só para quem edita", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);
    const redondo = screen.getAllByRole("button", { name: "Novo torneio" }).find((b) => b.textContent === "+")!;
    fireEvent.click(redondo);
    expect(screen.getByRole("heading", { name: "Novo Torneio" })).toBeTruthy();
    cleanup();

    preparar("jogador", {});
    abrir(<TelaTorneios />);
    expect(screen.queryByRole("button", { name: "Novo torneio" })).toBeNull();
  });
});

describe("ações no card do torneio", () => {
  const umTorneio = () => ({ ...torneioCom("Pessoa"), id: "um", nome: "Liga Um" });

  it("clicar no card abre o torneio", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [umTorneio()]);
    abrir(<TelaTorneios />);

    fireEvent.click(screen.getByText("JOGADORES"));
    expect(useStore.getState().tela).toBe("torneio");
    expect(useStore.getState().torneioId).toBe("um");
    useStore.getState().voltarParaLista();
  });

  it("o nome do torneio também abre, pelo teclado", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [umTorneio()]);
    abrir(<TelaTorneios />);

    fireEvent.click(screen.getByRole("button", { name: "Liga Um" }));
    expect(useStore.getState().tela).toBe("torneio");
    useStore.getState().voltarParaLista();
  });

  it("jogador não vê os ícones de ação", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [umTorneio()]);
    abrir(<TelaTorneios />);
    for (const acao of ["Editar", "Exportar", "Excluir"]) {
      expect(screen.queryByRole("button", { name: `${acao} Liga Um` })).toBeNull();
    }
  });

  it("os ícones agem sem abrir o torneio", async () => {
    preparar("admin", { isAdmin: true }, [umTorneio()]);
    useStore.getState().voltarParaLista();
    abrir(<TelaTorneios />);

    fireEvent.click(screen.getByRole("button", { name: "Editar Liga Um" }));
    expect(screen.getByText("Editar Torneio")).toBeTruthy();
    expect((screen.getByDisplayValue("Liga Um") as HTMLInputElement).value).toBe("Liga Um");
    expect(useStore.getState().tela).toBe("torneios");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Excluir Liga Um" }));
    expect(await screen.findByText(/Excluir permanentemente o torneio "Liga Um"/)).toBeTruthy();
    expect(useStore.getState().tela).toBe("torneios");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(useStore.getState().torneios).toHaveLength(1);
  });

  it("exportar baixa o arquivo sem abrir o torneio", () => {
    URL.createObjectURL = vi.fn(() => "blob:teste");
    URL.revokeObjectURL = vi.fn();
    const clicar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    preparar("admin", { isAdmin: true }, [umTorneio()]);
    useStore.getState().voltarParaLista();
    abrir(<TelaTorneios />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar Liga Um" }));
    expect(clicar).toHaveBeenCalled();
    expect(useStore.getState().tela).toBe("torneios");
    clicar.mockRestore();
  });
});

describe("barra da lista de torneios", () => {
  it("a barra não tem mais o menu Torneio, e Importar / Exportar continua para quem edita", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);

    expect(screen.queryByRole("button", { name: /^Torneio/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Importar \/ Exportar/ }));
    const textos = screen.getByRole("menu").textContent;
    expect(textos).toContain("Importar");
    expect(textos).toContain("Backup completo");
    expect(textos).toContain("Torneio de teste");
    expect(textos).not.toContain("Torneio selecionado");
  });

  it("o menu fecha ao clicar fora, com Esc e ao escolher um item", () => {
    preparar("admin", { isAdmin: true });
    abrir(<TelaTorneios />);
    const botao = screen.getByRole("button", { name: /Importar \/ Exportar/ });

    fireEvent.click(botao);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(botao);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(botao);
    fireEvent.click(screen.getByRole("menuitem", { name: /Torneio \(JSON\)/ }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("jogador não tem menus de edição nem botão Abrir na barra", () => {
    preparar("jogador", {});
    abrir(<TelaTorneios />);

    expect(screen.queryByRole("button", { name: "Abrir" })).toBeNull();
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

describe("sobre o app", () => {
  it("o menu da conta abre o Sobre com a descrição e a versão", () => {
    preparar("jogador", {});
    abrir(<AuthChip auth={conta({ nomesJogador: ["Alguém"] })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Sobre o app/ }));
    expect(screen.getByText(/organiza torneios de Magic/)).toBeTruthy();
    expect(screen.getByText(/^Versão \d+\.\d+\.\d+$/)).toBeTruthy();
    expect(screen.getByText(/Ajude o projeto/)).toBeTruthy();
  });
});

describe("excluir a própria conta", () => {
  it("o menu da conta abre a exclusão, que pede a senha antes de excluir", async () => {
    preparar("jogador", {});
    const sair = vi.fn();
    abrir(<AuthChip auth={conta({ nomesJogador: ["Alguém"] })} onSair={sair} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    // Fora da barra com desfoque, direto no body: assim o pop-up fica no meio da tela
    expect(screen.getByText("Excluir minha conta", { selector: "h2" }).closest(".fixed")!.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    expect(screen.getByRole("alert").textContent).toMatch(/senha/);
    expect(contas.excluirMinhaConta).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Sua senha"), { target: { value: "segredo123" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    await waitFor(() => expect(sair).toHaveBeenCalled());
    expect(contas.excluirMinhaConta).toHaveBeenCalledWith("segredo123");
  });
});

describe("mesas e tempo liberados na tela Usuários", () => {
  afterEach(() => { delete (globalThis as any).__rede; });

  const redeDeUsuarios = (permissoes: object[]) => {
    const gravados: any[] = [];
    (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
      if (url.includes("listar_usuarios")) {
        return json([{ user_id: "j1", email: "jog@teste.local", eh_admin: false, eh_organizador: false, nomes_jogador: ["Jog"] }]);
      }
      if (url.includes("permissoes_jogador")) {
        if (init?.method === "POST") { gravados.push(JSON.parse(String(init.body))); return json([], 201); }
        return json(permissoes);
      }
      return json([]);
    };
    return gravados;
  };

  it("a coluna Pro mostra o plano e o admin dá dias de cortesia", async () => {
    const daqui10 = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const concedidos: any[] = [];
    (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
      if (url.includes("listar_usuarios")) {
        return json([
          { user_id: "j1", email: "jog@teste.local", eh_admin: false, eh_organizador: false, nomes_jogador: ["Jog"] },
          { user_id: "o1", email: "org@teste.local", eh_admin: false, eh_organizador: true, nomes_jogador: ["Org"] },
        ]);
      }
      if (url.includes("rpc/conceder_pro")) {
        concedidos.push(JSON.parse(String(init?.body)));
        return json(daqui10);
      }
      if (url.includes("assinaturas_pro")) return json([{ user_id: "o1", plano: "organizador", pro_ate: daqui10 }]);
      return json([]);
    };
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);

    const doOrg = await screen.findByRole("button", { name: "Planos Pro de Org" });
    expect(doOrg.textContent).toMatch(/Organizador/);
    const doJog = screen.getByRole("button", { name: "Planos Pro de Jog" });
    expect(doJog.textContent).toBe("—");

    fireEvent.click(doJog);
    expect(screen.getByRole("radio", { name: "Jogador Pro" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "90 dias" }));
    fireEvent.click(screen.getByRole("button", { name: "Dar 90 dias de Jogador Pro" }));
    await waitFor(() => expect(concedidos[0]).toEqual({ p_user: "j1", p_dias: 90, p_plano: "jogador" }));
  });

  it("o admin convida por e-mail, com o nome de jogador opcional", async () => {
    const convites: any[] = [];
    (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
      if (url.includes("functions/v1/convidar-usuario")) {
        const corpo = JSON.parse(String(init?.body));
        convites.push(corpo);
        return corpo.email === "ja@teste.local" ? json({ erro: "Esse e-mail já tem conta" }, 400) : json({ ok: true });
      }
      return json([]);
    };
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);

    const email = await screen.findByLabelText("E-mail para convidar");
    fireEvent.change(email, { target: { value: "novo@teste.local" } });
    fireEvent.change(screen.getByLabelText("Nome de jogador do convidado"), { target: { value: "Novato" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(convites[0]).toEqual({ email: "novo@teste.local", nome: "Novato" }));
    await waitFor(() => expect((email as HTMLInputElement).value).toBe(""));

    fireEvent.change(email, { target: { value: "ja@teste.local" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Esse e-mail já tem conta");
  });

  it("mostra quem aceitou a política de privacidade", async () => {
    (globalThis as any).__rede = async (url: string) => {
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      if (url.includes("listar_usuarios")) {
        return json([
          { user_id: "a1", email: "aceitou@teste.local", eh_admin: false, eh_organizador: false, nomes_jogador: ["Aceitou"] },
          { user_id: "p1", email: "pendente@teste.local", eh_admin: false, eh_organizador: false, nomes_jogador: ["Pendente"] },
        ]);
      }
      if (url.includes("listar_aceites_privacidade")) {
        return json([
          { user_id: "a1", versao: VERSAO_PRIVACIDADE, aceita_em: "2026-11-08T15:00:00Z" },
          { user_id: "p1", versao: null, aceita_em: null },
        ]);
      }
      return json([]);
    };
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);

    expect(await screen.findByTitle(/^Aceitou em/)).toBeTruthy();
    expect(screen.getByTitle(/^Ainda não aceitou/)).toBeTruthy();
    expect(screen.getByText(/1 de 2 aceitaram a política/)).toBeTruthy();
  });

  it("o admin libera a mesa de quem não tem Pro; o tempo é só do Pro", async () => {
    const gravados = redeDeUsuarios([]);
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);

    const mesas = await screen.findByRole("switch", { name: "Mesas para Jog" });
    const tempo = screen.getByRole("switch", { name: "Tempo para Jog" }) as HTMLButtonElement;
    expect(mesas.getAttribute("aria-checked")).toBe("false");
    expect(tempo.disabled).toBe(true);
    expect(tempo.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(mesas);
    await waitFor(() => expect(mesas.getAttribute("aria-checked")).toBe("true"));
    expect(gravados[0]).toMatchObject({ user_id: "j1", ver_mesas: true, ver_tempo: false });
    expect(tempo.disabled).toBe(true);
  });

  it("com Pro, mesas e tempo ficam acesos sem depender das chaves", async () => {
    const daqui10 = new Date(Date.now() + 10 * 86_400_000).toISOString();
    (globalThis as any).__rede = async (url: string) => {
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      if (url.includes("listar_usuarios")) {
        return json([{ user_id: "j1", email: "jog@teste.local", eh_admin: false, eh_organizador: false, nomes_jogador: ["Jog"] }]);
      }
      if (url.includes("assinaturas_pro")) return json([{ user_id: "j1", plano: "jogador", pro_ate: daqui10 }]);
      return json([]);
    };
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);
    const mesas = await screen.findByRole("switch", { name: "Mesas para Jog" });
    await waitFor(() => expect(mesas.getAttribute("aria-checked")).toBe("true"));
    expect((mesas as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("switch", { name: "Tempo para Jog" }).getAttribute("aria-checked")).toBe("true");
  });

  it("sem a tabela no banco, avisa para rodar o SQL", async () => {
    (globalThis as any).__rede = async (url: string) => url.includes("permissoes_jogador")
      ? new Response(JSON.stringify({ message: "relation does not exist" }), { status: 404, headers: { "content-type": "application/json" } })
      : new Response(JSON.stringify(url.includes("listar_usuarios") ? [] : []), { status: 200, headers: { "content-type": "application/json" } });
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);
    expect(await screen.findByText(/permissoes_jogador.sql/)).toBeTruthy();
  });

  it("o relógio da rodada só aparece com o tempo liberado", () => {
    const t = torneioCom("Pessoa");
    t.jogadores.push(novoJogador(3, "Terceira Pessoa", "", true));
    t.rodadaAtual = 1;
    t.mesas = [{
      numero: 1, rodada: 1, jogadoresIds: [1, 2, 3], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [],
    } as unknown as Torneio["mesas"][number]];
    preparar("jogador", { nomesJogador: ["Pessoa"], verMesas: true }, [t]);

    const { unmount } = abrir(<AbaMesas torneio={t} podeEditar={false} verTempo />);
    expect(screen.getByText(/Aguardando o início do tempo/)).toBeTruthy();
    unmount();

    abrir(<AbaMesas torneio={t} podeEditar={false} verTempo={false} />);
    expect(screen.getAllByText("Mesa 1").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Aguardando o início do tempo/)).toBeNull();
  });
});

describe("abas do torneio", () => {
  const abas = () => screen.getAllByRole("button").map((b) => b.textContent ?? "");

  it("no torneio finalizado o jogador vê Ranking e Histórico, e Mesas se liberadas", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"], verMesas: true }, [{ ...torneioCom("Pessoa"), finalizado: true }]);
    abrir(<TelaTorneio />);
    const textos = abas().join(" | ");

    for (const visivel of ["Mesas", "Ranking", "Histórico"]) expect(textos).toContain(visivel);
    for (const oculta of ["Financeiro", "Premiação", "Sorteios", "Jogadores"]) expect(textos).not.toContain(oculta);
  });

  it("com o torneio em andamento o jogador não vê nada dele", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [{ ...torneioCom("Pessoa"), rodadaAtual: 1 }]);
    abrir(<TelaTorneio />);
    const textos = abas().join(" | ");
    for (const oculta of ["Mesas", "Ranking", "Histórico"]) expect(textos).not.toContain(oculta);
    expect(screen.getByText(/aparecem aqui quando o torneio for finalizado/)).toBeTruthy();
  });

  it("em andamento, com as mesas liberadas, o jogador vê só Mesas", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"], verMesas: true }, [torneioCom("Pessoa")]);
    abrir(<TelaTorneio />);
    const textos = abas().join(" | ");
    expect(textos).toContain("Mesas");
    expect(textos).not.toContain("Ranking");
    expect(textos).not.toContain("Histórico");
  });

  it("o desempenho do jogador ignora torneios em andamento", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"], proAte: PRO_JOGADOR }, [torneioCom("Pessoa")]);
    abrir(<TelaAnalytics />);
    expect(screen.queryByRole("heading", { name: /Partidas recentes/ })).toBeNull();
  });

  it("admin no modo jogador vê as mesas mesmo sem liberar", () => {
    preparar("jogador", { isAdmin: true, nomesJogador: ["Pessoa"] }, [torneioCom("Pessoa")]);
    abrir(<TelaTorneio />);
    expect(abas().join(" | ")).toContain("Mesas");
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
  it("decks são do admin e do Jogador Pro; só o admin atualiza a lista", () => {
    const entra = (modo: ModoView, auth: Partial<AuthState>) => {
      preparar(modo, auth);
      abrir(<TelaTorneios />);
      const temBotao = !!screen.queryByRole("button", { name: /Decks/ });
      cleanup();
      abrir(<TelaDecks />);
      const restrito = !!screen.queryByText(/Acesso restrito/);
      const temLista = !!screen.queryByRole("searchbox");
      const atualiza = !!screen.queryByRole("button", { name: /Atualizar decks/ });
      cleanup();
      return { temBotao, restrito, temLista, atualiza };
    };
    const bloqueado = { temBotao: false, restrito: true, temLista: false, atualiza: false };
    const comPro = { temBotao: true, restrito: false, temLista: true, atualiza: false };
    expect(entra("jogador", {})).toEqual(bloqueado);
    expect(entra("organizador", { isOrganizador: true })).toEqual(bloqueado);
    expect(entra("jogador", { proAte: PRO_JOGADOR })).toEqual(comPro);
    expect(entra("organizador", { isOrganizador: true, proAte: { jogador: null, organizador: PRO_JOGADOR.jogador } })).toEqual(comPro);
    // Admin tem o Pro em qualquer modo, mas só atualiza a lista no modo admin
    expect(entra("organizador", { isAdmin: true, isOrganizador: true })).toEqual(comPro);
    expect(entra("admin", { isAdmin: true })).toEqual({ temBotao: true, restrito: false, temLista: true, atualiza: true });
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
        {
          name: "Bicho", count: 1, type: "Creature — Beast", types: ["Creature"], identifiers: { scryfallId: "bi01" },
          manaCost: "{1}{G}", text: "{T}: Add {G}.", power: "2", toughness: "2", rarity: "uncommon", artist: "Fulana", setCode: "C16", number: "7",
          foreignData: [{ language: "Portuguese (Brazil)", name: "Bichinho", type: "Criatura — Fera", text: "{T}: Adicione {G}." }],
        },
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

    it("sem tokens na lista do deck, mostra os que as cartas criam, sem quantidade", async () => {
      const semTokens = { data: {
        commander: [{ name: "Comandante", count: 1, types: ["Creature"], identifiers: { scryfallId: "c1" } }],
        mainBoard: [{ name: "Bicho", count: 1, types: ["Creature"], identifiers: { scryfallId: "c2" } }],
      } };
      (globalThis as any).__rede = async (url: string, init: RequestInit) => {
        if (url.endsWith("DeckList.json")) return json({ data: [{ code: "CMD", name: "Counterpunch", fileName: "Counterpunch_CMD", type: "Commander Deck" }] });
        if (url.includes("scryfall")) {
          const ids = JSON.parse(String(init.body)).identifiers.map((i: any) => i.id);
          return ids.includes("c1")
            ? json({ data: [{ id: "c2", all_parts: [{ id: "t1", component: "token", name: "Saproling", type_line: "Token Creature" }] }] })
            : json({ data: [{ id: "t1", power: "1", toughness: "1" }] });
        }
        return json(semTokens);
      };
      abrirDeck(/^Counterpunch$/);

      const tokens = within(await screen.findByRole("region", { name: "Tokens" }));
      expect(tokens.getByText("Saproling")).toBeTruthy();
      expect(tokens.getByText("1/1")).toBeTruthy();
      expect(tokens.getByText(/que as cartas dele criam/)).toBeTruthy();
      expect(tokens.queryByText("0")).toBeNull();
    });

    it("passar o mouse na carta mostra a imagem, e sair esconde", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);
      const carta = within(await screen.findByRole("region", { name: "Criaturas" })).getByRole("button", { name: "Ver a carta Bicho" });

      fireEvent.pointerEnter(carta, { pointerType: "mouse", clientX: 100, clientY: 200 });
      const imagem = await screen.findByRole("img", { name: "Bicho" }) as HTMLImageElement;
      expect(imagem.src).toBe("https://cards.scryfall.io/normal/front/b/i/bi01.jpg");
      expect(screen.queryByRole("dialog")).toBeNull();

      fireEvent.pointerLeave(carta, { pointerType: "mouse" });
      expect(screen.queryByRole("img", { name: "Bicho" })).toBeNull();

      // Carta sem imagem não vira botão
      expect(screen.queryByRole("button", { name: "Ver a carta Floresta" })).toBeNull();
    });

    it("clicar com o mouse abre a carta em destaque", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);
      const carta = within(await screen.findByRole("region", { name: "Criaturas" })).getByRole("button", { name: "Ver a carta Bicho" });

      fireEvent.pointerDown(carta, { pointerType: "mouse" });
      fireEvent.click(carta);
      expect(within(screen.getByRole("dialog", { name: "Bicho" })).getByRole("img", { name: "Bicho" })).toBeTruthy();
      fireEvent.click(screen.getByRole("dialog"));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("a carta aberta mostra a ficha, com o texto em português e o preço em desenvolvimento", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);
      fireEvent.click(within(await screen.findByRole("region", { name: "Criaturas" })).getByRole("button", { name: "Ver a carta Bicho" }));

      const ficha = within(screen.getByRole("region", { name: "Ficha da carta" }));
      expect(ficha.getByRole("heading", { name: "Bicho" })).toBeTruthy();
      expect(ficha.getByText("Bichinho")).toBeTruthy();
      expect(ficha.getByText("Criatura — Fera")).toBeTruthy();
      expect(ficha.getByText(/Adicione/)).toBeTruthy();
      expect(ficha.getByText("· Incomum")).toBeTruthy();
      expect(ficha.getByLabelText("Poder e resistência 2/2")).toBeTruthy();
      expect(ficha.getByLabelText("Custo {1}{G}")).toBeTruthy();
      expect(ficha.getByText("Em desenvolvimento")).toBeTruthy();
      expect(ficha.getByText("Arte: Fulana")).toBeTruthy();

      // Clicar dentro da ficha não fecha, e dá para trocar para o texto oficial em inglês
      fireEvent.click(ficha.getByRole("button", { name: "Inglês" }));
      expect(ficha.getByText("Creature — Beast")).toBeTruthy();
      expect(ficha.getByText(/: Add/)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Bicho" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("clicar no comandante abre a ficha dele, sem prévia ao passar o mouse", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);
      const comandante = within(await screen.findByRole("region", { name: "Comandante" })).getByRole("button", { name: "Ver a carta Atraxa, Praetors' Voice" });

      fireEvent.pointerEnter(comandante, { pointerType: "mouse", clientX: 10, clientY: 10 });
      await new Promise((fim) => setTimeout(fim, 200));
      expect(screen.getAllByRole("img", { name: "Atraxa, Praetors' Voice" })).toHaveLength(1);

      fireEvent.click(comandante);
      const ficha = within(screen.getByRole("region", { name: "Ficha da carta" }));
      expect(ficha.getByRole("heading", { name: "Atraxa, Praetors' Voice" })).toBeTruthy();
      expect(ficha.getByText("Sem texto de regras.")).toBeTruthy();
      expect(ficha.queryByRole("group", { name: "Idioma do texto" })).toBeNull();
    });

    it("na lista, passar o mouse no deck mostra o comandante, e clicar abre o deck", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      preparar("admin", { isAdmin: true });
      abrir(<TelaDecks />);
      const linha = screen.getAllByRole("button", { name: /^Breed Lethality$/ })[0].closest("tr")!;

      fireEvent.pointerEnter(linha, { pointerType: "mouse", clientX: 50, clientY: 50 });
      const imagem = await screen.findByRole("img", { name: "Atraxa, Praetors' Voice" }) as HTMLImageElement;
      expect(decodeURIComponent(imagem.src)).toContain("cards/named?format=image&version=normal&exact=Atraxa, Praetors' Voice&set=cm2");

      // Se a impressão do deck não existir, tenta qualquer outra
      fireEvent.error(imagem);
      expect(imagem.src).not.toContain("&set=");

      fireEvent.pointerLeave(linha, { pointerType: "mouse" });
      expect(screen.queryByRole("img", { name: "Atraxa, Praetors' Voice" })).toBeNull();

      fireEvent.click(linha);
      expect(await screen.findByRole("region", { name: "Comandante" })).toBeTruthy();
    });

    it("decks com dois comandantes mostram as duas cartas", async () => {
      preparar("admin", { isAdmin: true });
      abrir(<TelaDecks />);
      const linha = screen.getAllByRole("button", { name: /^Food and Fellowship$/ })[0].closest("tr")!;
      fireEvent.pointerEnter(linha, { pointerType: "mouse", clientX: 50, clientY: 50 });
      const imagens = await screen.findAllByRole("img", { name: /Frodo/ });
      expect(imagens.map((i) => decodeURIComponent((i as HTMLImageElement).src).match(/exact=([^&]+)/)![1])).toEqual([
        "Frodo, Adventurous Hobbit",
        "Sam, Loyal Attendant",
      ]);
    });

    it("no celular, tocar abre a carta em destaque e tocar de novo fecha", async () => {
      (globalThis as any).__rede = async (url: string) =>
        url.endsWith("DeckList.json") ? json(lista) : url.includes("Arquivo_C16") ? json(deck) : json({}, 404);
      abrirDeck(/^Breed Lethality$/);
      const carta = within(await screen.findByRole("region", { name: "Criaturas" })).getByRole("button", { name: "Ver a carta Bicho" });

      fireEvent.pointerDown(carta, { pointerType: "touch" });
      fireEvent.pointerEnter(carta, { pointerType: "touch" });
      fireEvent.click(carta);
      const destaque = screen.getByRole("dialog", { name: "Bicho" });
      expect(within(destaque).getByRole("img", { name: "Bicho" })).toBeTruthy();

      fireEvent.click(destaque);
      expect(screen.queryByRole("dialog")).toBeNull();

      // Pelo teclado também abre, e Esc fecha
      fireEvent.keyDown(carta, { key: "Enter" });
      expect(screen.getByRole("dialog", { name: "Bicho" })).toBeTruthy();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
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
    expect(titulos).toContain("Combinação");
    expect(titulos).not.toContain("Cartas");
    expect(titulos).not.toContain("Tokens");
    expect(screen.getAllByText(/Commander 2016/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("C16").length).toBeGreaterThan(0);
    expect(titulos).toEqual(["Deck", "Comandante", "Cores", "Combinação", "Coleção", "Sigla", "Lançamento"]);

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
    preparar("jogador", { nomesJogador: ["Pessoa"], proAte: PRO_JOGADOR }, [{ ...comDeck(), finalizado: true }]);
    abrir(<TelaAnalytics />);

    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    const decks = titulos.findIndex((t) => t.includes("Decks mais usados"));
    expect(titulos[decks + 1]).toContain("Histórico de torneios");
  });

  it("jogador vê os próprios decks, com o atual marcado, sem as métricas gerais", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"], proAte: PRO_JOGADOR }, [{ ...comDeck(), finalizado: true }]);
    abrir(<TelaAnalytics />);

    const secao = within(screen.getByRole("heading", { name: /Decks mais usados/ }).closest(".ds-card") as HTMLElement);
    expect(secao.getByText(/Breed Lethality/)).toBeTruthy();
    expect(secao.getByText("Atraxa, Praetors' Voice")).toBeTruthy();
    expect(secao.getByText("ATUAL")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Comandantes que mais ganham/ })).toBeNull();
  });
});

describe("mesa do jogador sem Pro", () => {
  const rodadaComDuasMesas = () => {
    const t = torneioCom("Pessoa");
    for (let id = 3; id <= 6; id++) t.jogadores.push(novoJogador(id, `Jogador ${id}`, "", true));
    t.rodadaAtual = 1;
    t.mesas = [
      { numero: 1, rodada: 1, jogadoresIds: [1, 2, 3], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [] },
      { numero: 2, rodada: 1, jogadoresIds: [4, 5, 6], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [] },
    ] as unknown as Torneio["mesas"];
    return t;
  };

  it("sem o Pro vê só a própria mesa; com o Pro, todas", () => {
    const t = rodadaComDuasMesas();
    preparar("jogador", { nomesJogador: ["Pessoa"], verMesas: true }, [t]);
    const { unmount } = abrir(<AbaMesas torneio={t} podeEditar={false} verTempo={false} soMinhaMesa />);
    expect(screen.getByText(/Sua mesa/)).toBeTruthy();
    expect(screen.queryByText(/Mesas em andamento/)).toBeNull();
    unmount();

    abrir(<AbaMesas torneio={t} podeEditar={false} verTempo />);
    expect(screen.getByText(/Sua mesa/)).toBeTruthy();
    expect(screen.getByText(/Mesas em andamento/)).toBeTruthy();
  });
});

describe("desempenho do jogador", () => {
  it("sem o Jogador Pro, o Analytics mostra o convite", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, []);
    abrir(<TelaAnalytics />);
    expect(screen.getByText(/Analytics é do Jogador Pro/)).toBeTruthy();
  });

  it("o histórico de torneios vem depois de Partidas recentes", () => {
    const t = { ...torneioCom("Pessoa"), finalizado: true };
    preparar("jogador", { nomesJogador: ["Pessoa"], proAte: PRO_JOGADOR }, [t]);
    abrir(<TelaAnalytics />);

    const recentes = screen.getByRole("heading", { name: /Partidas recentes/ });
    const historico = screen.getByRole("heading", { name: /Histórico de torneios/ });
    expect(recentes.compareDocumentPosition(historico) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Forma recente/)).toBeNull();
  });
});

describe("easter egg", () => {
  it("10 cliques seguidos no símbolo Umbra abrem a tela, e só o X fecha", () => {
    render(<SegredoUmbra />);
    const simbolo = screen.getByRole("img", { name: "Umbra" });
    for (let i = 0; i < 9; i++) fireEvent.click(simbolo);
    expect(screen.queryByRole("dialog", { name: /Avanti/ })).toBeNull();

    fireEvent.click(simbolo);
    expect(screen.getByRole("dialog", { name: /Avanti/ })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog", { name: /Avanti/ }).parentElement!); // fora da janela
    fireEvent.click(screen.getByRole("dialog", { name: /Avanti/ }));
    expect(screen.getByRole("dialog", { name: /Avanti/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: /Avanti/ })).toBeNull();
  });
});

describe("avisos da mesa", () => {
  afterEach(() => { avisos.atual = { estado: "sem-suporte", ocupado: false, alternar: vi.fn(async () => {}) }; localStorage.clear(); });

  it("convida a ligar os avisos quem tem Mesas e o Jogador Pro, e some no Agora não", () => {
    avisos.atual = { estado: "desligado", ocupado: false, alternar: vi.fn(async () => {}) };
    preparar("jogador", { verMesas: true, nomesJogador: ["Pessoa"], proAte: PRO_JOGADOR });
    abrir(<TelaTorneios />);
    expect(screen.getByText(/Receba sua mesa no celular/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByText(/Receba sua mesa no celular/)).toBeNull();
  });

  it("não convida quem não tem as mesas liberadas", () => {
    avisos.atual = { estado: "desligado", ocupado: false, alternar: vi.fn(async () => {}) };
    preparar("jogador", { verMesas: false, nomesJogador: ["Pessoa"] });
    abrir(<TelaTorneios />);
    expect(screen.queryByText(/Receba sua mesa no celular/)).toBeNull();
  });

  it("a rodada em andamento pode ser avisada de novo pelo botão", async () => {
    const t = torneioCom("Pessoa");
    t.jogadores.push(novoJogador(3, "Terceira Pessoa", "", true));
    t.rodadaAtual = 2;
    t.mesas = [{
      numero: 1, rodada: 2, jogadoresIds: [1, 2, 3], finalizada: false, vencedorId: null, eliminacoes: [], empateTopoIds: [],
    } as unknown as Torneio["mesas"][number]];
    preparar("admin", { isAdmin: true }, [t]);
    avisos.avisarMesas.mockClear();
    abrir(<AbaMesas torneio={t} podeEditar />);
    fireEvent.click(screen.getByRole("button", { name: /Avisar mesas/ }));
    await waitFor(() => expect(avisos.avisarMesas).toHaveBeenCalledWith(t.id, 2));
    expect(await screen.findByText(/Mesa avisada a 3 aparelhos/)).toBeTruthy();
  });

  it("ao iniciar a rodada, quem organiza avisa as mesas", async () => {
    const t = torneioCom("Pessoa");
    t.jogadores.push(novoJogador(3, "Terceira Pessoa", "", true));
    preparar("admin", { isAdmin: true }, [t]);
    useStore.setState({ iniciarRodada: () => {} });
    abrir(<AbaMesas torneio={t} podeEditar />);
    fireEvent.click(screen.getByRole("button", { name: /Iniciar rodada 1/ }));
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(avisos.avisarMesas).toHaveBeenCalledWith(t.id, 1));
  });
});

describe("busca na lista de torneios", () => {
  afterEach(() => { delete (globalThis as any).__rede; });
  const criar = (nome: string, criadoPor?: string) => ({ ...torneioCom("Pessoa"), id: nome, nome, criadoPor });

  it("o admin acha por torneio ou por quem organizou", async () => {
    (globalThis as any).__rede = async () => new Response(JSON.stringify([
      { user_id: "u-bia", email: "bia@teste.local", nomes_jogador: ["Bia"] },
    ]), { status: 200, headers: { "content-type": "application/json" } });
    preparar("admin", { isAdmin: true }, [criar("Liga Norte", "u-bia"), criar("Copa Sul")]);
    abrir(<TelaTorneios />);

    const busca = screen.getByLabelText("Buscar torneios") as HTMLInputElement;
    expect(busca.placeholder).toMatch(/organizador/);
    fireEvent.change(busca, { target: { value: "copa" } });
    expect(screen.queryByRole("heading", { level: 3, name: "Liga Norte" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3, name: "Copa Sul" }).length).toBeGreaterThan(0);

    fireEvent.change(busca, { target: { value: "bia" } });
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3, name: "Liga Norte" }).length).toBeGreaterThan(0));
    expect(screen.queryByRole("heading", { level: 3, name: "Copa Sul" })).toBeNull();
  });

  it("o calendário filtra pelo período de criação", () => {
    const antigo = { ...criar("Copa Antiga"), dataCriacao: "2026-01-10T12:00:00" };
    const novo = { ...criar("Copa Nova"), dataCriacao: "2026-11-05T12:00:00" };
    preparar("organizador", { isOrganizador: true, session: { user: { id: "u1" } } as any }, [
      { ...antigo, criadoPor: "u1" }, { ...novo, criadoPor: "u1" },
    ]);
    abrir(<TelaTorneios />);
    fireEvent.change(screen.getByLabelText("Criados a partir de"), { target: { value: "2026-11-01" } });
    expect(screen.queryByRole("heading", { level: 3, name: "Copa Antiga" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3, name: "Copa Nova" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getAllByRole("heading", { level: 3, name: "Copa Antiga" }).length).toBeGreaterThan(0);
  });

  it("organizador busca por torneio ou data; jogador não tem a barra", () => {
    preparar("organizador", { isOrganizador: true, session: { user: { id: "u1" } } as any }, [criar("Liga Norte", "u1")]);
    abrir(<TelaTorneios />);
    expect((screen.getByLabelText("Buscar torneios") as HTMLInputElement).placeholder).not.toMatch(/organizador/);
    fireEvent.change(screen.getByLabelText("Buscar torneios"), { target: { value: "xyz" } });
    expect(screen.getByText(/Nenhum torneio encontrado/)).toBeTruthy();
    cleanup();

    preparar("jogador", { nomesJogador: ["Pessoa"] }, [criar("Liga Norte")]);
    abrir(<TelaTorneios />);
    expect(screen.queryByLabelText("Buscar torneios")).toBeNull();
  });

  it("filtra por situação: em aberto, em andamento e finalizados", () => {
    const aberto = { ...criar("Copa Aberta", "u1"), rodadaAtual: 0 };
    const andamento = { ...criar("Copa Rolando", "u1"), rodadaAtual: 2 };
    const finalizado = { ...criar("Copa Encerrada", "u1"), rodadaAtual: 3, finalizado: true };
    preparar("organizador", { isOrganizador: true, session: { user: { id: "u1" } } as any }, [aberto, andamento, finalizado]);
    abrir(<TelaTorneios />);
    const titulo = (nome: string) => screen.queryAllByRole("heading", { level: 3, name: nome }).length > 0;

    fireEvent.click(screen.getByRole("radio", { name: /Em andamento/ }));
    expect([titulo("Copa Aberta"), titulo("Copa Rolando"), titulo("Copa Encerrada")]).toEqual([false, true, false]);
    fireEvent.click(screen.getByRole("radio", { name: /Finalizados/ }));
    expect([titulo("Copa Aberta"), titulo("Copa Rolando"), titulo("Copa Encerrada")]).toEqual([false, false, true]);
    fireEvent.click(screen.getByRole("radio", { name: /Em aberto/ }));
    expect([titulo("Copa Aberta"), titulo("Copa Rolando"), titulo("Copa Encerrada")]).toEqual([true, false, false]);
    expect(screen.getByRole("radio", { name: /Todos/ }).textContent).toMatch(/3/);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect([titulo("Copa Aberta"), titulo("Copa Rolando"), titulo("Copa Encerrada")]).toEqual([true, true, true]);
  });

  it("o jogador também filtra por situação", () => {
    preparar("jogador", { nomesJogador: ["Pessoa"] }, [criar("Liga Norte"), { ...criar("Copa Sul"), rodadaAtual: 3, finalizado: true }]);
    abrir(<TelaTorneios />);
    fireEvent.click(screen.getByRole("radio", { name: /Finalizados/ }));
    expect(screen.queryAllByRole("heading", { level: 3, name: "Liga Norte" })).toHaveLength(0);
    expect(screen.getAllByRole("heading", { level: 3, name: "Copa Sul" }).length).toBeGreaterThan(0);
  });
});

describe("escolha dos avisos na tela Usuários", () => {
  afterEach(() => { delete (globalThis as any).__rede; });

  it("o admin liga e desliga cada tipo de aviso", async () => {
    const mudancas: any[] = [];
    (globalThis as any).__rede = async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      if (url.includes("config_avisos")) {
        if (init?.method === "PATCH") { mudancas.push(JSON.parse(String(init.body))); return json([]); }
        return json({ mesa: true, extra: true, ultimo_turno: false, finalizado: true, aprovacao: true });
      }
      return json([]);
    };
    preparar("admin", { isAdmin: true });
    abrir(<TelaUsuarios />);
    fireEvent.click(await screen.findByRole("button", { name: /Configurar notificações/ }));

    const esgotado = await screen.findByRole("switch", { name: "Último turno" });
    await waitFor(() => expect(esgotado.getAttribute("aria-checked")).toBe("false"));
    expect(screen.getByRole("switch", { name: "Tempo extra" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(esgotado);
    await waitFor(() => expect(mudancas[0]).toMatchObject({ ultimo_turno: true }));
    expect(esgotado.getAttribute("aria-checked")).toBe("true");
  });
});
