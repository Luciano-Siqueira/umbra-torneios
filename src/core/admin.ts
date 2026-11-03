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
  eh_organizador: boolean
): Promise<void> {
  const { error } = await supabase.rpc("definir_papel", {
    p_user_id: user_id,
    p_eh_admin: eh_admin,
    p_eh_organizador: eh_organizador,
  });
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
    .insert({ user_id, nome_jogador: n });
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
