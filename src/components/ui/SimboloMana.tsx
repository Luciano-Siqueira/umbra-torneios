import branca from "mana-font/svg/w.svg";
import azul from "mana-font/svg/u.svg";
import preta from "mana-font/svg/b.svg";
import vermelha from "mana-font/svg/r.svg";
import verde from "mana-font/svg/g.svg";
import incolor from "mana-font/svg/c.svg";

const MANA = {
  w: { icone: branca, fundo: "#f0f2c0" },
  u: { icone: azul, fundo: "#b5cde3" },
  b: { icone: preta, fundo: "#aca29a" },
  r: { icone: vermelha, fundo: "#db8664" },
  g: { icone: verde, fundo: "#93b483" },
  c: { icone: incolor, fundo: "#cac5c0" },
};

export type CorMana = keyof typeof MANA;

// Identidade de cor no formato "WUB"; texto vazio mostra o símbolo de incolor
export function CoresMana({ cores, tamanho = 16 }: { cores: string; tamanho?: number }) {
  const lista = (cores.toLowerCase() || "c").split("") as CorMana[];
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {lista.map((c) => <SimboloMana key={c} cor={c} tamanho={tamanho} />)}
    </span>
  );
}

export function SimboloMana({ cor, tamanho = 32 }: { cor: CorMana; tamanho?: number }) {
  const { icone, fundo } = MANA[cor];
  const mascara = `url("${icone}") center / contain no-repeat`;

  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-full"
      style={{
        width: tamanho,
        height: tamanho,
        background: fundo,
        boxShadow: "-1px 1px 0 rgba(0,0,0,0.85)",
      }}
    >
      <span
        style={{
          width: tamanho * 0.72,
          height: tamanho * 0.72,
          background: "#141414",
          WebkitMask: mascara,
          mask: mascara,
        }}
      />
    </span>
  );
}
