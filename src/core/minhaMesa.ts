// Encontra o torneio em andamento do jogador e a mesa dele
import { calcularColocacoes } from "./resultados";
import type { Jogador, Mesa, Torneio } from "./types";

export interface MinhaMesa {
  torneio: Torneio;
  jogador: Jogador;
  mesa: Mesa | null;
  colocacao: number | null; // só depois de sair da mesa ou de ela terminar
  venceu: boolean;
}

export function encontrarMinhaMesa(torneios: Torneio[], nomes: string[]): MinhaMesa | null {
  const meusNomes = new Set(nomes.map((n) => n.trim().toLowerCase()));
  const candidatos = torneios
    .filter((t) => !t.finalizado)
    .flatMap((torneio) => {
      const jogador = torneio.jogadores.find((j) => meusNomes.has(j.nome.trim().toLowerCase()));
      return jogador ? [{ torneio, jogador }] : [];
    })
    // Torneio já iniciado vem primeiro; entre iguais, o mais recente
    .sort((a, b) =>
      Number(b.torneio.rodadaAtual > 0) - Number(a.torneio.rodadaAtual > 0)
      || (b.torneio.dataCriacao || "").localeCompare(a.torneio.dataCriacao || "")
    );

  const achado = candidatos[0];
  if (!achado) return null;

  const { torneio, jogador } = achado;
  const mesa = torneio.mesas.find((m) => m.jogadoresIds.includes(jogador.id)) ?? null;
  return {
    torneio,
    jogador,
    mesa,
    colocacao: mesa ? calcularColocacoes(mesa).get(jogador.id) ?? null : null,
    venceu: mesa?.vencedorId === jogador.id,
  };
}
