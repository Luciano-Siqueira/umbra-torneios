// Símbolo oficial (marca/umbra-identidade.html), versão com acento em ouro antigo.
// O crescente é um desenho vazado, para funcionar sobre o banner.
const CRESCENTE = "M98 13.26A26 26 0 1 0 98 62.74A26 26 0 0 1 98 13.26Z";

export function SimboloUmbra({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="59 12 52 52" role="img" aria-label="Umbra">
      <path d={CRESCENTE} fill="#c9a648" />
    </svg>
  );
}
