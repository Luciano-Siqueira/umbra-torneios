import { useState } from "react";
import { sair, desvincularNome, type AuthState } from "../core/auth";
import { temEnviosPendentes } from "../core/sync";
import { useStore, type ModoView } from "../core/store";
import { useToast } from "./ui/Toast";

interface Props {
  auth: AuthState;
  onLoginClick?: () => void;
  onSair?: () => void;
  onVincularNome?: () => void;
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
    m === "admin" ? "👑 Admin" : m === "organizador" ? "🎯 Organizador" : "👤 Jogador"
  );
  const corModo = (m: ModoView) => (
    m === "admin" ? "#c9a648" : m === "organizador" ? "#38bdf8" : "#7bc47f"
  );

  const { toast } = useToast();
  const [abrindoMenu, setAbrindoMenu] = useState(false);

  if (auth.loading) return null;

  if (!auth.session) {
    return (
      <button
        onClick={onLoginClick}
        className="rounded-full px-3 md:px-4 py-2 font-semibold text-xs md:text-sm transition active:scale-95 flex items-center gap-1.5"
        style={{
          background: "linear-gradient(135deg, #c9a648, #8b0000)",
          color: "#fff",
        }}
      >
        🔐 <span className="hidden sm:inline">Login</span>
      </button>
    );
  }

  const email = auth.session.user.email || "";
  const emailCurto = email.split("@")[0];

  return (
    <div className="relative">
      <button
        onClick={() => setAbrindoMenu((v) => !v)}
        className="flex items-center gap-1.5 md:gap-2 rounded-full px-2 md:px-3 py-1.5 transition hover:bg-white/5"
        style={{
          background: `${corModo(modoView)}15`,
          border: `1px solid ${corModo(modoView)}40`,
        }}
      >
        <span className="text-xs">
          {modoView === "admin" ? "👑" : modoView === "organizador" ? "🎯" : "👤"}
        </span>
        <span
          className="text-[10px] font-bold tracking-widest uppercase hidden sm:inline"
          style={{ color: corModo(modoView) }}
        >
          {modoView === "admin" ? "ADMIN" : modoView === "organizador" ? "ORGANIZADOR" : "JOGADOR"}
        </span>
        <span className="text-xs truncate max-w-[90px] md:max-w-[140px]" style={{ color: "#c4c4c4" }}>
          {modoView === "jogador" && auth.nomesJogador[0] ? auth.nomesJogador[0] : emailCurto}
        </span>
      </button>

      {abrindoMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setAbrindoMenu(false)}
          />
          <div
            className="absolute right-0 mt-1 rounded-lg shadow-2xl z-40 min-w-[180px] overflow-hidden"
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(201,166,72,0.2)",
            }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: "#2a2a2a" }}>
              <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                   style={{ color: auth.isAdmin ? "#c9a648" : "#7bc47f" }}>
                {auth.isAdmin && <span>👑 Administrador</span>}
                {!auth.isAdmin && <span>👤 Jogador</span>}
                {auth.isAdmin && auth.nomesJogador.length > 0 && (
                  <span style={{ color: "#7bc47f" }}>+ 👤 Jogador</span>
                )}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "#c4c4c4" }}>
                {email}
              </div>
              {auth.nomesJogador.length > 0 && (
                <div className="text-[11px] mt-1" style={{ color: "#8a8a8a" }}>
                  Nome(s): <span style={{ color: "#7bc47f" }}>{auth.nomesJogador.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Seletor de modo de visualização */}
            {modosDisp.length > 1 && (
              <div className="px-3 py-2 border-b" style={{ borderColor: "#2a2a2a" }}>
                <div className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "#6b6b6b" }}>
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

            {/* Vincular/alterar nome do jogador */}
            <button
              onClick={() => { setAbrindoMenu(false); onVincularNome?.(); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
              style={{ color: "#c9a648" }}
            >
              {auth.nomesJogador.length === 0 ? "➕ Vincular meu nome" : "✎ Adicionar outro nome"}
            </button>

            {/* Desvincular nomes existentes */}
            {auth.nomesJogador.map((n) => (
              <button
                key={n}
                onClick={async () => {
                  setAbrindoMenu(false);
                  if (!confirm(`Desvincular "${n}"? Você vai parar de ver torneios desse nome.`)) return;
                  await desvincularNome(n);
                  toast(`"${n}" desvinculado`, "info");
                  window.location.reload();
                }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition"
                style={{ color: "#8a8a8a" }}
              >
                − Remover "{n}"
              </button>
            ))}

            <div style={{ borderTop: "1px solid #2a2a2a" }}>
              <button
                onClick={async () => {
                  setAbrindoMenu(false);
                  if (temEnviosPendentes() && !confirm("Há alterações que ainda não foram enviadas e serão perdidas se você sair. Sair mesmo assim?")) return;
                  await sair();
                  toast("Você saiu da conta", "info");
                  onSair?.();
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
                style={{ color: "#f87171" }}
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
