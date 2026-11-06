import type { JSX } from "react";
import { useAuth } from "../../core/auth";
import { useStore, type Tela } from "../../core/store";
import { podeEditarTorneios } from "../../core/visibilidade";
import { IconeDecks } from "./LogoUmbra";
import { IconeAnalytics, IconeArena, IconeUsuarios } from "./Icones";

const TELAS_COM_BARRA: Tela[] = ["torneios", "analytics", "decks", "usuarios"];

// Navegação principal no celular. Dentro de um torneio ficam só as abas dele.
export function BarraInferior() {
  const auth = useAuth();
  const tela = useStore((s) => s.tela);
  const modoView = useStore((s) => s.modoView);
  const irPara = useStore((s) => s.irPara);
  const voltarParaLista = useStore((s) => s.voltarParaLista);

  if (!auth.session || !TELAS_COM_BARRA.includes(tela)) return null;

  const admin = auth.isAdmin && modoView === "admin";
  const itens: { id: Tela; rotulo: string; icone: (cor: string) => JSX.Element; abrir: () => void }[] = [
    { id: "torneios", rotulo: "Torneios", icone: (cor) => <IconeArena tamanho={22} cor={cor} />, abrir: voltarParaLista },
    {
      id: "analytics",
      rotulo: podeEditarTorneios(modoView, auth) ? "Analytics" : "Desempenho",
      icone: (cor) => <IconeAnalytics tamanho={22} cor={cor} />,
      abrir: () => irPara("analytics"),
    },
    ...(admin ? [
      { id: "decks" as Tela, rotulo: "Decks", icone: (cor: string) => <IconeDecks tamanho={22} cor={cor} />, abrir: () => irPara("decks") },
      { id: "usuarios" as Tela, rotulo: "Usuários", icone: (cor: string) => <IconeUsuarios tamanho={22} cor={cor} />, abrir: () => irPara("usuarios") },
    ] : []),
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t"
      style={{
        background: "rgba(10,10,10,0.94)",
        borderColor: "var(--line)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {itens.map((item) => {
        const aberto = tela === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={aberto ? "page" : undefined}
            onClick={item.abrir}
            className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
            style={{ color: aberto ? "var(--brand-1)" : "var(--text-2)" }}
          >
            {item.icone(aberto ? "var(--brand-1)" : "currentColor")}
            <span className="truncate max-w-full">{item.rotulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
