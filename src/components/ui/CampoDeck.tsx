import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { sugerirDecks, type SugestaoDeck } from "../../core/decks";

interface Props {
  valor: string;
  onMudar: (valor: string) => void;
  onEscolher?: (nome: string) => void;
  onEnter?: () => void;
  onSair?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Busca entre os decks lançados, mas aceita qualquer texto: o jogador pode ter um deck próprio.
// A lista fica fora da tabela (portal) para a rolagem dela não cortar as sugestões.
export function CampoDeck({ valor, onMudar, onEscolher, onEnter, onSair, placeholder, disabled, className, style }: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoDeck[]>([]);
  const [ativa, setAtiva] = useState(-1); // Nada destacado: Enter mantém o texto digitado
  const campo = useRef<HTMLInputElement>(null);
  const aberta = sugestoes.length > 0;

  useEffect(() => {
    if (!aberta) return;
    const fechar = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest("[data-sugestoes-deck]"))) setSugestoes([]);
    };
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberta]);

  const escolher = (s: SugestaoDeck) => {
    onMudar(s.nome);
    setSugestoes([]);
    onEscolher?.(s.nome);
  };

  const r = aberta ? campo.current?.getBoundingClientRect() : undefined;

  return (
    <>
      <input
        ref={campo}
        role="combobox"
        aria-expanded={aberta}
        aria-autocomplete="list"
        autoComplete="off"
        type="text"
        className={className}
        style={style}
        value={valor}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onMudar(e.target.value);
          setSugestoes(sugerirDecks(e.target.value));
          setAtiva(-1);
        }}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && aberta) {
            e.preventDefault();
            const passo = e.key === "ArrowDown" ? 1 : -1;
            setAtiva((i) => (i === -1 && passo === -1 ? sugestoes.length - 1 : (i + passo + sugestoes.length) % sugestoes.length));
          }
          if (e.key === "Enter") {
            if (aberta && ativa >= 0) escolher(sugestoes[ativa]);
            else {
              setSugestoes([]);
              onEnter?.();
            }
          }
          if (e.key === "Escape") setSugestoes([]);
        }}
        onBlur={() => {
          setSugestoes([]);
          onSair?.();
        }}
      />
      {r && createPortal(
        <div
          data-sugestoes-deck
          role="listbox"
          className="fixed bg-bg-card border border-bg-cardalt rounded-lg shadow-2xl z-[70] max-h-64 overflow-y-auto"
          style={{ top: r.bottom + 4, left: r.left, width: Math.max(r.width, Math.min(320, window.innerWidth - r.left - 16)) }}
        >
          {sugestoes.map((s, i) => (
            <button
              key={`${s.nome}|${s.comandantes}`}
              type="button"
              role="option"
              aria-selected={i === ativa}
              ref={i === ativa ? (el) => el?.scrollIntoView?.({ block: "nearest" }) : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(s);
              }}
              className={`block w-full text-left px-3 py-2 hover:bg-bg-panel ${i === ativa ? "bg-acento/25" : ""}`}
            >
              <span className={`block text-sm ${i === ativa ? "text-acento font-semibold" : ""}`}>{s.nome}</span>
              <span className="block text-xs" style={{ color: "var(--text-2)" }}>
                {s.comandantes} · {s.colecoes.join(", ")}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
