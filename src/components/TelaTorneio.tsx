import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { useAoVivo } from "../core/useAoVivo";
import { useVibrarFimDaRodada } from "../core/useTimer";
import { encontrarMinhaMesa } from "../core/minhaMesa";
import type { Torneio } from "../core/types";
import { partesDoTorneioVisiveis, podeEditarTorneios } from "../core/visibilidade";
import { confirmar } from "./ui/Confirm";
import { useToast } from "./ui/Toast";
import { AuthChip } from "./AuthChip";
import { SeloStatus } from "./ui/SeloStatus";
import { EscritaUmbra, SimboloUmbra } from "./ui/LogoUmbra";
import { FUNDO_DE_TELA } from "../banner-image";
import { contar } from "../core/formato";
import { MTGDivider } from "./ui/Divider";
import { IconeCifrao, IconeDado, IconeHistorico, IconeMedalha, IconeMesa, IconeTrofeu, IconeUsuarios, IconeVoltar } from "./ui/Icones";
import { AbaJogadores } from "./abas/AbaJogadores";
import { AbaMesas } from "./abas/AbaMesas";
import { AbaRanking } from "./abas/AbaRanking";
import { AbaFinanceiro } from "./abas/AbaFinanceiro";
import { AbaPremiacao } from "./abas/AbaPremiacao";
import { AbaHistorico } from "./abas/AbaHistorico";

// Roleta e corrida de patinhos carregam só quando a aba é aberta
const AbaSorteios = lazy(() =>
  import("./abas/AbaSorteios").then((m) => ({ default: m.AbaSorteios }))
);

type Aba =
  | "jogadores"
  | "mesas"
  | "ranking"
  | "financeiro"
  | "premiacao"
  | "sorteios"
  | "historico";

const ABAS: { id: Aba; label: string; Icone: (props: { tamanho?: number; cor?: string }) => JSX.Element }[] = [
  { id: "jogadores", label: "Jogadores", Icone: IconeUsuarios },
  { id: "mesas", label: "Mesas", Icone: IconeMesa },
  { id: "ranking", label: "Ranking", Icone: IconeTrofeu },
  { id: "financeiro", label: "Financeiro", Icone: IconeCifrao },
  { id: "premiacao", label: "Premiação", Icone: IconeMedalha },
  { id: "sorteios", label: "Sorteios", Icone: IconeDado },
  { id: "historico", label: "Histórico", Icone: IconeHistorico },
];

// Só controla a interface: quem participa ainda baixa o torneio inteiro
const ABAS_JOGADOR: Aba[] = ["mesas", "ranking", "historico"];

// Componente próprio: o relógio atualiza a cada meio segundo e não deve redesenhar a tela toda
function VibracaoFimDaRodada({ torneio }: { torneio: Torneio }) {
  useVibrarFimDaRodada(torneio.tempoRodadaMin, torneio.tempoExtraMin, torneio.timer);
  return null;
}

export function TelaTorneio({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const torneio = useStore((s) => s.torneioAtivo());
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const modoView = useStore((s) => s.modoView);
  const podeEditar = podeEditarTorneios(modoView, auth);
  const { toast } = useToast();
  const reabrir = useStore((s) => s.reabrirTorneio);
  const torneioId = useStore((s) => s.torneioId);
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(() => {
    try {
      const salva = sessionStorage.getItem(`mtg.aba.${torneioId}`);
      if (ABAS.some((a) => a.id === salva)) return salva as Aba;
    } catch { /* ignore */ }
    return null;
  });
  const setAba = (nova: Aba) => {
    setAbaEscolhida(nova);
    try { sessionStorage.setItem(`mtg.aba.${torneioId}`, nova); } catch { /* ignore */ }
  };
  const verRodada = partesDoTorneioVisiveis(torneio, podeEditar, auth);
  const abasVisiveis = podeEditar
    ? ABAS
    : ABAS.filter((a) => ABAS_JOGADOR.includes(a.id) && (a.id === "mesas" ? verRodada.mesas : verRodada.resultados));
  // A aba salva pode não existir no modo atual: o F5 pode reabrir depois de trocar de modo
  const aba: Aba | null = abasVisiveis.some((a) => a.id === abaEscolhida)
    ? abaEscolhida!
    : abasVisiveis[0]?.id ?? null;

  useAoVivo(torneio ? torneio.id : null, podeEditar);

  // No celular as abas passam da largura: mantém a aba aberta à vista
  const abaAberta = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const botao = abaAberta.current;
    const barra = botao?.closest("nav");
    if (!botao || !barra) return;
    // Só na horizontal, para não mover a página
    const b = botao.getBoundingClientRect();
    const n = barra.getBoundingClientRect();
    barra.scrollLeft += b.left - n.left - (n.width - b.width) / 2;
  }, [aba]);

  if (!torneio) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-fg flex items-center justify-center">
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
      style={FUNDO_DE_TELA}
    >
      {/* Topo no mesmo vidro da lista de torneios: voltar, marca, nome com o selo e a conta */}
      <header className="px-3 md:px-8 pt-3 md:pt-4 pb-3">
        <div
          className="flex items-center gap-2 md:gap-3 rounded-full pl-1.5 pr-2 md:pr-3 py-1.5 border"
          style={{
            background: "rgba(15,15,15,0.72)",
            borderColor: "rgba(201,166,72,0.18)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            boxShadow: "0 20px 60px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar para a lista"
            title="Voltar para a lista"
            className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 rounded-full border flex items-center justify-center transition hover:bg-white/5 active:scale-95"
            style={{ borderColor: "rgba(201,166,72,0.3)" }}
          >
            <IconeVoltar tamanho={18} />
          </button>
          <span className="flex items-center gap-2 flex-shrink-0">
            <SimboloUmbra tamanho={24} />
            <span className="hidden lg:inline"><EscritaUmbra tamanho={13} /></span>
          </span>
          <span className="w-px h-7 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base md:text-xl font-black truncate leading-tight" style={{ color: "var(--text-strong)" }}>
              {torneio.nome}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <SeloStatus torneio={torneio} compacto />
              <span className="text-[11px] text-fg-dim truncate">{contar(torneio.jogadores.length, "jogador", "jogadores")}</span>
            </div>
          </div>
          <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
        </div>
      </header>

      {/* Banner de torneio finalizado — fixo e visível em TODAS as abas */}
      {torneio.finalizado && (
        <div
          className="relative mx-4 md:mx-8 my-2 rounded-xl p-3 md:p-4 flex items-center gap-3 overflow-hidden"
          style={{
            background: "linear-gradient(90deg, rgba(201,166,72,0.22), rgba(139,0,0,0.1), rgba(201,166,72,0.15))",
            border: "1.5px solid rgba(201,166,72,0.5)",
            boxShadow: "0 8px 32px -8px rgba(201,166,72,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="absolute -top-10 -right-10 w-32 h-32 opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--brand-1), transparent 65%)" }}
          />
          <div className="text-3xl md:text-4xl flex-shrink-0 relative">♛</div>
          <div className="flex-1 min-w-0 relative">
            <div
              className="text-[10px] md:text-[11px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "var(--brand-1)" }}
            >TORNEIO FINALIZADO</div>
            <div className="text-sm md:text-base font-semibold truncate" style={{ color: "#fff" }}>
              {podeEditar
                ? "Confira o ranking final, premiação e histórico das rodadas."
                : "Confira o ranking final e o histórico das rodadas."}
            </div>
          </div>
          {podeEditar && (
            <button
              className="text-xs md:text-sm px-3 py-1.5 rounded-full border transition hover:bg-white/5 flex-shrink-0 relative"
              style={{ color: "var(--brand-1)", borderColor: "rgba(201,166,72,0.4)" }}
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

      {/* O degradê à direita indica no celular que há mais abas */}
      <div className="relative">
      <nav
        className="px-4 md:px-8 py-2 border-b border-bg-cardalt flex items-center gap-2 overflow-x-auto"
        style={{ background: "rgba(10,10,10,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      >
        <div className="flex gap-1 min-w-max flex-1">
          {abasVisiveis.map((a) => (
            <button
              key={a.id}
              ref={aba === a.id ? abaAberta : undefined}
              onClick={() => setAba(a.id)}
              className={`px-3 md:px-4 py-2 rounded-t-lg text-sm font-semibold transition
                          ${aba === a.id
                            ? "bg-bg-panel text-acento border-b-2 border-acento"
                            : "text-fg-dim hover:text-fg hover:bg-bg-panel/40"}`}
            >
              <span className="mr-1.5"><a.Icone cor={aba === a.id ? undefined : "currentColor"} /></span>{a.label}
            </button>
          ))}
        </div>

        {podeEditar && torneio.finalizado && (
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
        )}
      </nav>
      <div
        className="sm:hidden absolute inset-y-0 right-0 w-8 pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, rgba(10,10,10,0.95))" }}
      />
      </div>

      <main className="flex-1 px-4 md:px-8 py-4 overflow-y-auto">
        {!podeEditar && verRodada.tempo && encontrarMinhaMesa([torneio], auth.nomesJogador)?.mesa && (
          <VibracaoFimDaRodada torneio={torneio} />
        )}
        {aba === null && (
          <div className="card max-w-lg mx-auto text-center py-10 space-y-2">
            <div className="text-lg font-semibold" style={{ color: "var(--text-strong)" }}>Torneio em andamento</div>
            <div className="text-sm" style={{ color: "var(--text-2)" }}>
              O ranking e o histórico aparecem aqui quando o torneio for finalizado.
            </div>
          </div>
        )}
        {aba === "jogadores" && <AbaJogadores torneio={torneio} podeEditar={podeEditar} />}
        {aba === "mesas" && <AbaMesas torneio={torneio} podeEditar={podeEditar} verTempo={verRodada.tempo} onIrParaAba={setAba} />}
        {aba === "ranking" && <AbaRanking torneio={torneio} />}
        {aba === "financeiro" && <AbaFinanceiro torneio={torneio} />}
        {aba === "premiacao" && <AbaPremiacao torneio={torneio} />}
        {aba === "sorteios" && (
          <Suspense fallback={<div className="text-center py-12 text-fg-dim">Carregando...</div>}>
            <AbaSorteios torneio={torneio} />
          </Suspense>
        )}
        {aba === "historico" && <AbaHistorico torneio={torneio} />}
      </main>
    </div>
  );
}
