import { useEffect, useRef, useState } from "react";
import { SimboloUmbra } from "./LogoUmbra";

const CLIQUES_PARA_ABRIR = 10;
const PAUSA_MAXIMA_MS = 1500; // parou de clicar por mais que isso, a contagem recomeça

// A imagem fica em public/. Tenta os formatos mais comuns antes de mostrar só o texto
const IMAGENS = ["segredo.webp", "segredo.jpg", "segredo.png"];

// Easter egg: 10 cliques seguidos no símbolo Umbra abrem a tela do Palmeiras
export function SegredoUmbra({ tamanho = 26 }: { tamanho?: number }) {
  const [aberto, setAberto] = useState(false);
  const cliques = useRef({ total: 0, ultimo: 0 });

  const clicar = () => {
    const agora = Date.now();
    const c = cliques.current;
    c.total = agora - c.ultimo > PAUSA_MAXIMA_MS ? 1 : c.total + 1;
    c.ultimo = agora;
    if (c.total >= CLIQUES_PARA_ABRIR) {
      c.total = 0;
      setAberto(true);
    }
  };

  return (
    <>
      <span className="flex items-center select-none" onClick={clicar}>
        <SimboloUmbra tamanho={tamanho} />
      </span>
      {aberto && <TelaSegredo onFechar={() => setAberto(false)} />}
    </>
  );
}

function TelaSegredo({ onFechar }: { onFechar: () => void }) {
  const [imagem, setImagem] = useState(0);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Avanti, Palestra!"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6 cursor-pointer"
      style={{ background: "radial-gradient(circle at center, #0b8a4a 0%, #006437 55%, #003d22 100%)" }}
      onClick={onFechar}
    >
      {imagem < IMAGENS.length && (
        <img
          src={IMAGENS[imagem]}
          alt="Palmeiras"
          onError={() => setImagem((i) => i + 1)}
          className="max-w-[min(90vw,520px)] max-h-[70vh] object-contain drop-shadow-2xl"
        />
      )}
      <div className="text-center text-white">
        <div className="text-4xl md:text-6xl font-black tracking-wide">AVANTI, PALESTRA!</div>
        <div className="text-sm mt-3 opacity-80">Toque em qualquer lugar para voltar</div>
      </div>
    </div>
  );
}
