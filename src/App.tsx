import { lazy, Suspense, useEffect, useState } from "react";
import { useStore } from "./core/store";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { Splash } from "./components/Splash";
import { TelaTorneios } from "./components/TelaTorneios";
import { TelaTorneio } from "./components/TelaTorneio";
import { TelaLogin } from "./components/TelaLogin";
import { TelaVincularNome } from "./components/TelaVincularNome";
import { useAuth } from "./core/auth";
import { useListaAtualizada } from "./core/useAoVivo";
import { publicarAoVivo } from "./core/aoVivo";
import { listarTorneios } from "./core/storage";
import { definirAvisoEnvio, puxarDoServidor, resolverConflito, retomarEnvios } from "./core/sync";
import { confirmar } from "./components/ui/Confirm";

// Telas carregadas só quando abertas
const TelaAnalytics = lazy(() =>
  import("./components/TelaAnalytics").then((m) => ({ default: m.TelaAnalytics }))
);
const TelaUsuarios = lazy(() =>
  import("./components/TelaUsuarios").then((m) => ({ default: m.TelaUsuarios }))
);

const KEY_DONO_CACHE = "mtg.torneios.dono";

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
  const setSincronizando = useStore((s) => s.setSincronizando);
  const auth = useAuth();
  const { toast } = useToast();
  const [loginAberto, setLoginAberto] = useState(false);
  const [vincularAberto, setVincularAberto] = useState(false);
  const [semConexao, setSemConexao] = useState(false);

  // Dentro de um torneio quem atualiza é o useAoVivo
  useListaAtualizada(!!auth.session && tela !== "torneio");

  useEffect(() => {
    definirAvisoEnvio((aviso) => {
      if (aviso.tipo === "sem-conexao") {
        setSemConexao(true);
        toast("Sem conexão. As alterações ficam guardadas neste aparelho até a internet voltar.", "aviso");
      } else if (aviso.tipo === "recuperado") {
        setSemConexao(false);
        toast("Conexão de volta. Alterações enviadas.", "sucesso");
      } else if (aviso.tipo === "recusado") {
        toast(`O servidor recusou salvar "${aviso.nome}": ${aviso.motivo}`, "erro");
      } else if (aviso.tipo === "conflito") {
        (async () => {
          const manter = await confirmar({
            titulo: "⚠ Conflito entre aparelhos",
            mensagem: `Outro aparelho alterou "${aviso.nome}" enquanto você também alterava.\n\nSó uma versão pode ficar. A outra será perdida.`,
            textoOk: "Manter a deste aparelho",
            textoCancelar: "Usar a do outro aparelho",
          });
          await resolverConflito(aviso.id, manter);
          recarregar();
          const t = listarTorneios().find((x) => x.id === aviso.id);
          if (manter && t) publicarAoVivo(t);
          toast(manter ? "Mantida a versão deste aparelho" : "Mantida a versão do outro aparelho", "info");
        })();
      } else if (aviso.tipo === "ao-vivo-falhou") {
        toast(`Os jogadores podem não ver esta atualização ao vivo: ${aviso.motivo}`, "erro");
      } else {
        toast(`Não foi possível excluir o torneio: ${aviso.motivo}`, "erro");
      }
    });
    window.addEventListener("online", retomarEnvios);
    return () => window.removeEventListener("online", retomarEnvios);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (auth.perfilErro) toast("Não foi possível carregar seu perfil: " + auth.perfilErro, "erro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.perfilErro]);

  useEffect(() => {
    setUsuarioId(auth.session?.user?.id ?? null);
  }, [auth.session?.user?.id, setUsuarioId]);

  // 1) Carrega localStorage
  useEffect(() => { recarregar(); }, [recarregar]);

  // 2) Mostra o cache na hora e atualiza do servidor por trás
  useEffect(() => {
    if (auth.loading) return;
    // Só descarta o cache quando muda a conta — garante que o filtro RLS valha
    const dono = auth.session?.user?.id ?? "";
    if (localStorage.getItem(KEY_DONO_CACHE) !== dono) {
      localStorage.removeItem("mtg.torneios.v1");
      localStorage.setItem(KEY_DONO_CACHE, dono);
    }
    if (dono) retomarEnvios();
    recarregar();
    setSincronizando(true);
    (async () => {
      const res = await puxarDoServidor();
      setSincronizando(false);
      if (res.erros.length === 0) recarregar();
      else toast("Não foi possível atualizar os torneios. Mostrando os dados salvos.", "aviso");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.session?.user?.id, recarregar, setSincronizando]);

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
      {semConexao && (
        <div
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{ background: "var(--warn)", color: "#0a1220" }}
        >
          ⏳ Alterações aguardando internet
        </div>
      )}

      {tela === "splash" &&<Splash onPedirLogin={() => setLoginAberto(true)} />}
      {tela === "torneios" && <TelaTorneios onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      {tela === "torneio" && <TelaTorneio onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-fg-dim">Carregando...</div>}>
        {tela === "analytics" && <TelaAnalytics onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
        {tela === "usuarios" && <TelaUsuarios onPedirLogin={() => setLoginAberto(true)} onVincularNome={() => setVincularAberto(true)} />}
      </Suspense>

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
