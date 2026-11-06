import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

interface Carta {
  nome: string;
  imagem: string | null;
}

interface Estado {
  carta: Carta;
  x: number;
  y: number;
  fixo: boolean; // aberta por toque ou teclado: fica até fechar
}

const LARGURA = 244;
const ALTURA = 340;
const MARGEM = 8;

// Imagem da carta ao passar o mouse. No celular, que não tem mouse, abre ao tocar.
export function usePrevisaoDeCarta() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const ultimoPonteiro = useRef("mouse");

  useEffect(() => {
    if (!estado?.fixo) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setEstado(null); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estado?.fixo]);

  const eventos = (carta: Carta): HTMLAttributes<HTMLElement> => {
    if (!carta.imagem) return {};
    const fixar = () => setEstado((s) => (s?.fixo && s.carta === carta ? null : { carta, x: 0, y: 0, fixo: true }));
    return {
      role: "button",
      tabIndex: 0,
      "aria-label": `Ver a carta ${carta.nome}`,
      style: { cursor: "zoom-in" },
      onPointerDown: (e) => { ultimoPonteiro.current = e.pointerType; },
      onPointerEnter: (e) => {
        if (e.pointerType === "mouse") setEstado((s) => (s?.fixo ? s : { carta, x: e.clientX, y: e.clientY, fixo: false }));
      },
      onPointerMove: (e) => {
        if (e.pointerType !== "mouse") return;
        setEstado((s) => (s && !s.fixo && s.carta === carta ? { ...s, x: e.clientX, y: e.clientY } : s));
      },
      onPointerLeave: (e) => {
        if (e.pointerType === "mouse") setEstado((s) => (s?.fixo ? s : null));
      },
      onClick: () => { if (ultimoPonteiro.current !== "mouse") fixar(); },
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fixar();
        }
      },
    };
  };

  let elemento = null;
  if (estado?.carta.imagem) {
    const imagem = (
      <img
        src={estado.carta.imagem}
        alt={estado.carta.nome}
        onError={() => setEstado(null)}
        className="rounded-xl w-full h-full object-cover"
        style={{ background: "var(--ds-surface-2)", boxShadow: "0 18px 50px -10px rgba(0,0,0,0.85)" }}
      />
    );
    if (estado.fixo) {
      elemento = (
        <div
          role="dialog"
          aria-label={estado.carta.nome}
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setEstado(null)}
        >
          <div style={{ width: `min(320px, 80vw)`, aspectRatio: "488 / 680" }}>{imagem}</div>
        </div>
      );
    } else {
      // Ao lado do cursor, trocando de lado perto das bordas
      const esquerda = estado.x + 20 + LARGURA > window.innerWidth - MARGEM ? estado.x - 20 - LARGURA : estado.x + 20;
      const topo = Math.min(Math.max(estado.y - ALTURA / 2, MARGEM), window.innerHeight - ALTURA - MARGEM);
      elemento = (
        <div
          className="fixed z-[80] pointer-events-none"
          style={{ left: Math.max(esquerda, MARGEM), top: Math.max(topo, MARGEM), width: LARGURA, height: ALTURA }}
        >
          {imagem}
        </div>
      );
    }
  }

  return { eventos, previsao: elemento && createPortal(elemento, document.body) };
}
