import { useMemo, useState } from "react";
import { statusPro } from "../core/pro";
import { BloqueioPro } from "./BloqueioPro";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { AuthChip } from "./AuthChip";
import { calcularMetricas, metricasRecentes, type MetricasGlobais } from "../core/metricas";
import { comandanteDoDeck, coresDoDeck } from "../core/decks";
import { CoresMana } from "./ui/SimboloMana";
import { IconeDecks } from "./ui/LogoUmbra";
import {
  IconeAnalytics, IconeCombinacoes, IconeCoroa, IconeDado, IconeEspadas, IconeGota,
  IconeGrafico, IconeHistorico, IconePessoa, IconeRaio, IconeTrofeu,
  IconeAlvo, IconeEstrela, IconeFogo, IconeMedalha, IconeVoltar,
} from "./ui/Icones";
import {
  calcularDesempenho, listarNomesJogadores, mesmoJogador,
  type Conquista, type DesempenhoJogador, type EvolucaoJogador, type ResultadoMesa, type TorneioDoJogador,
} from "../core/desempenho";
import { partesDoTorneioVisiveis, podeEditarTorneios, torneiosVisiveis } from "../core/visibilidade";
import type { Torneio } from "../core/types";
import { FUNDO_DE_TELA } from "../banner-image";
import { formatarNumero, formatarReais } from "../core/formato";

type AbaAnalytics = "geral" | "jogador";

// Conquistas do jogador: o núcleo diz qual é, a tela escolhe o ícone
const ICONE_DA_CONQUISTA: Record<Conquista["icone"], (p: { tamanho?: number }) => JSX.Element> = {
  trofeu: IconeTrofeu, coroa: IconeCoroa, medalha: IconeMedalha, espadas: IconeEspadas,
  fogo: IconeFogo, alvo: IconeAlvo, estrela: IconeEstrela, relogio: IconeHistorico,
};

export function TelaAnalytics({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const torneiosTodos = useStore((s) => s.torneios);
  const voltar = useStore((s) => s.voltarParaLista);
  const modoView = useStore((s) => s.modoView);
  const auth = useAuth();
  // Admin vê todos, organizador os que criou e jogador aqueles em que jogou.
  // O jogador só vê resultados de torneio finalizado.
  const torneios = useMemo(
    () => torneiosVisiveis(torneiosTodos, modoView, auth)
      .filter((t) => partesDoTorneioVisiveis(t, podeEditarTorneios(modoView, auth), auth).resultados),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [torneiosTodos, modoView, auth.session?.user?.id, auth.isAdmin, auth.isOrganizador, auth.nomesJogador]
  );
  const metricas = useMemo(() => calcularMetricas(torneios), [torneios]);
  // Jogador vê só o próprio desempenho; visão geral e filtro de jogadores são de quem organiza
  const podeEditar = podeEditarTorneios(modoView, auth);
  const sincronizando = useStore((s) => s.sincronizando);
  const carregando = sincronizando || (!auth.perfilCarregado && !auth.perfilErro);
  const ult30 = useMemo(() => metricasRecentes(torneios, 30), [torneios]);
  const ult7 = useMemo(() => metricasRecentes(torneios, 7), [torneios]);

  const [aba, setAba] = useState<AbaAnalytics>("geral");

  return (
    <div
      className="min-h-screen text-fg"
      style={FUNDO_DE_TELA}
    >
      <div className="px-4 md:px-8 py-4 flex items-center gap-3">
        <button className="btn-ghost hidden md:block" onClick={voltar}><IconeVoltar cor="currentColor" /> Voltar</button>
        <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2 min-w-0" style={{ color: "var(--text-strong)" }}>
          <IconeAnalytics tamanho={28} /> {podeEditar ? "Analytics" : "Meu desempenho"}
        </h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </div>

      <main className="px-4 md:px-8 pb-24 md:pb-12 space-y-6">
        {!podeEditar && auth.perfilCarregado && !statusPro(auth).jogador ? (
          <BloqueioPro
            recurso="Analytics"
            descricao="Veja seu desempenho em todos os torneios: vitórias, rivais, conquistas e evolução ao longo do tempo."
          />
        ) : !podeEditar ? (
          <PainelJogador
            torneios={torneios}
            metricas={metricas}
            meusNomes={auth.nomesJogador}
            escolherJogador={false}
            carregando={carregando}
          />
        ) : torneios.length === 0 ? (
          <div className="ds-card text-center py-16" style={{ color: "var(--text-2)" }}>
            {carregando
              ? "Carregando torneios..."
              : modoView === "organizador"
                ? "Você ainda não organizou nenhum torneio."
                : "Nenhum torneio ainda — crie um torneio para ver estatísticas."}
          </div>
        ) : (
          <>
            <nav className="flex gap-1 border-b border-bg-cardalt">
              {([
                { id: "geral", icone: <IconeAnalytics />, label: "Visão geral" },
                { id: "jogador", icone: <IconePessoa />, label: "Desempenho do jogador" },
              ] as const).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`px-3 md:px-4 py-2 rounded-t-lg text-sm font-semibold transition
                              ${aba === a.id
                                ? "bg-bg-panel text-acento border-b-2 border-acento"
                                : "text-fg-dim hover:text-fg hover:bg-bg-panel/40"}`}
                >
                  <span className="mr-1">{a.icone}</span>{a.label}
                </button>
              ))}
            </nav>

            {aba === "jogador" ? (
              <PainelJogador
                torneios={torneios}
                metricas={metricas}
                meusNomes={auth.nomesJogador}
                escolherJogador
                carregando={carregando}
              />
            ) : (
              <>
            <div className="text-xs" style={{ color: "var(--text-2)" }}>
              {modoView === "admin" ? "Mostrando todos os torneios." : "Mostrando os torneios que você organizou."}
            </div>

            {/* KPIs principais */}
            <section>
              <div className="ds-sect">Visão geral</div>
              <div className="ds-grid ds-g4">
                <KpiTile
                  label="Torneios"
                  valor={metricas.totalTorneios.toLocaleString("pt-BR")}
                  sub={`${metricas.torneiosFinalizados} finalizados`}
                />
                <KpiTile
                  label="Jogadores únicos"
                  valor={metricas.totalJogadoresUnicos.toLocaleString("pt-BR")}
                  sub={`média ${formatarNumero(metricas.mediaJogadoresPorTorneio, 1)} por torneio`}
                />
                <KpiTile
                  label="Partidas disputadas"
                  valor={metricas.totalPartidas.toLocaleString("pt-BR")}
                  sub={`${metricas.empatesPorTempo} empates por tempo`}
                />
                <KpiTile
                  label="Arrecadação total"
                  valor={formatarReais(metricas.totalArrecadado)}
                  sub="todos os torneios"
                />
              </div>
            </section>

            {/* Tendências recentes */}
            <section>
              <div className="ds-sect">Atividade recente</div>
              <div className="ds-grid ds-g3">
                <TrendCard titulo="Últimos 7 dias" m={ult7} />
                <TrendCard titulo="Últimos 30 dias" m={ult30} />
                <TrendCard titulo="Histórico total" m={{
                  qtd: metricas.totalTorneios,
                  participantes: metricas.rankingJogadores.reduce((s, j) => s + j.torneios, 0),
                  partidas: metricas.totalPartidas,
                }} />
              </div>
            </section>

            {/* Ranking de jogadores */}
            <section className="ds-grid ds-g2">
              <div className="ds-card">
                <div className="ds-card-h">
                  <h3><IconeTrofeu /> Top jogadores (por campeonatos)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
                    <thead>
                      <tr className="tabela-cab">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Jogador</th>
                        <th className="text-right py-2"><IconeTrofeu tamanho={13} /></th>
                        <th className="text-right py-2">Torn.</th>
                        <th className="text-right py-2">V</th>
                        <th className="text-right py-2">WR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricas.rankingJogadores.slice(0, 15).map((j, i) => (
                        <tr key={j.nome} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                          <td className="py-1.5 font-bold" style={{ color: i < 3 ? "var(--brand-1)" : "var(--text-2)" }}>
                            {i + 1}
                          </td>
                          <td className="py-1.5" style={{ color: "var(--text-strong)" }}>{j.nome}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: "var(--warn)" }}>
                            {j.campeonatos || "—"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{j.torneios}</td>
                          <td className="py-1.5 text-right tabular-nums">{j.vitorias}</td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>
                            {(j.winrate * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="ds-card">
                <div className="ds-card-h">
                  <h3><IconeDecks tamanho={16} /> Decks mais usados</h3>
                </div>
                {metricas.topDecks.length === 0 ? (
                  <div style={{ color: "var(--text-muted-ds)" }} className="text-sm py-4 text-center">
                    Nenhum deck registrado ainda. Adicione decks aos jogadores.
                  </div>
                ) : (
                  <BarraHorizontal dados={metricas.topDecks.map((d) => ({ label: d.nome, valor: d.usos }))} />
                )}
              </div>
            </section>

            <section>
              <div className="ds-sect">Decks e comandantes</div>
              <KpisDeCores metricas={metricas} />
              <div className="ds-grid ds-g2">
                <CartaoCores metricas={metricas} />
                <CartaoComandantes metricas={metricas} />
              </div>
              <div className="mt-4">
                <CartaoCombinacoes metricas={metricas} />
              </div>
            </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const NOME_COR: Record<string, string> = {
  W: "Branco", U: "Azul", B: "Preto", R: "Vermelho", G: "Verde", C: "Incolor",
};

const SEM_LISTA = "Aparece quando os jogadores tiverem decks da lista de Decks.";

function NotaDeckProprio({ metricas }: { metricas: MetricasGlobais }) {
  if (metricas.inscricoesSemComandante === 0) return null;
  return (
    <div className="text-xs mt-3" style={{ color: "var(--text-muted-ds)" }}>
      {metricas.inscricoesSemComandante} de {metricas.inscricoesComDeck} inscrições com deck ficaram de fora, por usarem um deck que não está na lista.
    </div>
  );
}

function KpisDeCores({ metricas }: { metricas: MetricasGlobais }) {
  if (metricas.combinacoes.length === 0) return null;
  const maisUsada = metricas.combinacoes[0];
  const maisVence = [...metricas.combinacoes].sort((a, b) => b.vitorias - a.vitorias || b.winrate - a.winrate)[0];
  const melhor = metricas.melhorCombinacao;
  const corMaisUsada = [...metricas.cores].sort((a, b) => b.usos - a.usos)[0];
  return (
    <div className="ds-grid ds-g4 mb-4">
      <KpiTile
        label="Cor mais usada"
        valor={NOME_COR[corMaisUsada.cor]}
        sub={`em ${(corMaisUsada.participacao * 100).toFixed(0)}% dos decks`}
      />
      <KpiTile
        label="Combinação mais usada"
        valor={maisUsada.nome}
        sub={`${maisUsada.usos} ${maisUsada.usos === 1 ? "uso" : "usos"} · ${(maisUsada.participacao * 100).toFixed(0)}% dos decks`}
      />
      <KpiTile
        label="Combinação que mais vence"
        valor={maisVence.nome}
        sub={`${maisVence.vitorias} ${maisVence.vitorias === 1 ? "vitória" : "vitórias"} em ${maisVence.partidas} mesas`}
      />
      <KpiTile
        label="Melhor taxa de vitória"
        valor={melhor ? melhor.nome : "—"}
        sub={melhor ? `${(melhor.winrate * 100).toFixed(0)}% em ${melhor.partidas} mesas` : "precisa de 5 mesas ou mais"}
      />
    </div>
  );
}

function CartaoCombinacoes({ metricas }: { metricas: MetricasGlobais }) {
  return (
    <div className="ds-card">
      <div className="ds-card-h"><h3><IconeCombinacoes /> Combinações de cores</h3></div>
      {metricas.combinacoes.length === 0 ? (
        <SemDados texto={SEM_LISTA} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
            <thead>
              <tr className="tabela-cab">
                <th className="text-left py-2">Cores</th>
                <th className="text-left py-2">Combinação</th>
                <th className="text-right py-2">Usos</th>
                <th className="text-right py-2">% dos decks</th>
                <th className="text-right py-2"><IconeTrofeu tamanho={13} /></th>
                <th className="text-right py-2">V</th>
                <th className="text-right py-2">WR</th>
              </tr>
            </thead>
            <tbody>
              {metricas.combinacoes.map((c) => (
                <tr key={c.cores} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                  <td className="py-1.5 whitespace-nowrap"><CoresMana cores={c.cores} tamanho={14} /></td>
                  <td className="py-1.5" style={{ color: "var(--text-strong)" }}>{c.nome}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.usos}</td>
                  <td className="py-1.5 text-right tabular-nums">{(c.participacao * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--warn)" }}>{c.campeonatos || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.vitorias}/{c.partidas}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>{(c.winrate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CartaoCores({ metricas }: { metricas: MetricasGlobais }) {
  return (
    <div className="ds-card">
      <div className="ds-card-h"><h3><IconeGota /> Cores dos comandantes</h3></div>
      {metricas.cores.length === 0 ? (
        <SemDados texto={SEM_LISTA} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
              <thead>
                <tr className="tabela-cab">
                  <th className="text-left py-2">Cor</th>
                  <th className="text-right py-2">Usos</th>
                  <th className="text-right py-2">% dos decks</th>
                  <th className="text-right py-2">V</th>
                  <th className="text-right py-2">WR</th>
                </tr>
              </thead>
              <tbody>
                {metricas.cores.map((c) => (
                  <tr key={c.cor} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
                        <CoresMana cores={c.cor === "C" ? "" : c.cor} />
                        {NOME_COR[c.cor]}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{c.usos}</td>
                    <td className="py-1.5 text-right tabular-nums">{(c.participacao * 100).toFixed(0)}%</td>
                    <td className="py-1.5 text-right tabular-nums">{c.vitorias}/{c.partidas}</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>{(c.winrate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs mt-3" style={{ color: "var(--text-muted-ds)" }}>
            Um deck de várias cores conta em cada uma delas, então os percentuais somam mais de 100%.
          </div>
          <NotaDeckProprio metricas={metricas} />
        </>
      )}
    </div>
  );
}

function CartaoComandantes({ metricas }: { metricas: MetricasGlobais }) {
  return (
    <div className="ds-card">
      <div className="ds-card-h"><h3><IconeCoroa /> Comandantes que mais ganham</h3></div>
      {metricas.comandantes.length === 0 ? (
        <SemDados texto={SEM_LISTA} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
            <thead>
              <tr className="tabela-cab">
                <th className="text-left py-2">Comandante</th>
                <th className="text-right py-2">Usos</th>
                <th className="text-right py-2"><IconeTrofeu tamanho={13} /></th>
                <th className="text-right py-2">V</th>
                <th className="text-right py-2">WR</th>
              </tr>
            </thead>
            <tbody>
              {metricas.comandantes.map((c) => (
                <tr key={c.nome} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                  <td className="py-1.5">
                    <span style={{ color: "var(--text-strong)" }}>{c.nome}</span> <CoresMana cores={c.cores} tamanho={14} />
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{c.usos}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--warn)" }}>{c.campeonatos || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.vitorias}/{c.partidas}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>{(c.winrate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PainelJogador({ torneios, metricas, meusNomes, escolherJogador, carregando }: {
  torneios: Torneio[];
  metricas: MetricasGlobais;
  meusNomes: string[];
  escolherJogador: boolean; // só quem organiza consulta outros jogadores
  carregando: boolean;
}) {
  const nomes = useMemo(
    () => (escolherJogador ? listarNomesJogadores(torneios) : meusNomes),
    [escolherJogador, torneios, meusNomes]
  );
  const meuNome = meusNomes[0] ?? "";
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [torneioEscolhido, setTorneioEscolhido] = useState("");
  const selecionado = escolhido ?? meuNome;
  const valorSelect = nomes.find((n) => mesmoJogador(n, selecionado)) ?? "";

  const geral = useMemo(
    () => (selecionado ? calcularDesempenho(torneios, selecionado) : null),
    [torneios, selecionado]
  );
  // O torneio escolhido pode não existir para o jogador recém-selecionado
  const torneioId = geral?.historico.some((t) => t.id === torneioEscolhido) ? torneioEscolhido : "";
  const d = useMemo(
    () => (torneioId ? calcularDesempenho(torneios.filter((t) => t.id === torneioId), selecionado) : geral),
    [torneios, torneioId, selecionado, geral]
  );
  const posicaoGeral = metricas.rankingJogadores.findIndex((j) => mesmoJogador(j.nome, selecionado)) + 1;

  return (
    <>
      <section className="flex items-center gap-2 flex-wrap">
        {nomes.length > 1 && (
          <select
            value={valorSelect}
            onChange={(e) => setEscolhido(e.target.value)}
            aria-label="Jogador"
            className="input flex-1 max-w-md"
            style={{ colorScheme: "dark" }}
          >
            <option value="" disabled>Escolha um jogador...</option>
            {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {geral && (
          <select
            value={torneioId}
            onChange={(e) => setTorneioEscolhido(e.target.value)}
            aria-label="Torneio"
            className="input flex-1 max-w-md"
            style={{ colorScheme: "dark" }}
          >
            <option value="">Todos os torneios</option>
            {geral.historico.map((t) => (
              <option key={t.id} value={t.id}>{t.nome} · {formatarData(t.data)}</option>
            ))}
          </select>
        )}
        {escolherJogador && meuNome && !mesmoJogador(meuNome, selecionado) && (
          <button className="btn-ghost text-sm" onClick={() => setEscolhido(meuNome)}>
            <IconePessoa /> Ver meu desempenho
          </button>
        )}
      </section>

      {!d || !geral ? (
        <div className="ds-card text-center py-16" style={{ color: "var(--text-2)" }}>
          {carregando
            ? "Carregando..."
            : selecionado
              ? `${selecionado} ainda não aparece em nenhum torneio.`
              : escolherJogador
                ? "Escolha um jogador para ver o desempenho."
                : "Vincule seu nome de jogador para ver seu desempenho."}
        </div>
      ) : (
        <DesempenhoView
          d={d}
          conquistas={geral.conquistas}
          torneio={torneioId ? d.historico[0] : null}
          posicaoGeral={posicaoGeral}
          totalGeral={metricas.rankingJogadores.length}
        />
      )}
    </>
  );
}

function DesempenhoView({ d, conquistas, torneio, posicaoGeral, totalGeral }: {
  d: DesempenhoJogador;
  conquistas: Conquista[]; // sempre de todos os torneios
  torneio: TorneioDoJogador | null; // preenchido quando filtrado por um torneio
  posicaoGeral: number;
  totalGeral: number;
}) {
  const obtidas = conquistas.filter((c) => c.obtida).length;
  const distribuicao = [
    { label: "Vitórias", valor: d.vitorias },
    { label: "Empates por tempo", valor: d.empates },
    ...d.colocacoes.map((c) => ({ label: `${c.posicao}º lugar na mesa`, valor: c.qtd })),
  ];

  return (
    <>
      <section>
        <div className="ds-sect">Conquistas ({obtidas} de {conquistas.length})</div>
        <div className="ds-grid ds-g4">
          {conquistas.map((c) => (
            <div
              key={c.titulo}
              className="ds-card"
              style={{ opacity: c.obtida ? 1 : 0.4, filter: c.obtida ? undefined : "grayscale(1)" }}
            >
              <div>{(() => { const Icone = ICONE_DA_CONQUISTA[c.icone]; return <Icone tamanho={28} />; })()}</div>
              <div className="text-sm font-bold mt-1" style={{ color: "var(--text-strong)" }}>{c.titulo}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted-ds)" }}>{c.descricao}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="ds-sect">{torneio ? `${d.nome} em ${torneio.nome}` : `Resumo de ${d.nome}`}</div>
        <div className="ds-grid ds-g3">
          {torneio ? (
            <KpiTile
              label="Colocação"
              valor={torneio.posicao !== null ? `${torneio.posicao}º` : "—"}
              sub={torneio.posicao !== null ? `de ${torneio.total} jogadores` : "torneio em andamento"}
            />
          ) : (
            <KpiTile
              label="Ranking geral"
              valor={posicaoGeral > 0 ? `${posicaoGeral}º` : "—"}
              sub={`de ${totalGeral} jogadores`}
            />
          )}
          <KpiTile
            label="Prêmios"
            valor={formatarReais(d.ganhos)}
            sub={d.torneiosPremiados === 1 ? "em 1 torneio premiado" : `em ${d.torneiosPremiados} torneios premiados`}
          />
          <KpiTile
            label="Pontos"
            valor={String(d.pontos)}
            sub={`${d.vitorias} vitórias · ${d.empates} empates · ${d.derrotas} derrotas`}
          />
          <KpiTile
            label="Campeonatos"
            valor={String(d.campeonatos)}
            sub={`${d.podios} pódios em ${d.finalizados} finalizados`}
          />
          <KpiTile
            label="Taxa de vitória"
            valor={`${(d.winrate * 100).toFixed(0)}%`}
            sub={`${d.vitorias} vitórias em ${d.partidas} mesas`}
          />
          <KpiTile
            label="Acima do esperado"
            valor={d.partidas > 0 ? `${d.fatorVitoria.toFixed(2).replace(".", ",")}x` : "—"}
            sub={`esperado pelo tamanho das mesas: ${d.vitoriasEsperadas.toFixed(1).replace(".", ",")} vitórias`}
          />
        </div>
      </section>

      <section className="ds-grid ds-g2">
        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeRaio /> Partidas recentes</h3></div>
          {d.forma.length === 0 ? (
            <SemDados texto="Nenhuma mesa finalizada ainda." />
          ) : (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {d.forma.map((r, i) => <ChipResultado key={i} resultado={r} />)}
              </div>
              <div className="text-xs mt-3" style={{ color: "var(--text-muted-ds)" }}>
                Últimas {d.forma.length} mesas, da mais antiga para a mais recente.
                {" "}Sequência atual: <b style={{ color: "var(--text-strong)" }}>{d.sequenciaAtual}</b>
                {" "}· Melhor sequência: <b style={{ color: "var(--text-strong)" }}>{d.melhorSequencia}</b>
              </div>
            </>
          )}
        </div>

        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeDado /> Como terminam as mesas</h3></div>
          {d.partidas === 0 ? (
            <SemDados texto="Nenhuma mesa finalizada ainda." />
          ) : (
            <BarraHorizontal dados={distribuicao} />
          )}
        </div>
      </section>

      <section>
        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeDecks tamanho={16} /> Decks mais usados</h3></div>
          {d.decks.length === 0 ? (
            <SemDados texto="Nenhum deck registrado para este jogador." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
                <thead>
                  <tr className="tabela-cab">
                    <th className="text-left py-2">Deck</th>
                    <th className="text-left py-2">Comandante</th>
                    <th className="text-right py-2">Torn.</th>
                    <th className="text-right py-2"><IconeTrofeu tamanho={13} /></th>
                    <th className="text-right py-2">V</th>
                    <th className="text-right py-2">WR</th>
                  </tr>
                </thead>
                <tbody>
                  {d.decks.map((x) => {
                    const cores = coresDoDeck(x.nome);
                    return (
                      <tr key={x.nome} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                        <td className="py-1.5" style={{ color: "var(--text-strong)" }}>
                          {x.nome}
                          {!torneio && mesmoJogador(x.nome, d.historico[0]?.deck ?? "") && (
                            <span
                              className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                              style={{ color: "var(--brand-link)", background: "rgba(201,166,72,0.15)" }}
                            >ATUAL</span>
                          )}
                        </td>
                        <td className="py-1.5">
                          {cores === null ? "—" : (
                            <>{comandanteDoDeck(x.nome)} <CoresMana cores={cores} tamanho={14} /></>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{x.torneios}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--warn)" }}>{x.campeonatos || "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{x.vitorias}/{x.partidas}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>{(x.winrate * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeHistorico /> Histórico de torneios</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
              <thead>
                <tr className="tabela-cab">
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Torneio</th>
                  <th className="text-left py-2">Deck</th>
                  <th className="text-right py-2">Pos.</th>
                  <th className="text-right py-2">Pts</th>
                  <th className="text-right py-2">V</th>
                  <th className="text-right py-2">Prêmio</th>
                </tr>
              </thead>
              <tbody>
                {d.historico.map((t) => (
                  <tr key={t.id} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                    <td className="py-1.5 whitespace-nowrap">{formatarData(t.data)}</td>
                    <td className="py-1.5" style={{ color: "var(--text-strong)" }}>{t.nome}</td>
                    <td className="py-1.5">{t.deck || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                      {t.posicao === 1 && <><IconeTrofeu /> </>}
                      {t.posicao !== null ? `${t.posicao}º de ${t.total}` : "em andamento"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{t.pontos}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.vitorias}/{t.partidas}</td>
                    <td
                      className="py-1.5 text-right tabular-nums whitespace-nowrap"
                      style={{ color: t.premio > 0 ? "var(--good)" : undefined }}
                    >
                      {t.premio > 0 ? formatarReais(t.premio) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeGrafico /> Evolução nos torneios</h3></div>
          {d.evolucao.length === 0 ? (
            <SemDados texto="Aparece quando o jogador tiver um torneio finalizado." />
          ) : (
            <GraficoEvolucao dados={d.evolucao} />
          )}
        </div>
      </section>

      <section>
        <div className="ds-card">
          <div className="ds-card-h"><h3><IconeEspadas /> Rivais</h3></div>
          {d.rivais.length === 0 ? (
            <SemDados texto="Nenhuma mesa finalizada ainda." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <DestaqueRival
                  titulo={<><IconeEspadas cor="currentColor" /> Carrasco</>}
                  nome={d.carrasco?.nome}
                  detalhe={d.carrasco ? `venceu ${d.carrasco.vitoriasDele} mesas contra ${d.nome}` : undefined}
                />
                <DestaqueRival
                  titulo={<><IconeAlvo cor="currentColor" /> Freguês</>}
                  nome={d.fregues?.nome}
                  detalhe={d.fregues ? `perdeu ${d.fregues.minhasVitorias} mesas para ${d.nome}` : undefined}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
                  <thead>
                    <tr className="tabela-cab">
                      <th className="text-left py-2">Jogador</th>
                      <th className="text-right py-2">Mesas</th>
                      <th className="text-right py-2">Venceu</th>
                      <th className="text-right py-2">Perdeu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rivais.map((r) => (
                      <tr key={r.nome} style={{ borderTop: "0.8px solid var(--line-soft)" }}>
                        <td className="py-1.5" style={{ color: "var(--text-strong)" }}>{r.nome}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.mesas}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--good)" }}>{r.minhasVitorias}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: "#f87171" }}>{r.vitoriasDele}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

    </>
  );
}

function formatarData(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function SemDados({ texto }: { texto: string }) {
  return <div className="text-sm py-4 text-center" style={{ color: "var(--text-muted-ds)" }}>{texto}</div>;
}

function ChipResultado({ resultado }: { resultado: ResultadoMesa }) {
  const estilo = {
    vitoria: { letra: "V", cor: "#6ee7b7", titulo: "Vitória" },
    empate: { letra: "E", cor: "#fcd34d", titulo: "Empate por tempo" },
    derrota: { letra: "D", cor: "#f87171", titulo: "Derrota" },
  }[resultado];
  return (
    <span
      title={estilo.titulo}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
      style={{ color: estilo.cor, background: `${estilo.cor}18`, border: `1px solid ${estilo.cor}50` }}
    >
      {estilo.letra}
    </span>
  );
}

function DestaqueRival({ titulo, nome, detalhe }: { titulo: React.ReactNode; nome?: string; detalhe?: string }) {
  return (
    <div className="p-2.5 rounded-lg min-w-0" style={{ background: "var(--surface-subtle)" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted-ds)" }}>{titulo}</div>
      <div className="text-sm font-bold truncate mt-0.5" style={{ color: "var(--text-strong)" }}>{nome ?? "—"}</div>
      {detalhe && <div className="text-[11px]" style={{ color: "var(--text-muted-ds)" }}>{detalhe}</div>}
    </div>
  );
}

// Percentil: 100% = primeiro lugar, 0% = último, para comparar torneios de tamanhos diferentes
function GraficoEvolucao({ dados }: { dados: EvolucaoJogador[] }) {
  const W = 800, H = 220, pad = { l: 44, r: 24, t: 24, b: 36 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const pontos = dados.map((d, i) => ({
    ...d,
    x: pad.l + (dados.length > 1 ? (i / (dados.length - 1)) * chartW : chartW / 2),
    y: pad.t + chartH * (1 - d.percentil),
  }));
  const passoRotulo = Math.max(1, Math.ceil(dados.length / 10));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line
              x1={pad.l} x2={W - pad.r}
              y1={pad.t + chartH * (1 - p)}
              y2={pad.t + chartH * (1 - p)}
              stroke="var(--line-soft)" strokeWidth="0.5"
            />
            <text
              x={pad.l - 6} y={pad.t + chartH * (1 - p) + 4}
              textAnchor="end" fontSize="10" fill="var(--text-muted-ds)"
            >
              {p * 100}%
            </text>
          </g>
        ))}
        <polyline
          points={pontos.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none" stroke="var(--brand-1)" strokeWidth="2"
        />
        {pontos.map((p, i) => (
          <g key={`${p.nome}-${i}`}>
            <circle cx={p.x} cy={p.y} r="5" fill={p.posicao === 1 ? "var(--warn)" : "var(--brand-1)"}>
              <title>{`${p.nome}: ${p.posicao}º de ${p.total}`}</title>
            </circle>
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-strong)">
              {p.posicao}º
            </text>
            {i % passoRotulo === 0 && (
              <text x={p.x} y={H - pad.b + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted-ds)">
                {p.data ? new Date(p.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted-ds)" }}>
        Parcela dos jogadores que ficaram atrás em cada torneio finalizado (100% é o primeiro lugar).
      </div>
    </>
  );
}

function KpiTile({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="ds-kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{valor}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function TrendCard({ titulo, m }: { titulo: string; m: { qtd: number; participantes: number; partidas: number } }) {
  return (
    <div className="ds-card">
      <div className="ds-card-h"><h3>{titulo}</h3></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--brand-1)" }}>{m.qtd}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted-ds)" }}>torneios</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--brand-link)" }}>{m.participantes}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted-ds)" }}>participações</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--action)" }}>{m.partidas}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted-ds)" }}>partidas</div>
        </div>
      </div>
    </div>
  );
}

function BarraHorizontal({ dados }: { dados: { label: string; valor: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="space-y-2">
      {dados.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs mb-0.5" style={{ color: "var(--text-2)" }}>
            <span className="truncate pr-2">{d.label}</span>
            <span className="tabular-nums font-semibold" style={{ color: "var(--text-strong)" }}>{d.valor}</span>
          </div>
          <div style={{ background: "var(--surface-subtle)", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${(d.valor / max) * 100}%`,
                height: "100%",
                background: "var(--sig-h)",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

