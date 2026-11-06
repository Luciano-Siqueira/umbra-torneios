// Quais torneios cada modo de visualização enxerga
import type { AuthState } from "./auth";
import type { ModoView } from "./store";
import type { Torneio } from "./types";

const DIAS_PARA_PARADO = 3;

// Torneio iniciado, sem finalizar e sem rodada ou tempo novos há dias: provavelmente foi esquecido
export function torneioParado(t: Torneio, agora: number = Date.now()): boolean {
  if (t.finalizado || t.rodadaAtual === 0) return false;
  const ultimaAtividade = Math.max(
    ...[t.dataCriacao, t.dataRodadaAtual, t.timer?.iniciadoEm].map((d) => Date.parse(d ?? "") || 0),
  );
  return agora - ultimaAtividade > DIAS_PARA_PARADO * 86_400_000;
}

// Só controla a interface: quem protege os dados é o RLS
export function podeEditarTorneios(modoView: ModoView, auth: AuthState): boolean {
  if (modoView === "admin") return auth.isAdmin;
  return modoView === "organizador" && (auth.isOrganizador || auth.isAdmin);
}

// Mesas e tempo da rodada: quem organiza e os admins sempre veem; os jogadores, só se o torneio liberar.
// O tempo aparece na aba Mesas, então sem as mesas ele também fica escondido.
export function partesDaRodadaVisiveis(t: Torneio, podeEditar: boolean, auth: Pick<AuthState, "isAdmin">) {
  if (podeEditar || auth.isAdmin) return { mesas: true, tempo: true };
  const mesas = !!t.mesasParaJogadores;
  return { mesas, tempo: mesas && !!t.tempoParaJogadores };
}

export function torneiosVisiveis(torneios: Torneio[], modoView: ModoView, auth: AuthState): Torneio[] {
  if (!auth.session) return torneios;
  if (modoView === "admin" && auth.isAdmin) return torneios;
  if (modoView === "organizador" && (auth.isOrganizador || auth.isAdmin)) {
    const uid = auth.session.user.id;
    return torneios.filter((t) => t.criadoPor === uid);
  }
  const meusNomes = new Set(auth.nomesJogador.map((n) => n.trim().toLowerCase()));
  return torneios.filter((t) => t.jogadores.some((j) => meusNomes.has(j.nome.trim().toLowerCase())));
}
