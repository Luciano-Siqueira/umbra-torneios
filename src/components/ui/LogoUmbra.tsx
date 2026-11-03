// Logo oficial (marca/umbra-identidade.html), versão com acento em ouro antigo.
// O crescente é um desenho vazado, para funcionar sobre o banner.
const CRESCENTE = "M98 13.26A26 26 0 1 0 98 62.74A26 26 0 0 1 98 13.26Z";

export function SimboloUmbra({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="59 12 52 52" role="img" aria-label="Umbra">
      <path d={CRESCENTE} fill="#c9a648" />
    </svg>
  );
}

export function LogoUmbra({ largura = 200 }: { largura?: number }) {
  return (
    <svg width={largura} viewBox="60 8 236 64" role="img" aria-label="Umbra: In umbra veritas">
      <path d={CRESCENTE} fill="#c9a648" />
      <text
        x="207" y="53" textAnchor="middle" fill="#f5f5f5"
        fontFamily="Inter,sans-serif" fontSize="42" fontWeight="700" letterSpacing="3"
      >UMBRA</text>
      <text
        x="207" y="68" textAnchor="middle" fill="#c9a648"
        fontFamily="Inter,sans-serif" fontSize="10" fontWeight="400" letterSpacing="3"
      >IN UMBRA VERITAS</text>
    </svg>
  );
}
