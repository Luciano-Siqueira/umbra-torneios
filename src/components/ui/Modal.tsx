import { PropsWithChildren, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  maxW?: string; // ex: "max-w-md"
  fecharAoClicarFora?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  maxW = "max-w-md",
  fecharAoClicarFora = false,
  children,
}: PropsWithChildren<Props>) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  // No body: aberto de dentro de uma barra com backdrop-filter, o fixed ficaria preso nela e fora do centro
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fadeIn p-4"
      onMouseDown={(e) => { if (fecharAoClicarFora && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-bg-panel rounded-2xl shadow-2xl w-full ${maxW} animate-slideUp
                    border border-bg-cardalt max-h-[90vh] overflow-hidden flex flex-col`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-bg-cardalt">
            <h2 className="text-xl font-semibold text-acento">{title}</h2>
          </div>
        )}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
