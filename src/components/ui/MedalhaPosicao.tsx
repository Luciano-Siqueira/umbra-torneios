// Posição no pódio (1º, 2º, 3º) em ouro, prata e bronze, no lugar dos emojis de medalha
const CORES = ["#c9a648", "#c4c8cf", "#c47a3a"];

export function MedalhaPosicao({ posicao, tamanho = 32 }: { posicao: number; tamanho?: number }) {
  const cor = CORES[posicao - 1] ?? "var(--line)";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-black flex-shrink-0"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: tamanho * 0.45,
        background: cor,
        color: "#141414",
        boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 4px 14px -4px ${cor}`,
      }}
      aria-label={`${posicao}º lugar`}
    >
      {posicao}
    </span>
  );
}
