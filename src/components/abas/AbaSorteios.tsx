import { useEffect, useRef, useState } from "react";
import type { Torneio } from "../../core/types";
import { SorteioRoda, type RodaHandle } from "../sorteios/SorteioRoda";
import { CorridaPatinhos, type PatinhosHandle } from "../sorteios/CorridaPatinhos";

type Modo = "roda" | "patinhos";

// Estado global de sorteios (não perde ao trocar de aba)
interface EstadoSorteio {
  modo: Modo;
  selecionados: string[];
  sorteadosRoda: string[];
  restantesRoda: string[];
  rankingCorrida: string[];
  participantesCorrida: string[];
}
const estadoPorTorneio = new Map<string, EstadoSorteio>();

export function AbaSorteios({ torneio }: { torneio: Torneio }) {
  const nomes = torneio.jogadores.map((j) => j.nome);
  const salvo = estadoPorTorneio.get(torneio.id);
  const [modo, setModo] = useState<Modo>(salvo?.modo ?? "roda");
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(salvo?.selecionados ?? nomes)
  );
  const [expandido, setExpandido] = useState(false);
  const rodaRef = useRef<RodaHandle>(null);
  const patinhosRef = useRef<PatinhosHandle>(null);

  // Salva quando muda
  useEffect(() => {
    const atual = estadoPorTorneio.get(torneio.id) ?? {
      modo, selecionados: [], sorteadosRoda: [], restantesRoda: [],
      rankingCorrida: [], participantesCorrida: [],
    };
    atual.modo = modo;
    atual.selecionados = Array.from(selecionados);
    estadoPorTorneio.set(torneio.id, atual);
  }, [modo, selecionados, torneio.id]);

  const toggleTodos = (marcar: boolean) =>
    setSelecionados(new Set(marcar ? nomes : []));
  const toggle = (n: string) =>
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n); else s.add(n);
      return s;
    });

  const usados = nomes.filter((n) => selecionados.has(n));

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {/* Toolbar TOP: modo + participantes + ações */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setModo("roda")}
          className={`${modo === "roda" ? "btn-primary" : "btn-ghost"} w-56`}
        >◈ Roleta</button>
        <button
          onClick={() => setModo("patinhos")}
          className={`${modo === "patinhos" ? "btn-primary" : "btn-ghost"} w-56`}
        >🦆 Corrida de Patinhos</button>

        <div className="flex-1" />

        <button
          className="btn-ghost text-sm"
          onClick={() => setExpandido((v) => !v)}
        >
          👥 {usados.length}/{nomes.length}
        </button>

        {modo === "roda" ? (
          <>
            <button className="btn-success" onClick={() => rodaRef.current?.girar()}>
              ◈ GIRAR
            </button>
            <button className="btn-ghost" onClick={() => rodaRef.current?.resetar()}>
              ↺ Resetar
            </button>
          </>
        ) : (
          <>
            <button className="btn-success" onClick={() => patinhosRef.current?.iniciar()}>
              ▶ LARGAR
            </button>
            <button className="btn-warning" onClick={() => patinhosRef.current?.proximaCorrida()}>
              → Próxima
            </button>
            <button className="btn-ghost" onClick={() => patinhosRef.current?.resetar()}>
              ↺ Resetar
            </button>
          </>
        )}
      </div>

      {/* Painel colapsável de participantes */}
      {expandido && (
        <div className="card !p-3">
          <div className="flex justify-end gap-2 mb-2">
            <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => toggleTodos(true)}>Todos</button>
            <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => toggleTodos(false)}>Nenhum</button>
            <button className="btn-primary !px-3 !py-1 text-xs" onClick={() => setExpandido(false)}>OK</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 max-h-52 overflow-y-auto">
            {nomes.map((n) => (
              <label key={n} className="flex items-center gap-2 p-1 hover:bg-bg-cardalt rounded cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selecionados.has(n)}
                  onChange={() => toggle(n)}
                  className="w-4 h-4"
                />
                <span className="truncate">{n}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {nomes.length === 0 ? (
        <div className="text-center py-16 text-fg-dim">Adicione jogadores para sortear.</div>
      ) : usados.length === 0 ? (
        <div className="text-center py-8 text-fg-dim text-sm">Selecione ao menos 1 participante.</div>
      ) : modo === "roda" ? (
        <SorteioRoda ref={rodaRef} nomes={usados} torneioId={torneio.id} estado={estadoPorTorneio} />
      ) : (
        <CorridaPatinhos ref={patinhosRef} nomes={usados} torneioId={torneio.id} estado={estadoPorTorneio} />
      )}
    </div>
  );
}
