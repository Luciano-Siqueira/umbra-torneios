import { useEffect, useState } from "react";
import { useStore } from "./core/store";
import { ToastProvider } from "./components/ui/Toast";
import { Splash } from "./components/Splash";
import { TelaTorneios } from "./components/TelaTorneios";
import { TelaTorneio } from "./components/TelaTorneio";
import { TelaAnalytics } from "./components/TelaAnalytics";
import { TelaLogin } from "./components/TelaLogin";
import { useAuth } from "./core/auth";
import { puxarDoServidor } from "./core/sync";

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const tela = useStore((s) => s.tela);
  const irPara = useStore((s) => s.irPara);
  const recarregar = useStore((s) => s.recarregar);
  const auth = useAuth();
  const [loginAberto, setLoginAberto] = useState(false);

  // 1) Carrega localStorage
  useEffect(() => { recarregar(); }, [recarregar]);

  // 2) Puxa do Supabase ao carregar E sempre que a sessão mudar
  useEffect(() => {
    if (auth.loading) return;
    (async () => {
      const res = await puxarDoServidor();
      if (res.erros.length === 0) recarregar();
    })();
  }, [auth.loading, auth.session?.user?.id, recarregar]);

  // 3) Se não logado e NÃO está na splash, volta pra splash
  useEffect(() => {
    if (!auth.loading && !auth.session && tela !== "splash") {
      irPara("splash");
    }
  }, [auth.loading, auth.session, tela, irPara]);

  // 4) Se já logado e está na splash, vai direto pra torneios
  useEffect(() => {
    if (!auth.loading && auth.session && tela === "splash") {
      // só pula se não é a 1ª renderização intencional
      const timer = setTimeout(() => irPara("torneios"), 100);
      return () => clearTimeout(timer);
    }
  }, [auth.loading, auth.session, tela, irPara]);

  return (
    <>
      {tela === "splash" && <Splash onPedirLogin={() => setLoginAberto(true)} />}
      {tela === "torneios" && <TelaTorneios onPedirLogin={() => setLoginAberto(true)} />}
      {tela === "torneio" && <TelaTorneio onPedirLogin={() => setLoginAberto(true)} />}
      {tela === "analytics" && <TelaAnalytics onPedirLogin={() => setLoginAberto(true)} />}

      <TelaLogin
        aberta={loginAberto}
        onFechar={() => setLoginAberto(false)}
        onSucesso={() => {
          setLoginAberto(false);
          irPara("torneios");
        }}
      />
    </>
  );
}
