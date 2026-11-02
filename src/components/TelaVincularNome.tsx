import { useEffect, useState } from "react";
import { vincularNome } from "../core/auth";
import * as storage from "../core/storage";
import { supabase } from "../core/supabaseClient";

interface Props {
  aberta: boolean;
  onConcluido: () => void;
}

export function TelaVincularNome({ aberta, onConcluido }: Props) {
  const [nome, setNome] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [nomesServidor, setNomesServidor] = useState<string[]>([]);

  // Carrega todos os nomes cadastrados (local + servidor)
  useEffect(() => {
    if (!aberta) return;
    (async () => {
      const { data } = await supabase.from("nomes_cadastrados").select("nome").order("nome");
      const nomesSrv = (data || []).map((r: any) => r.nome);
      const nomesLocal = storage.carregarNomes();
      const todos = Array.from(new Set([...nomesSrv, ...nomesLocal])).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      setNomesServidor(todos);
    })();
  }, [aberta]);

  if (!aberta) return null;

  const onDigitar = (v: string) => {
    setNome(v);
    setErro("");
    const q = v.trim().toLowerCase();
    if (q.length >= 1) {
      setSugestoes(
        nomesServidor.filter((n) => n.toLowerCase().includes(q)).slice(0, 8)
      );
    } else {
      setSugestoes([]);
    }
  };

  const salvar = async (nomeFinal?: string) => {
    const n = (nomeFinal ?? nome).trim();
    if (!n) {
      setErro("Digite um nome");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      await vincularNome(n);
      // Garante que o nome está também na base pública (pra autocomplete futuro)
      await supabase.from("nomes_cadastrados").upsert({ nome: n });
      onConcluido();
    } catch (e: any) {
      setErro(e.message || "Erro ao vincular");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(201,166,72,0.3)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">👤</div>
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.3em] mb-3"
            style={{ background: "rgba(201,166,72,0.1)", color: "#c9a648", border: "1px solid rgba(201,166,72,0.3)" }}
          >
            VINCULAR SEU PERFIL
          </div>
          <h2 className="text-xl font-bold" style={{ color: "#f5f5f5" }}>
            Qual seu nome nos torneios?
          </h2>
          <p className="text-xs mt-2" style={{ color: "#8a8a8a" }}>
            Precisamos saber como você aparece na lista de jogadores
            para liberar o acesso aos seus torneios.
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={nome}
              onChange={(e) => onDigitar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (sugestoes.length > 0 && !nomesServidor.includes(nome)) {
                    setNome(sugestoes[0]);
                    setSugestoes([]);
                  } else {
                    salvar();
                  }
                }
              }}
              autoFocus
              placeholder="Ex.: Luciano Siqueira"
              className="w-full px-3 py-3 rounded-lg outline-none transition text-base"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
            />
            {sugestoes.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-2xl z-20 max-h-48 overflow-y-auto"
                style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
              >
                {sugestoes.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNome(s);
                      setSugestoes([]);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition cursor-pointer"
                    style={{ color: i === 0 ? "#c9a648" : "#f5f5f5" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px]" style={{ color: "#6b6b6b" }}>
            💡 Digite devagar — se seu nome já aparece em algum torneio, vai ser sugerido.
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
            type="button"
            onClick={() => salvar()}
            disabled={carregando || !nome.trim()}
            className="w-full py-2.5 rounded-lg font-bold text-sm tracking-wider transition active:scale-95 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #c9a648, #8b0000)",
              color: "#fff",
              boxShadow: "0 4px 16px -4px rgba(201,166,72,0.5)",
            }}
          >
            {carregando ? "VINCULANDO..." : "VINCULAR E CONTINUAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
