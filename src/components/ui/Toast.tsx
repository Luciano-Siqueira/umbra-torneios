// Toast simples com contexto
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface Toast {
  id: number;
  msg: string;
  tipo: "info" | "sucesso" | "erro" | "aviso";
}
interface Ctx {
  toast: (msg: string, tipo?: Toast["tipo"]) => void;
}
const TCtx = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(TCtx);

let counter = 1;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, tipo: Toast["tipo"] = "info") => {
    const id = counter++;
    setToasts((ts) => [...ts, { id, msg, tipo }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 3200);
  }, []);

  const cores: Record<Toast["tipo"], string> = {
    info: "bg-info",
    sucesso: "bg-sucesso",
    erro: "bg-perigo",
    aviso: "bg-atencao",
  };

  return (
    <TCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${cores[t.tipo]} text-bg font-medium px-4 py-3 rounded-lg
                        shadow-2xl animate-slideUp`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </TCtx.Provider>
  );
}
