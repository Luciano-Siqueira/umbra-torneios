import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const CORES_PATOS = [
  "#fbbf24", "#f472b6", "#38bdf8", "#4ade80", "#a78bfa",
  "#fb923c", "#ec4899", "#22d3ee", "#84cc16", "#e879f9",
  "#facc15", "#818cf8", "#2dd4bf", "#fca5a5", "#c084fc",
  "#a3e635", "#fdba74", "#67e8f9", "#f9a8d4", "#93c5fd",
];

export interface PatinhosHandle {
  iniciar: () => void;
  proximaCorrida: () => void;
  resetar: () => void;
}

interface Props {
  nomes: string[];
  torneioId: string;
  estado: Map<string, any>;
}

interface Pato {
  nome: string;
  cor: string;
  x: number;
  y: number;
  vel: number;
  wobble: number;
  posicaoFinal: number | null; // 1=primeiro, 2=segundo…
}

const MARGEM_ESQ = 170;
const MARGEM_DIR = 60;
const LARGURA = 1400;
const FRAME_MS = 30;

export const CorridaPatinhos = forwardRef<PatinhosHandle, Props>(function CorridaPatinhos(
  { nomes, torneioId, estado },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = estado.get(torneioId);
  const [participantes, setParticipantes] = useState<string[]>(
    () => (st?.participantesCorrida && st.participantesCorrida.length > 0)
      ? st.participantesCorrida.filter((n: string) => nomes.includes(n))
      : embaralhar([...nomes])
  );
  const [ranking, setRanking] = useState<string[]>(() => st?.rankingCorrida ?? []);
  const [patos, setPatos] = useState<Pato[]>([]);
  const [rodando, setRodando] = useState(false);
  const [ultimoVencedor, setUltimoVencedor] = useState<string | null>(null);
  const [tempoCorrida, setTempoCorrida] = useState<number>(0);
  const rodandoRef = useRef(false);
  const patosRef = useRef<Pato[]>([]);
  const rankRef = useRef<string[]>(st?.rankingCorrida ?? []);
  const frameRef = useRef(0);
  const corPorNome = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const atual = estado.get(torneioId) ?? {};
    atual.participantesCorrida = participantes;
    atual.rankingCorrida = ranking;
    estado.set(torneioId, atual);
  }, [participantes, ranking, torneioId, estado]);

  useEffect(() => {
    const setNomes = new Set(nomes);
    setRanking((r) => r.filter((n) => setNomes.has(n)));
    rankRef.current = rankRef.current.filter((n) => setNomes.has(n));
    setParticipantes((p) => {
      const filtrados = p.filter((n) => setNomes.has(n));
      const jaVistos = new Set([...filtrados, ...rankRef.current]);
      const novos = nomes.filter((n) => !jaVistos.has(n));
      return [...filtrados, ...novos];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomes.join("|")]);

  const altura = Math.max(700, Math.min(1200, participantes.length * 60 + 180));
  const linhaChegada = LARGURA - MARGEM_DIR - 20;

  const criarPatos = (lista: string[]): Pato[] => {
    const espacoUtil = altura - 140;
    const gap = espacoUtil / Math.max(lista.length, 1);
    return lista.map((n, i) => {
      // mantém cor fixa pelo nome entre corridas
      let cor = corPorNome.current.get(n);
      if (!cor) {
        cor = CORES_PATOS[corPorNome.current.size % CORES_PATOS.length];
        corPorNome.current.set(n, cor);
      }
      return {
        nome: n,
        cor,
        x: MARGEM_ESQ,
        y: 110 + gap * i + gap / 2,
        vel: 3 + Math.random() * 3,
        wobble: Math.random() * Math.PI * 2,
        posicaoFinal: null,
      };
    });
  };

  useEffect(() => {
    setPatos(criarPatos(participantes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantes.join("|"), altura]);

  useEffect(() => {
    patosRef.current = patos;
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patos]);

  const desenhar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Céu estrelado no topo
    const sky = ctx.createLinearGradient(0, 0, 0, 90);
    sky.addColorStop(0, "#1e293b");
    sky.addColorStop(1, "#0f172a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 90);
    // Algumas estrelas fixas
    ctx.fillStyle = "#fff";
    [[150,30],[400,20],[700,40],[1000,25],[1200,45],[300,55],[850,15]].forEach(([x,y])=>{
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Painel escuro à esquerda (nomes das raias)
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 90, MARGEM_ESQ, H - 90);
    // Linha divisória roxa tracejada
    ctx.strokeStyle = "#c9a648";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(MARGEM_ESQ, 90);
    ctx.lineTo(MARGEM_ESQ, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Label LARGADA
    ctx.fillStyle = "#c9a648";
    ctx.font = "bold 11px Sora, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("LARGADA", MARGEM_ESQ / 2, 78);

    // Água à direita
    const water = ctx.createLinearGradient(0, 90, 0, H);
    water.addColorStop(0, "rgba(14, 165, 233, 0.9)");
    water.addColorStop(0.5, "rgba(2, 132, 199, 0.95)");
    water.addColorStop(1, "#082f49");
    ctx.fillStyle = water;
    ctx.fillRect(MARGEM_ESQ, 90, W - MARGEM_ESQ, H - 90);

    // Brilho de sunrise
    const sun = ctx.createRadialGradient(W / 2, H - 80, 20, W / 2, H - 80, 500);
    sun.addColorStop(0, "rgba(251, 191, 36, 0.25)");
    sun.addColorStop(1, "transparent");
    ctx.fillStyle = sun;
    ctx.fillRect(MARGEM_ESQ, 90, W - MARGEM_ESQ, H - 90);

    // Ondas (curvas suaves)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    const off = frameRef.current * 2;
    const pats = patosRef.current;
    const n = pats.length;
    const espacoUtil = altura - 140;
    const gap = espacoUtil / Math.max(n, 1);
    for (let i = 0; i < n; i++) {
      const y = 110 + gap * i + gap / 2 + 30;
      ctx.beginPath();
      for (let x = MARGEM_ESQ; x < W; x += 4) {
        const yy = y + Math.sin((x + off) * 0.03) * 2.5;
        if (x === MARGEM_ESQ) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Linhas sutis separando as raias (sem texto)
    ctx.strokeStyle = "rgba(201,166,72,0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    for (let i = 1; i < n; i++) {
      const yDiv = 110 + gap * i;
      ctx.beginPath();
      ctx.moveTo(MARGEM_ESQ + 10, yDiv);
      ctx.lineTo(W - 10, yDiv);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Chegada xadrez
    const xMeta = linhaChegada;
    ctx.save();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    for (let y = 90; y < H; y += 10) {
      for (let dx = 0; dx < 20; dx += 10) {
        ctx.fillStyle = ((Math.floor(y / 10) + Math.floor(dx / 10)) % 2 === 0) ? "#fff" : "#000";
        ctx.fillRect(xMeta + dx, y, 10, 10);
      }
    }
    ctx.restore();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px Sora, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("CHEGADA", xMeta + 10, 78);

    // Cards com nome do pato no painel esquerdo (SEM sub-label)
    ctx.textAlign = "left";
    pats.forEach((p, i) => {
      const y = 110 + gap * i + gap / 2;
      const cardY = y - 16;
      const cardH = 32;
      // Card bg
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, 4, cardY, MARGEM_ESQ - 12, cardH, 8);
      ctx.fill();
      // Faixa colorida vertical
      ctx.fillStyle = p.cor;
      roundRect(ctx, 4, cardY, 4, cardH, 2);
      ctx.fill();
      // Nome só
      ctx.fillStyle = p.cor;
      ctx.font = "bold 13px Sora, system-ui";
      const nomeCurto = p.nome.length > 14 ? p.nome.slice(0, 13) + "…" : p.nome;
      ctx.fillText(nomeCurto, 14, cardY + 20);
    });

    // Patinhos (sem nome flutuante — já aparece no card lateral)
    pats.forEach((p) => {
      const y = p.y + Math.sin(p.wobble) * 4;
      desenharPato(ctx, p.x, y, p.cor);
      // Rastro quando em movimento
      if (rodandoRef.current && p.posicaoFinal === null && p.x > MARGEM_ESQ + 10) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(252,211,77,0.6)";
        for (let k = 1; k <= 2; k++) {
          const rx = p.x - 30 * k;
          if (rx > MARGEM_ESQ) {
            ctx.beginPath();
            ctx.ellipse(rx, y + 2, 10 - k * 2, 4 - k, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    });

    // Badge "👑 LÍDER" sobre o pato que está mais à frente
    if (rodandoRef.current && n > 0) {
      const vivos = pats.filter((p) => p.posicaoFinal === null);
      if (vivos.length > 0) {
        const lider = vivos.reduce((a, b) => (b.x > a.x ? b : a));
        ctx.save();
        ctx.fillStyle = "#fcd34d";
        ctx.font = "bold 10px Sora, system-ui";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(252,211,77,0.8)";
        ctx.shadowBlur = 10;
        ctx.fillText("👑 LÍDER", lider.x, lider.y - 30);
        ctx.restore();
      }
    }
  };

  const desenharPato = (ctx: CanvasRenderingContext2D, x: number, y: number, cor: string) => {
    // Sombra na água
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 24, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corpo com gradient radial 3 cores
    const corClara = clarear(cor, 0.3);
    const corEscura = escurecer(cor, 0.35);
    const grad = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, 24);
    grad.addColorStop(0, corClara);
    grad.addColorStop(0.5, cor);
    grad.addColorStop(1, corEscura);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Asa escura destacada
    ctx.fillStyle = escurecer(cor, 0.5);
    ctx.save();
    ctx.translate(x - 18, y - 6);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rabo
    ctx.fillStyle = escurecer(cor, 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 2);
    ctx.lineTo(x - 32, y - 8);
    ctx.lineTo(x - 24, y + 2);
    ctx.closePath();
    ctx.fill();

    // Cabeça
    const gradCab = ctx.createRadialGradient(x + 18, y - 14, 2, x + 20, y - 11, 13);
    gradCab.addColorStop(0, corClara);
    gradCab.addColorStop(1, cor);
    ctx.fillStyle = gradCab;
    ctx.beginPath();
    ctx.arc(x + 20, y - 11, 12, 0, Math.PI * 2);
    ctx.fill();

    // Bico com divisão
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(x + 28, y - 13);
    ctx.lineTo(x + 42, y - 11);
    ctx.lineTo(x + 28, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 28, y - 11);
    ctx.lineTo(x + 40, y - 11);
    ctx.stroke();

    // Olho
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x + 23, y - 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(x + 23.8, y - 14, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x + 24.2, y - 14.5, 0.8, 0, Math.PI * 2); ctx.fill();

    // Reflexo no corpo
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 6);
    ctx.quadraticCurveTo(x - 2, y - 10, x + 8, y - 6);
    ctx.stroke();
  };

  const iniciar = () => {
    if (rodando || participantes.length === 0 || ultimoVencedor) return;
    const resetados = patosRef.current.map((p) => ({
      ...p,
      x: MARGEM_ESQ,
      vel: 3 + Math.random() * 3,
      wobble: Math.random() * Math.PI * 2,
      posicaoFinal: null,
    }));
    patosRef.current = resetados;
    setPatos(resetados);
    rodandoRef.current = true;
    setRodando(true);
    const inicio = performance.now();

    let ultimoTs = performance.now();
    const loop = () => {
      if (!rodandoRef.current) return;
      const agora = performance.now();
      if (agora - ultimoTs < FRAME_MS) { requestAnimationFrame(loop); return; }
      ultimoTs = agora;
      frameRef.current += 1;

      let vencedor: Pato | null = null;
      const nova = patosRef.current.map((p) => {
        const variacao = 0.85 + Math.random() * 0.3;
        let novoX = p.x + p.vel * variacao;
        if (novoX >= linhaChegada && !vencedor) {
          novoX = linhaChegada;
          vencedor = { ...p, x: novoX, wobble: p.wobble + 0.15, posicaoFinal: 1 };
          return vencedor;
        }
        // Só quem alcançou a linha no mesmo quadro do vencedor fica logo atrás dela.
        // Limitar os demais prenderia um pato lento, cujo passo não vence essa distância.
        return { ...p, x: novoX >= linhaChegada ? linhaChegada - 5 : novoX, wobble: p.wobble + 0.15 };
      });
      patosRef.current = nova;
      setPatos(nova);

      if (vencedor) {
        rodandoRef.current = false;
        setRodando(false);
        const nome = (vencedor as Pato).nome;
        rankRef.current = [...rankRef.current, nome];
        setRanking([...rankRef.current]);
        setUltimoVencedor(nome);
        setTempoCorrida((performance.now() - inicio) / 1000);
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const proximaCorrida = () => {
    if (!ultimoVencedor) return;
    setParticipantes((prev) => prev.filter((n) => n !== ultimoVencedor));
    setUltimoVencedor(null);
    setTempoCorrida(0);
  };

  const resetar = () => {
    rodandoRef.current = false;
    setRodando(false);
    setUltimoVencedor(null);
    setTempoCorrida(0);
    rankRef.current = [];
    setRanking([]);
    setParticipantes(embaralhar([...nomes]));
  };

  useImperativeHandle(ref, () => ({ iniciar, proximaCorrida, resetar }));

  // Medalhas e descrições do pódio
  const topTres = ranking.slice(0, 3);
  const medalhas = ["🥇", "🥈", "🥉"];
  const bordas = ["#fbbf24", "#d1d5db", "#f97316"];
  const restantes = participantes.filter((n) => !ranking.includes(n));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 w-full">
      {/* Pista */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "rgba(15,15,15,0.65)",
          border: "1px solid rgba(201,166,72,0.2)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header da pista */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{
                background: "linear-gradient(135deg, #c9a648, #8b0000)",
                boxShadow: "0 4px 12px -4px rgba(201,166,72,0.5)",
              }}
            >🏁</div>
            <div>
              <div className="text-sm font-bold tracking-wider" style={{ color: "var(--text-strong)" }}>
                PISTA DE CORRIDA
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted-ds)" }}>
                {patos.length} patinhos · chegada da direita
              </div>
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: rodando ? "rgba(252,211,77,0.15)" : "rgba(201,166,72,0.15)",
              border: `1px solid ${rodando ? "rgba(252,211,77,0.3)" : "rgba(201,166,72,0.3)"}`,
              color: rodando ? "#fcd34d" : "var(--brand-link)",
            }}
          >
            {rodando ? "⚡ CORRENDO" : ultimoVencedor ? "✅ FINALIZADA" : "🎯 PRONTA"}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={altura}
          className="w-full h-auto max-h-[85vh] rounded-lg block"
          style={{ boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
        />
      </div>

      {/* Painel Pódio */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "rgba(15,15,15,0.65)",
          border: "1px solid rgba(201,166,72,0.2)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Título */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-1 h-5 rounded"
            style={{ background: "linear-gradient(180deg, #c9a648, #8b0000)" }}
          />
          <h3 className="m-0 text-sm font-bold tracking-widest uppercase"
              style={{ color: "var(--text-strong)" }}>PÓDIO</h3>
          <span className="ml-auto text-xs" style={{ color: "var(--text-muted-ds)" }}>
            {ranking.length}/{nomes.length}
          </span>
        </div>

        {/* Card vencedor atual */}
        {ultimoVencedor && (
          <div
            className="p-4 rounded-xl mb-4 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(252,211,77,0.25), rgba(251,146,60,0.08))",
              border: "1px solid rgba(252,211,77,0.4)",
            }}
          >
            <div
              className="absolute -top-5 -right-5 w-20 h-20 opacity-50"
              style={{ background: "radial-gradient(circle, #fcd34d, transparent 65%)" }}
            />
            <div className="relative flex items-center gap-3">
              <div className="text-4xl">🏆</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold tracking-widest" style={{ color: "#fcd34d" }}>
                  VENCEDOR ATUAL
                </div>
                <div className="text-lg font-bold mt-0.5 truncate" style={{ color: "#fff" }}>
                  {ultimoVencedor}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "#fcd34d", opacity: 0.8 }}>
                  1º lugar{tempoCorrida > 0 ? ` · ${tempoCorrida.toFixed(2)}s` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 com medalhas */}
        {topTres.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {topTres.map((n, i) => {
              const cor = corPorNome.current.get(n) || CORES_PATOS[i];
              const isAtual = n === ultimoVencedor;
              return (
                <div
                  key={n + i}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg"
                  style={{
                    background: isAtual
                      ? `linear-gradient(90deg, ${cor}20, transparent)`
                      : `${cor}10`,
                    borderLeft: isAtual ? `3px solid ${bordas[i]}` : "3px solid transparent",
                  }}
                >
                  <div className="text-2xl">{medalhas[i]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: isAtual ? "#fff" : "var(--text-strong)" }}>
                      {n}
                    </div>
                    <div className="text-[10px]" style={{ color: `${cor}cc` }}>
                      pato · {participantes.indexOf(n) >= 0 ? `${participantes.indexOf(n) + 1}ª raia` : "finalizado"}
                    </div>
                  </div>
                  {isAtual && <span className="text-sm">👑</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Demais vencedores (4º em diante) */}
        {ranking.length > 3 && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[10px] font-bold tracking-widest uppercase mb-2"
                 style={{ color: "var(--text-muted-ds)" }}>
              DEMAIS
            </div>
            <div className="flex flex-col gap-1 text-xs">
              {ranking.slice(3).map((n, i) => {
                const cor = corPorNome.current.get(n) || "#c9a648";
                return (
                  <div key={n + i} className="flex items-center gap-2 py-1">
                    <span className="w-5 text-right tabular-nums" style={{ color: "var(--text-muted-ds)" }}>
                      {i + 4}
                    </span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                    <span className="truncate" style={{ color: "var(--text-strong)" }}>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de restantes como pills */}
        {restantes.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: "var(--text-muted-ds)" }}>
                Restantes
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--text-strong)" }}>
                {restantes.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {restantes.slice(0, 12).map((n) => {
                const cor = corPorNome.current.get(n) || "#c9a648";
                return (
                  <div
                    key={n}
                    className="px-2 py-0.5 rounded text-[11px]"
                    style={{
                      background: `${cor}15`,
                      border: `1px solid ${cor}40`,
                      color: cor,
                    }}
                  >
                    {n.length > 10 ? n.slice(0, 9) + "…" : n}
                  </div>
                );
              })}
              {restantes.length > 12 && (
                <span className="px-2 py-0.5 text-[11px]" style={{ color: "var(--text-muted-ds)" }}>
                  +{restantes.length - 12}
                </span>
              )}
            </div>
          </div>
        )}

        {ranking.length === 0 && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--text-muted-ds)" }}>
            Nenhuma corrida feita ainda
          </div>
        )}
      </div>
    </div>
  );
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function embaralhar<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function clarear(hex: string, amt: number) { return mix(hex, "#ffffff", amt); }
function escurecer(hex: string, amt: number) { return mix(hex, "#000000", amt); }
function mix(c1: string, c2: string, amt: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  return `rgb(${Math.round(r1*(1-amt)+r2*amt)},${Math.round(g1*(1-amt)+g2*amt)},${Math.round(b1*(1-amt)+b2*amt)})`;
}
function parseHex(h: string): [number,number,number] {
  const m = h.replace("#", "");
  return [parseInt(m.slice(0,2),16), parseInt(m.slice(2,4),16), parseInt(m.slice(4,6),16)];
}
