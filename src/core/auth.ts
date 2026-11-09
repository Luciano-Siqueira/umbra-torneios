// Autenticação Supabase + flags de admin/jogador (estado único para todas as telas)
import { create } from "zustand";
import { LINK_PEDE_SENHA, supabase } from "./supabaseClient";
import { guardarAceiteLocal, VERSAO_PRIVACIDADE } from "./privacidade";
import type { Session } from "@supabase/supabase-js";

// Validade de cada plano Pro da conta (null = nunca assinou)
export interface ProAte {
  jogador: string | null;
  organizador: string | null;
}
const SEM_PRO: ProAte = { jogador: null, organizador: null };

// Jogador Pro em dia (o Organizador Pro inclui o do jogador)
function temJogadorPro(pro: ProAte | undefined, agora = Date.now()): boolean {
  const ativo = (ate: string | null | undefined) => !!ate && Date.parse(ate) > agora;
  return ativo(pro?.jogador) || ativo(pro?.organizador);
}

export interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  isOrganizador: boolean;
  nomesJogador: string[];  // nomes vinculados ao usuário e aprovados
  nomesPendentes: string[]; // aguardando o admin aprovar
  verMesas: boolean; // Jogador Pro em dia, ou liberado pelo admin na tela Usuários (sem Pro, só a própria mesa)
  verTempo: boolean; // só com o Jogador Pro em dia
  proAte?: ProAte; // validade dos planos Pro
  criarSenha: boolean; // chegou por link de convite ou de nova senha
  loading: boolean;
  perfilCarregado: boolean; // true depois de ter o perfil (do cache ou do servidor)
  perfilErro: string | null; // falha na busca do perfil (diferente de "sem papel")
}

interface PerfilSalvo {
  uid: string;
  isAdmin: boolean;
  isOrganizador: boolean;
  nomesJogador: string[];
  nomesPendentes?: string[];
  verMesas?: boolean; // liberação do admin, sem considerar o Pro
  verTempo?: boolean;
  proAte?: ProAte;
}

const KEY_PERFIL = "mtg.perfil.v1";

const useAuthStore = create<AuthState>(() => ({
  session: null,
  isAdmin: false,
  isOrganizador: false,
  nomesJogador: [],
  nomesPendentes: [],
  verMesas: false,
  verTempo: false,
  proAte: SEM_PRO,
  criarSenha: LINK_PEDE_SENHA,
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
        nomesPendentes: salvo.nomesPendentes ?? [],
        verMesas: !!salvo.verMesas || temJogadorPro(salvo.proAte),
        verTempo: temJogadorPro(salvo.proAte),
        proAte: salvo.proAte ?? SEM_PRO,
        perfilCarregado: true,
        perfilErro: null,
      }
    : { perfilCarregado: false, perfilErro: null });

  const [adminRes, orgRes, jogadoresRes, permissaoRes, proRes] = await Promise.all([
    supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("organizadores").select("user_id").eq("user_id", userId).maybeSingle(),
    // "*" para não quebrar enquanto o banco não tiver a coluna aprovado
    supabase.from("usuarios_jogadores").select("*").eq("user_id", userId),
    supabase.from("permissoes_jogador").select("ver_mesas, ver_tempo").eq("user_id", userId).maybeSingle(),
    supabase.from("assinaturas_pro").select("plano, pro_ate").eq("user_id", userId),
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
    nomesJogador: (jogadoresRes.data || []).filter((r: any) => r.aprovado !== false).map((r: any) => r.nome_jogador),
    nomesPendentes: (jogadoresRes.data || []).filter((r: any) => r.aprovado === false).map((r: any) => r.nome_jogador),
    // Sem a tabela ou sem linha, fica escondido: não é erro de perfil
    verMesas: !!permissaoRes.data?.ver_mesas,
    verTempo: !!permissaoRes.data?.ver_tempo,
    // Sem a tabela, ninguém tem Pro (admins têm tudo de qualquer jeito)
    proAte: {
      jogador: (proRes.data ?? []).find((a: any) => a.plano === "jogador")?.pro_ate ?? null,
      organizador: (proRes.data ?? []).find((a: any) => a.plano === "organizador")?.pro_ate ?? null,
    },
  };
  localStorage.setItem(KEY_PERFIL, JSON.stringify(perfil));
  useAuthStore.setState({
    isAdmin: perfil.isAdmin,
    isOrganizador: perfil.isOrganizador,
    nomesJogador: perfil.nomesJogador,
    nomesPendentes: perfil.nomesPendentes,
    verMesas: !!perfil.verMesas || temJogadorPro(perfil.proAte),
    verTempo: temJogadorPro(perfil.proAte),
    proAte: perfil.proAte,
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
    nomesPendentes: [],
    verMesas: false,
    verTempo: false,
    proAte: SEM_PRO,
    perfilCarregado: true,
    perfilErro: null,
  });
}

// Relê papéis, nomes, permissões (Mesas e Tempo) e planos Pro do servidor, mesmo com o perfil já carregado.
// Assim, o que o admin muda na tela Usuários chega ao jogador sem ele fechar o app.
export function atualizarPerfil(): void {
  const uid = useAuthStore.getState().session?.user?.id;
  if (!uid || buscandoUid === uid) return;
  perfilUid = null;
  carregarPerfil(uid);
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

supabase.auth.onAuthStateChange((evento, s) => {
  aplicarSessao(s);
  if (evento === "PASSWORD_RECOVERY") useAuthStore.setState({ criarSenha: true });
});

// Senha nova de quem chegou por convite ou pelo e-mail de redefinir senha
export async function definirSenha(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw error;
  useAuthStore.setState({ criarSenha: false });
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
  // Apaga do aparelho os dados da conta e dos torneios (LGPD: aparelho compartilhado, como o tablet da loja).
  // O próximo login baixa tudo de novo do servidor.
  for (const chave of [
    "mtg.torneios.v1",       // torneios, com nomes e pagamentos
    "mtg.jogadores.v1",      // lista de nomes de jogadores
    "mtg.envios.pendentes",  // alterações ainda não enviadas (quem sai já foi avisado)
    "mtg.torneios.versoes",
    "mtg.torneios.dono",
    "mtg.modoView",
    KEY_PERFIL,
  ]) {
    try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ }
  }
}

// Registra na conta que a pessoa aceitou esta versão da política de privacidade
export async function aceitarPrivacidade(uid: string): Promise<void> {
  guardarAceiteLocal(uid);
  const { error } = await supabase.auth.updateUser({
    data: { privacidade_versao: VERSAO_PRIVACIDADE, privacidade_aceita_em: new Date().toISOString() },
  });
  if (error) console.warn("Aceite da privacidade guardado só neste aparelho", error.message);
}

// Apaga a conta de quem está logado; a senha é conferida no banco
export async function excluirMinhaConta(senha: string): Promise<void> {
  const { error } = await supabase.rpc("excluir_minha_conta", { p_senha: senha });
  if (error) throw error;
  await sair();
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
    // Só vale depois da aprovação do admin; o próprio admin já entra aprovado
    .insert({ user_id: uid, nome_jogador: nomeLimpo, ...(useAuthStore.getState().isAdmin ? { aprovado: true } : {}) });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Esse nome já foi vinculado a outra conta. Escolha outro ou peça pro admin.");
    }
    throw error;
  }
  localStorage.removeItem(KEY_PERFIL);
  // Avisa os admins no celular; se a função não estiver publicada, o pedido segue normal
  if (!useAuthStore.getState().isAdmin) {
    supabase.functions.invoke("avisar-mesas", { body: { tipo: "aprovacao", nome: nomeLimpo } }).catch(() => {});
  }
}

// O nome antigo só sai depois que o novo foi aceito, para um erro não deixar a conta sem nome
export async function trocarNome(antigo: string, novo: string): Promise<void> {
  if (antigo.trim() === novo.trim()) throw new Error("Esse já é o seu nome");
  await vincularNome(novo);
  const { data: sess } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("usuarios_jogadores")
    .delete()
    .eq("user_id", sess.session?.user?.id ?? "")
    .eq("nome_jogador", antigo);
  if (error) throw error;
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
