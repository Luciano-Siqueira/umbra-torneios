import { useMemo } from "react";
import { IconeCheck } from "../ui/Icones";
import type { Torneio, Rodada, Mesa } from "../../core/types";

export function AbaHistorico({ torneio }: { torneio: Torneio }) {
  const jogadoresPorId = useMemo(() => {
    const m = new Map<number, string>();
    torneio.jogadores.forEach((j) => m.set(j.id, j.nome));
    return m;
  }, [torneio.jogadores]);

  // Junta rodadasFinalizadas + rodada corrente (t.mesas)
  const rodadas: Rodada[] = [...torneio.rodadasFinalizadas];
  if (torneio.mesas.length > 0) {
    rodadas.push({
      numero: torneio.rodadaAtual,
      mesas: torneio.mesas,
      dataInicio: torneio.dataRodadaAtual || "",
      finalizada: torneio.mesas.every((m) => m.finalizada),
    });
  }

  if (rodadas.length === 0) {
    return (
      <div className="text-center py-16 text-fg-dim">
        Nenhuma rodada iniciada ainda.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rodadas.map((r) => (
          <section key={r.numero}>
            <h2 className="text-lg font-bold mb-2 sticky top-0 bg-[#0a0a0a] py-1 z-10">
              <span className="text-acento">Rodada {r.numero}</span>
              <span className="text-sm text-fg-dim ml-2">
                ({r.mesas.filter((m) => m.finalizada).length}/{r.mesas.length})
              </span>
            </h2>
            <div className="space-y-2">
              {r.mesas.map((m) => (
                <MesaCard key={`${r.numero}-${m.numero}`} mesa={m} jogadoresPorId={jogadoresPorId} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MesaCard({ mesa, jogadoresPorId }: { mesa: Mesa; jogadoresPorId: Map<number, string> }) {
  const ordem = mesa.finalizada ? construirOrdem(mesa) : mesa.jogadoresIds;
  const colocacaoPorId = mesa.finalizada ? calcularColocacoes(mesa) : new Map<number, number>();
  return (
    <div className="card-alt p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold">Mesa {mesa.numero}</div>
        {mesa.finalizada ? (
          <span className="text-xs text-sucesso">
            <IconeCheck cor="currentColor" />{mesa.empateTopoIds.length > 1 ? ` empate K=${mesa.empateTopoIds.length}` : ""}
          </span>
        ) : (
          <span className="text-xs text-info">pendente</span>
        )}
      </div>
      <div className="text-sm space-y-0.5">
        {ordem.map((id) => {
          const col = colocacaoPorId.get(id);
          return (
            <div key={id} className={col === 1 && mesa.finalizada ? "font-bold" : ""}>
              {mesa.finalizada && <span className="text-fg-muted mr-1">{col}º</span>}
              {jogadoresPorId.get(id) ?? "?"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function calcularColocacoes(mesa: Mesa): Map<number, number> {
  const total = mesa.jogadoresIds.length;
  const col = new Map<number, number>();
  let colAtual = total;
  let ultimaColGrupo: number | null = null;
  for (const g of mesa.eliminacoes) {
    for (const id of g) col.set(id, colAtual);
    ultimaColGrupo = colAtual;
    colAtual -= g.length;
  }
  if (mesa.empateTopoIds.length) {
    const colEmpate = ultimaColGrupo !== null ? ultimaColGrupo - 1 : total;
    for (const id of mesa.empateTopoIds) col.set(id, colEmpate);
  } else if (mesa.vencedorId !== null) {
    col.set(mesa.vencedorId, 1);
  }
  return col;
}

function construirOrdem(mesa: Mesa): number[] {
  const ordem: number[] = [];
  if (mesa.empateTopoIds.length) ordem.push(...mesa.empateTopoIds);
  else if (mesa.vencedorId !== null) ordem.push(mesa.vencedorId);
  const gruposInv = [...mesa.eliminacoes].reverse();
  for (const g of gruposInv) ordem.push(...g);
  const vistos = new Set(ordem);
  for (const id of mesa.jogadoresIds) {
    if (!vistos.has(id)) { ordem.push(id); vistos.add(id); }
  }
  return ordem;
}
