import { useEffect, useState } from "react";
import { IconeAnalytics, IconeCadeado, IconeCoroa, IconeDado, IconeEspadas, IconeHistorico, IconeTrofeu } from "./ui/Icones";
import { useStore } from "../core/store";
import { BANNER_IMAGE } from "../banner-image";
import manaPathsData from "../mana-paths.json";
import { useAuth } from "../core/auth";
import { TelaLogin } from "./TelaLogin";

const MANA_PATHS: Record<string, string> = manaPathsData;

// Os símbolos voam para uma fileira logo abaixo do título. "posicao" vai de -2 a 2 a partir do centro
const SIMBOLOS = [
  { sym: "w", cor: "#f9f5e3", posicao: -2, delay: 0.0 },
  { sym: "u", cor: "#5b9bd5", posicao: -1, delay: 0.1 },
  { sym: "b", cor: "#c4b5fd", posicao: 0,  delay: 0.2 },
  { sym: "r", cor: "#e15b5b", posicao: 1,  delay: 0.3 },
  { sym: "g", cor: "#7bc47f", posicao: 2,  delay: 0.4 },
];
const ESPACO_CEL = "12vw"; // entre os centros dos símbolos
const ESPACO_PC = "88px";

// No computador o título "SYSTEM" termina em max(34,4vh, 19,2vw); a fileira fica logo abaixo dele
const FILEIRA_DE_MANA_PC = "calc(max(34.4vh, 19.2vw) + 52px)";
const INICIO_DO_CONTEUDO_PC = "calc(max(34.4vh, 19.2vw) + 112px)";

// Banner 1800x1004. No celular, a imagem cobrindo a altura cortava "TOURNAMENT SYSTEM" nas laterais;
// com 150% da largura o título inteiro aparece. O conteúdo vai abaixo da arte, sem cobrir os dragões.
const LARGURA_BANNER_CEL = 150; // em vw
const ALTURA_BANNER_CEL = LARGURA_BANNER_CEL * 1004 / 1800;
const FILEIRA_DE_MANA_CEL = `${(ALTURA_BANNER_CEL * 0.8).toFixed(1)}vw`; // centro da fileira, sobre o fim da arte
const INICIO_DO_CONTEUDO_CEL = `calc(${(ALTURA_BANNER_CEL * 0.8).toFixed(1)}vw + 36px)`;

function useCelular() {
  const consulta = "(max-width: 767px)";
  const [celular, setCelular] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const mudar = () => setCelular(m.matches);
    m.addEventListener?.("change", mudar);
    return () => m.removeEventListener?.("change", mudar);
  }, []);
  return celular;
}

export function Splash(_props: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const irPara = useStore((s) => s.irPara);
  const torneios = useStore((s) => s.torneios);
  const temTorneios = torneios.length > 0;
  const auth = useAuth();
  const [loginAberto, setLoginAberto] = useState(false);
  const celular = useCelular();

  const handleEntrar = () => {
    if (auth.session) {
      irPara("torneios");
    } else {
      setLoginAberto(true);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={celular ? {
        // A imagem some aos poucos no fundo escuro
        backgroundColor: "#0a0a0a",
        backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0) 50%, #0a0a0a 100%), url(${BANNER_IMAGE})`,
        backgroundSize: `${LARGURA_BANNER_CEL}vw ${ALTURA_BANNER_CEL}vw, ${LARGURA_BANNER_CEL}vw auto`,
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      } : {
        backgroundImage: `linear-gradient(to bottom,
          rgba(10,10,10,0.1) 0%,
          rgba(10,10,10,0.3) 50%,
          rgba(10,10,10,0.75) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      {/* Símbolos de mana em fileira abaixo do título (animação curta) */}
      {SIMBOLOS.map((s) => (
        <ManaFlutuante
          key={s.sym}
          sym={s.sym}
          cor={s.cor}
          xFinal={`calc(50% + ${s.posicao} * ${celular ? ESPACO_CEL : ESPACO_PC})`}
          yFinal={celular ? FILEIRA_DE_MANA_CEL : FILEIRA_DE_MANA_PC}
          delay={s.delay}
        />
      ))}

      {/* Conteúdo central — aparece rápido */}
      {/* O título "SYSTEM" do banner termina em 34,4% da altura da imagem (proporção 1800x1004) */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-start px-6 pb-8 text-center"
        style={{
          paddingTop: celular
            ? INICIO_DO_CONTEUDO_CEL
            : INICIO_DO_CONTEUDO_PC,
        }}
      >
        <div
          className="text-[10px] md:text-sm font-mono tracking-[0.3em] md:tracking-[0.5em] whitespace-nowrap mb-5 md:mb-6 opacity-0"
          style={{
            color: "var(--brand-1)",
            animation: "fadeInUp 0.6s ease-out 0.4s forwards",
          }}
        >
          MULTIPLAYER · TABLE · FORMAT
        </div>

        {/* CTA ENTRAR */}
        <button
          onClick={handleEntrar}
          className="group relative transition-all active:scale-95 opacity-0"
          style={{
            animation: "entraCTA 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s forwards, floatY 4s ease-in-out 1.3s infinite",
          }}
        >
          <div
            className="absolute -inset-4 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"
            style={{ background: "radial-gradient(circle, rgba(201,166,72,0.5), transparent 70%)" }}
          />
          <div
            className="relative px-10 py-4 md:px-20 md:py-6 font-black text-lg md:text-2xl tracking-[0.3em] md:tracking-[0.4em] border-2"
            style={{
              background: "linear-gradient(135deg, rgba(201,166,72,0.1) 0%, rgba(139,0,0,0.1) 100%)",
              borderImage: "linear-gradient(135deg, var(--brand-1), var(--brand-2)) 1",
              clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))",
              color: "#fff",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0 40px -5px rgba(201,166,72,0.5), inset 0 0 20px rgba(139,0,0,0.15)",
            }}
          >
            <span
              style={{
                background: "linear-gradient(90deg, var(--brand-1), var(--text-strong), var(--brand-1))",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmerText 3s linear infinite",
                filter: "drop-shadow(0 0 10px rgba(201,166,72,0.5))",
              }}
            >
              ◤ ENTRAR ◢
            </span>
          </div>
        </button>

        {/* Info de login + hint */}
        <div
          className="mt-4 md:mt-6 flex flex-col items-center gap-2 opacity-0"
          style={{ animation: "fadeInUp 0.6s ease-out 1s forwards" }}
        >
          {auth.loading ? (
            <div className="text-xs" style={{ color: "var(--text-2)" }}>...</div>
          ) : auth.session ? (
            <div className="text-xs" style={{ color: "var(--brand-1)" }}>
              {auth.isAdmin ? <><IconeCoroa cor="currentColor" /> ADMINISTRADOR · </> : ""}{auth.nomesJogador[0] ?? auth.session.user.email}
            </div>
          ) : (
            <div className="text-xs" style={{ color: "var(--text-2)" }}>
              <IconeCadeado cor="currentColor" /> Login necessário
            </div>
          )}
          <div className="text-[11px]" style={{ color: "var(--text-muted-ds)" }}>
            {auth.session
              ? (temTorneios ? `${torneios.length} torneio${torneios.length > 1 ? "s" : ""} salvo${torneios.length > 1 ? "s" : ""}` : "Nenhum torneio ainda")
              : "Clique em ENTRAR para fazer login"}
          </div>
        </div>

        {/* Features em pills */}
        <div className="my-auto py-7 md:py-0 md:mb-0 md:mt-14 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
          {[
            { icon: <IconeEspadas />, txt: "Pareamento automático" },
            { icon: <IconeTrofeu />, txt: "Ranking OMW/GW/OGW" },
            { icon: <IconeHistorico />, txt: "Timer com fases" },
            { icon: <IconeDado />, txt: "Sorteios integrados" },
            { icon: <IconeAnalytics />, txt: "Analytics semanais" },
          ].map((f, i) => (
            <div
              key={f.txt}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs opacity-0"
              style={{
                background: "rgba(15,15,15,0.5)",
                borderColor: "rgba(201,166,72,0.15)",
                backdropFilter: "blur(10px)",
                color: "var(--text-strong)",
                animation: `fadeInUp 0.4s ease-out ${1.3 + i * 0.08}s forwards`,
              }}
            >
              <span>{f.icon}</span>
              <span>{f.txt}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 text-center pb-6 text-xs font-mono opacity-0"
        style={{
          color: "rgba(201,166,72,0.4)",
          animation: "fadeInUp 0.5s ease-out 1.8s forwards",
        }}
      >
        v2.0 · {new Date().getFullYear()}
      </div>

      <TelaLogin
        aberta={loginAberto}
        onFechar={() => setLoginAberto(false)}
        onSucesso={() => irPara("torneios")}
      />
    </div>
  );
}

function ManaFlutuante({
  sym, cor, xFinal, yFinal, delay,
}: {
  sym: string; cor: string; xFinal: string; yFinal: string; delay: number;
}) {
  // A flutuação troca o transform: fica no círculo, para a fileira continuar centralizada
  const flutuar = `floatY ${4 + delay * 0.5}s ease-in-out ${1 + delay}s infinite`;
  const animName = `voaPara_${sym}`;
  const keyframes = `
    @keyframes ${animName} {
      0% {
        left: 50%; top: 50%;
        transform: translate(-50%, -50%) scale(0) rotate(-180deg);
        opacity: 0;
      }
      35% {
        left: 50%; top: 50%;
        transform: translate(-50%, -50%) scale(1.3) rotate(0deg);
        opacity: 1;
      }
      100% {
        left: ${xFinal}; top: ${yFinal};
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
        opacity: 0.85;
      }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="absolute pointer-events-none z-0"
        style={{
          left: "50%",
          top: "50%",
          opacity: 0,
          animation: `${animName} 0.8s cubic-bezier(0.34, 1.3, 0.64, 1) ${delay}s forwards`,
        }}
      >
        <div
          className="w-9 h-9 md:w-16 md:h-16 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${cor}, ${cor}99)`,
            boxShadow: `0 0 30px ${cor}cc, 0 0 60px ${cor}66, inset 0 2px 10px rgba(255,255,255,0.3)`,
            animation: flutuar,
          }}
        >
          <svg viewBox="0 0 32 32" width="60%" height="60%" fill="var(--page-1)">
            <path d={MANA_PATHS[sym]} />
          </svg>
        </div>
      </div>
    </>
  );
}
