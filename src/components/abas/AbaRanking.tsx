import { useMemo } from "react";
import type { Torneio } from "../../core/types";
import {
  ranking, omwJogador, ogwJogador, gameWinrate,
  vitorias, partidasJogadas,
} from "../../core/resultados";
import { formatarPercentual } from "../../core/formato";

export function AbaRanking({ torneio }: { torneio: Torneio }) {
  const rank = useMemo(() => ranking(torneio), [torneio]);

  return (
    <div className="w-full">
      <div className="card">
        <div className="text-sm font-semibold text-center mb-3" style={{ color: "var(--critical)" }}>
          Desempate oficial MTG: Pontos → OMW% → GW% → OGW% (piso 33%)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="tabela-cab">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Jogador</th>
                <th className="text-right py-2 px-2">Pts</th>
                <th className="text-right py-2 px-2">OMW%</th>
                <th className="text-right py-2 px-2">GW%</th>
                <th className="text-right py-2 px-2">OGW%</th>
                <th className="text-right py-2 px-2">V</th>
                <th className="text-right py-2 px-2">Jog.</th>
              </tr>
            </thead>
            <tbody>
              {rank.map((j, i) => {
                const omw = omwJogador(torneio, j);
                const gw = gameWinrate(j);
                const ogw = ogwJogador(torneio, j);
                return (
                  <tr
                    key={j.id}
                    className={`border-b border-bg-cardalt/40 hover:bg-bg-panel/40
                                ${!j.ativo ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 px-2 font-bold">
                      <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs
                                        ${i === 0 ? "bg-atencao text-bg"
                                          : i === 1 ? "bg-gray-300 text-bg"
                                          : i === 2 ? "bg-orange-400 text-bg"
                                          : "bg-bg-cardalt"}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-medium">
                      {j.nome}
                      {!j.ativo && <span className="ml-2 text-xs text-perigo">(drop)</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-acento">{j.pontos}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatarPercentual(omw)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatarPercentual(gw)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatarPercentual(ogw)}</td>
                    <td className="py-2 px-2 text-right">{vitorias(j)}</td>
                    <td className="py-2 px-2 text-right">{partidasJogadas(j)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rank.length === 0 && (
          <div className="text-center py-8 text-fg-dim">Nenhum jogador ainda</div>
        )}
      </div>
    </div>
  );
}
