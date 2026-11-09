import { useEffect, useState } from "react";
import { CONFIG_AVISOS_PADRAO, lerConfigAvisos, salvarConfigAvisos, type ConfigAvisos } from "../core/admin";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

const TIPOS: { chave: keyof ConfigAvisos; titulo: string; descricao: string }[] = [
  { chave: "mesa", titulo: "Mesa da rodada", descricao: "Quando a rodada começa, cada jogador recebe a mesa e com quem joga." },
  { chave: "faltam10", titulo: "Faltam 10 minutos", descricao: "Aos 10 minutos do fim da rodada, para quem ainda está jogando." },
  { chave: "esgotado", titulo: "Tempo esgotado", descricao: "Quando o tempo da rodada acaba, para quem ainda está jogando." },
  { chave: "finalizado", titulo: "Torneio finalizado", descricao: "Ao finalizar, todos os jogadores recebem o convite para ver o ranking." },
  { chave: "aprovacao", titulo: "Nome aguardando aprovação", descricao: "Os administradores são avisados quando alguém vincula um nome." },
];

// Escolha de quais avisos (notificações) o app manda. Vale para todos os torneios.
export function DialogoAvisos({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigAvisos>(CONFIG_AVISOS_PADRAO);
  const [faltaTabela, setFaltaTabela] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<keyof ConfigAvisos | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setCarregando(true);
    lerConfigAvisos().then((r) => {
      if (!ativo) return;
      setConfig(r.config);
      setFaltaTabela(r.faltaTabela);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [aberto]);

  const alternar = async (chave: keyof ConfigAvisos) => {
    const novo = !config[chave];
    setSalvando(chave);
    setConfig((c) => ({ ...c, [chave]: novo }));
    try {
      await salvarConfigAvisos({ [chave]: novo });
    } catch (e: any) {
      setConfig((c) => ({ ...c, [chave]: !novo }));
      toast("Não foi possível salvar: " + (e?.message ?? ""), "erro");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Modal open={aberto} onClose={onFechar} title="🔔 Avisos no celular" fecharAoClicarFora>
      <div className="space-y-3 text-sm">
        <p style={{ color: "var(--text-2)" }}>
          Escolha quais avisos o app manda. Vale para todos os torneios. Só recebe quem ligou os avisos no aparelho.
        </p>
        {faltaTabela && (
          <div className="text-xs" style={{ color: "var(--warn)" }}>
            Para escolher os avisos, rode o arquivo supabase/config_avisos.sql no Supabase. Até lá, todos ficam ligados.
          </div>
        )}
        <ul className="space-y-1">
          {TIPOS.map((t) => (
            <li key={t.chave} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold" style={{ color: "var(--text-strong)" }}>{t.titulo}</div>
                <div className="text-xs" style={{ color: "var(--text-2)" }}>{t.descricao}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config[t.chave]}
                aria-label={t.titulo}
                disabled={carregando || faltaTabela || salvando === t.chave}
                onClick={() => alternar(t.chave)}
                className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 active:scale-95 disabled:opacity-40"
                style={{ background: config[t.chave] ? "var(--brand-1)" : "var(--line)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: config[t.chave] ? "26px" : "2px" }}
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={onFechar}>Pronto</button>
        </div>
      </div>
    </Modal>
  );
}
