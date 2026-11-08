// Aceite da política de privacidade (public/privacidade.html).
// Fica guardado na própria conta (user_metadata do Supabase), então vale em todos os aparelhos.
// Ao mudar a política de forma importante, troque a versão: todos veem o aviso de novo.
export const VERSAO_PRIVACIDADE = "2026-11-08";

const chaveLocal = (uid: string) => `mtg.privacidade.${uid}`;

type UsuarioComMetadados = { id: string; user_metadata?: Record<string, unknown> | null };

export function precisaAceitarPrivacidade(usuario: UsuarioComMetadados | null | undefined): boolean {
  if (!usuario) return false;
  if (usuario.user_metadata?.privacidade_versao === VERSAO_PRIVACIDADE) return false;
  // Aceite feito sem internet: vale até conseguir gravar na conta
  try {
    return localStorage.getItem(chaveLocal(usuario.id)) !== VERSAO_PRIVACIDADE;
  } catch {
    return true;
  }
}

export function guardarAceiteLocal(uid: string): void {
  try { localStorage.setItem(chaveLocal(uid), VERSAO_PRIVACIDADE); } catch { /* ignore */ }
}
