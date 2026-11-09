import { useEffect, useState, type ReactNode } from "react";
import { IconeCheck, IconeCopiar, IconeCoroa, IconeSino } from "./ui/Icones";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import {
  CONFIG_PRO_PADRAO, consultarCobranca, criarCobrancaPix, formatarData, formatarPreco, lerConfigPro,
  type CobrancaPix, type ConfigPro, type useMeuPro,
} from "../core/pro";
import { podeVenderNoApp } from "../core/plataforma";

type Pro = ReturnType<typeof useMeuPro>;
const INTERVALO_CONSULTA_MS = 5000;

export const BENEFICIOS_PRO = [
  "Escolha quais notificações cada torneio manda: mesa da rodada, tempo extra e último turno, torneio finalizado.",
  "Ajuda a manter o app no ar e sem anúncios.",
];

export function DialogoPro({ aberto, onFechar, pro, ehOrganizador }: {
  aberto: boolean;
  onFechar: () => void;
  pro: Pro;
  ehOrganizador: boolean;
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigPro>(CONFIG_PRO_PADRAO);
  const [cobranca, setCobranca] = useState<CobrancaPix | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const venda = podeVenderNoApp();

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    lerConfigPro().then(setConfig);
  }, [aberto]);

  // Enquanto o Pix está na tela, pergunta de tempos em tempos se ele caiu
  useEffect(() => {
    if (!aberto || !cobranca) return;
    let ativo = true;
    const id = window.setInterval(async () => {
      setAgora(Date.now());
      if (cobranca.expiraEm && Date.parse(cobranca.expiraEm) < Date.now()) return;
      try {
        const r = await consultarCobranca(cobranca.id);
        if (!ativo) return;
        if (r.status === "approved") {
          pro.definir(r.proAte);
          setCobranca(null);
          toast(`Pagamento confirmado! Organizador Pro ativo${r.proAte ? ` até ${formatarData(r.proAte)}` : ""}.`, "sucesso");
        } else if (r.status === "rejected" || r.status === "cancelled") {
          setCobranca(null);
          setErro("O Pix foi cancelado. Gere um novo para tentar de novo.");
        }
      } catch { /* tenta de novo no próximo intervalo */ }
    }, INTERVALO_CONSULTA_MS);
    return () => { ativo = false; window.clearInterval(id); };
  }, [aberto, cobranca, pro.definir, toast]);

  const gerarPix = async () => {
    setGerando(true);
    setErro("");
    try {
      setCobranca(await criarCobrancaPix());
      setAgora(Date.now());
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível gerar o Pix.");
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast("Código Pix copiado. Cole no app do seu banco.", "sucesso");
    } catch {
      toast("Não foi possível copiar. Selecione o código e copie à mão.", "aviso");
    }
  };

  const expirado = !!cobranca?.expiraEm && Date.parse(cobranca.expiraEm) < agora;
  const ativoAte = pro.proAte && Date.parse(pro.proAte) > agora ? pro.proAte : null;

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={<span className="inline-flex items-center gap-2"><IconeCoroa tamanho={20} /> Organizador Pro</span>}
      fecharAoClicarFora={!cobranca}
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        {pro.ehAdmin ? (
          <Selo>Administradores já têm todos os recursos do Pro.</Selo>
        ) : ativoAte ? (
          <Selo>Seu Organizador Pro está ativo até <b>{formatarData(ativoAte)}</b>.</Selo>
        ) : null}

        <ul className="space-y-2">
          {BENEFICIOS_PRO.map((b, i) => (
            <li key={b} className="flex gap-2">
              {i === 0 ? <IconeSino /> : <IconeCheck />}
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {!pro.ehAdmin && !venda && !ativoAte && (
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            A assinatura não está disponível neste aplicativo.
          </p>
        )}

        {!pro.ehAdmin && venda && !ehOrganizador && (
          <p className="text-xs" style={{ color: "var(--warn)" }}>
            O Organizador Pro é para quem organiza torneios. Peça a liberação de organizador a um administrador.
          </p>
        )}

        {!pro.ehAdmin && venda && ehOrganizador && !cobranca && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--ds-surface-2)", border: "1px solid rgba(201,166,72,0.3)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold" style={{ color: "var(--brand-1)" }}>{formatarPreco(config.precoCentavos)}</span>
              <span className="text-xs" style={{ color: "var(--text-2)" }}>por {config.dias} dias · Pix</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>
              Sem renovação automática: quando quiser continuar, pague de novo. Se renovar antes do fim, os dias se somam.
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={gerarPix}
              disabled={gerando || !config.vendasAbertas}
            >
              {gerando ? "Gerando o Pix..." : ativoAte ? `Renovar por mais ${config.dias} dias` : "Assinar com Pix"}
            </button>
            {!config.vendasAbertas && (
              <p className="text-xs" style={{ color: "var(--warn)" }}>As vendas estão pausadas no momento.</p>
            )}
          </div>
        )}

        {cobranca && (
          <div className="rounded-xl p-3 space-y-3 text-center" style={{ background: "var(--ds-surface-2)" }}>
            {expirado ? (
              <>
                <p style={{ color: "var(--warn)" }}>Este Pix expirou.</p>
                <button type="button" className="btn-primary" onClick={gerarPix} disabled={gerando}>Gerar outro Pix</button>
              </>
            ) : (
              <>
                <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
                  Pague {formatarPreco(cobranca.valorCentavos)} pelo app do seu banco
                </p>
                {cobranca.qrCodeBase64 && (
                  <img
                    src={`data:image/png;base64,${cobranca.qrCodeBase64}`}
                    alt="QR Code do Pix"
                    className="mx-auto rounded-lg bg-white p-2"
                    width={200}
                    height={200}
                  />
                )}
                <div className="flex items-center gap-2 text-left">
                  <code
                    className="flex-1 min-w-0 truncate select-all rounded-lg px-2 py-1.5 text-[11px]"
                    style={{ background: "var(--page-1)", color: "var(--text-strong)" }}
                    aria-label="Código Pix copia e cola"
                  >
                    {cobranca.qrCode}
                  </code>
                  <button type="button" className="btn-primary text-xs whitespace-nowrap" onClick={() => copiar(cobranca.qrCode)}>
                    <IconeCopiar cor="currentColor" /> Copiar
                  </button>
                </div>
                <p className="text-xs" role="status" style={{ color: "var(--text-2)" }}>
                  Aguardando o pagamento... esta tela atualiza sozinha.
                  {cobranca.expiraEm && <> O código vale até {new Date(cobranca.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</>}
                </p>
              </>
            )}
          </div>
        )}

        {erro && <div role="alert" className="text-xs" style={{ color: "var(--critical)" }}>{erro}</div>}

        {venda && !pro.ehAdmin && (
          <p className="text-[10px] leading-snug" style={{ color: "var(--text-2)" }}>
            O pagamento é processado pelo Mercado Pago. O Pro vale para a sua conta no site e no app.
          </p>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-ghost" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

function Selo({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.3)", color: "var(--good)" }}>
      <IconeCheck cor="currentColor" />
      <span>{children}</span>
    </div>
  );
}
