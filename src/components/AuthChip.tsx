import { useEffect, useRef, useState } from "react";
import { sair, desvincularNome, type AuthState } from "../core/auth";
import { temEnviosPendentes } from "../core/sync";
import { useStore, type ModoView } from "../core/store";
import { useToast } from "./ui/Toast";
import { confirmar } from "./ui/Confirm";
import { IconeAlvo, IconeCadeado, IconeCoroa, IconePessoa } from "./ui/Icones";

interface Props {
  auth: AuthState;
  onLoginClick?: () => void;
  onSair?: () => void;
  onVincularNome?: () => void;
}

function IconeDoModo({ modo, cor }: { modo: ModoView; cor: string }) {
  const Icone = modo === "admin" ? IconeCoroa : modo === "organizador" ? IconeAlvo : IconePessoa;
  return <Icone tamanho={14} cor={cor} />;
}

export function AuthChip({ auth, onLoginClick, onSair, onVincularNome }: Props) {
  const modoView = useStore((s) => s.modoView);
  const setModoView = useStore((s) => s.setModoView);

  // Modos disponíveis pra esse usuário
  const modosDisp: ModoView[] = [];
  if (auth.isAdmin) modosDisp.push("admin");
  if (auth.isOrganizador || auth.isAdmin) modosDisp.push("organizador");
  modosDisp.push("jogador"); // Qualquer usuário pode ver como jogador
  // Jogador é default; só valida se o modo atual ainda é permitido
  if (auth.perfilCarregado && !modosDisp.includes(modoView)) {
    setTimeout(() => setModoView("jogador"), 0);
  }

  const labelModo = (m: ModoView) => (
    <><IconeDoModo modo={m} cor="currentColor" /> {m === "admin" ? "Admin" : m === "organizador" ? "Organizador" : "Jogador"}</>
  );
  const corModo = (m: ModoView) => (
    m === "admin" ? "var(--brand-1)" : m === "organizador" ? "var(--text-strong)" : "var(--text-label)"
  );

  const { toast } = useToast();
  const [abrindoMenu, setAbrindoMenu] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!abrindoMenu) return;
    const aoClicar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbrindoMenu(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbrindoMenu(false);
    };
    document.addEventListener("pointerdown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [abrindoMenu]);

  if (auth.loading) return null;

  if (!auth.session) {
    return (
      <button
        onClick={onLoginClick}
        className="rounded-full px-3 md:px-4 py-2 font-semibold text-xs md:text-sm transition active:scale-95 flex items-center gap-1.5"
        style={{
          background: "linear-gradient(135deg, var(--brand-1), var(--brand-2))",
          color: "#fff",
        }}
      >
        <IconeCadeado cor="currentColor" /> <span className="hidden sm:inline">Login</span>
      </button>
    );
  }

  const email = auth.session.user.email || "";
  const emailCurto = email.split("@")[0];

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAbrindoMenu((v) => !v)}
        className="flex items-center gap-1.5 md:gap-2 rounded-full px-2 md:px-3 py-1.5 transition hover:bg-white/5"
        style={{
          background: `${corModo(modoView)}15`,
          border: `1px solid ${corModo(modoView)}40`,
        }}
      >
        <span className="text-xs">
          <IconeDoModo modo={modoView} cor={corModo(modoView)} />
        </span>
        <span
          className="text-[10px] font-bold tracking-widest uppercase hidden sm:inline"
          style={{ color: corModo(modoView) }}
        >
          {modoView === "admin" ? "ADMIN" : modoView === "organizador" ? "ORGANIZADOR" : "JOGADOR"}
        </span>
        <span className="text-xs truncate max-w-[90px] md:max-w-[140px]" style={{ color: "var(--text-label)" }}>
          {modoView === "jogador" && auth.nomesJogador[0] ? auth.nomesJogador[0] : emailCurto}
        </span>
      </button>

      {abrindoMenu && (
        <>
          <div
            className="absolute right-0 mt-1 rounded-lg shadow-2xl z-40 min-w-[180px] overflow-hidden"
            style={{
              background: "var(--ds-surface-2)",
              border: "1px solid rgba(201,166,72,0.2)",
            }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
              <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                   style={{ color: auth.isAdmin ? "var(--brand-1)" : "var(--text-label)" }}>
                {auth.isAdmin && <span><IconeCoroa cor="currentColor" /> Administrador</span>}
                {!auth.isAdmin && <span><IconePessoa cor="currentColor" /> Jogador</span>}
                {auth.isAdmin && auth.nomesJogador.length > 0 && (
                  <span style={{ color: "var(--text-label)" }}>+ <IconePessoa cor="currentColor" /> Jogador</span>
                )}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-label)" }}>
                {email}
              </div>
              {auth.nomesJogador.length > 0 && (
                <div className="text-[11px] mt-1" style={{ color: "var(--text-2)" }}>
                  Nome(s): <span style={{ color: "var(--text-label)" }}>{auth.nomesJogador.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Seletor de modo de visualização */}
            {modosDisp.length > 1 && (
              <div className="px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
                <div className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "var(--text-muted-ds)" }}>
                  Ver como:
                </div>
                <div className="flex flex-col gap-1">
                  {modosDisp.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setModoView(m); setAbrindoMenu(false); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition text-xs"
                      style={{
                        background: m === modoView ? `${corModo(m)}20` : "transparent",
                        border: `1px solid ${m === modoView ? `${corModo(m)}50` : "transparent"}`,
                        color: m === modoView ? corModo(m) : "#c4c4c4",
                      }}
                    >
                      {labelModo(m)}
                      {m === modoView && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Só o admin pode estar sem nome, pois a conta nova já vincula um ao ser criada */}
            <button
              onClick={() => { setAbrindoMenu(false); onVincularNome?.(); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
              style={{ color: "var(--brand-1)" }}
            >
              {auth.nomesJogador.length + auth.nomesPendentes.length === 0 ? "➕ Vincular meu nome" : "✎ Trocar nome"}
            </button>

            {/* Remover nomes existentes */}
            {auth.nomesPendentes.length > 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--brand-1)" }}>
                ⏳ Aguardando aprovação: {auth.nomesPendentes.join(", ")}
              </div>
            )}
            {[...auth.nomesJogador, ...auth.nomesPendentes].map((n) => (
              <button
                key={n}
                onClick={async () => {
                  setAbrindoMenu(false);
                  const ok = await confirmar({
                    titulo: "Remover nome",
                    mensagem: `Remover "${n}" da sua conta? Você vai parar de ver os torneios desse nome.`,
                    textoOk: "Remover",
                    perigo: true,
                  });
                  if (!ok) return;
                  await desvincularNome(n);
                  toast(`"${n}" removido`, "info");
                  window.location.reload();
                }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition"
                style={{ color: "var(--text-2)" }}
              >
                − Remover "{n}"
              </button>
            ))}

            <div style={{ borderTop: "1px solid var(--line)" }}>
              <button
                onClick={async () => {
                  setAbrindoMenu(false);
                  if (temEnviosPendentes()) {
                    const ok = await confirmar({
                      titulo: "Sair da conta",
                      mensagem: "Há alterações que ainda não foram enviadas e serão perdidas se você sair.",
                      textoOk: "Sair mesmo assim",
                      perigo: true,
                    });
                    if (!ok) return;
                  }
                  await sair();
                  toast("Você saiu da conta", "info");
                  onSair?.();
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
                style={{ color: "var(--critical)" }}
              >
                ⏻ Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
