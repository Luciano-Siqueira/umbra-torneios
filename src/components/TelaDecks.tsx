import { useMemo, useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import { ANOS_DECKS, DECKS, filtrarDecks } from "../core/decks";
import { atualizarDecks, useVersaoDecks } from "../core/atualizarDecks";
import { BANNER_IMAGE } from "../banner-image";
import { AuthChip } from "./AuthChip";
import { useToast } from "./ui/Toast";

const ESTILO_TITULO = "text-left py-2 px-2 text-[10px] font-bold tracking-widest uppercase";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function TelaDecks({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const [busca, setBusca] = useState("");
  const [ano, setAno] = useState("");
  const versao = useVersaoDecks();
  const decks = useMemo(() => filtrarDecks(busca, ano), [busca, ano, versao]);
  const modoView = useStore((s) => s.modoView);
  const { toast } = useToast();
  const [progresso, setProgresso] = useState<string | null>(null);

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

  return (
    <div
      className="min-h-screen text-fg"
      style={{
        backgroundImage: `linear-gradient(to bottom,
          rgba(10,10,10,0.65) 0%,
          rgba(10,10,10,0.75) 20%,
          rgba(10,10,10,0.85) 45%,
          rgba(10,10,10,0.94) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="px-4 md:px-10 py-4 flex items-center gap-3">
        <button className="btn-ghost" onClick={voltar}>← Voltar</button>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-strong)" }}>🃏 Decks</h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </div>

      <main className="px-4 md:px-10 pb-12 space-y-4">
        <div className="card grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
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
          {auth.isAdmin && modoView === "admin" && (
            <button className="btn-info whitespace-nowrap" onClick={atualizar} disabled={progresso !== null}>
              {progresso ?? "⟳ Atualizar decks"}
            </button>
          )}
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
                <tr style={{ color: "var(--text-muted-ds)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className={`${ESTILO_TITULO} hidden md:table-cell`}>Lançamento</th>
                  <th className={`${ESTILO_TITULO} hidden sm:table-cell`}>Coleção</th>
                  <th className={ESTILO_TITULO}>Deck</th>
                  <th className={`${ESTILO_TITULO} hidden sm:table-cell`}>Comandante</th>
                  <th className={`${ESTILO_TITULO} !text-right hidden md:table-cell`}>Cartas</th>
                  <th className={`${ESTILO_TITULO} !text-right hidden md:table-cell`}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((d) => (
                  <tr key={`${d.colecao}|${d.nome}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="py-1.5 px-2 whitespace-nowrap tabular-nums hidden md:table-cell">{formatarData(d.lancamento)}</td>
                    <td className="py-1.5 px-2 hidden sm:table-cell">{d.colecao}</td>
                    <td className="py-1.5 px-2">
                      <span className="font-medium" style={{ color: "var(--text-strong)" }}>{d.nome}</span>
                      {/* No celular, o comandante e a coleção ficam junto do nome */}
                      <span className="block text-xs sm:hidden" style={{ color: "var(--text-2)" }}>
                        {d.comandantes} · {d.colecao} · {d.lancamento.slice(0, 4)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 hidden sm:table-cell">{d.comandantes}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums hidden md:table-cell">{d.cartas}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums hidden md:table-cell">{d.tokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
