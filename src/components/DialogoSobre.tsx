import { version as versao } from "../../package.json";
import { IconeCopiar, IconeCoracao, IconeEnvelope, IconeInfo } from "./ui/Icones";
import { EscritaUmbra, SimboloUmbra } from "./ui/LogoUmbra";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { podeVenderNoApp } from "../core/plataforma";

// Chave Pix aleatória para quem quiser ajudar com os custos do app. Vazia, o bloco avisa que vem em breve.
// No app da Play Store o bloco some: a loja não aceita pagamentos por fora dela.
export const CHAVE_PIX = "";
const EMAIL_CONTATO = "contato@umbraarena.com.br";

export function DialogoSobre({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { toast } = useToast();

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(CHAVE_PIX);
      toast("Chave Pix copiada", "sucesso");
    } catch {
      toast("Não foi possível copiar. Selecione a chave e copie à mão.", "aviso");
    }
  };

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={<span className="inline-flex items-center gap-2"><IconeInfo tamanho={20} /> Sobre o app</span>}
      fecharAoClicarFora
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        <div className="flex flex-col items-center gap-2 text-center">
          <SimboloUmbra tamanho={56} />
          <EscritaUmbra tamanho={18} />
          <span className="text-xs font-mono" style={{ color: "var(--text-2)" }}>Versão {versao}</span>
        </div>

        <p>
          O Umbra Torneios organiza torneios de Magic multiplayer do começo ao fim: inscrição e pagamento
          dos jogadores, sorteio das mesas, tempo da rodada com avisos no celular, resultados, ranking com o
          desempate oficial, premiação e histórico.
        </p>
        <p style={{ color: "var(--text-2)" }}>
          Cada jogador acompanha a própria mesa, os decks e o seu desempenho. O app é gratuito para jogadores e não tem anúncios.
        </p>

        {podeVenderNoApp() && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--ds-surface-2)", border: "1px solid rgba(201,166,72,0.3)" }}>
            <div className="font-semibold flex items-center gap-2" style={{ color: "var(--brand-1)" }}>
              <IconeCoracao cor="currentColor" /> Ajude o projeto
            </div>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>
              Servidor, domínio e e-mail têm custo. Se quiser ajudar, qualquer valor via Pix é bem-vindo.
            </p>
            {CHAVE_PIX ? (
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 min-w-0 break-all select-all rounded-lg px-2 py-1.5 text-xs"
                  style={{ background: "var(--page-1)", color: "var(--text-strong)" }}
                  aria-label="Chave Pix aleatória"
                >
                  {CHAVE_PIX}
                </code>
                <button type="button" className="btn-primary text-xs whitespace-nowrap" onClick={copiarPix}>
                  <IconeCopiar cor="currentColor" /> Copiar
                </button>
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: "var(--text-2)" }}>A chave Pix chega em breve.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 text-xs">
          <a href={`mailto:${EMAIL_CONTATO}`} className="inline-flex items-center gap-2" style={{ color: "var(--brand-1)" }}>
            <IconeEnvelope cor="currentColor" /> {EMAIL_CONTATO}
          </a>
          <a href="privacidade.html" target="_blank" rel="noopener" className="underline" style={{ color: "var(--text-2)" }}>
            Política de privacidade
          </a>
        </div>

        <p className="text-[10px] leading-snug" style={{ color: "var(--text-2)" }}>
          Magic: The Gathering é marca da Wizards of the Coast. O Umbra Torneios não é afiliado nem endossado por ela.
        </p>

        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}
