// Hook de autenticação Supabase + flag de admin
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    const verificarAdmin = async (userId: string) => {
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (ativo) setIsAdmin(!!data);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      if (data.session?.user?.id) verificarAdmin(data.session.user.id);
      else setIsAdmin(false);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!ativo) return;
      setSession(s);
      if (s?.user?.id) verificarAdmin(s.user.id);
      else setIsAdmin(false);
    });

    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, isAdmin, loading };
}

export async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function sair() {
  await supabase.auth.signOut();
}
