import { IconeCheck } from "./Icones";
// travado: torneio finalizado, onde o pagamento já registrado não pode ser desfeito sem reabrir
export function CaixaPago({ pago, onClick, nome, travado = false }: {
  pago: boolean; onClick: () => void; nome: string; travado?: boolean;
}) {
  const bloqueado = travado && pago;
  return (
    <button
      type="button"
      aria-pressed={pago}
      aria-label={`${nome}: ${pago ? "pago" : "não pago"}`}
      title={bloqueado ? "Pago. Reabra o torneio para desmarcar" : pago ? "Pago" : "Não pago"}
      onClick={onClick}
      disabled={bloqueado}
      className={`w-7 h-7 flex-shrink-0 rounded border-2 flex items-center justify-center text-xs
                  ${pago
                    ? `bg-sucesso border-sucesso text-bg ${bloqueado ? "opacity-60 cursor-not-allowed" : ""}`
                    : "border-fg-muted text-transparent hover:border-fg-dim"}`}
    >{pago ? <IconeCheck tamanho={15} cor="currentColor" /> : ""}</button>
  );
}
