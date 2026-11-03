// Autenticação Supabase + flags de admin/jogador (estado único para todas as telas)
import { create } from "zustand";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  isOrganizador: boolean;
  nomesJogador: string[];  // nomes vinculados ao usuário
  loading: boolean;
  perfilCarregado: boolean; // true depois de ter o perfil (do cache ou do servidor)
  perfilErro: string | null; // falha na busca do perfil (diferente de "sem papel")
}

interface PerfilSalvo {
  uid: string;
  isAdmin: boolean;
  isOrganizador: boolean;
  nomesJogador: string[];
}

const KEY_PERFIL = "mtg.perfil.v1";

const useAuthStore = create<AuthState>(() => ({
  session: null,
  isAdmin: false,
  isOrganizador: false,
  nomesJogador: [],
  loading: true,
  perfilCarregado: false,
  perfilErro: null,
}));

export function useAuth(): AuthState {
  return useAuthStore();
}

function lerPerfilSalvo(uid: string): PerfilSalvo | null {
  try {
    const perfil = JSON.parse(localStorage.getItem(KEY_PERFIL) || "null") as PerfilSalvo | null;
    return perfil?.uid === uid ? perfil : null;
  } catch {
    return null;
  }
}

let perfilUid: string | null = null; // usuário com perfil já carregado
let buscandoUid: string | null = null; // evita buscar duas vezes o mesmo usuário
let ultimaBusca = 0; // descarta respostas de buscas antigas

async function carregarPerfil(userId: string) {
  // O Supabase repete SIGNED_IN ao voltar pra aba; não recarrega o mesmo usuário
  if (perfilUid === userId || buscandoUid === userId) return;
  const busca = ++ultimaBusca;
  buscandoUid = userId;

  // Mostra o perfil salvo na hora e confirma com o servidor por trás.
  // Serve só para a interface: quem protege os dados é o RLS.
  const salvo = lerPerfilSalvo(userId);
  useAuthStore.setState(salvo
    ? {
        isAdmin: salvo.isAdmin,
        isOrganizador: salvo.isOrganizador,
        nomesJogador: salvo.nomesJogador,
        perfilCarregado: true,
        perfilErro: null,
      }
    : { perfilCarregado: false, perfilErro: null });

  const [adminRes, orgRes, jogadoresRes] = await Promise.all([
    supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("organizadores").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("usuarios_jogadores").select("nome_jogador").eq("user_id", userId),
  ]);
  if (busca !== ultimaBusca) return;
  buscandoUid = null;

  // Erro não pode virar "não é admin e não tem nome"
  const erro = adminRes.error || orgRes.error || jogadoresRes.error;
  if (erro) {
    console.error("Erro ao carregar perfil", erro);
    useAuthStore.setState({ perfilErro: erro.message });
    return;
  }

  perfilUid = userId;
  const perfil: PerfilSalvo = {
    uid: userId,
    isAdmin: !!adminRes.data,
    isOrganizador: !!orgRes.data,
    nomesJogador: (jogadoresRes.data || []).map((r: any) => r.nome_jogador),
  };
  localStorage.setItem(KEY_PERFIL, JSON.stringify(perfil));
  useAuthStore.setState({
    isAdmin: perfil.isAdmin,
    isOrganizador: perfil.isOrganizador,
    nomesJogador: perfil.nomesJogador,
    perfilCarregado: true,
    perfilErro: null,
  });
}

function limparPerfil() {
  ultimaBusca++;
  perfilUid = null;
  buscandoUid = null;
  useAuthStore.setState({
    isAdmin: false,
    isOrganizador: false,
    nomesJogador: [],
    perfilCarregado: true,
    perfilErro: null,
  });
}

function aplicarSessao(session: Session | null) {
  if (session?.user?.id) carregarPerfil(session.user.id);
  else limparPerfil();
  useAuthStore.setState({ session });
}

supabase.auth.getSession().then(({ data }) => {
  aplicarSessao(data.session);
  useAuthStore.setState({ loading: false });
});

supabase.auth.onAuthStateChange((_e, s) => aplicarSessao(s));

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
  localStorage.removeItem(KEY_PERFIL);
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
  localStorage.removeItem(KEY_PERFIL);
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
  localStorage.removeItem(KEY_PERFIL);
}
