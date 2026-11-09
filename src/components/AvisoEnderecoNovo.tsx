import { useState } from "react";
import { IconeMegafone } from "./ui/Icones";
import { Modal } from "./ui/Modal";

// O site mudou para torneios.umbraarena.com.br em 08/11/2026. O aviso fica no ar por 90 dias
// e aparece só para contas criadas até a mudança, uma vez por conta em cada aparelho.
const DIA_DA_MUDANCA = Date.parse("2026-11-09T00:00:00-03:00"); // contas criadas antes disto já existiam
const FIM_DO_AVISO = DIA_DA_MUDANCA + 90 * 86_400_000;
const chave = (uid: string) => `mtg.aviso.endereco.${uid}`;

export function deveMostrarAvisoEndereco(
  usuario: { id: string; created_at?: string } | null | undefined,
  agora = Date.now(),
): boolean {
  if (!usuario || agora >= FIM_DO_AVISO) return false;
  const criada = Date.parse(usuario.created_at ?? "");
  if (!(criada < DIA_DA_MUDANCA)) return false;
  try {
    return localStorage.getItem(chave(usuario.id)) === null;
  } catch {
    return false;
  }
}

export function AvisoEnderecoNovo({ usuario }: { usuario: { id: string; created_at?: string } | null | undefined }) {
  const [visto, setVisto] = useState(false);
  if (visto || !deveMostrarAvisoEndereco(usuario)) return null;

  const entendi = () => {
    try { localStorage.setItem(chave(usuario!.id), new Date().toISOString()); } catch { /* ignore */ }
    setVisto(true);
  };

  return (
    <Modal open onClose={entendi} title={<span className="inline-flex items-center gap-2"><IconeMegafone tamanho={20} /> Endereço novo</span>}>
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        <p>
          O Umbra Torneios agora fica em{" "}
          <b style={{ color: "var(--brand-1)" }}>torneios.umbraarena.com.br</b>.
        </p>
        <p>
          Seus torneios, seu histórico e seus nomes de jogador continuam aqui. O endereço antigo
          leva para o novo sozinho.
        </p>
        <div className="rounded-xl p-3 space-y-1" style={{ background: "var(--ds-surface-2)" }}>
          <div className="font-semibold" style={{ color: "var(--text-strong)" }}>Tem o app instalado no celular?</div>
          <ol className="list-decimal pl-5 space-y-0.5" style={{ color: "var(--text-2)" }}>
            <li>Apague o ícone antigo.</li>
            <li>Abra torneios.umbraarena.com.br no navegador.</li>
            <li>No menu do navegador, toque em "Adicionar à tela inicial" ou "Instalar app".</li>
          </ol>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={entendi} autoFocus>Entendi</button>
        </div>
      </div>
    </Modal>
  );
}
