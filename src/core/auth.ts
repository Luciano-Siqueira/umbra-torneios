// Hook de autenticação Supabase + flags de admin/jogador
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  isOrganizador: boolean;
  nomesJogador: string[];  // nomes vinculados ao usuário
  loading: boolean;
  perfilCarregado: boolean; // true só depois de buscar admin + nomes do servidor
  perfilErro: string | null; // falha na busca do perfil (diferente de "sem papel")
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizador, setIsOrganizador] = useState(false);
  const [nomesJogador, setNomesJogador] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [perfilErro, setPerfilErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let perfilUid: string | null = null; // usuário com perfil já carregado
    let ultimaBusca = 0; // descarta respostas de buscas antigas

    const carregarPerfil = async (userId: string) => {
      // O Supabase repete SIGNED_IN ao voltar pra aba; não recarrega o mesmo usuário
      if (perfilUid === userId) return;
      const busca = ++ultimaBusca;
      setPerfilCarregado(false);
      setPerfilErro(null);
      const [adminRes, orgRes, jogadoresRes] = await Promise.all([
        supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("organizadores").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("usuarios_jogadores").select("nome_jogador").eq("user_id", userId),
      ]);
      if (!ativo || busca !== ultimaBusca) return;
      // Erro não pode virar "não é admin e não tem nome"
      const erro = adminRes.error || orgRes.error || jogadoresRes.error;
      if (erro) {
        console.error("Erro ao carregar perfil", erro);
        setPerfilErro(erro.message);
        return;
      }
      perfilUid = userId;
      setIsAdmin(!!adminRes.data);
      setIsOrganizador(!!orgRes.data);
      setNomesJogador((jogadoresRes.data || []).map((r: any) => r.nome_jogador));
      setPerfilCarregado(true);
    };

    const reset = () => {
      ultimaBusca++;
      perfilUid = null;
      setPerfilErro(null);
      setIsAdmin(false);
      setIsOrganizador(false);
      setNomesJogador([]);
      setPerfilCarregado(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      if (data.session?.user?.id) carregarPerfil(data.session.user.id);
      else reset();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!ativo) return;
      setSession(s);
      if (s?.user?.id) carregarPerfil(s.user.id);
      else reset();
    });

    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, isAdmin, isOrganizador, nomesJogador, loading, perfilCarregado, perfilErro };
}

export async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function registrar(email: string, senha: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function sair() {
  await supabase.auth.signOut();
  // Limpa cache local — próximo login puxa fresh do servidor
  localStorage.removeItem("mtg.torneios.v1");
  localStorage.removeItem("mtg.modoView");
}

// Vincula nome ao usuário atual
export async function vincularNome(nome: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Precisa estar logado");
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error("Digite um nome");

  const { error } = await supabase
    .from("usuarios_jogadores")
    .insert({ user_id: uid, nome_jogador: nomeLimpo });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Esse nome já foi vinculado a outra conta. Escolha outro ou peça pro admin.");
    }
    throw error;
  }
}

export async function desvincularNome(nome: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  await supabase
    .from("usuarios_jogadores")
    .delete()
    .eq("user_id", uid)
    .eq("nome_jogador", nome);
}
