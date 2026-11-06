import { useEffect, useMemo, useState } from "react";
import { podeAdicionarJogador, type Torneio } from "../../core/types";
import { useStore } from "../../core/store";
import { useToast } from "../ui/Toast";
import { confirmar } from "../ui/Confirm";
import { CampoDeck } from "../ui/CampoDeck";
import { CoresMana } from "../ui/SimboloMana";
import { CaixaPago } from "../ui/CaixaPago";
import { contar } from "../../core/formato";
import { comandanteDoDeck, coresDoDeck } from "../../core/decks";
import { sugerirNomes } from "../../core/storage";

function DeckDoJogador({ deck, onSalvar }: { deck: string; onSalvar: (novo: string) => void }) {
  const [valor, setValor] = useState(deck);
  useEffect(() => setValor(deck), [deck]); // Pode ter mudado em outro aparelho

  const salvar = (texto: string) => {
    const novo = texto.trim();
    if (novo !== deck) onSalvar(novo);
  };

  return (
    <CampoDeck
      valor={valor}
      onMudar={setValor}
      onEscolher={salvar}
      onEnter={() => salvar(valor)}
      onSair={() => salvar(valor)}
      placeholder="— sem deck —"
      className="w-full bg-transparent text-xs italic px-2 py-1 rounded border border-transparent hover:border-white/10 focus:border-acento focus:bg-black/20 outline-none"
      style={{ color: deck ? "var(--app-text)" : "var(--text-muted-ds)" }}
    />
  );
}

export function AbaJogadores({ torneio, podeEditar }: { torneio: Torneio; podeEditar: boolean }) {
  const addJogador = useStore((s) => s.addJogador);
  const removerJogador = useStore((s) => s.removerJogador);
  const editarJogador = useStore((s) => s.editarJogador);
  const alternarDrop = useStore((s) => s.alternarDrop);
  const marcarTodosPagos = useStore((s) => s.marcarTodosPagos);
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [deck, setDeck] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);

  const rodadaAndamento = torneio.mesas.length > 0;
  const podeAdicionar = podeAdicionarJogador(torneio);
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
    if (!n || !podeAdicionar) return;
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

  const drop = async (id: number, nomeJ: string, ativo: boolean) => {
    if (!ativo) {
      alternarDrop(id);
      toast(`${nomeJ} volta a entrar nas próximas rodadas`, "sucesso");
      return;
    }
    const ok = await confirmar({
      titulo: "Drop de jogador",
      mensagem: `${nomeJ} sai das próximas rodadas e continua no ranking. Se estiver em uma mesa em andamento, registre o resultado dela normalmente.`,
      textoOk: "Confirmar drop",
    });
    if (ok) alternarDrop(id);
  };

  return (
    <div className="space-y-4 w-full">
      {/* z-30: a lista de sugestões precisa ficar por cima dos botões e cartões abaixo */}
      {podeEditar && (
      <div className="card relative z-30">
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
              disabled={!podeAdicionar}
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
                                ${i === sugestaoAtiva ? "bg-acento/25 text-acento font-semibold" : ""}`}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
          <CampoDeck
            className="input w-full"
            valor={deck}
            onMudar={setDeck}
            onEnter={() => adicionar()}
            placeholder="Deck ou comandante (opcional)"
            disabled={!podeAdicionar}
          />
          <button
            className="btn-primary"
            onClick={() => adicionar()}
            disabled={!podeAdicionar}
          >+ Adicionar</button>
        </div>
        {!torneio.finalizado && torneio.rodadaAtual === 1 && (
          <div className="text-xs mt-2" style={{ color: "var(--text-2)" }}>
            Quem entrar agora joga a partir da rodada 2. Para incluir na rodada 1, resorteie as mesas ou use Voltar ao início na aba Mesas.
          </div>
        )}
        {!podeAdicionar && !torneio.finalizado && (
          <div className="text-xs mt-2" style={{ color: "var(--text-2)" }}>
            Depois da rodada 1 não dá mais para adicionar jogadores.
          </div>
        )}
      </div>
      )}

      {podeEditar && (
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
              mensagem: `Remover todos os jogadores deste torneio (${torneio.jogadores.length})?`,
              perigo: true,
              textoOk: "Remover tudo",
            });
            if (!ok) return;
            [...torneio.jogadores].forEach((j) => removerJogador(j.id));
            toast("Todos os jogadores foram removidos", "sucesso");
          }}
          disabled={torneio.jogadores.length === 0 || torneio.rodadaAtual > 0}
        >🗑 Remover todos</button>
      </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-fg-dim">
            {contar(torneio.jogadores.length, "jogador", "jogadores")}
            {podeEditar && ` · ${contar(torneio.jogadores.filter((j) => j.pago).length, "pago")}`}
            {" · "}
            {contar(ativos.length, "ativo")}
          </div>
        </div>

        {jogadoresOrdenados.length === 0 ? (
          <div className="text-fg-dim text-center py-8">
            {podeEditar ? "Adicione jogadores para começar" : "Nenhum jogador inscrito ainda"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tabela-cab">
                  {podeEditar && <th className="text-left py-2 px-2 w-12">Pago</th>}
                  <th className="text-left py-2 px-2">Jogador</th>
                  <th className="text-left py-2 px-2">Deck</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Comandante</th>
                  {podeEditar && <th className="text-right py-2 px-2">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {jogadoresOrdenados.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {podeEditar && (
                    <td className="py-1.5 px-2">
                      <CaixaPago pago={j.pago} nome={j.nome} onClick={() => alternarPago(j.id, j.pago)} />
                    </td>
                    )}
                    <td className="py-1.5 px-2">
                      <span className={`font-medium ${!j.ativo ? "line-through text-fg-muted" : ""}`}
                            style={{ color: "var(--text-strong)" }}>
                        {j.nome}
                      </span>
                      {!j.ativo && (
                        <span className="ml-2 text-[10px] bg-perigo/20 text-perigo px-2 py-0.5 rounded">DROP</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      {!podeEditar ? (
                        <span className="text-xs italic px-2" style={{ color: j.deck ? "var(--app-text)" : "var(--text-muted-ds)" }}>
                          {j.deck || "— sem deck —"}
                        </span>
                      ) : (
                      <DeckDoJogador
                        deck={j.deck || ""}
                        onSalvar={(novo) => editarJogador(j.id, { deck: novo })}
                      />
                      )}
                      {/* No celular, o comandante fica junto do deck */}
                      {coresDoDeck(j.deck || "") !== null && (
                        <span className="block sm:hidden text-xs px-2 mt-0.5" style={{ color: "var(--text-2)" }}>
                          {comandanteDoDeck(j.deck)} <CoresMana cores={coresDoDeck(j.deck)!} tamanho={13} />
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-xs hidden sm:table-cell" style={{ color: "var(--app-text)" }}>
                      {coresDoDeck(j.deck || "") === null ? "—" : (
                        <>{comandanteDoDeck(j.deck)} <CoresMana cores={coresDoDeck(j.deck)!} tamanho={14} /></>
                      )}
                    </td>
                    {podeEditar && (
                    <td className="py-1.5 px-2 text-right">
                      {/* Depois de iniciado, remover quebraria o histórico das mesas */}
                      {torneio.rodadaAtual === 0 ? (
                        <button
                          className="text-perigo hover:text-red-400 text-xl leading-none min-w-[36px] min-h-[36px]"
                          onClick={() => remover(j.id, j.nome)}
                          title="Remover"
                        >×</button>
                      ) : !torneio.finalizado && (
                        <button
                          className="text-xs px-3 min-h-[36px] rounded border border-white/10 hover:bg-white/5 whitespace-nowrap"
                          onClick={() => drop(j.id, j.nome, j.ativo)}
                          title={j.ativo ? "Tirar das próximas rodadas" : "Voltar para as próximas rodadas"}
                        >{j.ativo ? "Drop" : "Desfazer drop"}</button>
                      )}
                    </td>
                    )}
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
