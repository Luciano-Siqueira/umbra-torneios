import { useMemo } from "react";
import type { Torneio } from "../../core/types";
import { calcularPremiacao, descricaoFaixa } from "../../core/premiacao";
import { ranking } from "../../core/resultados";

export function AbaPremiacao({ torneio }: { torneio: Torneio }) {
  const pagos = torneio.jogadores.filter((j) => j.pago).length;
  const arrecadado = pagos * torneio.taxaInscricao;

  const premios = useMemo(
    () => calcularPremiacao(torneio.jogadores.length, arrecadado),
    [torneio.jogadores.length, arrecadado]
  );
  const rank = useMemo(() => ranking(torneio), [torneio]);
  const faixa = descricaoFaixa(torneio.jogadores.length);

  return (
    <div className="w-full space-y-4">
      <div className="card">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-fg-dim">JOGADORES</div>
            <div className="text-2xl font-black">{torneio.jogadores.length}</div>
          </div>
          <div>
            <div className="text-xs text-fg-dim">ARRECADADO</div>
            <div className="text-2xl font-black text-sucesso">R$ {arrecadado.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-dim">FAIXA</div>
            <div className="text-sm font-semibold text-acento">{faixa}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="label mb-3">Distribuição da premiação</h3>
        {premios.length === 0 ? (
          <div className="text-fg-dim text-sm text-center py-4">
            Nenhum jogador na faixa ou sem valores.
          </div>
        ) : (
          <div className="space-y-2">
            {premios.map((p, i) => {
              const j = rank[i];
              return (
                <div key={p.posicao} className="flex items-center gap-3 p-3 bg-bg-cardalt rounded-lg">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg
                                    ${i === 0 ? "bg-atencao text-bg"
                                      : i === 1 ? "bg-gray-300 text-bg"
                                      : i === 2 ? "bg-orange-400 text-bg"
                                      : "bg-bg-card text-fg"}`}>
                    {p.posicao}º
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {torneio.finalizado && j ? j.nome : "(a definir)"}
                    </div>
                    <div className="text-xs text-fg-dim">{(p.percentual * 100).toFixed(1)}% do prêmio</div>
                  </div>
                  <div className="text-xl font-black text-sucesso">R$ {p.valor.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-fg-muted text-center">
        A premiação segue a tabela de faixas por número de participantes.
      </div>
    </div>
  );
}
