import { useMemo, useState } from "react";
import type { Torneio } from "../../core/types";
import { useStore } from "../../core/store";
import { useToast } from "../ui/Toast";
import { confirmar } from "../ui/Confirm";
import { sugerirNomes } from "../../core/storage";

export function AbaJogadores({ torneio }: { torneio: Torneio }) {
  const addJogador = useStore((s) => s.addJogador);
  const removerJogador = useStore((s) => s.removerJogador);
  const editarJogador = useStore((s) => s.editarJogador);
  const marcarTodosPagos = useStore((s) => s.marcarTodosPagos);
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [deck, setDeck] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);

  const rodadaAndamento = torneio.mesas.length > 0;
  const ativos = torneio.jogadores.filter((j) => j.ativo);

  const jogadoresOrdenados = useMemo(
    () => [...torneio.jogadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
    [torneio.jogadores]
  );

  const onDigitar = (v: string) => {
    setNome(v);
    setSugestoes(v.trim().length >= 2 ? sugerirNomes(v, 6) : []);
    setSugestaoAtiva(0);
  };

  const adicionar = (nomeInput?: string) => {
    const n = (nomeInput ?? nome).trim();
    if (!n) return;
    if (torneio.jogadores.some((j) => j.nome.toLowerCase() === n.toLowerCase())) {
      toast(`"${n}" já está no torneio`, "aviso");
      return;
    }
    addJogador(n, deck.trim(), false);
    setNome("");
    setDeck("");
    setSugestoes([]);
    toast(`${n} adicionado`, "sucesso");
  };

  const remover = async (id: number, nomeJ: string) => {
    if (rodadaAndamento) return toast("Não é possível remover durante uma rodada", "aviso");
    const ok = await confirmar({ mensagem: `Remover ${nomeJ}?`, perigo: true, textoOk: "Remover" });
    if (ok) removerJogador(id);
  };

  const alternarPago = (id: number, atual: boolean) => editarJogador(id, { pago: !atual });

  return (
    <div className="space-y-4 w-full">
      <div className="card">
        <div className="label mb-2">Adicionar jogador</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <div className="relative">
            <input
              className="input w-full"
              value={nome}
              onChange={(e) => onDigitar(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "ArrowDown" || e.key === "ArrowUp") && sugestoes.length > 0) {
                  // Setas percorrem as sugestões, voltando ao início/fim da lista
                  e.preventDefault();
                  const passo = e.key === "ArrowDown" ? 1 : -1;
                  setSugestaoAtiva((i) => (i + passo + sugestoes.length) % sugestoes.length);
                }
                if (e.key === "Enter") {
                  if (sugestoes.length > 0) {
                    // Enter aceita a sugestão destacada (definitivo)
                    setNome(sugestoes[sugestaoAtiva]);
                    setSugestoes([]);
                  } else {
                    adicionar();
                  }
                }
                if (e.key === "Escape") setSugestoes([]);
              }}
              placeholder="Nome do jogador..."
              disabled={rodadaAndamento || torneio.finalizado}
            />
            {sugestoes.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-bg-card border border-bg-cardalt rounded-lg mt-1 z-20 max-h-48 overflow-y-auto shadow-2xl">
                {sugestoes.map((s, i) => (
                  <button
                    key={s}
                    ref={i === sugestaoAtiva ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setNome(s); setSugestoes([]); }}
                    className={`block w-full text-left px-3 py-2 hover:bg-bg-panel text-sm
                                ${i === sugestaoAtiva ? "bg-bg-panel text-acento font-semibold" : ""}`}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
          <input
            className="input w-full"
            value={deck}
            onChange={(e) => setDeck(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="Deck (opcional)"
            disabled={rodadaAndamento || torneio.finalizado}
          />
          <button
            className="btn-primary"
            onClick={() => adicionar()}
            disabled={rodadaAndamento || torneio.finalizado}
          >+ Adicionar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-info"
          onClick={() => marcarTodosPagos()}
          disabled={torneio.jogadores.length === 0}
        >Marcar todos pagos</button>
        <button
          className="btn-danger"
          onClick={async () => {
            if (rodadaAndamento) return toast("Não é possível remover durante uma rodada", "aviso");
            if (torneio.jogadores.length === 0) return;
            const ok = await confirmar({
              titulo: "Remover todos",
              mensagem: `Remover TODOS os ${torneio.jogadores.length} jogadores deste torneio?`,
              perigo: true,
              textoOk: "Remover tudo",
            });
            if (!ok) return;
            [...torneio.jogadores].forEach((j) => removerJogador(j.id));
            toast("Todos os jogadores foram removidos", "sucesso");
          }}
          disabled={torneio.jogadores.length === 0 || rodadaAndamento}
        >🗑 Remover todos</button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-fg-dim">
            {torneio.jogadores.length} jogadores
            {" · "}
            {torneio.jogadores.filter((j) => j.pago).length} pagos
            {" · "}
            {ativos.length} ativos
          </div>
        </div>

        {jogadoresOrdenados.length === 0 ? (
          <div className="text-fg-dim text-center py-8">Adicione jogadores para começar</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--text-muted-ds)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="text-left py-2 px-2 text-[10px] font-bold tracking-widest uppercase w-12">PAGO</th>
                  <th className="text-left py-2 px-2 text-[10px] font-bold tracking-widest uppercase">JOGADOR</th>
                  <th className="text-left py-2 px-2 text-[10px] font-bold tracking-widest uppercase">DECK</th>
                  <th className="text-right py-2 px-2 text-[10px] font-bold tracking-widest uppercase w-16">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {jogadoresOrdenados.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="py-1.5 px-2">
                      <button
                        onClick={() => alternarPago(j.id, j.pago)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center text-xs
                                    ${j.pago
                                      ? "bg-sucesso border-sucesso text-bg"
                                      : "border-fg-muted text-transparent hover:border-fg-dim"}`}
                        title={j.pago ? "Pago" : "Não pago"}
                      >{j.pago ? "✓" : ""}</button>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`font-medium ${!j.ativo ? "line-through text-fg-muted" : ""}`}
                            style={{ color: "var(--text-strong)" }}>
                        {j.nome}
                      </span>
                      {!j.ativo && (
                        <span className="ml-2 text-[10px] bg-perigo/20 text-perigo px-2 py-0.5 rounded">INATIVO</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        defaultValue={j.deck || ""}
                        placeholder="— sem deck —"
                        onBlur={(e) => {
                          const novo = e.target.value.trim();
                          if (novo !== (j.deck || "")) editarJogador(j.id, { deck: novo });
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="w-full bg-transparent text-xs italic px-2 py-1 rounded border border-transparent hover:border-white/10 focus:border-acento focus:bg-black/20 outline-none"
                        style={{ color: j.deck ? "var(--app-text)" : "var(--text-muted-ds)" }}
                        disabled={rodadaAndamento}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        className="text-perigo hover:text-red-400 text-xl leading-none px-2"
                        onClick={() => remover(j.id, j.nome)}
                        title="Remover"
                        disabled={rodadaAndamento}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
