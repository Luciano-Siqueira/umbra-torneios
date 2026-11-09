import type { MinhaMesa } from "../core/minhaMesa";
import { IconeEmpate, IconeEspadas, IconeTrofeu } from "./ui/Icones";
import { formatarTempo, useContagem } from "../core/useTimer";
import type { Torneio } from "../core/types";

function RelogioRodada({ torneio }: { torneio: Torneio }) {
  const c = useContagem(torneio.tempoRodadaMin, torneio.tempoExtraMin, torneio.timer);
  const fase = !c.iniciado
    ? "Aguardando o início do tempo"
    : c.restante === 0
      ? "Último turno: 1 para cada jogador"
      : c.pausado || !c.rodando
        ? "Tempo pausado"
        : c.emExtra
          ? "Tempo extra"
          : "Tempo normal";
  return (
    <div className="text-center flex-shrink-0">
      <div
        className="text-4xl md:text-5xl font-mono font-bold tabular-nums"
        style={{ color: c.emExtra ? "var(--warn)" : "var(--brand-1)" }}
      >
        {formatarTempo(c.restante)}
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--text-2)" }}>{fase}</div>
    </div>
  );
}

export function CartaoMinhaMesa({ minha, mostrarTempo = true }: { minha: MinhaMesa; mostrarTempo?: boolean }) {
  const { torneio, jogador, mesa, colocacao, venceu } = minha;

  const nomeDe = (id: number) => torneio.jogadores.find((j) => j.id === id)?.nome ?? "?";
  const status = !mesa
    ? "Aguardando o sorteio das mesas"
    : venceu
      ? <><IconeTrofeu cor="currentColor" /> Você venceu esta mesa!</>
      : mesa.empateTopoIds.includes(jogador.id)
        ? <><IconeEmpate cor="currentColor" /> Sua mesa terminou em empate por tempo</>
        : colocacao !== null
          ? `Você terminou esta mesa em ${colocacao}º lugar`
          : mesa.finalizada
            ? "Mesa finalizada"
            : "Você está jogando";

  return (
    <div
      className="rounded-2xl border p-4 md:p-5"
      style={{
        background: "linear-gradient(90deg, rgba(201,166,72,0.18), rgba(15,15,15,0.75))",
        borderColor: "rgba(201,166,72,0.45)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--brand-1)" }}>
            <IconeEspadas cor="currentColor" /> Sua mesa · Rodada {torneio.rodadaAtual} de {torneio.qtdRodadas}
          </div>
          {mesa && (
            <>
              <div className="text-2xl font-black mt-2" style={{ color: "var(--text-strong)" }}>
                Mesa {mesa.numero}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {mesa.jogadoresIds.map((id) => (
                  <span
                    key={id}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={id === jogador.id
                      ? { background: "var(--brand-1)", color: "#0a0a0a", fontWeight: 700 }
                      : { background: "rgba(255,255,255,0.08)", color: "var(--app-text)" }}
                  >
                    {id === jogador.id ? "Você" : nomeDe(id)}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="text-sm mt-2" style={{ color: "var(--text-2)" }}>{status}</div>
        </div>
        {mostrarTempo && <RelogioRodada torneio={torneio} />}
      </div>
    </div>
  );
}
