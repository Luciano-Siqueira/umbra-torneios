// Função do Supabase (Edge Function) que avisa cada jogador da sua mesa quando a rodada começa.
// Chamada pelo app de quem organiza, logo depois de iniciar a rodada.
// Só avisa quem tem "Mesas" liberado na tela Usuários (ou é admin), e só aparelhos que aceitaram avisos.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (mailto:contato@umbraarena.com.br)
// Publicar: Edge Functions → Deploy a new function → Via editor, nome "avisar-mesas", colar e Deploy.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esperar = (ms: number) => new Promise((fim) => setTimeout(fim, ms));
const normalizar = (nome: string) => nome.trim().toLowerCase();

// "Ana", "Ana e Bruno", "Ana, Bruno e Carla"
function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

type Jogador = { id: number; nome: string };
type Mesa = { numero: number; jogadoresIds: number[] };
type Dados = { nome: string; rodadaAtual: number; jogadores: Jogador[]; mesas: Mesa[]; finalizado?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { erro: "Use POST" });

  const servidor = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await servidor.auth.getUser(token);
  if (!quem?.user) return resposta(401, { erro: "Entre na sua conta" });

  let torneioId = "";
  let rodada = 0;
  try {
    const corpo = await req.json();
    torneioId = String(corpo?.torneio_id ?? "");
    rodada = Number(corpo?.rodada ?? 0);
  } catch {
    return resposta(400, { erro: "Pedido inválido" });
  }
  if (!torneioId || !rodada) return resposta(400, { erro: "Informe o torneio e a rodada" });

  // Só admin ou quem criou o torneio
  const [{ data: admin }, { data: privado }] = await Promise.all([
    servidor.from("admins").select("user_id").eq("user_id", quem.user.id).maybeSingle(),
    servidor.from("torneio_privado").select("criado_por").eq("torneio_id", torneioId).maybeSingle(),
  ]);
  if (!admin && privado?.criado_por !== quem.user.id) {
    return resposta(403, { erro: "Só quem organiza o torneio pode avisar as mesas" });
  }

  // O app grava o torneio em segundo plano: espera a rodada nova chegar ao banco
  let dados: Dados | null = null;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { data } = await servidor.from("torneios").select("dados").eq("id", torneioId).maybeSingle();
    dados = (data?.dados as Dados) ?? null;
    if (dados && dados.rodadaAtual >= rodada && dados.mesas?.length) break;
    await esperar(1500);
  }
  if (!dados || dados.rodadaAtual !== rodada || !dados.mesas?.length) {
    return resposta(409, { erro: "As mesas desta rodada ainda não foram salvas. Tente de novo em instantes." });
  }

  // Quem é quem: nome de jogador do torneio → conta (só nomes aprovados)
  const nomePorId = new Map(dados.jogadores.map((j) => [j.id, j.nome]));
  const { data: vinculos } = await servidor.from("usuarios_jogadores").select("user_id, nome_jogador, aprovado");
  const contasPorNome = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    if (v.aprovado === false) continue;
    const chave = normalizar(v.nome_jogador);
    contasPorNome.set(chave, [...(contasPorNome.get(chave) ?? []), v.user_id]);
  }

  // Só quem pode ver as mesas: admins ou quem tem "Mesas" liberado
  const [{ data: admins }, permissoes] = await Promise.all([
    servidor.from("admins").select("user_id"),
    servidor.from("permissoes_jogador").select("user_id, ver_mesas"),
  ]);
  const podeVer = new Set<string>([
    ...(admins ?? []).map((a) => a.user_id),
    ...((permissoes.data ?? []) as { user_id: string; ver_mesas: boolean }[]).filter((p) => p.ver_mesas).map((p) => p.user_id),
  ]);

  // Mensagem de cada conta: a mesa e com quem joga
  const mensagemPorConta = new Map<string, { title: string; body: string }>();
  for (const mesa of dados.mesas) {
    for (const id of mesa.jogadoresIds) {
      const nome = nomePorId.get(id);
      if (!nome) continue;
      const outros = mesa.jogadoresIds.filter((x) => x !== id).map((x) => nomePorId.get(x) ?? "?");
      for (const uid of contasPorNome.get(normalizar(nome)) ?? []) {
        if (!podeVer.has(uid)) continue;
        mensagemPorConta.set(uid, {
          title: `⚔️ Rodada ${rodada} · Mesa ${mesa.numero}`,
          body: `${dados.nome}: você joga com ${juntarNomes(outros)}. Boa sorte!`,
        });
      }
    }
  }
  if (mensagemPorConta.size === 0) return resposta(200, { ok: true, enviados: 0, contas: 0 });

  const { data: aparelhos } = await servidor
    .from("push_inscricoes")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", [...mensagemPorConta.keys()]);

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@umbraarena.com.br",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let enviados = 0;
  const vencidos: string[] = [];
  await Promise.all((aparelhos ?? []).map(async (a) => {
    const msg = mensagemPorConta.get(a.user_id)!;
    const carga = JSON.stringify({ ...msg, url: "/?tela=torneios", tag: `mesa-${torneioId}-${rodada}` });
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, carga, {
        TTL: 60 * 60,
        urgency: "high",
      });
      enviados++;
    } catch (e) {
      // Aparelho que desinstalou ou recusou depois: tira da lista
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) vencidos.push(a.endpoint);
    }
  }));
  if (vencidos.length) await servidor.from("push_inscricoes").delete().in("endpoint", vencidos);

  return resposta(200, { ok: true, enviados, contas: mensagemPorConta.size });
});
