import { useState } from "react";
import { sair, type AuthState } from "../core/auth";
import { useToast } from "./ui/Toast";

interface Props {
  auth: AuthState;
  onLoginClick?: () => void;
  onSair?: () => void;
}

export function AuthChip({ auth, onLoginClick, onSair }: Props) {
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
          background: auth.isAdmin ? "rgba(201,166,72,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${auth.isAdmin ? "rgba(201,166,72,0.3)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        {auth.isAdmin && <span className="text-xs">👑</span>}
        <span
          className="text-[10px] font-bold tracking-widest uppercase hidden sm:inline"
          style={{ color: auth.isAdmin ? "#c9a648" : "#8a8a8a" }}
        >
          {auth.isAdmin ? "ADMIN" : "USER"}
        </span>
        <span className="text-xs truncate max-w-[90px] md:max-w-[140px]" style={{ color: "#c4c4c4" }}>
          {emailCurto}
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
              <div className="text-[10px] uppercase tracking-widest font-bold"
                   style={{ color: "#8a8a8a" }}>
                {auth.isAdmin ? "👑 Administrador" : "Visitante"}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "#c4c4c4" }}>
                {email}
              </div>
            </div>
            <button
              onClick={async () => {
                setAbrindoMenu(false);
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
        </>
      )}
    </div>
  );
}
