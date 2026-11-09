// Função do Supabase (Edge Function) que convida uma pessoa por e-mail.
// Só o servidor pode convidar: a chave de serviço nunca vai para o app.
// Quem chama precisa estar logado e ser admin. Opcionalmente já vincula o nome de jogador, aprovado.
//
// Publicar: Supabase → Edge Functions → Deploy a new function → Via editor,
// nome "convidar-usuario", colar este arquivo e clicar em Deploy.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ENDERECO_DO_APP = "https://torneios.umbraarena.com.br";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { erro: "Use POST" });

  const servidor = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quem está pedindo: o token da sessão vem no cabeçalho
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await servidor.auth.getUser(token);
  if (!quem?.user) return resposta(401, { erro: "Entre na sua conta para convidar" });

  const { data: admin } = await servidor.from("admins").select("user_id").eq("user_id", quem.user.id).maybeSingle();
  if (!admin) return resposta(403, { erro: "Apenas administradores podem convidar" });

  let email = "";
  let nome = "";
  try {
    const corpo = await req.json();
    email = String(corpo?.email ?? "").trim().toLowerCase();
    nome = String(corpo?.nome ?? "").trim();
  } catch {
    return resposta(400, { erro: "Pedido inválido" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta(400, { erro: "E-mail inválido" });
  if (nome.length > 60) return resposta(400, { erro: "Nome muito longo" });

  const { data: convite, error } = await servidor.auth.admin.inviteUserByEmail(email, { redirectTo: ENDERECO_DO_APP });
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message);
    return resposta(400, { erro: jaExiste ? "Esse e-mail já tem conta" : error.message });
  }

  // O nome já entra aprovado: foi o admin quem escolheu
  if (nome && convite?.user) {
    const { error: erroNome } = await servidor
      .from("usuarios_jogadores")
      .insert({ user_id: convite.user.id, nome_jogador: nome, aprovado: true });
    if (erroNome) {
      const repetido = erroNome.code === "23505";
      return resposta(200, {
        ok: true,
        aviso: repetido
          ? `Convite enviado, mas o nome "${nome}" já está em outra conta. Vincule outro nome na tela Usuários.`
          : `Convite enviado, mas o nome não foi vinculado: ${erroNome.message}`,
      });
    }
  }

  return resposta(200, { ok: true });
});
