import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import type { FichaDaCarta } from "../../core/fichaDaCarta";
import { FichaCarta } from "./FichaCarta";

// reserva: endereço tentado se o primeiro falhar
export interface ImagemDaCarta {
  src: string;
  reserva?: string;
}

export interface CartaVisivel {
  nome: string;
  imagens: ImagemDaCarta[]; // duas para decks com dois comandantes
  ficha?: FichaDaCarta; // mostrada ao lado da imagem quando a carta é aberta por clique
}

interface Estado {
  carta: CartaVisivel;
  x: number;
  y: number;
  fixo: boolean; // aberta por clique, toque ou teclado: fica até fechar
}

const LARGURA = 244;
const ALTURA = 340;
const ESPACO = 8;
const MARGEM = 8;
// Evita baixar imagens só por o mouse cruzar a lista
const ATRASO_MS = 150;

function Imagem({ imagem, nome, onFalha }: { imagem: ImagemDaCarta; nome: string; onFalha: () => void }) {
  const [src, setSrc] = useState(imagem.src);
  useEffect(() => setSrc(imagem.src), [imagem.src]);
  return (
    <img
      src={src}
      alt={nome}
      onError={() => (imagem.reserva && src !== imagem.reserva ? setSrc(imagem.reserva) : onFalha())}
      className="rounded-xl w-full h-full object-cover"
      style={{ background: "var(--ds-surface-2)", boxShadow: "0 18px 50px -10px rgba(0,0,0,0.85)" }}
    />
  );
}

// Imagem da carta ao passar o mouse e, ao clicar ou tocar, em destaque no meio da tela.
// apenasPassarMouse: para linhas cujo clique já faz outra coisa, como abrir o deck.
// apenasClique: para imagens grandes, em que mostrar a mesma imagem ao passar o mouse não ajuda.
export function usePrevisaoDeCarta() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarEspera = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };
  useEffect(() => cancelarEspera, []);

  useEffect(() => {
    if (!estado?.fixo) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setEstado(null); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estado?.fixo]);

  const eventos = (carta: CartaVisivel, opcoes: { apenasPassarMouse?: boolean; apenasClique?: boolean } = {}): HTMLAttributes<HTMLElement> => {
    if (carta.imagens.length === 0) return {};
    const mesma = (s: Estado | null) => s?.carta.nome === carta.nome;
    const fixar = () => {
      cancelarEspera();
      setEstado((s) => (s?.fixo && mesma(s) ? null : { carta, x: 0, y: 0, fixo: true }));
    };
    const passarMouse: HTMLAttributes<HTMLElement> = {
      onPointerEnter: (e) => {
        if (e.pointerType !== "mouse") return;
        const { clientX: x, clientY: y } = e;
        cancelarEspera();
        espera.current = setTimeout(() => {
          setEstado((s) => (s?.fixo ? s : { carta, x, y, fixo: false }));
        }, ATRASO_MS);
      },
      onPointerMove: (e) => {
        if (e.pointerType !== "mouse") return;
        const { clientX: x, clientY: y } = e;
        setEstado((s) => (s && !s.fixo && mesma(s) ? { ...s, x, y } : s));
      },
      onPointerLeave: (e) => {
        if (e.pointerType !== "mouse") return;
        cancelarEspera();
        setEstado((s) => (s?.fixo ? s : null));
      },
    };
    if (opcoes.apenasPassarMouse) return passarMouse;
    return {
      ...(opcoes.apenasClique ? {} : passarMouse),
      role: "button",
      tabIndex: 0,
      "aria-label": `Ver a carta ${carta.nome}`,
      style: { cursor: "zoom-in" },
      onClick: fixar,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fixar();
        }
      },
    };
  };

  let elemento = null;
  if (estado) {
    const { carta } = estado;
    const fechar = () => setEstado(null);
    const imagens = carta.imagens.map((imagem, i) => (
      <Imagem key={`${carta.nome}|${i}`} imagem={imagem} nome={carta.nome} onFalha={fechar} />
    ));
    if (estado.fixo) {
      elemento = (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={carta.nome}
          className="fixed inset-0 z-[80] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={fechar}
        >
          {/* No celular, a ficha fica embaixo da imagem e a tela rola */}
          <div className="min-h-full flex flex-col md:flex-row items-center justify-center gap-4 p-6">
            <div className="flex gap-4 flex-wrap justify-center">
              {imagens.map((img, i) => (
                <div
                  key={i}
                  style={{
                    width: carta.ficha ? `min(300px, ${70 / imagens.length}vw)` : `min(320px, ${80 / imagens.length}vw)`,
                    aspectRatio: "488 / 680",
                  }}
                >
                  {img}
                </div>
              ))}
            </div>
            {carta.ficha && <FichaCarta ficha={carta.ficha} />}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed top-3 right-3 w-10 h-10 rounded-full text-xl flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", color: "var(--text-strong)", border: "1px solid var(--line)" }}
            onClick={fechar}
          >
            ×
          </button>
        </div>
      );
    } else {
      // Ao lado do cursor, trocando de lado perto das bordas
      const largura = LARGURA * imagens.length + ESPACO * (imagens.length - 1);
      const esquerda = estado.x + 20 + largura > window.innerWidth - MARGEM ? estado.x - 20 - largura : estado.x + 20;
      const topo = Math.min(Math.max(estado.y - ALTURA / 2, MARGEM), window.innerHeight - ALTURA - MARGEM);
      elemento = (
        <div
          className="fixed z-[80] pointer-events-none flex"
          style={{ left: Math.max(esquerda, MARGEM), top: Math.max(topo, MARGEM), gap: ESPACO }}
        >
          {imagens.map((img, i) => <div key={i} style={{ width: LARGURA, height: ALTURA }}>{img}</div>)}
        </div>
      );
    }
  }

  return { eventos, previsao: elemento && createPortal(elemento, document.body) };
}
