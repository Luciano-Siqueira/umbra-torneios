import { useState } from "react";
import { excluirMinhaConta } from "../core/auth";
import { Modal } from "./ui/Modal";

// Exigido pela Google Play: quem cria conta precisa conseguir apagá-la pelo próprio app
export function DialogoExcluirConta({ aberto, email, onFechar, onExcluida }: {
  aberto: boolean;
  email: string;
  onFechar: () => void;
  onExcluida: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const fechar = () => {
    if (excluindo) return;
    setSenha("");
    setErro("");
    onFechar();
  };

  const excluir = async () => {
    if (!senha) return setErro("Digite sua senha para confirmar.");
    setExcluindo(true);
    setErro("");
    try {
      await excluirMinhaConta(senha);
      setSenha("");
      onExcluida();
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      // Função ainda não criada no banco: mensagem do Supabase em inglês não ajuda quem usa o app
      setErro(/could not find the function/i.test(msg)
        ? "A exclusão de conta ainda não está disponível. Avise um administrador."
        : msg || "Não foi possível excluir a conta.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Modal open={aberto} onClose={fechar} title="Excluir minha conta">
      <div className="space-y-4 text-sm">
        <p style={{ color: "var(--text-label)" }}>
          Isso apaga de vez o login <b style={{ color: "var(--text-strong)" }}>{email}</b>, os nomes de jogador
          vinculados a ele e os acessos de organizador ou admin. Não dá para desfazer.
        </p>
        <p style={{ color: "var(--text-2)" }}>
          Os torneios continuam, porque têm os resultados dos outros jogadores. Seu nome segue nas
          classificações em que você jogou.
        </p>
        <label className="block">
          <span className="label block mb-1">Sua senha</span>
          <input
            type="password"
            autoComplete="current-password"
            className="input w-full"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") excluir(); }}
            disabled={excluindo}
          />
        </label>
        {erro && <div role="alert" style={{ color: "var(--critical)" }}>{erro}</div>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={fechar} disabled={excluindo}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Excluir conta"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
