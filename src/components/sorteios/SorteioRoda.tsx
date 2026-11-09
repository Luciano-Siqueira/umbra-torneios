import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { IconeAlvo, IconeEstrela, IconeReiniciar, IconeRoleta, IconeTrofeu } from "../ui/Icones";

// Paleta com gradientes (par de hex por fatia)
const GRADIENTES: Array<[string, string]> = [
  ["#f472b6", "#a855f7"],
  ["#22d3ee", "#3b82f6"],
  ["#1ECDA1", "#059669"],
  ["#fbbf24", "#f97316"],
  ["#f87171", "#dc2626"],
  ["#a78bfa", "#6366f1"],
  ["#ec4899", "#db2777"],
  ["#38bdf8", "#0ea5e9"],
  ["#8fe9f2", "#22d3ee"],
  ["#fdba74", "#f97316"],
];

export interface RodaHandle {
  girar: () => void;
  resetar: () => void;
}

interface Props {
  nomes: string[];
  torneioId: string;
  estado: Map<string, any>;
}

export const SorteioRoda = forwardRef<RodaHandle, Props>(function SorteioRoda(
  { nomes, torneioId, estado },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = estado.get(torneioId);
  const [restantes, setRestantes] = useState<string[]>(
    () => (st?.restantesRoda && st.restantesRoda.length > 0)
      ? st.restantesRoda.filter((n: string) => nomes.includes(n))
      : nomes
  );
  const [sorteados, setSorteados] = useState<string[]>(() => st?.sorteadosRoda ?? []);
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);

  useEffect(() => {
    const atual = estado.get(torneioId) ?? {};
    atual.restantesRoda = restantes;
    atual.sorteadosRoda = sorteados;
    estado.set(torneioId, atual);
  }, [restantes, sorteados, torneioId, estado]);

  useEffect(() => {
    const setNomes = new Set(nomes);
    setSorteados((s) => s.filter((n) => setNomes.has(n)));
    setRestantes((r) => {
      const filtrados = r.filter((n) => setNomes.has(n));
      const jaVistos = new Set([...filtrados, ...sorteados]);
      const novos = nomes.filter((n) => !jaVistos.has(n));
      return [...filtrados, ...novos];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomes.join("|")]);

  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restantes, angulo]);

  const desenhar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 20;
    ctx.clearRect(0, 0, size, size);

    const n = restantes.length;

    // Anel externo gradiente (3 cores) estilo roleta premium
    const anel = ctx.createConicGradient(0, cx, cy);
    anel.addColorStop(0, "#c9a648");
    anel.addColorStop(0.33, "#8b0000");
    anel.addColorStop(0.66, "#8b0000");
    anel.addColorStop(1, "#c9a648");
    ctx.fillStyle = anel;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();

    // Aro escuro interno (dá "profundidade")
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();

    if (n === 0) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a5a3b8";
      ctx.font = "bold 24px Sora, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Todos sorteados!", cx, cy);
      return;
    }

    const anguloFatia = (Math.PI * 2) / n;

    // Fatias com gradiente diagonal
    for (let i = 0; i < n; i++) {
      const a0 = angulo + i * anguloFatia;
      const a1 = a0 + anguloFatia;
      const [c1, c2] = GRADIENTES[i % GRADIENTES.length];

      // Gradient radial da origem para a borda
      const mid = a0 + anguloFatia / 2;
      const x1 = cx + Math.cos(mid) * 20;
      const y1 = cy + Math.sin(mid) * 20;
      const x2 = cx + Math.cos(mid) * r;
      const y2 = cy + Math.sin(mid) * r;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();

      // Linha divisória preta sutil
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      ctx.stroke();

      // Pontinho brilhante na borda
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 3, 0, Math.PI * 2);
      ctx.fill();

      // Nome — sempre legível (vira o texto se cair na metade esquerda)
      const anguloTexto = (a0 + anguloFatia / 2) % (Math.PI * 2);
      const normAng = (anguloTexto + Math.PI * 2) % (Math.PI * 2);
      const virar = normAng > Math.PI / 2 && normAng < (3 * Math.PI) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(anguloTexto + (virar ? Math.PI : 0));
      ctx.textAlign = virar ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px Sora, system-ui";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      const nome = restantes[i].length > 20 ? restantes[i].slice(0, 19) + "…" : restantes[i];
      const distTexto = virar ? -(r - 20) : (r - 20);
      ctx.fillText(nome, distTexto, 0);
      ctx.restore();
    }

    ctx.shadowBlur = 0;

    // Hub central: glow radial dourado + círculo escuro com borda dourada
    const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 100);
    glow.addColorStop(0, "rgba(201,166,72,0.5)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.fill();

    const hub = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, 65);
    hub.addColorStop(0, "#f3f7fc");
    hub.addColorStop(0.3, "#c9a648");
    hub.addColorStop(0.8, "#1a1a1a");
    hub.addColorStop(1, "#000");
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(cx, cy, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a648";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Anel interno fino
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.stroke();

    // Texto no centro
    ctx.fillStyle = girando ? "#c9a648" : "#fff";
    ctx.font = "bold 14px Sora, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(girando ? "..." : "GIRAR", cx, cy - 7);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px Sora, system-ui";
    ctx.fillText(`${n} restante${n !== 1 ? "s" : ""}`, cx, cy + 12);

    // Ponteiro dourado — ponta aponta PARA DENTRO da roleta
    const px = cx + r + 8;
    ctx.shadowColor = "rgba(252,211,77,0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(px - 32, cy);        // ponta dentro
    ctx.lineTo(px, cy - 18);        // base de cima (fora)
    ctx.lineTo(px, cy + 18);        // base de baixo (fora)
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Pino de base (na parte externa)
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.arc(px - 2, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  };

  const girar = () => {
    if (girando || restantes.length === 0) return;
    setGirando(true);
    const anguloAtual = angulo % (Math.PI * 2);
    const voltas = 4 + Math.random() * 2;
    const alvoRel = Math.random() * Math.PI * 2;
    const anguloFinal = anguloAtual + voltas * Math.PI * 2 + alvoRel;
    const duracao = 4500;
    const t0 = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duracao);
      const e = easeOut(t);
      const a = anguloAtual + (anguloFinal - anguloAtual) * e;
      setAngulo(a);
      if (t < 1) requestAnimationFrame(step);
      else {
        const n = restantes.length;
        const anguloFatia = (Math.PI * 2) / n;
        const normalizado = ((0 - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.floor(normalizado / anguloFatia) % n;
        const vencedor = restantes[idx];
        setTimeout(() => {
          setSorteados((s) => [...s, vencedor]);
          setRestantes((r) => r.filter((_, i) => i !== idx));
          setGirando(false);
        }, 600);
      }
    };
    requestAnimationFrame(step);
  };

  const resetar = () => {
    setRestantes(nomes);
    setSorteados([]);
    setAngulo(0);
  };

  useImperativeHandle(ref, () => ({ girar, resetar }));

  // Click no hub central dispara GIRAR
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist <= 65) girar();
  };

  const ultimo = sorteados[sorteados.length - 1];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 w-full">
      {/* Roleta */}
      <div
        className="rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center gap-3"
        style={{
          background: "rgba(15,15,15,0.6)",
          border: "1px solid rgba(201,166,72,0.2)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={1000}
          onClick={onCanvasClick}
          className="w-full h-auto max-h-[85vh] cursor-pointer transition-transform hover:scale-[1.01]"
          style={{ aspectRatio: "1 / 1" }}
        />
        <div className="flex gap-2 items-center">
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: girando ? "rgba(201,166,72,0.15)" : "rgba(252,211,77,0.15)",
              border: `1px solid ${girando ? "rgba(201,166,72,0.3)" : "rgba(252,211,77,0.3)"}`,
              color: girando ? "var(--brand-link)" : "#fcd34d",
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              {girando ? <><IconeRoleta cor="currentColor" /> Girando...</> : <><IconeAlvo cor="currentColor" /> Pronto para girar</>}
            </span>
          </div>
          <div className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted-ds)" }}>
            clique no centro ou no botão
          </span>
        </div>
      </div>

      {/* Painel lateral */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "rgba(15,15,15,0.6)",
          border: "1px solid rgba(201,166,72,0.2)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Título com barra lateral */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-1 h-5 rounded"
            style={{ background: "linear-gradient(180deg, #c9a648, #8b0000)" }}
          />
          <h3 className="m-0 text-sm font-bold tracking-widest uppercase"
              style={{ color: "var(--text-strong)" }}>SORTEADOS</h3>
          <span className="ml-auto text-xs" style={{ color: "var(--text-muted-ds)" }}>
            {sorteados.length}/{nomes.length}
          </span>
        </div>

        {/* Card do último sorteado em destaque */}
        {ultimo && (
          <div
            className="p-4 rounded-xl mb-3 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(252,211,77,0.2), rgba(252,211,77,0.05))",
              border: "1px solid rgba(252,211,77,0.35)",
            }}
          >
            <div
              className="absolute -top-5 -right-5 w-20 h-20 opacity-30"
              style={{ background: "radial-gradient(circle, #fcd34d, transparent 70%)" }}
            />
            <div className="relative text-[10px] font-bold tracking-widest" style={{ color: "#fcd34d" }}>
              <IconeTrofeu cor="currentColor" /> ÚLTIMO SORTEADO
            </div>
            <div className="relative text-xl font-bold mt-1 truncate" style={{ color: "#fff" }}>
              {ultimo}
            </div>
          </div>
        )}

        {/* Lista */}
        {sorteados.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted-ds)" }}>
            Nenhum sorteado ainda
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorteados.map((n, i) => {
              const [c1, c2] = GRADIENTES[i % GRADIENTES.length];
              const isUltimo = i === sorteados.length - 1;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 p-2 rounded-lg transition"
                  style={{
                    background: isUltimo
                      ? "rgba(252,211,77,0.12)"
                      : `${c1}15`,
                    border: isUltimo ? "1px solid rgba(252,211,77,0.25)" : "1px solid transparent",
                    boxShadow: isUltimo ? "0 0 20px -5px rgba(252,211,77,0.4)" : "none",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs"
                    style={{
                      background: `linear-gradient(135deg, ${c1}, ${c2})`,
                      color: isUltimo ? "#1a0a0a" : "#fff",
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    className="flex-1 truncate font-semibold text-sm"
                    style={{ color: isUltimo ? "#fcd34d" : "var(--text-strong)" }}
                  >
                    {n}
                  </span>
                  {isUltimo && <IconeEstrela cor="#fcd34d" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé */}
        <div
          className="mt-4 pt-4 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted-ds)" }}>
            Restam {restantes.length}
          </span>
          <button
            onClick={resetar}
            className="px-3 py-1.5 rounded-lg text-xs transition hover:bg-white/5"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-strong)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          ><IconeReiniciar cor="currentColor" /> Resetar</button>
        </div>
      </div>
    </div>
  );
});
