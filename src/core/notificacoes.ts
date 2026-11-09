// Avisos da mesa (notificações). O aparelho se inscreve com a chave pública (VAPID) e fica guardado
// em push_inscricoes; quem envia é a função avisar-mesas, ao iniciar a rodada.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export type EstadoAvisos = "sem-suporte" | "bloqueado" | "ligado" | "desligado";

export function suportaAvisos(): boolean {
  return Boolean(
    CHAVE_PUBLICA &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// A chave VAPID vem em base64 "de URL"; o navegador quer os bytes
function bytesDaChave(base64: string): Uint8Array<ArrayBuffer> {
  const completo = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(completo);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

export async function estadoDosAvisos(): Promise<EstadoAvisos> {
  if (!suportaAvisos()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "desligado";
  return (await inscricaoAtual()) ? "ligado" : "desligado";
}

// Precisa vir de um toque da pessoa: o navegador só pede a permissão assim
export async function ligarAvisos(): Promise<EstadoAvisos> {
  if (!suportaAvisos()) return "sem-suporte";
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";

  const registro = await navigator.serviceWorker.ready;
  const inscricao = (await registro.pushManager.getSubscription())
    ?? await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(CHAVE_PUBLICA) });
  const json = inscricao.toJSON();
  const { error } = await supabase.rpc("registrar_push", {
    p_endpoint: inscricao.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
  });
  if (error) throw error;
  return "ligado";
}

export async function desligarAvisos(): Promise<EstadoAvisos> {
  const inscricao = suportaAvisos() ? await inscricaoAtual() : null;
  if (inscricao) {
    await supabase.rpc("remover_push", { p_endpoint: inscricao.endpoint });
    await inscricao.unsubscribe();
  }
  return suportaAvisos() ? "desligado" : "sem-suporte";
}

export type TipoAviso = "mesa" | "faltam10" | "esgotado" | "finalizado" | "aprovacao";

// Pede à função avisar-mesas um aviso de qualquer tipo. contas: quantos podem receber
export async function enviarAviso(
  pedido: { tipo: TipoAviso; torneio_id?: string; rodada?: number; nome?: string },
): Promise<{ enviados: number; contas: number }> {
  const { data, error } = await supabase.functions.invoke("avisar-mesas", { body: pedido });
  if (error) {
    let motivo = "";
    try { motivo = (await (error as any).context?.json())?.erro ?? ""; } catch { /* sem corpo */ }
    if (!motivo && /failed to send|not found|404/i.test(error.message)) {
      motivo = "Os avisos ainda não estão disponíveis: falta publicar a função avisar-mesas no Supabase.";
    }
    throw new Error(motivo || error.message);
  }
  return { enviados: Number((data as any)?.enviados ?? 0), contas: Number((data as any)?.contas ?? 0) };
}

// Chamado por quem organiza ao iniciar a rodada, ou pelo botão "Avisar mesas"
export function avisarMesas(torneioId: string, rodada: number) {
  return enviarAviso({ tipo: "mesa", torneio_id: torneioId, rodada });
}

export function useAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos>(suportaAvisos() ? "desligado" : "sem-suporte");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    estadoDosAvisos().then((e) => { if (ativo) setEstado(e); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  const alternar = useCallback(async () => {
    setOcupado(true);
    try {
      setEstado(estado === "ligado" ? await desligarAvisos() : await ligarAvisos());
    } finally {
      setOcupado(false);
    }
  }, [estado]);

  return { estado, ocupado, alternar };
}
