export function CaixaPago({ pago, onClick, nome }: { pago: boolean; onClick: () => void; nome: string }) {
  return (
    <button
      type="button"
      aria-pressed={pago}
      aria-label={`${nome}: ${pago ? "pago" : "não pago"}`}
      title={pago ? "Pago" : "Não pago"}
      onClick={onClick}
      className={`w-7 h-7 flex-shrink-0 rounded border-2 flex items-center justify-center text-xs
                  ${pago
                    ? "bg-sucesso border-sucesso text-bg"
                    : "border-fg-muted text-transparent hover:border-fg-dim"}`}
    >{pago ? "✓" : ""}</button>
  );
}
