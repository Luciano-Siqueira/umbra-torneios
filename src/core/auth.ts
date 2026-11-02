// Hook de autenticação Supabase + flags de admin/jogador
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  nomesJogador: string[];  // nomes vinculados ao usuário
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nomesJogador, setNomesJogador] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    const carregarPerfil = async (userId: string) => {
      const [adminRes, jogadoresRes] = await Promise.all([
        supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("usuarios_jogadores").select("nome_jogador").eq("user_id", userId),
      ]);
      if (!ativo) return;
      setIsAdmin(!!adminRes.data);
      setNomesJogador((jogadoresRes.data || []).map((r: any) => r.nome_jogador));
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      if (data.session?.user?.id) carregarPerfil(data.session.user.id);
      else { setIsAdmin(false); setNomesJogador([]); }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!ativo) return;
      setSession(s);
      if (s?.user?.id) carregarPerfil(s.user.id);
      else { setIsAdmin(false); setNomesJogador([]); }
    });

    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, isAdmin, nomesJogador, loading };
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
