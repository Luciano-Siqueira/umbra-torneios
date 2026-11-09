import { useState } from "react";
import { IconeCadeado } from "./ui/Icones";
import { aceitarPrivacidade, sair } from "../core/auth";
import { Modal } from "./ui/Modal";

// Aparece uma vez para cada conta, nova ou antiga, até a pessoa aceitar.
// Não fecha por fora: ou aceita, ou sai da conta.
export function AvisoPrivacidade({ uid, onAceito, onSair }: { uid: string; onAceito?: () => void; onSair?: () => void }) {
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (aceito) return null;

  const aceitar = async () => {
    setEnviando(true);
    try {
      await aceitarPrivacidade(uid);
    } finally {
      setEnviando(false);
      setAceito(true);
      onAceito?.();
    }
  };

  return (
    <Modal open onClose={() => {}} title={<span className="inline-flex items-center gap-2"><IconeCadeado tamanho={20} /> Sua privacidade</span>}>
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        <p>Antes de continuar, veja como o Umbra Torneios usa seus dados:</p>
        <ul className="list-disc pl-5 space-y-1.5" style={{ color: "var(--text-2)" }}>
          <li>Guardamos seu e-mail, seu nome de jogador e os dados dos torneios: mesas, resultados e ranking.</li>
          <li>Do pagamento da inscrição, só a marcação de quem pagou, vista apenas por quem organiza.</li>
          <li>Não vendemos dados, não mostramos anúncios e não usamos rastreadores.</li>
          <li>Você pode excluir sua conta quando quiser, pelo menu da conta.</li>
        </ul>
        <a
          href="privacidade.html"
          target="_blank"
          rel="noopener"
          className="inline-block underline"
          style={{ color: "var(--brand-1)" }}
        >
          Ler a política de privacidade completa
        </a>
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            className="btn-ghost"
            disabled={enviando}
            onClick={async () => { await sair(); onSair?.(); }}
          >
            Sair da conta
          </button>
          <button type="button" className="btn-primary" disabled={enviando} onClick={aceitar} autoFocus>
            {enviando ? "Salvando..." : "Li e concordo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
