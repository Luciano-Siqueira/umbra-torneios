import { useStore } from "../core/store";
import type { Torneio } from "../core/types";

function Interruptor({ rotulo, descricao, ligado, desativado, onMudar }: {
  rotulo: string;
  descricao: string;
  ligado: boolean;
  desativado?: boolean;
  onMudar: (ligado: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 flex-1 min-w-[220px] ${desativado ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        disabled={desativado}
        onClick={() => onMudar(!ligado)}
        className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0 active:scale-95"
        style={{ background: ligado ? "var(--brand-1)" : "var(--line)" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: ligado ? "26px" : "2px" }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{rotulo}</span>
        <span className="block text-xs" style={{ color: "var(--text-2)" }}>{descricao}</span>
      </span>
    </label>
  );
}

// Só quem organiza vê: decide se os jogadores acompanham as mesas e o tempo
export function PainelVisaoJogadores({ torneio }: { torneio: Torneio }) {
  const liberar = useStore((s) => s.liberarParaJogadores);
  const mesas = !!torneio.mesasParaJogadores;
  const tempo = !!torneio.tempoParaJogadores;

  return (
    <section aria-label="O que os jogadores veem" className="card mb-4 space-y-3">
      <div className="label">O que os jogadores veem</div>
      <div className="flex flex-wrap gap-4">
        <Interruptor
          rotulo="Mesas"
          descricao="A aba Mesas e a mesa de cada jogador"
          ligado={mesas}
          onMudar={(v) => liberar({ mesasParaJogadores: v })}
        />
        <Interruptor
          rotulo="Temporizador"
          descricao={mesas ? "O tempo da rodada e o aviso de fim" : "Libere as mesas primeiro"}
          ligado={mesas && tempo}
          desativado={!mesas}
          onMudar={(v) => liberar({ tempoParaJogadores: v })}
        />
      </div>
      <div className="text-[11px]" style={{ color: "var(--text-muted-ds)" }}>
        Os admins sempre veem tudo.
      </div>
    </section>
  );
}
