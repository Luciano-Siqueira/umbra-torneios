import { useEffect, useState } from "react";
import { useStore } from "./core/store";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { Splash } from "./components/Splash";
import { TelaTorneios } from "./components/TelaTorneios";
import { TelaTorneio } from "./components/TelaTorneio";
import { TelaAnalytics } from "./components/TelaAnalytics";
import { TelaUsuarios } from "./components/TelaUsuarios";
import { TelaLogin } from "./components/TelaLogin";
import { TelaVincularNome } from "./components/TelaVincularNome";
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
  const setUsuarioId = useStore((s) => s.setUsuarioId);
  const auth = useAuth();
  const { toast } = useToast();
  const [loginAberto, setLoginAberto] = useState(false);
  const [vincularAberto, setVincularAberto] = useState(false);

  useEffect(() => {
    if (auth.perfilErro) toast("Não foi possível carregar seu perfil: " + auth.perfilErro, "erro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.perfilErro]);

  useEffect(() => {
    setUsuarioId(auth.session?.user?.id ?? null);
  }, [auth.session?.user?.id, setUsuarioId]);

  // 1) Carrega localStorage
  useEffect(() => { recarregar(); }, [recarregar]);

  // 2) Quando a sessão muda (login/logout), limpa cache e puxa fresco do servidor
  useEffect(() => {
    if (auth.loading) return;
    // Sempre limpa a lista local antes de puxar — garante que o filtro RLS valha
    localStorage.removeItem("mtg.torneios.v1");
    recarregar();
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
      {tela === "torneios" && <TelaTorneios onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      {tela === "torneio" && <TelaTorneio onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      {tela === "analytics" && <TelaAnalytics onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      {tela === "usuarios" && <TelaUsuarios onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}

      <TelaLogin
        aberta={loginAberto}
        onFechar={() => setLoginAberto(false)}
        onSucesso={() => {
          setLoginAberto(false);
          irPara("torneios");
        }}
      />

      {/* Vinculação obrigatória de nome pra não-admin que acabou de criar conta */}
      <TelaVincularNome
        aberta={
          vincularAberto ||
          (!auth.loading && auth.perfilCarregado && !!auth.session && !auth.isAdmin && auth.nomesJogador.length === 0)
        }
        onConcluido={async () => {
          setVincularAberto(false);
          const res = await puxarDoServidor();
          if (res.erros.length === 0) recarregar();
          window.location.reload();
        }}
      />
    </>
  );
}
