import type { ReactNode } from "react";

// Ícones da marca: traço fino em ouro antigo, no lugar dos emojis da barra e dos títulos
interface Props {
  tamanho?: number;
  cor?: string;
}

function Base({ tamanho = 16, cor = "var(--brand-1)", children }: Props & { children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke={cor}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-[-0.15em] flex-shrink-0"
    >
      {children}
    </svg>
  );
}

const criar = (desenho: ReactNode) => (props: Props) => <Base {...props}>{desenho}</Base>;

export const IconeArena = criar(<path d="M3 21h18M5 21V10M19 21V10M3 10h18M4 6.5h16M4 6.5 12 3l8 3.5M9.5 21v-6.5a2.5 2.5 0 0 1 5 0V21M4 10V6.5M20 10V6.5" />);
export const IconeMesa = criar(<>
  <circle cx="12" cy="12" r="5" />
  <circle cx="12" cy="3.5" r="1.5" />
  <circle cx="12" cy="20.5" r="1.5" />
  <circle cx="3.5" cy="12" r="1.5" />
  <circle cx="20.5" cy="12" r="1.5" />
</>);
export const IconeMedalha = criar(<>
  <circle cx="12" cy="15" r="6" />
  <path d="M8.5 10 5 3h5l2 4 2-4h5l-3.5 7M12 12.5v5" />
</>);
export const IconeCifrao = criar(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M15 9.2c-.5-1-1.6-1.7-3-1.7-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.2 2.2-3 2.2-1.4 0-2.5-.7-3-1.7M12 6v12" />
</>);
export const IconeLapis = criar(<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19zM14.5 6l3.5 3.5" />);
export const IconeBaixar = criar(<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 20h16" />);
export const IconeLixeira = criar(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />);
export const IconeAnalytics = criar(<path d="M4 20h16M7 20v-7M12 20V5M17 20v-10" />);
export const IconeUsuarios = criar(<>
  <circle cx="9" cy="8" r="3.5" />
  <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
</>);
export const IconePessoa = criar(<>
  <circle cx="12" cy="8" r="4" />
  <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
</>);
export const IconeCoroa = criar(<path d="M4 19h16M4.5 15.5 3 7l5 3.5L12 4l4 6.5L21 7l-1.5 8.5z" />);
export const IconeAlvo = criar(<>
  <circle cx="12" cy="12" r="9" />
  <circle cx="12" cy="12" r="4.5" />
  <circle cx="12" cy="12" r="0.6" />
</>);
export const IconeTrofeu = criar(<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1.5A3.5 3.5 0 0 0 7.5 11M16 6h4v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v5M8 20h8" />);
export const IconePasta = criar(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const IconeDocumento = criar(<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />);
export const IconeCaixa = criar(<path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />);
export const IconeDado = criar(<>
  <rect x="4" y="4" width="16" height="16" rx="3" />
  <circle cx="9" cy="9" r="0.6" />
  <circle cx="15" cy="15" r="0.6" />
  <circle cx="12" cy="12" r="0.6" />
</>);
export const IconeCadeado = criar(<>
  <rect x="5" y="11" width="14" height="10" rx="2" />
  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
</>);
export const IconeRaio = criar(<path d="M13 3 5 14h6l-1 7 8-11h-6z" />);
export const IconeGota = criar(<path d="M12 3s6.5 6.5 6.5 11a6.5 6.5 0 0 1-13 0C5.5 9.5 12 3 12 3z" />);
export const IconeCombinacoes = criar(<>
  <circle cx="12" cy="8.5" r="5" />
  <circle cx="8" cy="15" r="5" />
  <circle cx="16" cy="15" r="5" />
</>);
export const IconeHistorico = criar(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 7v5l3.5 2" />
</>);
export const IconeGrafico = criar(<path d="M4 4v16h16M7.5 15l4-4.5 3 2.5 5-6" />);
export const IconeEspadas = criar(<path d="M4 4l11 11M20 4 9 15M6 13.5l4.5 4.5M18 13.5 13.5 18M7.5 16.5 4 20M16.5 16.5 20 20" />);
export const IconeGarra = criar(<>
  <circle cx="6.5" cy="11" r="1.8" />
  <circle cx="10" cy="6.5" r="1.8" />
  <circle cx="14.5" cy="6.5" r="1.8" />
  <circle cx="18" cy="11" r="1.8" />
  <path d="M12 11c-2.8 0-5 3.2-5 6 0 1.8 1.4 3 3 3 .8 0 1.4-.4 2-.4s1.2.4 2 .4c1.6 0 3-1.2 3-3 0-2.8-2.2-6-5-6z" />
</>);
export const IconeEstrela = criar(<path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />);
export const IconeEngrenagem = criar(<>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
</>);
export const IconeMontanha = criar(<path d="m2.5 20 6.5-12 4 7 2.5-3.5 6 8.5z" />);
export const IconeEspiral = criar(<path d="M12 12a1.5 1.5 0 1 1 1.5 1.5 3.5 3.5 0 1 1 3.5-3.5 6.5 6.5 0 1 1-6.5-6.5" />);
export const IconeMoeda = criar(<>
  <circle cx="12" cy="12" r="9" />
  <circle cx="12" cy="12" r="5" />
</>);

// Ações dos botões (tempo, mesas e sorteios). Em botão colorido, use cor="currentColor"
export const IconePlay = criar(<path d="M7 4.5v15l12-7.5z" />);
export const IconePausa = criar(<path d="M8 5v14M16 5v14" />);
export const IconeParar = criar(<rect x="6" y="6" width="12" height="12" rx="2" />);
export const IconeReiniciar = criar(<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5" />);
export const IconeEmbaralhar = criar(<path d="M16 3.5h4.5V8M3.5 20.5 20.5 3.5M20.5 16v4.5H16M14.5 14.5l6 6M3.5 3.5l5 5" />);
export const IconeSino = criar(<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9M10 20.5a2.2 2.2 0 0 0 4 0" />);
export const IconeCopiar = criar(<>
  <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
  <path d="M15 9V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9" />
</>);
export const IconeSeta = criar(<path d="M4.5 12h15M13.5 6l6 6-6 6" />);
export const IconeRoleta = criar(<>
  <circle cx="12" cy="12" r="8.5" />
  <circle cx="12" cy="12" r="2" />
  <path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5M6 6l4.6 4.6M13.4 13.4 18 18" />
</>);
export const IconePato = criar(<>
  <circle cx="15.5" cy="7.5" r="3" />
  <path d="M18.5 7.2h3l-2.6 1.8M13 10.3C12 11.4 10 12 8 11.6L3 10.5c0 5 3.3 9 8.5 9h2c3.4 0 6-2.4 6-5.4 0-1.6-.8-3-2-3.9" />
</>);
