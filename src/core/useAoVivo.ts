// Acompanha um torneio em tempo real e mantém o store atualizado
import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useStore } from "./store";
import { listaMudou, puxarDoServidor, puxarTorneio, temEnviosPendentes } from "./sync";
import { sincronizarRelogio } from "./timer";
import { ehPublicacaoMinha, type LinhaAoVivo } from "./aoVivo";

// Conferência por consulta, caso o Realtime caia ou nem conecte
const CONFERENCIA_CONECTADO_MS = 60_000;
const CONFERENCIA_DESCONECTADO_MS = 15_000;
const CONFERENCIA_LISTA_MS = 60_000;

// escritor: aparelho de quem organiza, que também grava o torneio
export function useAoVivo(torneioId: string | null, escritor = false): void {
  useEffect(() => {
    if (!torneioId) return;
    let ativo = true;
    let ultimaVista = 0;

    const baixarTorneio = async () => {
      if (await puxarTorneio(torneioId) && ativo) useStore.getState().recarregar();
    };

    const aplicar = async (linha: LinhaAoVivo) => {
      if (escritor && (ehPublicacaoMinha(linha) || temEnviosPendentes())) return;

      const quando = Date.parse(linha.atualizado_em ?? "") || 0;
      if (quando < ultimaVista) return; // resposta antiga chegou depois da nova
      const novidade = quando > ultimaVista;
      ultimaVista = quando;

      const { torneios, aplicarAoVivo } = useStore.getState();
      const atual = torneios.find((t) => t.id === linha.torneio_id);
      const mudouRodada = !!atual && (atual.rodadaAtual !== linha.rodada || atual.finalizado !== linha.finalizado);
      aplicarAoVivo(linha);

      // Pontos e histórico não vêm na linha. Quem só acompanha baixa o torneio uma vez
      // por rodada; quem também grava precisa dele inteiro para não sobrescrever o outro aparelho.
      if (!mudouRodada && !(escritor && novidade)) return;
      await baixarTorneio();
      if (ativo) useStore.getState().aplicarAoVivo(linha);
    };

    const buscar = async () => {
      const { data, error } = await supabase
        .from("torneio_ao_vivo")
        .select("torneio_id, rodada, finalizado, mesas, timer, atualizado_em")
        .eq("torneio_id", torneioId)
        .maybeSingle();
      if (!ativo) return;
      if (error) console.warn("Erro ao buscar ao vivo", error.message);
      if (data) aplicar(data as LinhaAoVivo);
      // Sem linha ao vivo, o tempo e as mesas ainda estão no torneio salvo
      else if (!escritor) baixarTorneio();
    };

    let conferencia = 0;
    const programarConferencia = (ms: number) => {
      window.clearInterval(conferencia);
      conferencia = window.setInterval(buscar, ms);
    };
    programarConferencia(CONFERENCIA_DESCONECTADO_MS);

    const canal = supabase
      .channel(`ao-vivo-${torneioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "torneio_ao_vivo", filter: `torneio_id=eq.${torneioId}` },
        (mudanca) => {
          if (ativo && "torneio_id" in mudanca.new) aplicar(mudanca.new as LinhaAoVivo);
        },
      )
      .subscribe((estado, erro) => {
        if (!ativo) return;
        if (estado === "SUBSCRIBED") {
          programarConferencia(CONFERENCIA_CONECTADO_MS);
          buscar();
        } else {
          if (erro) console.warn("Realtime desconectado", estado, erro.message);
          programarConferencia(CONFERENCIA_DESCONECTADO_MS);
        }
      });

    // Celular bloqueado derruba a conexão: confere ao voltar para o app
    const aoVoltar = () => {
      if (document.visibilityState === "visible") buscar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    sincronizarRelogio();
    buscar();

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(conferencia);
      supabase.removeChannel(canal);
    };
  }, [torneioId, escritor]);
}

// Fora de um torneio: mostra torneio novo ou reaberto sem precisar recarregar.
// Consulta só um resumo, e baixa os torneios apenas quando algo mudou.
export function useListaAtualizada(ligado: boolean): void {
  useEffect(() => {
    if (!ligado) return;

    const conferir = async () => {
      const { sincronizando, recarregar } = useStore.getState();
      if (sincronizando || document.visibilityState !== "visible") return;
      if (!(await listaMudou())) return;
      const res = await puxarDoServidor();
      if (res.erros.length === 0) recarregar();
    };

    conferir();
    const id = window.setInterval(conferir, CONFERENCIA_LISTA_MS);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, [ligado]);
}
