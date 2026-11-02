import { useMemo } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { AuthChip } from "./AuthChip";
import { calcularMetricas, metricasRecentes } from "../core/metricas";
import { BANNER_IMAGE } from "../banner-image";

export function TelaAnalytics({ onPedirLogin }: { onPedirLogin?: () => void } = {}) {
  const torneios = useStore((s) => s.torneios);
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const metricas = useMemo(() => calcularMetricas(torneios), [torneios]);
  const ult30 = useMemo(() => metricasRecentes(torneios, 30), [torneios]);
  const ult7 = useMemo(() => metricasRecentes(torneios, 7), [torneios]);

  return (
    <div
      className="min-h-screen text-fg"
      style={{
        backgroundImage: `linear-gradient(to bottom,
          rgba(10,9,22,0.15) 0%,
          rgba(10,9,22,0.25) 20%,
          rgba(10,9,22,0.85) 45%,
          rgba(10,9,22,0.94) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <header className="relative h-32 md:h-40 pointer-events-none" />

      <div className="px-6 md:px-10 py-4 flex items-center gap-3">
        <button className="btn-ghost" onClick={voltar}>← Voltar</button>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-strong)" }}>
          📊 Analytics
        </h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onSair={voltar} />
      </div>

      <main className="px-6 md:px-10 pb-12 space-y-6">
        {torneios.length === 0 ? (
          <div className="ds-card text-center py-16" style={{ color: "var(--text-2)" }}>
            Nenhum torneio ainda — crie um torneio para ver estatísticas.
          </div>
        ) : (
          <>
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
                  sub={`média ${metricas.mediaJogadoresPorTorneio.toFixed(1)} por torneio`}
                />
                <KpiTile
                  label="Partidas disputadas"
                  valor={metricas.totalPartidas.toLocaleString("pt-BR")}
                  sub={`${metricas.empatesPorTempo} empates por tempo`}
                />
                <KpiTile
                  label="Arrecadação total"
                  valor={`R$ ${metricas.totalArrecadado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                  <h3>🏆 Top jogadores (por campeonatos)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ color: "var(--app-text)" }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted-ds)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".02em" }}>
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Jogador</th>
                        <th className="text-right py-2">🏆</th>
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
                  <h3>🎴 Decks mais usados</h3>
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

            {/* Gráfico mensal */}
            <section>
              <div className="ds-card">
                <div className="ds-card-h">
                  <h3>📈 Torneios por mês</h3>
                </div>
                <GraficoBarras dados={metricas.torneiosPorMes} />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
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

function GraficoBarras({ dados }: { dados: { mes: string; qtd: number; participantes: number }[] }) {
  if (dados.length === 0) {
    return <div className="text-center py-8" style={{ color: "var(--text-muted-ds)" }}>Sem dados ainda.</div>;
  }
  const W = 800, H = 220, pad = { l: 40, r: 20, t: 20, b: 40 };
  const maxQtd = Math.max(1, ...dados.map((d) => d.qtd));
  const barW = (W - pad.l - pad.r) / dados.length;
  const chartH = H - pad.t - pad.b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={pad.l} x2={W - pad.r}
          y1={pad.t + chartH * (1 - p)}
          y2={pad.t + chartH * (1 - p)}
          stroke="var(--line-soft)" strokeWidth="0.5"
        />
      ))}
      {/* eixos y */}
      {[0, 0.5, 1].map((p) => (
        <text
          key={p}
          x={pad.l - 6} y={pad.t + chartH * (1 - p) + 4}
          textAnchor="end" fontSize="10" fill="var(--text-muted-ds)"
        >
          {Math.round(maxQtd * p)}
        </text>
      ))}
      {/* barras */}
      {dados.map((d, i) => {
        const h = (d.qtd / maxQtd) * chartH;
        const x = pad.l + i * barW + 4;
        return (
          <g key={d.mes}>
            <rect
              x={x} y={pad.t + chartH - h}
              width={barW - 8} height={h}
              fill="url(#grad-bars)" rx="2"
            >
              <title>{`${d.mes}: ${d.qtd} torneios · ${d.participantes} participações`}</title>
            </rect>
            <text
              x={x + (barW - 8) / 2} y={H - pad.b + 14}
              textAnchor="middle" fontSize="10" fill="var(--text-muted-ds)"
            >
              {d.mes.slice(5) + "/" + d.mes.slice(2, 4)}
            </text>
            <text
              x={x + (barW - 8) / 2} y={pad.t + chartH - h - 4}
              textAnchor="middle" fontSize="10" fontWeight="600"
              fill="var(--text-strong)"
            >
              {d.qtd}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="grad-bars" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-1)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
