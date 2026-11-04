import { useState } from "react";
import { useStore } from "../core/store";
import { useToast } from "./ui/Toast";
import type { Torneio } from "../core/types";

interface Props {
  torneioExistente: Torneio | null;
  onFechar: () => void;
}

export function DialogoTorneio({ torneioExistente, onFechar }: Props) {
  const criarTorneio = useStore((s) => s.criarTorneio);
  const editarTorneio = useStore((s) => s.editarTorneio);
  const { toast } = useToast();

  const [nome, setNome] = useState(torneioExistente?.nome ?? "");
  const [taxa, setTaxa] = useState(String(torneioExistente?.taxaInscricao ?? 0));
  const [rodadas, setRodadas] = useState(String(torneioExistente?.qtdRodadas ?? 3));
  const [tempoMin, setTempoMin] = useState(String(torneioExistente?.tempoRodadaMin ?? 75));
  const [tempoExtra, setTempoExtra] = useState(String(torneioExistente?.tempoExtraMin ?? 15));

  const salvar = () => {
    const nomeT = nome.trim();
    if (!nomeT) return toast("Informe um nome", "aviso");
    const taxaN = parseFloat(taxa) || 0;
    const rodN = parseInt(rodadas) || 0;
    const tempN = parseInt(tempoMin) || 0;
    const tempEx = parseInt(tempoExtra) || 0;
    if (rodN < 1) return toast("Rodadas deve ser >= 1", "aviso");
    if (tempN < 1) return toast("Tempo por rodada deve ser >= 1", "aviso");

    if (torneioExistente) {
      editarTorneio(torneioExistente.id, {
        nome: nomeT,
        taxaInscricao: taxaN,
        qtdRodadas: rodN,
        tempoRodadaMin: tempN,
        tempoExtraMin: tempEx,
      });
      toast("Torneio atualizado", "sucesso");
    } else {
      criarTorneio(nomeT, taxaN, rodN, tempN, tempEx);
      toast("Torneio criado", "sucesso");
    }
    onFechar();
  };

  return (
    <div className="space-y-4">
      <Field label="Nome do torneio">
        <input
          className="input w-full"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          placeholder="Ex.: Torneio Fev/26"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Taxa de inscrição (R$)">
          <input
            className="input w-full"
            type="number" min="0" step="1"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
          />
        </Field>
        <Field label="Quantidade de rodadas">
          <input
            className="input w-full"
            type="number" min="1" step="1"
            value={rodadas}
            onChange={(e) => setRodadas(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tempo normal (min)">
          <input
            className="input w-full"
            type="number" min="1" step="1"
            value={tempoMin}
            onChange={(e) => setTempoMin(e.target.value)}
          />
        </Field>
        <Field label="Tempo extra (min)">
          <input
            className="input w-full"
            type="number" min="0" step="1"
            value={tempoExtra}
            onChange={(e) => setTempoExtra(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-bg-cardalt">
        <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary" onClick={salvar}>
          {torneioExistente ? "Salvar" : "Criar"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}
