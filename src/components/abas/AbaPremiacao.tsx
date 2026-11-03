import { useMemo, useState } from "react";
import type { Jogador, Torneio } from "../../core/types";
import { calcularPremiacao, descricaoFaixa } from "../../core/premiacao";
import { rankingPremiavel } from "../../core/resultados";
import { useStore } from "../../core/store";
import { useToast } from "../ui/Toast";

function RegistroPremio({ jogador, sugerido }: { jogador: Jogador; sugerido: number }) {
  const registrarPremio = useStore((s) => s.registrarPremio);
  const { toast } = useToast();
  const [valor, setValor] = useState(sugerido.toFixed(2));

  if (jogador.premioPago) {
    return (
      <div className="flex items-center justify-end gap-2 text-xs mt-1">
        <span className="text-sucesso">
          ✓ Pago R$ {jogador.premioPago.valor.toFixed(2)} em {new Date(jogador.premioPago.em).toLocaleDateString("pt-BR")}
        </span>
        <button className="text-fg-dim hover:text-fg underline" onClick={() => registrarPremio(jogador.id, null)}>
          Desfazer
        </button>
      </div>
    );
  }

  const registrar = () => {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return toast("Digite um valor válido", "aviso");
    registrarPremio(jogador.id, Math.round(n * 100) / 100);
  };

  return (
    <div className="flex items-center justify-end gap-2 mt-1">
      <span className="text-xs text-fg-dim">R$</span>
      <input
        className="input !py-1 !px-2 text-sm w-24"
        inputMode="decimal"
        aria-label={`Valor pago a ${jogador.nome}`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && registrar()}
      />
      <button className="btn-info !py-1 !px-3 text-xs" onClick={registrar}>Registrar pago</button>
    </div>
  );
}

export function AbaPremiacao({ torneio }: { torneio: Torneio }) {
  const pagos = torneio.jogadores.filter((j) => j.pago).length;
  const arrecadado = pagos * torneio.taxaInscricao;

  const premios = useMemo(
    () => calcularPremiacao(torneio.jogadores.length, arrecadado),
    [torneio.jogadores.length, arrecadado]
  );
  const rank = useMemo(() => rankingPremiavel(torneio), [torneio]);
  const faixa = descricaoFaixa(torneio.jogadores.length);
  const totalPago = torneio.jogadores.reduce((s, j) => s + (j.premioPago?.valor ?? 0), 0);

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
        {torneio.finalizado && (
          <div className="text-sm text-fg-dim mb-3">Pago até agora: R$ {totalPago.toFixed(2)}</div>
        )}
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
                  <div className="text-right">
                    <div className="text-xl font-black text-sucesso">R$ {p.valor.toFixed(2)}</div>
                    {torneio.finalizado && j && <RegistroPremio key={j.id} jogador={j} sugerido={p.valor} />}
                  </div>
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
