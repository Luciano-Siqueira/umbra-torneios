import { useState } from "react";
import { definirSenha } from "../core/auth";
import { Modal } from "./ui/Modal";

// Quem chega pelo link de convite ou de nova senha já está logado, mas precisa escolher a senha.
// Só fecha depois de salvar: sem isso, a pessoa não consegue entrar de novo.
export function DialogoCriarSenha({ email, onPronto }: { email: string; onPronto: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (senha.length < 6) return setErro("A senha precisa de pelo menos 6 caracteres.");
    if (senha !== confirma) return setErro("As duas senhas não são iguais.");
    setSalvando(true);
    setErro("");
    try {
      await definirSenha(senha);
      onPronto();
    } catch (e: any) {
      setErro(/different from the old/i.test(e?.message ?? "")
        ? "A senha nova precisa ser diferente da anterior."
        : e?.message || "Não foi possível salvar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open onClose={() => {}} title="🔑 Crie sua senha">
      <form
        className="space-y-4 text-sm"
        onSubmit={(e) => { e.preventDefault(); salvar(); }}
      >
        <p style={{ color: "var(--text-label)" }}>
          Escolha a senha da conta <b style={{ color: "var(--text-strong)" }}>{email}</b>. Você vai usá-la para entrar
          da próxima vez.
        </p>
        <label className="block">
          <span className="label block mb-1">Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            className="input w-full"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo 6 caracteres"
            disabled={salvando}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="label block mb-1">Confirmar senha</span>
          <input
            type="password"
            autoComplete="new-password"
            className="input w-full"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            disabled={salvando}
          />
        </label>
        {erro && <div role="alert" style={{ color: "var(--critical)" }}>{erro}</div>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar senha"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
