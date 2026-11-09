import { supabase } from "./supabaseClient";

export interface UsuarioInfo {
  user_id: string;
  email: string;
  criado_em: string;
  eh_admin: boolean;
  eh_organizador: boolean;
  nomes_jogador: string[];
}

export async function listarUsuarios(): Promise<UsuarioInfo[]> {
  const { data, error } = await supabase.rpc("listar_usuarios");
  if (error) throw error;
  return (data || []) as UsuarioInfo[];
}

export async function definirPapel(
  user_id: string,
  eh_admin: boolean,
  eh_organizador: boolean,
  senha?: string
): Promise<void> {
  // Mudar quem é admin exige a senha, conferida no banco
  const { error } = await supabase.rpc("definir_papel_seguro", {
    p_user_id: user_id,
    p_eh_admin: eh_admin,
    p_eh_organizador: eh_organizador,
    p_senha: senha ?? null,
  });
  if (error) throw error;
}

export interface NomePendente {
  user_id: string;
  nome_jogador: string;
}

export async function listarNomesPendentes(): Promise<NomePendente[]> {
  const { data, error } = await supabase
    .from("usuarios_jogadores")
    .select("user_id, nome_jogador")
    .eq("aprovado", false);
  if (error) throw error;
  return (data || []) as NomePendente[];
}

export async function aprovarNome(user_id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from("usuarios_jogadores")
    .update({ aprovado: true })
    .eq("user_id", user_id)
    .eq("nome_jogador", nome);
  if (error) throw error;
}


export async function deletarUsuario(user_id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_deletar_usuario", { p_user_id: user_id });
  if (error) throw error;
}

export async function enviarResetSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function renomearJogador(user_id: string, nome_antigo: string, nome_novo: string): Promise<void> {
  const n = nome_novo.trim();
  if (!n) throw new Error("Nome não pode estar vazio");
  const { error } = await supabase
    .from("usuarios_jogadores")
    .update({ nome_jogador: n })
    .eq("user_id", user_id)
    .eq("nome_jogador", nome_antigo);
  if (error) {
    if (error.code === "23505") throw new Error("Esse nome já está vinculado a outro usuário");
    throw error;
  }
}

export async function adicionarNome(user_id: string, nome: string): Promise<void> {
  const n = nome.trim();
  if (!n) throw new Error("Nome não pode estar vazio");
  const { error } = await supabase
    .from("usuarios_jogadores")
    .insert({ user_id, nome_jogador: n, aprovado: true });
  if (error) {
    if (error.code === "23505") throw new Error("Esse nome já está vinculado a outro usuário");
    throw error;
  }
}

export async function removerNomeDoUsuario(user_id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from("usuarios_jogadores")
    .delete()
    .eq("user_id", user_id)
    .eq("nome_jogador", nome);
  if (error) throw error;
}

// O que cada jogador vê no torneio; sem linha, fica tudo escondido
export interface PermissaoJogador {
  ver_mesas: boolean;
  ver_tempo: boolean;
}

export async function listarPermissoesJogador(): Promise<{ porUsuario: Map<string, PermissaoJogador>; faltaTabela: boolean }> {
  const { data, error } = await supabase.from("permissoes_jogador").select("user_id, ver_mesas, ver_tempo");
  // Sem a tabela, a tela ainda abre e avisa para rodar o SQL
  if (error) return { porUsuario: new Map(), faltaTabela: true };
  return {
    porUsuario: new Map((data ?? []).map((p: any) => [p.user_id, { ver_mesas: !!p.ver_mesas, ver_tempo: !!p.ver_tempo }])),
    faltaTabela: false,
  };
}

export async function definirPermissaoJogador(user_id: string, permissao: PermissaoJogador): Promise<void> {
  const { error } = await supabase
    .from("permissoes_jogador")
    .upsert({ user_id, ...permissao, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}

// Quem aceitou a política de privacidade e quando (supabase/aceites_privacidade.sql)
export interface AceitePrivacidade {
  versao: string | null;
  aceita_em: string | null;
}

export async function listarAceitesPrivacidade(): Promise<{ porUsuario: Map<string, AceitePrivacidade>; faltaFuncao: boolean }> {
  const { data, error } = await supabase.rpc("listar_aceites_privacidade");
  if (error) return { porUsuario: new Map(), faltaFuncao: true };
  return {
    porUsuario: new Map(((data ?? []) as any[]).map((a) => [a.user_id, { versao: a.versao ?? null, aceita_em: a.aceita_em ?? null }])),
    faltaFuncao: false,
  };
}

// Convite por e-mail (supabase/functions/convidar-usuario). O nome, se vier, já entra aprovado.
export async function convidarUsuario(email: string, nome = ""): Promise<{ aviso?: string }> {
  const { data, error } = await supabase.functions.invoke("convidar-usuario", { body: { email, nome } });
  if (error) {
    // A função devolve o motivo em português no corpo da resposta
    let motivo = "";
    try { motivo = (await (error as any).context?.json())?.erro ?? ""; } catch { /* sem corpo */ }
    if (!motivo && /failed to send|not found|404/i.test(error.message)) {
      motivo = "O convite ainda não está disponível: falta publicar a função convidar-usuario no Supabase.";
    }
    throw new Error(motivo || error.message);
  }
  return { aviso: (data as any)?.aviso };
}

// Quais avisos (notificações) saem, escolhidos pelo admin (supabase/config_avisos.sql)
export interface ConfigAvisos {
  mesa: boolean;
  faltam10: boolean;
  esgotado: boolean;
  finalizado: boolean;
  aprovacao: boolean;
}
export const CONFIG_AVISOS_PADRAO: ConfigAvisos = { mesa: true, faltam10: true, esgotado: true, finalizado: true, aprovacao: true };

export async function lerConfigAvisos(): Promise<{ config: ConfigAvisos; faltaTabela: boolean }> {
  const { data, error } = await supabase.from("config_avisos").select("mesa, faltam10, esgotado, finalizado, aprovacao").eq("id", 1).maybeSingle();
  if (error) return { config: CONFIG_AVISOS_PADRAO, faltaTabela: true };
  return { config: { ...CONFIG_AVISOS_PADRAO, ...(data ?? {}) }, faltaTabela: false };
}

export async function salvarConfigAvisos(mudanca: Partial<ConfigAvisos>): Promise<void> {
  const { error } = await supabase
    .from("config_avisos")
    .update({ ...mudanca, atualizado_em: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}
