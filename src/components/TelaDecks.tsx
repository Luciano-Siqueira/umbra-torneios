import { useMemo, useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { ANOS_DECKS, DECKS, filtrarDecks, opcoesDeCores, type DeckCommander } from "../core/decks";
import { nomeDaCombinacao } from "../core/coresMagic";
import { DetalheDeck } from "./DetalheDeck";
import { atualizarDecks, useVersaoDecks } from "../core/atualizarDecks";
import { FUNDO_DE_TELA } from "../banner-image";
import { AuthChip } from "./AuthChip";
import { useToast } from "./ui/Toast";
import { CoresMana } from "./ui/SimboloMana";
import { IconeDecks } from "./ui/LogoUmbra";

const ESTILO_TITULO = "text-left py-2 px-2";
const TODAS_AS_CORES = "todas";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function TelaDecks({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const [busca, setBusca] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState(TODAS_AS_CORES);
  const versao = useVersaoDecks();
  const decks = useMemo(() => filtrarDecks(busca, ano, cor === TODAS_AS_CORES ? null : cor), [busca, ano, cor, versao]);
  const opcoes = useMemo(() => opcoesDeCores(), [versao]);
  const modoView = useStore((s) => s.modoView);
  const { toast } = useToast();
  const [progresso, setProgresso] = useState<string | null>(null);
  const [aberto, setAberto] = useState<DeckCommander | null>(null);

  const atualizar = async () => {
    setProgresso("Procurando lançamentos...");
    try {
      const { adicionados, falhas } = await atualizarDecks((feitos, total) => {
        if (total > 0) setProgresso(`Baixando ${feitos} de ${total}...`);
      });
      if (adicionados.length > 0) {
        toast(`${adicionados.length} novo${adicionados.length > 1 ? "s" : ""}: ${adicionados.join(", ")}`, "sucesso");
      } else if (falhas.length === 0) {
        toast("A lista de decks já está atualizada", "info");
      }
      if (falhas.length > 0) {
        toast(`Ficou de fora: ${falhas.map((f) => `${f.nome} (${f.motivo})`).join("; ")}`, "aviso");
      }
    } catch (e: any) {
      toast(`Não foi possível atualizar os decks: ${e.message}`, "erro");
    } finally {
      setProgresso(null);
    }
  };

  if (auth.perfilErro || (auth.perfilCarregado && (!auth.isAdmin || modoView !== "admin"))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg p-6">
        <div className="text-center">
          <div className="text-2xl mb-2">{auth.perfilErro ? "⚠️ Erro ao carregar seu perfil" : "🔒 Acesso restrito"}</div>
          <div className="text-sm text-fg-dim mb-4">{auth.perfilErro || "Essa página é só para administradores."}</div>
          <button className="btn-primary" onClick={voltar}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-fg"
      style={FUNDO_DE_TELA}
    >
      <div className="px-4 md:px-8 py-4 flex items-center gap-3">
        <button className="btn-ghost" onClick={voltar}>← Voltar</button>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
          <IconeDecks tamanho={32} /> Decks
        </h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </div>

      <main className="px-4 md:px-8 pb-12 space-y-4">
        {aberto ? <DetalheDeck deck={aberto} onVoltar={() => setAberto(null)} /> : <>
        <div className="card grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
          <input
            type="search"
            className="input w-full"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por deck, comandante ou coleção..."
            aria-label="Buscar decks"
          />
          <select className="input" value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Filtrar por ano">
            <option value="">Todos os anos</option>
            {ANOS_DECKS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="input" value={cor} onChange={(e) => setCor(e.target.value)} aria-label="Filtrar por cores">
            <option value={TODAS_AS_CORES}>Todas as cores</option>
            {opcoes.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.opcoes.map((o) => (
                  <option key={o.cores} value={o.cores}>{o.nome} ({o.qtd})</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button className="btn-info whitespace-nowrap" onClick={atualizar} disabled={progresso !== null}>
            {progresso ?? "⟳ Atualizar decks"}
          </button>
        </div>

        <div className="card">
          <div className="text-sm text-fg-dim mb-3">
            {decks.length === DECKS.length ? `${DECKS.length} decks` : `${decks.length} de ${DECKS.length} decks`}
          </div>

          {decks.length === 0 ? (
            <div className="text-fg-dim text-center py-8">Nenhum deck encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="tabela-cab">
                  <th className={`${ESTILO_TITULO} hidden md:table-cell`}>Lançamento</th>
                  <th className={`${ESTILO_TITULO} hidden sm:table-cell`}>Coleção</th>
                  <th className={ESTILO_TITULO}>Deck</th>
                  <th className={`${ESTILO_TITULO} hidden sm:table-cell`}>Comandante</th>
                  <th className={`${ESTILO_TITULO} hidden sm:table-cell`}>Cores</th>
                  <th className={`${ESTILO_TITULO} hidden md:table-cell`}>Combinação</th>
                  <th className={`${ESTILO_TITULO} !text-right hidden md:table-cell`}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((d) => (
                  <tr
                    key={`${d.colecao}|${d.nome}`}
                    className="cursor-pointer hover:bg-white/5 transition"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    onClick={() => setAberto(d)}
                  >
                    <td className="py-1.5 px-2 whitespace-nowrap tabular-nums hidden md:table-cell">{formatarData(d.lancamento)}</td>
                    <td className="py-1.5 px-2 hidden sm:table-cell">{d.colecao}</td>
                    <td className="py-1.5 px-2">
                      <button type="button" className="font-medium text-left hover:underline" style={{ color: "var(--text-strong)" }}>
                        {d.nome}
                      </button>
                      {/* No celular, o comandante e a coleção ficam junto do nome */}
                      <span className="block text-xs sm:hidden" style={{ color: "var(--text-2)" }}>
                        {d.comandantes} <CoresMana cores={d.cores} tamanho={13} /> · {d.colecao} · {d.lancamento.slice(0, 4)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 hidden sm:table-cell">{d.comandantes}</td>
                    <td className="py-1.5 px-2 hidden sm:table-cell whitespace-nowrap">
                      <CoresMana cores={d.cores} tamanho={14} />
                    </td>
                    <td className="py-1.5 px-2 hidden md:table-cell whitespace-nowrap">{nomeDaCombinacao(d.cores)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums hidden md:table-cell">{d.tokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>}
      </main>
    </div>
  );
}
