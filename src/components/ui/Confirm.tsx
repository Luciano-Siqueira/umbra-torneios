// Confirm nativo custom — usa uma promise para await
import { createRoot } from "react-dom/client";
import { useState } from "react";

interface Opts {
  titulo?: string;
  mensagem: string;
  textoOk?: string;
  textoCancelar?: string;
  perigo?: boolean;
}

export function confirmar(opts: Opts): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = (v: boolean) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<Dialog {...opts} onClose={close} />);
  });
}

function Dialog({
  titulo = "Confirmar",
  mensagem,
  textoOk = "OK",
  textoCancelar = "Cancelar",
  perigo,
  onClose,
}: Opts & { onClose: (v: boolean) => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 animate-fadeIn p-4">
      <div className="bg-bg-panel rounded-2xl w-full max-w-sm shadow-2xl border border-bg-cardalt animate-slideUp">
        <div className="p-5 border-b border-bg-cardalt">
          <h3 className={`text-lg font-semibold ${perigo ? "text-perigo" : "text-acento"}`}>
            {titulo}
          </h3>
        </div>
        <div className="p-5 text-fg whitespace-pre-line">{mensagem}</div>
        <div className="p-4 flex justify-end gap-2 border-t border-bg-cardalt">
          <button
            className="btn-ghost"
            onClick={() => { setOpen(false); onClose(false); }}
          >{textoCancelar}</button>
          <button
            className={perigo ? "btn-danger" : "btn-primary"}
            onClick={() => { setOpen(false); onClose(true); }}
          >{textoOk}</button>
        </div>
      </div>
    </div>
  );
}
