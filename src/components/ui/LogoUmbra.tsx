// Símbolo oficial (marca/umbra-identidade.html), versão com acento em ouro antigo.
// O crescente é um desenho vazado, para funcionar sobre o banner.
const CRESCENTE = "M98 13.26A26 26 0 1 0 98 62.74A26 26 0 0 1 98 13.26Z";

// Duas cartas em contorno, com o crescente da marca na da frente
export function IconeDecks({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="var(--brand-1)"
      strokeWidth="1.4"
      strokeLinejoin="round"
      className="inline-block align-[-0.12em] flex-shrink-0"
    >
      <rect x="9.2" y="2.6" width="11" height="15.5" rx="2" transform="rotate(12 14.7 10.35)" opacity="0.5" />
      <rect x="3.6" y="5.2" width="11.4" height="16.2" rx="2" fill="var(--page-1)" />
      <path
        d={CRESCENTE}
        fill="var(--brand-1)"
        stroke="none"
        transform="translate(9.3 13.3) scale(0.2) translate(-78.5 -38)"
      />
    </svg>
  );
}

export function SimboloUmbra({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="59 12 52 52" role="img" aria-label="Umbra">
      <path d={CRESCENTE} fill="#c9a648" />
    </svg>
  );
}
