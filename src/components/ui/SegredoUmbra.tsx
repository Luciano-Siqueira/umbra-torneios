import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SimboloUmbra } from "./LogoUmbra";

const CLIQUES_PARA_ABRIR = 10;
const PAUSA_MAXIMA_MS = 1500; // parou de clicar por mais que isso, a contagem recomeça

// A imagem fica em public/. Tenta os formatos mais comuns antes de mostrar só o texto
const IMAGENS = ["segredo.jpg", "segredo.webp", "segredo.png"];

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
      {/* No body: a barra do menu tem backdrop-filter, que prenderia a janela fixa dentro dela */}
      {aberto && createPortal(<TelaSegredo onFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

function TelaSegredo({ onFechar }: { onFechar: () => void }) {
  const [imagem, setImagem] = useState(0);

  // O X já recebe o foco: Enter ou espaço também fecham pelo teclado
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => { fechar.current?.focus(); }, []);

  // Janela no meio da tela, com o resto embaçado em verde. Só o X fecha
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 100, 55, 0.45)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Avanti, Palestra!"
        className="relative w-full max-w-sm rounded-2xl p-6 pt-10 flex flex-col items-center gap-4 shadow-2xl"
        style={{ background: "radial-gradient(circle at center, #0b8a4a 0%, #006437 60%, #003d22 100%)" }}
      >
        <button
          ref={fechar}
          type="button"
          aria-label="Fechar"
          onClick={onFechar}
          className="absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center text-2xl leading-none text-white hover:bg-white/15 transition"
        >×</button>
        {imagem < IMAGENS.length && (
          <img
            src={IMAGENS[imagem]}
            alt="Palmeiras"
            onError={() => setImagem((i) => i + 1)}
            className="max-w-full max-h-[50vh] object-contain drop-shadow-2xl"
          />
        )}
        <div className="text-3xl font-black tracking-wide text-white text-center">AVANTI, PALESTRA!</div>
      </div>
    </div>
  );
}
