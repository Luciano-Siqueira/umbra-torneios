// Acompanha um torneio em tempo real e mantém o store atualizado
import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useStore } from "./store";
import { puxarTorneio } from "./sync";
import { sincronizarRelogio } from "./timer";
import type { LinhaAoVivo } from "./aoVivo";

const INTERVALO_CONFERENCIA_MS = 60_000; // caso o Realtime caia sem avisar

export function useAoVivo(torneioId: string | null): void {
  useEffect(() => {
    if (!torneioId) return;
    let ativo = true;

    const aplicar = async (linha: LinhaAoVivo) => {
      const { torneios, aplicarAoVivo, recarregar } = useStore.getState();
      const atual = torneios.find((t) => t.id === linha.torneio_id);
      const mudouRodada = !!atual && (atual.rodadaAtual !== linha.rodada || atual.finalizado !== linha.finalizado);
      aplicarAoVivo(linha);
      if (!mudouRodada) return;

      // Pontos e histórico não vêm na linha: baixa o torneio uma vez por rodada
      if (await puxarTorneio(linha.torneio_id)) {
        if (!ativo) return;
        recarregar();
        aplicarAoVivo(linha);
      }
    };

    const buscar = async () => {
      const { data, error } = await supabase
        .from("torneio_ao_vivo")
        .select("torneio_id, rodada, finalizado, mesas, timer")
        .eq("torneio_id", torneioId)
        .maybeSingle();
      if (!ativo) return;
      if (error) {
        console.warn("Erro ao buscar ao vivo", error.message);
        return;
      }
      if (data) aplicar(data as LinhaAoVivo);
    };

    const canal = supabase
      .channel(`ao-vivo-${torneioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "torneio_ao_vivo", filter: `torneio_id=eq.${torneioId}` },
        (mudanca) => {
          if (ativo && "torneio_id" in mudanca.new) aplicar(mudanca.new as LinhaAoVivo);
        },
      )
      .subscribe();

    // Celular bloqueado derruba a conexão: confere ao voltar para o app
    const aoVoltar = () => {
      if (document.visibilityState === "visible") buscar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    const conferencia = window.setInterval(buscar, INTERVALO_CONFERENCIA_MS);

    sincronizarRelogio();
    buscar();

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(conferencia);
      supabase.removeChannel(canal);
    };
  }, [torneioId]);
}
