// Organizador Pro: assinatura paga por Pix, vendida só pelo site (supabase/organizador_pro.sql e
// a função pagamento-pro). Administradores têm todos os recursos do Pro sem pagar.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export interface ConfigPro {
  precoCentavos: number;
  dias: number;
  vendasAbertas: boolean;
}
export const CONFIG_PRO_PADRAO: ConfigPro = { precoCentavos: 990, dias: 30, vendasAbertas: true };

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

// Validade do Pro da própria conta; null quando nunca assinou ou a tabela ainda não existe
export async function lerMeuPro(uid: string): Promise<string | null> {
  const { data, error } = await supabase.from("assinaturas_pro").select("pro_ate").eq("user_id", uid).maybeSingle();
  if (error) return null;
  return (data?.pro_ate as string) ?? null;
}

// Para a tela Usuários: conta → validade do Pro
export async function listarAssinaturasPro(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("assinaturas_pro").select("user_id, pro_ate");
  if (error) return new Map();
  return new Map((data ?? []).map((a: any) => [a.user_id as string, a.pro_ate as string]));
}

async function chamar(corpo: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("pagamento-pro", { body: corpo });
  if (error) {
    let motivo = "";
    try { motivo = (await (error as any).context?.json())?.erro ?? ""; } catch { /* sem corpo */ }
    if (!motivo && /failed to send|not found|404/i.test(error.message)) {
      motivo = "As vendas ainda não estão disponíveis: falta publicar a função pagamento-pro no Supabase.";
    }
    throw new Error(motivo || error.message);
  }
  return data;
}

export async function criarCobrancaPix(): Promise<CobrancaPix> {
  const d = await chamar({ acao: "criar" });
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

// Validade do Pro de quem está logado. Confere de novo quando o app volta para a frente.
export function useMeuPro(uid: string | null | undefined, ehAdmin: boolean) {
  const [proAte, setProAte] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    if (!uid) { setProAte(null); setCarregado(true); return; }
    setProAte(await lerMeuPro(uid));
    setCarregado(true);
  }, [uid]);

  useEffect(() => {
    recarregar();
    const aoVoltar = () => { if (document.visibilityState === "visible") recarregar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [recarregar]);

  return { proAte, ativo: ehAdmin || proAtivo(proAte), ehAdmin, carregado, recarregar, definir: setProAte };
}
