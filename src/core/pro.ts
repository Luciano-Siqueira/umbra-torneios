// Assinaturas Pro, pagas por Pix e vendidas só pelo site (supabase/organizador_pro.sql e a função
// pagamento-pro). Jogador Pro: mesas, tempo e notificações (com a liberação do admin), Decks e
// Analytics. Organizador Pro: tudo do jogador + escolher as notificações de cada torneio.
// Administradores têm tudo sem pagar.
import { supabase } from "./supabaseClient";
import type { AuthState, ProAte } from "./auth";

export type Plano = "jogador" | "organizador";
export const NOME_DO_PLANO: Record<Plano, string> = { jogador: "Jogador Pro", organizador: "Organizador Pro" };

export interface ConfigPro {
  precoCentavos: number;
  dias: number;
  vendasAbertas: boolean;
}
export const CONFIG_PRO_PADRAO: ConfigPro = { precoCentavos: 990, dias: 30, vendasAbertas: false };

export interface CobrancaPix {
  id: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string | null;
  expiraEm: string | null;
  valorCentavos: number;
  dias: number;
}

export function proAtivo(proAte: string | null | undefined, agora = Date.now()): boolean {
  return !!proAte && Date.parse(proAte) > agora;
}

// O que a conta pode usar agora. "ate" é a validade comprada de cada plano (null sem assinatura).
export function statusPro(auth: Pick<AuthState, "isAdmin" | "proAte">, agora = Date.now()) {
  const org = proAtivo(auth.proAte?.organizador, agora);
  const jog = proAtivo(auth.proAte?.jogador, agora);
  return {
    ehAdmin: auth.isAdmin,
    organizador: auth.isAdmin || org,
    jogador: auth.isAdmin || org || jog, // o Organizador Pro inclui o do jogador
    ate: {
      jogador: jog ? auth.proAte!.jogador : null,
      organizador: org ? auth.proAte!.organizador : null,
    } as ProAte,
  };
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export async function lerConfigPro(): Promise<ConfigPro> {
  const { data, error } = await supabase.from("config_pro").select("preco_centavos, dias, vendas_abertas").eq("id", 1).maybeSingle();
  if (error || !data) return CONFIG_PRO_PADRAO;
  return { precoCentavos: data.preco_centavos, dias: data.dias, vendasAbertas: data.vendas_abertas };
}

// Para a tela Usuários: conta → validade de cada plano
export async function listarAssinaturasPro(): Promise<Map<string, ProAte>> {
  const { data, error } = await supabase.from("assinaturas_pro").select("user_id, plano, pro_ate");
  const mapa = new Map<string, ProAte>();
  if (error) return mapa;
  for (const a of (data ?? []) as { user_id: string; plano: Plano; pro_ate: string }[]) {
    const atual = mapa.get(a.user_id) ?? { jogador: null, organizador: null };
    atual[a.plano] = a.pro_ate;
    mapa.set(a.user_id, atual);
  }
  return mapa;
}

async function chamar(corpo: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("pagamento-pro", { body: corpo });
  if (error) {
    let motivo = "";
    try { motivo = (await (error as any).context?.json())?.erro ?? ""; } catch { /* sem corpo */ }
    if (!motivo && /failed to send|not found|404/i.test(error.message)) {
      motivo = "As assinaturas ainda não estão disponíveis: falta publicar a função pagamento-pro no Supabase.";
    }
    throw new Error(motivo || error.message);
  }
  return data;
}

export async function criarCobrancaPix(plano: Plano): Promise<CobrancaPix> {
  const d = await chamar({ acao: "criar", plano });
  return {
    id: String(d.id),
    status: String(d.status ?? "pending"),
    qrCode: String(d.qr_code ?? ""),
    qrCodeBase64: d.qr_code_base64 ?? null,
    expiraEm: d.expira_em ?? null,
    valorCentavos: Number(d.valor_centavos ?? 0),
    dias: Number(d.dias ?? 0),
  };
}

export async function consultarCobranca(id: string): Promise<{ status: string; proAte: string | null }> {
  const d = await chamar({ acao: "consultar", id });
  return { status: String(d.status ?? ""), proAte: d.pro_ate ?? null };
}
