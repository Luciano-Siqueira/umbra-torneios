// Função do Supabase (Edge Function) que vende o Jogador Pro e o Organizador Pro por Pix, pelo Mercado Pago.
//
// Pedidos do app (com a pessoa logada):
//   { acao: "criar", plano: "jogador" | "organizador" } — cria a cobrança Pix e devolve o QR Code e o "copia e cola"
//   { acao: "consultar", id: "..." } — confere no Mercado Pago se o Pix caiu e, se caiu, libera o Pro
// Aviso do Mercado Pago (webhook): POST em ...?origem=mercadopago, com a assinatura x-signature.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN    — "Access Token" de produção das credenciais do Mercado Pago
//   MP_WEBHOOK_SECRET  — "Assinatura secreta" da tela de Webhooks do Mercado Pago
// Publicar: Edge Functions → Deploy a new function → Via Editor, nome pagamento-pro, colar este
// arquivo e DESLIGAR "Verify JWT" (o Mercado Pago não manda login; a função confere sozinha).
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP = "https://api.mercadopago.com";
const MINUTOS_PARA_PAGAR = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const servidor = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tokenMP = () => Deno.env.get("MP_ACCESS_TOKEN") ?? "";

type Plano = "jogador" | "organizador";
const NOME_DO_PLANO: Record<Plano, string> = { jogador: "Jogador Pro", organizador: "Organizador Pro" };

type Pagamento = {
  id: string;
  user_id: string;
  plano: Plano;
  valor_centavos: number;
  dias: number;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  expira_em: string | null;
  creditado: boolean;
};

// O Mercado Pago quer a data com milissegundos e fuso: 2026-11-09T10:30:00.000-03:00
function dataMP(ms: number): string {
  const brasilia = new Date(ms - 3 * 3_600_000).toISOString().replace("Z", "");
  return `${brasilia}-03:00`;
}

async function proAtual(uid: string, plano: Plano): Promise<string | null> {
  const { data } = await servidor.from("assinaturas_pro").select("pro_ate").eq("user_id", uid).eq("plano", plano).maybeSingle();
  return (data?.pro_ate as string) ?? null;
}

// Confere o pagamento no Mercado Pago (a fonte da verdade) e libera o Pro se ele foi aprovado
async function atualizar(p: Pagamento): Promise<{ status: string; pro_ate: string | null }> {
  if (p.creditado) return { status: "approved", pro_ate: await proAtual(p.user_id, p.plano) };

  const r = await fetch(`${MP}/v1/payments/${encodeURIComponent(p.id)}`, {
    headers: { Authorization: `Bearer ${tokenMP()}` },
  });
  if (!r.ok) return { status: p.status, pro_ate: await proAtual(p.user_id, p.plano) };
  const mp = await r.json();

  // Só vale o pagamento desta conta, no valor cobrado
  const valorOk = Math.round(Number(mp.transaction_amount) * 100) >= p.valor_centavos;
  const daConta = String(mp.external_reference ?? "") === p.user_id;
  const status = String(mp.status ?? p.status);

  if (status === "approved" && valorOk && daConta) {
    const { data: ate, error } = await servidor.rpc("creditar_pagamento_pro", { p_id: p.id });
    if (error) throw error;
    return { status: "approved", pro_ate: (ate as string) ?? null };
  }
  if (status !== p.status) await servidor.from("pagamentos_pro").update({ status }).eq("id", p.id);
  return { status, pro_ate: await proAtual(p.user_id, p.plano) };
}

async function hmacHex(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Aviso do Mercado Pago: confere a assinatura e depois o pagamento direto na API
async function webhook(req: Request, url: URL): Promise<Response> {
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* aviso sem corpo */ }
  const tipo = url.searchParams.get("type") ?? corpo?.type ?? "";
  const idDado = String(url.searchParams.get("data.id") ?? corpo?.data?.id ?? "");
  if (tipo !== "payment" || !idDado) return resposta(200, { ok: true, ignorado: true });

  const segredo = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
  if (segredo) {
    const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }));
    const pedidoId = req.headers.get("x-request-id") ?? "";
    const manifesto = `id:${idDado.toLowerCase()};request-id:${pedidoId};ts:${partes.ts ?? ""};`;
    if (!partes.v1 || (await hmacHex(segredo, manifesto)) !== partes.v1) {
      return resposta(401, { erro: "Assinatura inválida" });
    }
  }

  const { data: p } = await servidor.from("pagamentos_pro").select("*").eq("id", idDado).maybeSingle();
  if (!p) return resposta(200, { ok: true, desconhecido: true });
  const r = await atualizar(p as Pagamento);
  return resposta(200, { ok: true, status: r.status });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { erro: "Use POST" });
  if (!tokenMP()) return resposta(503, { erro: "As vendas ainda não foram configuradas (falta o MP_ACCESS_TOKEN)." });

  const url = new URL(req.url);
  if (url.searchParams.get("origem") === "mercadopago") return webhook(req, url);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await servidor.auth.getUser(token);
  if (!quem?.user) return resposta(401, { erro: "Entre na sua conta" });
  const uid = quem.user.id;

  let acao = "";
  let id = "";
  let plano: Plano = "jogador";
  try {
    const corpo = await req.json();
    acao = String(corpo?.acao ?? "");
    id = String(corpo?.id ?? "");
    plano = corpo?.plano === "organizador" ? "organizador" : "jogador";
  } catch {
    return resposta(400, { erro: "Pedido inválido" });
  }

  if (acao === "consultar") {
    const { data: p } = await servidor.from("pagamentos_pro").select("*").eq("id", id).eq("user_id", uid).maybeSingle();
    if (!p) return resposta(404, { erro: "Pagamento não encontrado" });
    return resposta(200, { ok: true, ...(await atualizar(p as Pagamento)) });
  }

  if (acao !== "criar") return resposta(400, { erro: "Ação desconhecida" });

  // Admin já tem tudo; o Organizador Pro é só para quem organiza torneios
  const [{ data: org }, { data: adm }] = await Promise.all([
    servidor.from("organizadores").select("user_id").eq("user_id", uid).maybeSingle(),
    servidor.from("admins").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  if (adm) return resposta(400, { erro: "Administradores já têm todos os recursos do Pro." });
  if (plano === "organizador" && !org) {
    return resposta(403, { erro: "O Organizador Pro é para quem organiza torneios. Peça a liberação a um administrador." });
  }

  const { data: config } = await servidor.from("config_pro").select("*").eq("id", 1).maybeSingle();
  if (!config) return resposta(503, { erro: "As vendas ainda não foram configuradas (falta rodar organizador_pro.sql)." });
  if (!config.vendas_abertas) return resposta(403, { erro: "As assinaturas estão pausadas no momento." });

  // Reaproveita um Pix ainda válido, para não criar várias cobranças com toques repetidos
  const { data: aberto } = await servidor
    .from("pagamentos_pro")
    .select("*")
    .eq("user_id", uid)
    .eq("plano", plano)
    .eq("status", "pending")
    .gt("expira_em", new Date(Date.now() + 5 * 60_000).toISOString())
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aberto && aberto.valor_centavos === config.preco_centavos) {
    return resposta(200, { ok: true, ...publico(aberto as Pagamento) });
  }

  const expira = Date.now() + MINUTOS_PARA_PAGAR * 60_000;
  const r = await fetch(`${MP}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenMP()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: config.preco_centavos / 100,
      description: `Umbra Torneios · ${NOME_DO_PLANO[plano]} (${config.dias} dias)`,
      payment_method_id: "pix",
      payer: { email: quem.user.email },
      external_reference: uid,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/pagamento-pro?origem=mercadopago`,
      date_of_expiration: dataMP(expira),
    }),
  });
  const mp = await r.json().catch(() => ({}));
  const dadosPix = mp?.point_of_interaction?.transaction_data;
  if (!r.ok || !dadosPix?.qr_code) {
    console.error("Mercado Pago recusou a cobrança", r.status, JSON.stringify(mp));
    return resposta(502, { erro: "Não foi possível gerar o Pix agora. Tente de novo em instantes." });
  }

  const novo: Pagamento = {
    id: String(mp.id),
    user_id: uid,
    plano,
    valor_centavos: config.preco_centavos,
    dias: config.dias,
    status: String(mp.status ?? "pending"),
    qr_code: dadosPix.qr_code,
    qr_code_base64: dadosPix.qr_code_base64 ?? null,
    expira_em: new Date(expira).toISOString(),
    creditado: false,
  };
  const { error } = await servidor.from("pagamentos_pro").insert(novo);
  if (error) {
    console.error("Falha ao gravar o pagamento", error);
    return resposta(500, { erro: "Não foi possível registrar o Pix. Tente de novo." });
  }
  return resposta(200, { ok: true, ...publico(novo) });
});

function publico(p: Pagamento) {
  return {
    id: p.id,
    plano: p.plano,
    status: p.status,
    qr_code: p.qr_code,
    qr_code_base64: p.qr_code_base64,
    expira_em: p.expira_em,
    valor_centavos: p.valor_centavos,
    dias: p.dias,
  };
}
