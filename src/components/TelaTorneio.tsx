import { useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { confirmar } from "./ui/Confirm";
import { useToast } from "./ui/Toast";
import { AuthChip } from "./AuthChip";
import { BANNER_IMAGE } from "../banner-image";
import { MTGDivider } from "./ui/Divider";
import { AbaJogadores } from "./abas/AbaJogadores";
import { AbaMesas } from "./abas/AbaMesas";
import { AbaRanking } from "./abas/AbaRanking";
import { AbaFinanceiro } from "./abas/AbaFinanceiro";
import { AbaPremiacao } from "./abas/AbaPremiacao";
import { AbaSorteios } from "./abas/AbaSorteios";
import { AbaHistorico } from "./abas/AbaHistorico";

type Aba =
  | "jogadores"
  | "mesas"
  | "ranking"
  | "financeiro"
  | "premiacao"
  | "sorteios"
  | "historico";

const ABAS: { id: Aba; label: string; icone: string }[] = [
  { id: "jogadores", label: "Jogadores", icone: "◉" },
  { id: "mesas", label: "Mesas", icone: "▦" },
  { id: "ranking", label: "Ranking", icone: "★" },
  { id: "financeiro", label: "Financeiro", icone: "$" },
  { id: "premiacao", label: "Premiação", icone: "♛" },
  { id: "sorteios", label: "Sorteios", icone: "◈" },
  { id: "historico", label: "Histórico", icone: "◷" },
];

export function TelaTorneio({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const torneio = useStore((s) => s.torneioAtivo());
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const modoView = useStore((s) => s.modoView);
  const podeEditar = (auth.isAdmin && modoView === "admin") || modoView === "organizador";
  const { toast } = useToast();
  const reabrir = useStore((s) => s.reabrirTorneio);
  const finalizar = useStore((s) => s.finalizarTorneio);
  const [aba, setAba] = useState<Aba>("jogadores");

  if (!torneio) {
    return (
      <div className="min-h-screen bg-[#0a0916] text-fg flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl">Nenhum torneio ativo</div>
          <button className="btn-primary mt-4" onClick={voltar}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-fg flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(10,9,22,0.55) 0%, rgba(10,9,22,0.65) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <header className="px-4 md:px-8 pt-4 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={voltar}
            className="btn-ghost !px-3"
            title="Voltar para a lista"
          >← Voltar</button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black truncate">{torneio.nome}</h1>
            <div className="text-xs text-fg-dim">
              {torneio.jogadores.length} jogadores ·
              {torneio.finalizado
                ? " FINALIZADO"
                : ` Rodada ${Math.max(torneio.rodadaAtual, 1)} de ${torneio.qtdRodadas}`}
            </div>
          </div>
        </div>
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </header>

      {/* Banner de torneio finalizado — fixo e visível em TODAS as abas */}
      {torneio.finalizado && (
        <div
          className="relative mx-2 md:mx-6 my-2 rounded-xl p-3 md:p-4 flex items-center gap-3 overflow-hidden"
          style={{
            background: "linear-gradient(90deg, rgba(201,166,72,0.22), rgba(139,0,0,0.1), rgba(201,166,72,0.15))",
            border: "1.5px solid rgba(201,166,72,0.5)",
            boxShadow: "0 8px 32px -8px rgba(201,166,72,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="absolute -top-10 -right-10 w-32 h-32 opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle, #c9a648, transparent 65%)" }}
          />
          <div className="text-3xl md:text-4xl flex-shrink-0 relative">♛</div>
          <div className="flex-1 min-w-0 relative">
            <div
              className="text-[10px] md:text-[11px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "#c9a648" }}
            >TORNEIO FINALIZADO</div>
            <div className="text-sm md:text-base font-semibold truncate" style={{ color: "#fff" }}>
              Confira o ranking final, premiação e histórico das rodadas.
            </div>
          </div>
          {podeEditar && (
            <button
              className="text-xs md:text-sm px-3 py-1.5 rounded-full border transition hover:bg-white/5 flex-shrink-0 relative"
              style={{ color: "#c9a648", borderColor: "rgba(201,166,72,0.4)" }}
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Reabrir torneio",
                  mensagem: `Tem certeza que deseja reabrir o torneio "${torneio.nome}"?`,
                  textoOk: "Reabrir",
                });
                if (ok) { reabrir(); toast("Torneio reaberto", "sucesso"); }
              }}
            >↺ <span className="hidden sm:inline">Reabrir</span></button>
          )}
        </div>
      )}

      <MTGDivider />

      {/* Tabs + ação (Reabrir/Finalizar) à direita */}
      <nav className="px-2 md:px-8 py-2 border-b border-bg-cardalt flex items-center gap-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max flex-1">
          {ABAS.map((a) => (
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
        </div>

        {/* Ação à direita: Reabrir (se finalizado) ou Finalizar (se aberto) — só admin */}
        {podeEditar && (
          torneio.finalizado ? (
            <button
              className="btn-warning !py-2 text-xs md:text-sm flex-shrink-0"
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Reabrir torneio",
                  mensagem: `Tem certeza que deseja reabrir o torneio "${torneio.nome}"?\n\nIsso vai trazer a última rodada de volta para edição e desbloquear mudanças.`,
                  textoOk: "Reabrir",
                });
                if (ok) {
                  reabrir();
                  toast("Torneio reaberto", "sucesso");
                }
              }}
              title="Reabre o torneio para editar"
            >
              ↺ <span className="hidden sm:inline">Reabrir torneio</span>
            </button>
          ) : torneio.rodadaAtual > 0 ? (
            <button
              className="btn-success !py-2 text-xs md:text-sm flex-shrink-0"
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Finalizar torneio",
                  mensagem: `Tem certeza que deseja finalizar o torneio "${torneio.nome}"?\n\nIsso encerra o torneio definitivamente (mas você pode reabrir depois se precisar).`,
                  textoOk: "Finalizar",
                });
                if (ok) {
                  finalizar();
                  toast("Torneio finalizado!", "sucesso");
                }
              }}
              title="Encerra o torneio"
            >
              ♛ <span className="hidden sm:inline">Finalizar torneio</span>
            </button>
          ) : null
        )}
      </nav>

      <main className="flex-1 px-4 md:px-8 py-4 overflow-y-auto">
        {aba === "jogadores" && <AbaJogadores torneio={torneio} />}
        {aba === "mesas" && <AbaMesas torneio={torneio} />}
        {aba === "ranking" && <AbaRanking torneio={torneio} />}
        {aba === "financeiro" && <AbaFinanceiro torneio={torneio} />}
        {aba === "premiacao" && <AbaPremiacao torneio={torneio} />}
        {aba === "sorteios" && <AbaSorteios torneio={torneio} />}
        {aba === "historico" && <AbaHistorico torneio={torneio} />}
      </main>
    </div>
  );
}
