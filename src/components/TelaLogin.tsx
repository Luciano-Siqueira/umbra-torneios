import { useState } from "react";
import { entrar, registrar } from "../core/auth";

interface Props {
  aberta: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
}

type Modo = "login" | "signup";

export function TelaLogin({ aberta, onFechar, onSucesso }: Props) {
  const [modo, setModo] = useState<Modo>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  if (!aberta) return null;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      if (modo === "signup") {
        if (senha.length < 6) throw new Error("Senha precisa ter pelo menos 6 caracteres");
        if (senha !== confirmaSenha) throw new Error("As senhas não coincidem");
        await registrar(email.trim(), senha);
        // Após registro, loga automaticamente
        try { await entrar(email.trim(), senha); } catch {}
      } else {
        await entrar(email.trim(), senha);
      }
      setEmail(""); setSenha(""); setConfirmaSenha("");
      onFechar();
      onSucesso?.();
    } catch (e: any) {
      setErro(e.message || "Erro");
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
        {/* Abas */}
        <div className="flex gap-2 mb-6 p-1 rounded-lg" style={{ background: "#0a0a0a" }}>
          <button
            type="button"
            onClick={() => { setModo("login"); setErro(""); }}
            className="flex-1 py-2 text-sm font-semibold rounded-md transition"
            style={{
              background: modo === "login" ? "linear-gradient(135deg, #c9a648, #8b0000)" : "transparent",
              color: modo === "login" ? "#fff" : "#8a8a8a",
            }}
          >Entrar</button>
          <button
            type="button"
            onClick={() => { setModo("signup"); setErro(""); }}
            className="flex-1 py-2 text-sm font-semibold rounded-md transition"
            style={{
              background: modo === "signup" ? "linear-gradient(135deg, #c9a648, #8b0000)" : "transparent",
              color: modo === "signup" ? "#fff" : "#8a8a8a",
            }}
          >Criar conta</button>
        </div>

        <div className="text-center mb-5">
          <h2 className="text-xl font-bold" style={{ color: "#f5f5f5" }}>
            {modo === "login" ? "Bem-vindo de volta" : "Nova conta de jogador"}
          </h2>
          <p className="text-xs mt-1" style={{ color: "#8a8a8a" }}>
            {modo === "login"
              ? "Entre para ver seus torneios"
              : "Crie uma conta grátis para acompanhar seus torneios"}
          </p>
        </div>

        <form onSubmit={submeter} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold tracking-widest uppercase block mb-1"
                   style={{ color: "#8a8a8a" }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg outline-none transition"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold tracking-widest uppercase block mb-1"
                   style={{ color: "#8a8a8a" }}>SENHA</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={modo === "signup" ? 6 : undefined}
              className="w-full px-3 py-2.5 rounded-lg outline-none transition"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
              placeholder={modo === "signup" ? "mínimo 6 caracteres" : "••••••••"}
            />
          </div>
          {modo === "signup" && (
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase block mb-1"
                     style={{ color: "#8a8a8a" }}>CONFIRMAR SENHA</label>
              <input
                type="password"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg outline-none transition"
                style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                placeholder="digite de novo"
              />
            </div>
          )}

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
            {carregando
              ? (modo === "login" ? "ENTRANDO..." : "CRIANDO...")
              : (modo === "login" ? "ENTRAR" : "CRIAR CONTA")}
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="w-full py-1 text-xs transition hover:text-white"
            style={{ color: "#8a8a8a" }}
          >Cancelar</button>
        </form>
      </div>
    </div>
  );
}
