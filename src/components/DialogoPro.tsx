import { useEffect, useState, type ReactNode } from "react";
import { IconeAmpulheta, IconeAnalytics, IconeCheck, IconeCopiar, IconeCoroa, IconeEngrenagem, IconePessoa, IconeSino } from "./ui/Icones";
import { IconeDecks } from "./ui/LogoUmbra";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { atualizarPerfil, useAuth } from "../core/auth";
import {
  CONFIG_PRO_PADRAO, NOME_DO_PLANO, consultarCobranca, criarCobrancaPix, formatarData, formatarPreco, lerConfigPro,
  statusPro, type CobrancaPix, type ConfigPro, type Plano,
} from "../core/pro";
import { podeVenderNoApp } from "../core/plataforma";

const INTERVALO_CONSULTA_MS = 5000;

const BENEFICIOS_JOGADOR: { icone: ReactNode; texto: string }[] = [
  { icone: <IconeAmpulheta />, texto: "Sua mesa e o tempo da rodada no app." },
  { icone: <IconeSino />, texto: "Notificações no celular: sua mesa, tempo extra, último turno e fim do torneio." },
  { icone: <IconeDecks tamanho={16} />, texto: "Decks: todos os decks Commander, com as cartas e as cores." },
  { icone: <IconeAnalytics />, texto: "Analytics: seu desempenho, rivais, conquistas e evolução." },
];
const BENEFICIOS_ORGANIZADOR: { icone: ReactNode; texto: string }[] = [
  { icone: <IconeEngrenagem />, texto: "Escolha quais notificações cada torneio manda aos jogadores." },
  { icone: <IconePessoa />, texto: "Inclui tudo do Jogador Pro para quando você também joga." },
];

export function DialogoPro({ aberto, onFechar, plano }: { aberto: boolean; onFechar: () => void; plano: Plano }) {
  const { toast } = useToast();
  const auth = useAuth();
  const status = statusPro(auth);
  const [config, setConfig] = useState<ConfigPro>(CONFIG_PRO_PADRAO);
  const [cobranca, setCobranca] = useState<CobrancaPix | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const venda = podeVenderNoApp();
  const nome = NOME_DO_PLANO[plano];
  const ativoAte = status.ate[plano];
  // Quem tem o Organizador Pro já tem o do jogador: não precisa comprar os dois
  const incluidoNoOrganizador = plano === "jogador" && !!status.ate.organizador;
  const podeComprar = plano === "jogador" || auth.isOrganizador;

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
          setCobranca(null);
          atualizarPerfil();
          toast(`Pagamento confirmado! ${nome} ativo${r.proAte ? ` até ${formatarData(r.proAte)}` : ""}.`, "sucesso");
        } else if (r.status === "rejected" || r.status === "cancelled") {
          setCobranca(null);
          setErro("O Pix foi cancelado. Gere um novo para tentar de novo.");
        }
      } catch { /* tenta de novo no próximo intervalo */ }
    }, INTERVALO_CONSULTA_MS);
    return () => { ativo = false; window.clearInterval(id); };
  }, [aberto, cobranca, nome, toast]);

  const gerarPix = async () => {
    setGerando(true);
    setErro("");
    try {
      setCobranca(await criarCobrancaPix(plano));
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
  const beneficios = plano === "organizador" ? BENEFICIOS_ORGANIZADOR : BENEFICIOS_JOGADOR;
  const mostrarCompra = !status.ehAdmin && venda && podeComprar && !incluidoNoOrganizador && !cobranca;

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={<span className="inline-flex items-center gap-2">
        {plano === "organizador" ? <IconeCoroa tamanho={20} /> : <IconePessoa tamanho={20} />} {nome}
      </span>}
      fecharAoClicarFora={!cobranca}
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        {status.ehAdmin ? (
          <Selo>Administradores já têm todos os recursos Pro.</Selo>
        ) : incluidoNoOrganizador ? (
          <Selo>Incluído no seu Organizador Pro, ativo até <b>{formatarData(status.ate.organizador!)}</b>.</Selo>
        ) : ativoAte ? (
          <Selo>Seu {nome} está ativo até <b>{formatarData(ativoAte)}</b>.</Selo>
        ) : null}

        <ul className="space-y-2">
          {beneficios.map((b) => (
            <li key={b.texto} className="flex gap-2 items-start">
              <span className="mt-0.5">{b.icone}</span>
              <span>{b.texto}</span>
            </li>
          ))}
        </ul>
        {plano === "jogador" && (
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            Mesas, tempo e notificações aparecem quando o administrador libera para você.
          </p>
        )}

        {!status.ehAdmin && !venda && !ativoAte && !incluidoNoOrganizador && (
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            A assinatura não está disponível neste aplicativo.
          </p>
        )}

        {!status.ehAdmin && venda && !podeComprar && (
          <p className="text-xs" style={{ color: "var(--warn)" }}>
            O Organizador Pro é para quem organiza torneios. Peça a liberação de organizador a um administrador.
          </p>
        )}

        {mostrarCompra && (
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
              <p className="text-xs" style={{ color: "var(--warn)" }}>As assinaturas abrem em breve.</p>
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

        {venda && !status.ehAdmin && (
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
