import type { CSSProperties } from "react";
import type { Torneio } from "../../core/types";
import { torneioParado } from "../../core/visibilidade";

type TipoStatus = "aberto" | "rodada" | "parado" | "finalizado";

// O torneio em andamento chama a atenção; o finalizado fica discreto, pois não pede mais nada
export function statusDoTorneio(t: Torneio): { tipo: TipoStatus; texto: string } {
  if (t.finalizado) return { tipo: "finalizado", texto: "FINALIZADO" };
  if (t.rodadaAtual === 0) return { tipo: "aberto", texto: "ABERTO" };
  if (torneioParado(t)) return { tipo: "parado", texto: `PARADO · RODADA ${t.rodadaAtual}` };
  return { tipo: "rodada", texto: `RODADA ${t.rodadaAtual} DE ${t.qtdRodadas}` };
}

const ESTILO_DO_STATUS: Record<TipoStatus, CSSProperties> = {
  aberto: { background: "rgba(148,163,184,0.14)", color: "#a9b6c8", borderColor: "rgba(148,163,184,0.32)" },
  rodada: { background: "var(--brand-1)", color: "#141414", borderColor: "var(--brand-1)", boxShadow: "0 0 14px -2px rgba(201,166,72,0.6)" },
  parado: { background: "rgba(252,211,77,0.14)", color: "var(--warn)", borderColor: "rgba(252,211,77,0.35)" },
  finalizado: { background: "rgba(123,196,127,0.10)", color: "rgba(123,196,127,0.85)", borderColor: "rgba(123,196,127,0.22)" },
};

const SINAL_DO_STATUS: Record<Exclude<TipoStatus, "rodada">, string> = { aberto: "○", parado: "⚠", finalizado: "♛" };

// Selo do torneio: no card da lista e no topo da tela do torneio
export function SeloStatus({ torneio, compacto = false }: { torneio: Torneio; compacto?: boolean }) {
  const status = statusDoTorneio(torneio);
  return (
    <span
      className={`${compacto ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1"} font-bold tracking-wider rounded-full border inline-flex items-center gap-1.5 whitespace-nowrap`}
      style={ESTILO_DO_STATUS[status.tipo]}
    >
      {status.tipo === "rodada"
        ? <span className="ponto-ao-vivo" aria-hidden="true" />
        : <span aria-hidden="true">{SINAL_DO_STATUS[status.tipo]}</span>}
      {status.texto}
    </span>
  );
}
