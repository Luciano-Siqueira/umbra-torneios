import { useMemo } from "react";
import type { Torneio } from "../../core/types";
import { useStore } from "../../core/store";
import { contar, formatarReais } from "../../core/formato";
import { CaixaPago } from "../ui/CaixaPago";

export function AbaFinanceiro({ torneio }: { torneio: Torneio }) {
  const marcarTodosPagos = useStore((s) => s.marcarTodosPagos);
  const editarJogador = useStore((s) => s.editarJogador);

  const { pagos, pendentes, arrecadado, esperado } = useMemo(() => {
    const pagos = torneio.jogadores.filter((j) => j.pago);
    const pendentes = torneio.jogadores.filter((j) => !j.pago);
    return {
      pagos, pendentes,
      arrecadado: pagos.length * torneio.taxaInscricao,
      esperado: torneio.jogadores.length * torneio.taxaInscricao,
    };
  }, [torneio]);

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="TAXA" valor={formatarReais(torneio.taxaInscricao)} cor="text-info" />
        <StatCard label="ESPERADO" valor={formatarReais(esperado)} cor="text-atencao" />
        <StatCard label="PENDENTE" valor={formatarReais(esperado - arrecadado)} cor="text-perigo" />
        <StatCard label="ARRECADADO" valor={formatarReais(arrecadado)} cor="text-sucesso" />
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-fg-dim">
          {contar(pagos.length, "pago")} · {contar(pendentes.length, "pendente")}
        </div>
        <button className="btn-info" onClick={() => marcarTodosPagos()}>Marcar todos pagos</button>
      </div>

      <div className="card">
        <h3 className="label mb-2">Pendentes ({pendentes.length})</h3>
        {pendentes.length === 0 ? (
          <div className="text-fg-dim text-sm">Todos pagos!</div>
        ) : (
          <div className="space-y-1">
            {pendentes.map((j) => (
              <div key={j.id} className="flex items-center gap-3 p-2 hover:bg-bg-cardalt rounded">
                <CaixaPago pago={false} nome={j.nome} onClick={() => editarJogador(j.id, { pago: true })} />
                <span className="flex-1">{j.nome}</span>
                <span className="text-xs text-perigo">{formatarReais(torneio.taxaInscricao)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="label mb-2">Pagos ({pagos.length})</h3>
        {pagos.length === 0 ? (
          <div className="text-fg-dim text-sm">Nenhum pagamento ainda</div>
        ) : (
          <div className="space-y-1">
            {pagos.map((j) => (
              <div key={j.id} className="flex items-center gap-3 p-2 hover:bg-bg-cardalt rounded">
                <CaixaPago pago nome={j.nome} travado={torneio.finalizado} onClick={() => editarJogador(j.id, { pago: false })} />
                <span className="flex-1">{j.nome}</span>
                <span className="text-xs text-sucesso">{formatarReais(torneio.taxaInscricao)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="card text-center">
      <div className="text-xs text-fg-dim">{label}</div>
      <div className={`text-2xl font-black mt-1 ${cor}`}>{valor}</div>
    </div>
  );
}
