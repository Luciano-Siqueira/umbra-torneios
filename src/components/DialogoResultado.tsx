import { useMemo, useState } from "react";
import type { Mesa } from "../core/types";
import { useStore } from "../core/store";
import { useToast } from "./ui/Toast";
import { confirmar } from "./ui/Confirm";

interface Props {
  mesa: Mesa;
  mesaIdx: number;
  jogadoresPorId: Map<number, string>;
  onFechar: () => void;
}

// Sistema idêntico ao Python:
// - Usuário marca eliminados via checkbox e clica "Registrar eliminação" → vira um grupo.
// - Último restante é campeão automático.
// - "Empate por tempo" agrupa 2+ jogadores para dividir o topo.
export function DialogoResultado({ mesa, mesaIdx, jogadoresPorId, onFechar }: Props) {
  const finalizarMesa = useStore((s) => s.finalizarMesa);
  const salvarParcialMesa = useStore((s) => s.salvarParcialMesa);
  const editarMesa = useStore((s) => s.editarMesa);
  const { toast } = useToast();

  const editando = mesa.finalizada;

  const ids0 = useMemo(() => [...mesa.jogadoresIds], [mesa]);
  // Estado inicial: hidrata dos dados salvos (mesa finalizada ou resultado parcial)
  const [grupos, setGrupos] = useState<number[][]>(() => {
    // reverte a ordem armazenada (last-to-first eliminados) para first-to-last
    // Python armazena eliminacoes na ordem: primeiro grupo = primeiros a saírem (última posição).
    // Como salvamos igual, apenas cópia direta.
    return mesa.eliminacoes.map((g) => [...g]);
  });
  const [empateTopo, setEmpateTopo] = useState<number[]>(() => [...mesa.empateTopoIds]);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  const alocados = new Set<number>();
  grupos.forEach((g) => g.forEach((id) => alocados.add(id)));
  empateTopo.forEach((id) => alocados.add(id));
  const restantes = ids0.filter((id) => !alocados.has(id));

  const campeaoAuto = empateTopo.length === 0 && restantes.length === 1 ? restantes[0] : null;
  const eliminaveis = restantes.filter((id) => id !== campeaoAuto);

  const toggleMarca = (id: number) => {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const registrarEliminacao = () => {
    const sel = eliminaveis.filter((id) => marcados.has(id));
    if (sel.length === 0) return toast("Marque ao menos um jogador", "aviso");
    if (sel.length === eliminaveis.length && !campeaoAuto) {
      return toast("Não é possível eliminar todos — precisa sobrar 1 campeão", "aviso");
    }
    setGrupos([...grupos, sel]);
    setMarcados(new Set());
  };

  const marcarEmpateTopo = () => {
    const sel = eliminaveis.filter((id) => marcados.has(id));
    const candidatos = [...sel];
    if (campeaoAuto !== null) candidatos.push(campeaoAuto);
    if (candidatos.length < 2) {
      return toast("Marque pelo menos 2 jogadores empatados no topo", "aviso");
    }
    setEmpateTopo(candidatos);
    setMarcados(new Set());
  };

  const reiniciar = () => {
    setGrupos([]);
    setEmpateTopo([]);
    setMarcados(new Set());
  };

  const confirmarResultado = async () => {
    if (empateTopo.length && restantes.length > 0) {
      return toast("Com empate por tempo, todos precisam estar em algum grupo", "aviso");
    }
    if (!empateTopo.length && restantes.length !== 1) {
      return toast("Deve restar exatamente 1 vencedor (ou use empate)", "aviso");
    }
    if (editando) {
      const ok = await confirmar({
        titulo: "Editar resultado",
        mensagem: "Isso vai recalcular pontos e estatísticas. Continuar?",
      });
      if (!ok) return;
      editarMesa(mesaIdx);
    }
    finalizarMesa(mesaIdx, grupos, empateTopo);
    toast(editando ? "Resultado atualizado" : "Mesa finalizada", "sucesso");
    onFechar();
  };

  const salvarParcial = () => {
    salvarParcialMesa(mesaIdx, grupos, empateTopo);
    toast(`Mesa ${mesa.numero}: resultado parcial salvo`, "sucesso");
    onFechar();
  };

  // Log da sequência (idêntico ao Python)
  const total = ids0.length;
  const linhasLog: { texto: string; destaque?: boolean }[] = [];
  let col = total;
  let ultimaColGrupo: number | null = null;
  for (const g of grupos) {
    const nomes = g.map((id) => jogadoresPorId.get(id) ?? "?").join(", ");
    linhasLog.push({ texto: `${col}º lugar: ${nomes}` });
    ultimaColGrupo = col;
    col -= g.length;
  }
  if (campeaoAuto !== null && !empateTopo.length) {
    linhasLog.push({
      texto: `1º lugar (campeão): ${jogadoresPorId.get(campeaoAuto)}`,
      destaque: true,
    });
  } else if (empateTopo.length) {
    const colEmp = ultimaColGrupo !== null ? ultimaColGrupo - 1 : total;
    const nomes = empateTopo.map((id) => jogadoresPorId.get(id) ?? "?").join(", ");
    linhasLog.push({
      texto: `${colEmp}º lugar (empate por tempo): ${nomes}`,
      destaque: true,
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-fg-dim text-center">
        Marque quem foi eliminado e clique em <b>Registrar eliminação</b>.
        <br />Se marcar 2+ juntos, ficam empatados na mesma posição.
        <br />O último restante é o campeão (aparece destacado).
      </div>

      {/* Campeão automático */}
      {campeaoAuto !== null && (
        <div className="bg-atencao/15 border-2 border-atencao rounded-lg p-3">
          <div className="text-xs text-atencao font-bold tracking-wider">♛ CAMPEÃO</div>
          <div className="text-xl font-black">{jogadoresPorId.get(campeaoAuto)}</div>
        </div>
      )}

      {/* Checkboxes dos eliminados */}
      <div className="card-alt">
        <div className="label mb-2">Jogadores para eliminar</div>
        {eliminaveis.length === 0 ? (
          <div className="text-fg-dim text-sm text-center py-2">
            Todos os elimináveis já foram registrados.
          </div>
        ) : (
          <div className="space-y-1">
            {eliminaveis.map((id) => (
              <label
                key={id}
                className="flex items-center gap-3 p-2 hover:bg-bg-cardalt/60 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={marcados.has(id)}
                  onChange={() => toggleMarca(id)}
                  className="w-4 h-4"
                />
                <span className="flex-1">{jogadoresPorId.get(id) ?? "?"}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-2">
        <button className="btn-info flex-1 min-w-[150px]" onClick={registrarEliminacao}>
          Registrar eliminação
        </button>
        <button className="btn-warning" onClick={marcarEmpateTopo}>
          Empate (tempo)
        </button>
        <button className="btn-danger" onClick={reiniciar}>Reiniciar</button>
      </div>

      {/* Log da sequência */}
      <div className="card-alt">
        <div className="label mb-2">Sequência registrada</div>
        {linhasLog.length === 0 ? (
          <div className="text-fg-muted text-sm">Nenhuma eliminação registrada</div>
        ) : (
          <div className="font-mono text-sm space-y-1">
            {linhasLog.map((l, i) => (
              <div key={i} className={l.destaque ? "text-atencao font-bold" : "text-fg"}>
                {l.texto}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-bg-cardalt">
        <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
        {!editando && (
          <button
            className="btn-info"
            onClick={salvarParcial}
            title="Guarda quem já saiu. A mesa continua em andamento e os pontos só contam ao confirmar."
          >
            Salvar parcial
          </button>
        )}
        <button className="btn-success" onClick={confirmarResultado}>
          {editando ? "Salvar alterações" : "Confirmar resultado"}
        </button>
      </div>
    </div>
  );
}
