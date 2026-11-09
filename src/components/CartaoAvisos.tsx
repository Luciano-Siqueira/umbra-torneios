import { useState } from "react";
import { useAvisos } from "../core/notificacoes";
import { useToast } from "./ui/Toast";
import { IconeSino } from "./ui/Icones";

const chaveDispensado = (uid: string) => `mtg.avisos.dispensado.${uid}`;

function foiDispensado(uid: string): boolean {
  try { return localStorage.getItem(chaveDispensado(uid)) !== null; } catch { return false; }
}

// Convite para ligar os avisos da mesa, na lista de torneios. Some ao ligar ou ao tocar em "Agora não";
// depois, dá para ligar ou desligar pelo menu da conta.
export function CartaoAvisos({ uid }: { uid: string }) {
  const { estado, ocupado, alternar } = useAvisos();
  const { toast } = useToast();
  const [dispensado, setDispensado] = useState(() => foiDispensado(uid));
  if (estado !== "desligado" || dispensado) return null;

  const ligar = async () => {
    try {
      await alternar();
      toast("Avisos ligados: você recebe sua mesa quando a rodada começar.", "sucesso");
    } catch (e: any) {
      toast("Não foi possível ligar os avisos: " + (e?.message ?? ""), "erro");
    }
  };

  const agoraNao = () => {
    try { localStorage.setItem(chaveDispensado(uid), new Date().toISOString()); } catch { /* ignore */ }
    setDispensado(true);
  };

  return (
    <section
      aria-label="Avisos da mesa"
      className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: "rgba(201,166,72,0.08)", borderColor: "rgba(201,166,72,0.35)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: "var(--text-strong)" }}><IconeSino /> Receba sua mesa no celular</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
          Quando a rodada começar, avisamos a sua mesa e com quem você joga.
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={agoraNao} disabled={ocupado}>Agora não</button>
        <button type="button" className="btn-primary text-sm" onClick={ligar} disabled={ocupado}>
          {ocupado ? "Ligando..." : "Ligar avisos"}
        </button>
      </div>
    </section>
  );
}
