import { useState } from "react";
import { IconeCoroa, IconePessoa } from "./ui/Icones";
import { Modal } from "./ui/Modal";
import { confirmar } from "./ui/Confirm";
import type { ProAte } from "../core/auth";
import type { UsuarioInfo } from "../core/admin";
import { NOME_DO_PLANO, concederPro, formatarData, proAtivo, revogarPro, type Plano } from "../core/pro";

const ATALHOS_DE_DIAS = [7, 30, 90, 365];

// Admin dá dias de Jogador Pro ou Organizador Pro (cortesia) ou encerra um plano
export function DialogoProUsuario({ usuario, pro, onFechar, onMudou, toast }: {
  usuario: UsuarioInfo;
  pro: ProAte | undefined;
  onFechar: () => void;
  onMudou: () => void;
  toast: (msg: string, tipo?: any) => void;
}) {
  const [plano, setPlano] = useState<Plano>(usuario.eh_organizador ? "organizador" : "jogador");
  const [dias, setDias] = useState("30");
  const [salvando, setSalvando] = useState(false);
  const quem = usuario.nomes_jogador[0] || usuario.email;
  const nDias = Math.trunc(Number(dias));
  const diasValidos = Number.isFinite(nDias) && nDias > 0 && nDias <= 3650;

  const dar = async () => {
    if (!diasValidos) return;
    setSalvando(true);
    try {
      const ate = await concederPro(usuario.user_id, nDias, plano);
      toast(`${NOME_DO_PLANO[plano]} para ${quem} até ${formatarData(ate)}`, "sucesso");
      onMudou();
    } catch (e: any) {
      toast("Não foi possível dar o Pro: " + (e?.message ?? ""), "erro");
    } finally {
      setSalvando(false);
    }
  };

  const tirar = async (p: Plano) => {
    const ok = await confirmar({
      titulo: `Tirar ${NOME_DO_PLANO[p]}`,
      mensagem: `Encerrar agora o ${NOME_DO_PLANO[p]} de ${quem}? Os dias que faltam são perdidos.`,
      textoOk: "Tirar",
      perigo: true,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await revogarPro(usuario.user_id, p);
      toast(`${NOME_DO_PLANO[p]} de ${quem} encerrado`, "info");
      onMudou();
    } catch (e: any) {
      toast("Não foi possível tirar o Pro: " + (e?.message ?? ""), "erro");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onFechar}
      title={<span className="inline-flex items-center gap-2"><IconeCoroa tamanho={20} /> Planos Pro</span>}
      fecharAoClicarFora
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-label)" }}>
        <div className="truncate" style={{ color: "var(--text-strong)" }}>{usuario.email}</div>

        {usuario.eh_admin && (
          <p className="text-xs" style={{ color: "var(--good)" }}>Administrador: já tem todos os recursos Pro.</p>
        )}

        <ul className="space-y-2">
          {(["jogador", "organizador"] as Plano[]).map((p) => {
            const ate = pro?.[p] ?? null;
            const ativo = proAtivo(ate);
            return (
              <li key={p} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--ds-surface-2)" }}>
                {p === "organizador" ? <IconeCoroa /> : <IconePessoa />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold" style={{ color: "var(--text-strong)" }}>{NOME_DO_PLANO[p]}</div>
                  <div className="text-xs" style={{ color: ativo ? "var(--good)" : "var(--text-2)" }}>
                    {ativo ? `Ativo até ${formatarData(ate!)}` : ate ? `Venceu em ${formatarData(ate)}` : "Nunca teve"}
                  </div>
                </div>
                {ativo && (
                  <button type="button" className="btn-ghost text-xs" style={{ color: "var(--critical)" }}
                          onClick={() => tirar(p)} disabled={salvando}>
                    Tirar
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <fieldset className="space-y-2 rounded-xl p-3" style={{ border: "1px solid rgba(201,166,72,0.3)" }}>
          <legend className="label px-1">Dar dias de cortesia</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Plano">
            {(["jogador", "organizador"] as Plano[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={plano === p}
                onClick={() => setPlano(p)}
                className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold border"
                style={plano === p
                  ? { background: "rgba(201,166,72,0.15)", borderColor: "var(--brand-1)", color: "var(--brand-1)" }
                  : { borderColor: "var(--line)", color: "var(--text-2)" }}
              >
                {NOME_DO_PLANO[p]}
              </button>
            ))}
          </div>
          {plano === "organizador" && !usuario.eh_organizador && (
            <p className="text-[11px]" style={{ color: "var(--warn)" }}>
              Esta pessoa não é organizadora: só vai aproveitar a parte do Jogador Pro.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {ATALHOS_DE_DIAS.map((d) => (
              <button key={d} type="button" className="btn-ghost text-xs px-2 py-1"
                      style={String(d) === dias ? { color: "var(--brand-1)" } : undefined}
                      onClick={() => setDias(String(d))}>
                {d === 365 ? "1 ano" : `${d} dias`}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={3650}
              inputMode="numeric"
              className="input w-20 text-xs"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              aria-label="Quantidade de dias"
            />
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-2)" }}>
            Os dias se somam à validade atual. Vale na hora; o app da pessoa atualiza em até 3 minutos.
          </p>
          <button type="button" className="btn-primary w-full" onClick={dar} disabled={salvando || !diasValidos}>
            {salvando ? "Salvando..." : `Dar ${diasValidos ? nDias : ""} ${nDias === 1 ? "dia" : "dias"} de ${NOME_DO_PLANO[plano]}`}
          </button>
        </fieldset>

        <div className="flex justify-end">
          <button type="button" className="btn-ghost" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}
