import { useState } from "react";
import { entrar } from "../core/auth";

interface Props {
  aberta: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
}

export function TelaLogin({ aberta, onFechar, onSucesso }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  if (!aberta) return null;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
      setEmail(""); setSenha("");
      onFechar();
      onSucesso?.();
    } catch (e: any) {
      setErro(e.message || "Erro ao entrar");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(201,166,72,0.3)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.3em] mb-3"
            style={{ background: "rgba(201,166,72,0.1)", color: "#c9a648", border: "1px solid rgba(201,166,72,0.3)" }}
          >
            ADMIN LOGIN
          </div>
          <h2 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Entrar</h2>
          <p className="text-xs mt-1" style={{ color: "#8a8a8a" }}>Apenas para administradores</p>
        </div>

        <form onSubmit={submeter} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold tracking-widest uppercase block mb-1.5"
                   style={{ color: "#8a8a8a" }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg outline-none transition"
              style={{
                background: "#0a0a0a",
                border: "1px solid #2a2a2a",
                color: "#f5f5f5",
              }}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold tracking-widest uppercase block mb-1.5"
                   style={{ color: "#8a8a8a" }}>SENHA</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg outline-none transition"
              style={{
                background: "#0a0a0a",
                border: "1px solid #2a2a2a",
                color: "#f5f5f5",
              }}
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <div
              className="text-xs p-2.5 rounded-lg"
              style={{ background: "rgba(139,0,0,0.15)", border: "1px solid rgba(139,0,0,0.3)", color: "#f87171" }}
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-2.5 rounded-lg font-bold text-sm tracking-wider transition active:scale-95"
            style={{
              background: carregando ? "#3a3a3a" : "linear-gradient(135deg, #c9a648, #8b0000)",
              color: "#fff",
              boxShadow: carregando ? "none" : "0 4px 16px -4px rgba(201,166,72,0.5)",
            }}
          >
            {carregando ? "ENTRANDO..." : "ENTRAR"}
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="w-full py-2 text-xs transition hover:text-white"
            style={{ color: "#8a8a8a" }}
          >
            Cancelar — continuar como visitante
          </button>
        </form>
      </div>
    </div>
  );
}
