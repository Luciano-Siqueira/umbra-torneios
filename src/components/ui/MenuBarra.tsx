import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

// Menu suspenso da barra superior. Fecha ao escolher um item, ao clicar fora ou com Esc.
export function MenuBarra({ icone, rotulo, children }: { icone?: ReactNode; rotulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotulo}
        title={rotulo}
        className="rounded-full p-2 2xl:px-4 2xl:py-2 font-medium text-sm transition hover:bg-white/5 active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
        style={{ color: "var(--text-strong)" }}
        onClick={() => setAberto((v) => !v)}
      >
        {icone}
        {/* No celular fica só o ícone */}
        {/* Texto só em tela bem larga: nas médias o ícone basta e sobra espaço na barra */}
        <span className="hidden 2xl:inline">{rotulo}</span>
        <span className="hidden 2xl:inline text-xs opacity-60">▾</span>
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 md:right-auto md:left-0 mt-1 bg-bg-card border border-bg-cardalt rounded-lg shadow-2xl z-40 min-w-full w-max max-w-[calc(100vw-2rem)] overflow-hidden"
          onClick={() => setAberto(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function ItemMenu({ perigo, className = "", style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { perigo?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`block w-full text-left px-3 py-2 text-sm transition hover:bg-bg-panel disabled:opacity-40 ${className}`}
      style={perigo ? { color: "var(--critical)", ...style } : style}
      {...props}
    />
  );
}

export function TituloMenu({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-2)" }}>
      {children}
    </div>
  );
}
