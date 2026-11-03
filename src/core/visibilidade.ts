// Quais torneios cada modo de visualização enxerga
import type { AuthState } from "./auth";
import type { ModoView } from "./store";
import type { Torneio } from "./types";

// Só controla a interface: quem protege os dados é o RLS
export function podeEditarTorneios(modoView: ModoView, auth: AuthState): boolean {
  if (modoView === "admin") return auth.isAdmin;
  return modoView === "organizador" && (auth.isOrganizador || auth.isAdmin);
}

export function torneiosVisiveis(torneios: Torneio[], modoView: ModoView, auth: AuthState): Torneio[] {
  if (!auth.session) return torneios;
  if (modoView === "admin" && auth.isAdmin) return torneios;
  if (modoView === "organizador" && (auth.isOrganizador || auth.isAdmin)) {
    const uid = auth.session.user.id;
    // Torneios antigos não têm criadoPor e continuam visíveis para não sumirem da gestão
    return torneios.filter((t) => t.criadoPor === uid || !t.criadoPor);
  }
  const meusNomes = new Set(auth.nomesJogador.map((n) => n.trim().toLowerCase()));
  return torneios.filter((t) => t.jogadores.some((j) => meusNomes.has(j.nome.trim().toLowerCase())));
}
