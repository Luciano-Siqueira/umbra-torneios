import { useEffect, useMemo, useState } from "react";
import { IconeCheck as IconeCheckMesa } from "../ui/Icones";
import { MedalhaPosicao } from "../ui/MedalhaPosicao";
import type { Torneio, Mesa } from "../../core/types";
import { useStore } from "../../core/store";
import { calcularColocacoes, ranking } from "../../core/resultados";
import { useToast } from "../ui/Toast";
import { confirmar } from "../ui/Confirm";
import { Modal } from "../ui/Modal";
import { DialogoResultado } from "../DialogoResultado";
import { CartaoMinhaMesa } from "../CartaoMinhaMesa";
import { useAuth } from "../../core/auth";
import { encontrarMinhaMesa } from "../../core/minhaMesa";
import { torneioParado } from "../../core/visibilidade";
import { useTimer, formatarTempo } from "../../core/useTimer";
import { comandanteDoDeck, coresDoDeck } from "../../core/decks";
import { CoresMana } from "../ui/SimboloMana";
import { contar } from "../../core/formato";
import { avisarMesas, enviarAviso } from "../../core/notificacoes";
import { DialogoAvisosTorneio } from "../DialogoAvisosTorneio";
import {
  IconeCopiar, IconeCoroa, IconeEmbaralhar, IconeHistorico, IconeMedalha, IconePausa, IconeParar,
  IconeEngrenagem, IconePlay, IconeReiniciar, IconeSino, IconeTrofeu,
} from "../ui/Icones";

export function AbaMesas({ torneio, podeEditar, verTempo = true, onIrParaAba }: {
  torneio: Torneio;
  podeEditar: boolean;
  verTempo?: boolean; // falso para o jogador quando o torneio não libera o tempo
  onIrParaAba?: (aba: "ranking" | "premiacao" | "historico") => void;
}) {
  const iniciarRodada = useStore((s) => s.iniciarRodada);
  const resortearMesas = useStore((s) => s.resortearMesas);
  const voltarAoInicio = useStore((s) => s.voltarAoInicio);
  const finalizarTorneio = useStore((s) => s.finalizarTorneio);
  const { toast } = useToast();

  const [mesaSel, setMesaSel] = useState<{ mesa: Mesa; idx: number } | null>(null);
  const [avisosTorneioAberto, setAvisosTorneioAberto] = useState(false);
  const timer = useTimer(torneio.tempoRodadaMin, torneio.tempoExtraMin, torneio.timer, podeEditar);
  const { nomesJogador } = useAuth();
  // O cartão da própria mesa é só do modo jogador
  const minha = useMemo(
    () => (podeEditar || torneioParado(torneio) ? null : encontrarMinhaMesa([torneio], nomesJogador)),
    [podeEditar, torneio, nomesJogador]
  );

  useEffect(() => {
    timer.setOnFimNormal(verTempo ? () => toast("Tempo normal acabou! Iniciando tempo extra.", "aviso") : () => {});
    timer.setOnFimTotal(verTempo ? () => toast("Tempo extra acabou: último turno para cada jogador!", "erro") : () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verTempo]);

  const jogadoresPorId = useMemo(() => {
    const m = new Map<number, string>();
    torneio.jogadores.forEach((j) => m.set(j.id, j.nome));
    return m;
  }, [torneio.jogadores]);
  const deckPorId = useMemo(
    () => new Map(torneio.jogadores.map((j) => [j.id, j.deck?.trim() ?? ""])),
    [torneio.jogadores]
  );

  const pendentes: { m: Mesa; i: number }[] = [];
  const finalizadas: { m: Mesa; i: number }[] = [];
  torneio.mesas.forEach((m, i) => {
    if (m.finalizada) finalizadas.push({ m, i });
    else pendentes.push({ m, i });
  });

  const semMesas = torneio.mesas.length === 0;
  const temParcial = torneio.mesas.some((m) => m.eliminacoes.length > 0 || m.empateTopoIds.length > 0);
  const nenhumaFinalizada = torneio.mesas.length > 0 && finalizadas.length === 0 && !temParcial;
  const rodadaConcluida = torneio.mesas.length > 0 && pendentes.length === 0;
  const ativos = torneio.jogadores.filter((j) => j.ativo).length;
  const podeIniciar =
    (semMesas || rodadaConcluida) &&
    !torneio.finalizado &&
    torneio.rodadaAtual < torneio.qtdRodadas &&
    ativos >= 3;
  const podeFinalizar =
    !torneio.finalizado &&
    torneio.rodadaAtual === torneio.qtdRodadas &&
    rodadaConcluida;
  // Último caminho para quando o torneio precisa terminar antes da hora
  const podeEncerrarAntes = podeEditar && !torneio.finalizado && !podeFinalizar && torneio.rodadaAtual > 0
    && !(semMesas && torneio.rodadaAtual >= torneio.qtdRodadas);

  const iniciar = async () => {
    if (!podeIniciar) {
      if (ativos < 3) return toast("Precisa de pelo menos 3 jogadores ativos", "aviso");
      if (torneio.finalizado) return toast("Torneio finalizado", "aviso");
      if (torneio.rodadaAtual >= torneio.qtdRodadas) return toast("Todas as rodadas já foram jogadas", "aviso");
      return;
    }
    const ok = await confirmar({
      titulo: "Iniciar rodada",
      mensagem: `Iniciar rodada ${torneio.rodadaAtual + 1} de ${torneio.qtdRodadas}?`,
    });
    if (ok) {
      const rodada = torneio.rodadaAtual + 1;
      iniciarRodada();
      toast(`Rodada ${rodada} iniciada`, "sucesso");
      // Avisa cada jogador da sua mesa; se falhar (sem internet, função não publicada), a rodada segue normal
      avisarMesas(torneio.id, rodada)
        .then(({ enviados }) => { if (enviados > 0) toast(`Mesa avisada a ${contar(enviados, "aparelho")}`, "info"); })
        .catch(() => {});
    }
  };

  const resortear = async () => {
    if (!nenhumaFinalizada) return;
    const ok = await confirmar({
      titulo: "Resortear mesas",
      mensagem: "Vai refazer todas as mesas desta rodada. Continuar?",
    });
    if (ok) {
      resortearMesas();
      toast("Mesas resorteadas", "sucesso");
    }
  };

  const voltarInicio = async () => {
    const ok = await confirmar({
      titulo: "Voltar ao início",
      mensagem: "O torneio volta para antes da rodada 1: as mesas e os resultados lançados nela serão apagados. Os jogadores continuam inscritos.\n\nDepois disso, você pode adicionar jogadores e iniciar de novo.",
      textoOk: "Voltar ao início",
      perigo: true,
    });
    if (ok) {
      voltarAoInicio();
      toast("Torneio de volta ao início", "sucesso");
    }
  };

  // Reenvia o aviso da rodada atual: serve para rodadas iniciadas antes dos avisos existirem,
  // ou para quem ligou os avisos depois do início
  const [avisando, setAvisando] = useState(false);
  const avisarDeNovo = async () => {
    setAvisando(true);
    try {
      const { enviados, contas, desligado } = await avisarMesas(torneio.id, torneio.rodadaAtual);
      if (desligado === "torneio") toast("A notificação de mesa está desligada neste torneio (botão Notificações).", "aviso");
      else if (desligado) toast("A notificação de mesa está desligada para todos em Usuários → Configurar notificações.", "aviso");
      else if (enviados > 0) toast(`Mesa avisada a ${contar(enviados, "aparelho")}`, "sucesso");
      else if (contas === 0) toast("Ninguém desta rodada pode receber: o jogador precisa de conta com o nome aprovado, Mesas liberado e o Jogador Pro.", "aviso");
      else toast("Nenhum aparelho para avisar: os jogadores ainda não ligaram os avisos no celular.", "aviso");
    } catch (e: any) {
      toast(e?.message ?? "Não foi possível avisar as mesas.", "erro");
    } finally {
      setAvisando(false);
    }
  };

  const copiarWhatsApp = async () => {
    const linhas: string[] = [`*${torneio.nome}*`, `_Rodada ${torneio.rodadaAtual}_`, ""];
    for (const m of torneio.mesas) {
      linhas.push(`*Mesa ${m.numero}*`);
      for (const id of m.jogadoresIds) {
        const nome = torneio.jogadores.find((j) => j.id === id)?.nome ?? "?";
        linhas.push(`• ${nome}`);
      }
      linhas.push("");
    }
    const texto = linhas.join("\n").trimEnd();
    try {
      await navigator.clipboard.writeText(texto);
      toast("Copiado para a área de transferência", "sucesso");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copiado", "sucesso");
    }
  };

  const finalizar = async () => {
    const ok = await confirmar({
      titulo: "Finalizar torneio",
      mensagem: "O torneio será encerrado e o ranking ficará fechado. Se precisar, dá para reabrir depois.",
      textoOk: "Finalizar",
    });
    if (ok) {
      finalizarTorneio();
      toast("Torneio finalizado!", "sucesso");
      enviarAviso({ tipo: "finalizado", torneio_id: torneio.id }).catch(() => {});
    }
  };

  const encerrarAntes = async () => {
    const semResultado = pendentes.length > 0
      ? `\n\n${contar(pendentes.length, "mesa")} sem resultado ${pendentes.length === 1 ? "ficará" : "ficarão"} sem pontos.`
      : "";
    const ok = await confirmar({
      titulo: "Encerrar antes do previsto",
      mensagem: `O torneio está na rodada ${torneio.rodadaAtual} de ${torneio.qtdRodadas}.${semResultado}\n\nSe precisar, dá para reabrir depois.`,
      textoOk: "Encerrar",
      perigo: true,
    });
    if (ok) {
      finalizarTorneio();
      toast("Torneio encerrado", "sucesso");
      enviarAviso({ tipo: "finalizado", torneio_id: torneio.id }).catch(() => {});
    }
  };

  const botaoEncerrarAntes = podeEncerrarAntes && (
    <button
      className="btn !bg-transparent border text-sm hover:!bg-white/5"
      style={{ color: "var(--critical)", borderColor: "var(--critical)" }}
      onClick={encerrarAntes}
    >
      Encerrar antes do previsto
    </button>
  );

  // Sem rodada em andamento → tela de "iniciar rodada"
  if (semMesas) {
    const rank = torneio.finalizado ? ranking(torneio) : [];
    const podio = rank.slice(0, 3);

    return (
      <div className="max-w-3xl mx-auto py-6 md:py-10">
        {torneio.finalizado ? (
          <div
            className="rounded-2xl p-6 md:p-10 border relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(201,166,72,0.18), rgba(139,0,0,0.08))",
              borderColor: "rgba(201,166,72,0.4)",
              boxShadow: "0 20px 60px -20px rgba(201,166,72,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Glow decorativo */}
            <div
              className="absolute -top-20 -right-20 w-64 h-64 opacity-40 pointer-events-none"
              style={{ background: "radial-gradient(circle, var(--brand-1), transparent 65%)" }}
            />
            <div
              className="absolute -bottom-16 -left-16 w-48 h-48 opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(circle, var(--brand-2), transparent 65%)" }}
            />

            <div className="relative text-center">
              <div className="mb-3 flex justify-center"><IconeCoroa tamanho={64} /></div>
              <div
                className="inline-block px-4 py-1 rounded-full text-[11px] font-bold tracking-[0.3em] mb-4"
                style={{
                  background: "rgba(201,166,72,0.2)",
                  color: "var(--brand-1)",
                  border: "1px solid rgba(201,166,72,0.4)",
                }}
              >
                TORNEIO FINALIZADO
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight"
                  style={{ color: "#fff" }}>
                {torneio.nome}
              </h2>
              <div className="text-sm mb-6" style={{ color: "var(--text-label)" }}>
                {contar(torneio.jogadores.length, "jogador", "jogadores")} · {contar(torneio.rodadasFinalizadas.length, "rodada jogada", "rodadas jogadas")}
              </div>

              {/* Pódio inline */}
              {podio.length > 0 && (
                <div className="flex flex-wrap items-end justify-center gap-3 md:gap-4 mb-8">
                  {podio.map((j, i) => (
                    <div
                      key={j.id}
                      className="flex flex-col items-center min-w-0"
                      style={{ order: [1, 0, 2][i] }}
                    >
                      <div className="mb-2 flex justify-center"><MedalhaPosicao posicao={i + 1} tamanho={36} /></div>
                      <div
                        className="rounded-xl px-3 md:px-5 py-3 border min-w-[110px] md:min-w-[140px]"
                        style={{
                          background: i === 0
                            ? "linear-gradient(180deg, rgba(201,166,72,0.3), rgba(201,166,72,0.1))"
                            : "rgba(255,255,255,0.03)",
                          borderColor: i === 0 ? "rgba(201,166,72,0.5)" : "rgba(255,255,255,0.08)",
                          height: i === 0 ? "100px" : i === 1 ? "80px" : "70px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        <div className="text-xs font-bold truncate" style={{ color: "#fff" }}>
                          {j.nome}
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: "var(--brand-1)" }}>
                          {j.pontos} pts
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Atalhos pras outras abas */}
              <div className="text-xs mb-3" style={{ color: "var(--text-2)" }}>
                Confira os detalhes completos:
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: "Ranking final", icone: <IconeTrofeu cor="currentColor" />, key: "ranking" as const },
                  ...(podeEditar ? [{ label: "Premiação", icone: <IconeMedalha cor="currentColor" />, key: "premiacao" as const }] : []),
                  { label: "Histórico", icone: <IconeHistorico cor="currentColor" />, key: "historico" as const },
                ].map((atalho) => (
                  <button
                    key={atalho.key}
                    type="button"
                    onClick={() => onIrParaAba?.(atalho.key)}
                    className="px-4 py-2 rounded-full border text-xs md:text-sm font-semibold transition hover:brightness-125 active:scale-95"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(201,166,72,0.25)",
                      color: "var(--text-strong)",
                    }}
                  >
                    {atalho.icone} {atalho.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : torneio.rodadaAtual >= torneio.qtdRodadas ? (
          <div className="max-w-lg mx-auto text-center py-6 space-y-4">
            <div className="text-xl font-semibold">Todas as {torneio.qtdRodadas} rodadas foram jogadas</div>
            {podeEditar ? (
              <>
                <div className="text-fg-dim text-sm">Finalize o torneio quando quiser.</div>
                <button className="btn-primary text-lg font-black" onClick={finalizar}>
                  <IconeCoroa cor="currentColor" /> Finalizar torneio
                </button>
              </>
            ) : (
              <div className="text-fg-dim text-sm">Aguardando o organizador finalizar o torneio.</div>
            )}
          </div>
        ) : (
          <div className="max-w-lg mx-auto text-center py-6 space-y-4">
            <div className="text-2xl font-semibold">
              Rodada {torneio.rodadaAtual + 1} de {torneio.qtdRodadas}
            </div>
            <div className="text-fg-dim">
              {contar(ativos, "jogador ativo", "jogadores ativos")} · {torneio.tempoRodadaMin}min + {torneio.tempoExtraMin}min extra
            </div>
            {podeEditar ? (
              <button
                className="btn-success text-lg font-black w-full max-w-sm mx-auto"
                onClick={iniciar}
                disabled={!podeIniciar}
              >
                <IconePlay cor="currentColor" /> Iniciar rodada {torneio.rodadaAtual + 1}
              </button>
            ) : (
              <div className="text-fg-dim text-sm">Aguardando o organizador iniciar a rodada.</div>
            )}
            {podeEditar && ativos < 3 && (
              <div className="text-perigo text-sm">Adicione pelo menos 3 jogadores ativos.</div>
            )}
            {botaoEncerrarAntes}
          </div>
        )}
      </div>
    );
  }

  // Com rodada em andamento
  return (
    <div className="space-y-4 w-full">
      {minha?.mesa && <CartaoMinhaMesa minha={minha} mostrarTempo={verTempo} />}

      {/* Quem só acompanha e está jogando já vê o tempo no cartão acima */}
      {verTempo && (podeEditar || !minha?.mesa) && (
      <div className="card flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="label mb-1">Rodada {torneio.rodadaAtual} de {torneio.qtdRodadas}</div>
          <div className={`text-5xl font-mono font-bold tabular-nums
                          ${timer.emExtra ? "text-atencao" : "text-acento"}`}>
            {formatarTempo(timer.restante)}
          </div>
          <div className="text-xs text-fg-dim mt-1">
            {timer.emExtra ? "TEMPO EXTRA" : "Tempo normal"} · fase: {formatarTempo(timer.restanteFase)}
          </div>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2 justify-center">
            {!timer.rodando ? (
              <button className="btn-success" onClick={timer.iniciar}><IconePlay cor="currentColor" /> Iniciar</button>
            ) : timer.pausado ? (
              <button className="btn-warning" onClick={timer.iniciar}><IconePlay cor="currentColor" /> Retomar</button>
            ) : (
              <button className="btn-warning" onClick={timer.pausar}><IconePausa cor="currentColor" /> Pausar</button>
            )}
            <button className="btn-danger" onClick={timer.parar}><IconeParar cor="currentColor" /> Parar</button>
            <button className="btn-ghost" onClick={timer.resetar}><IconeReiniciar cor="currentColor" /> Reset</button>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        {podeEditar && nenhumaFinalizada && (
          <button className="btn-warning" onClick={resortear} title="Refaz o pareamento desta rodada">
            <IconeEmbaralhar cor="currentColor" /> Resortear mesas
          </button>
        )}
        {podeEditar && torneio.rodadaAtual === 1 && !torneio.finalizado && (
          <button className="btn-ghost" onClick={voltarInicio} title="Só na rodada 1: apaga as mesas e os resultados dela">
            <IconeReiniciar cor="currentColor" /> Voltar ao início
          </button>
        )}
        {podeEditar && !torneio.finalizado && (
          <button className="btn-ghost" onClick={avisarDeNovo} disabled={avisando} title="Manda de novo a mesa de cada jogador para o celular">
            <IconeSino cor="currentColor" /> {avisando ? "Avisando..." : "Avisar mesas"}
          </button>
        )}
        {podeEditar && (
          <button className="btn-ghost" onClick={() => setAvisosTorneioAberto(true)} title="Escolher quais notificações este torneio manda">
            <IconeEngrenagem cor="currentColor" /> Notificações
          </button>
        )}
        {podeEditar && (
          <button className="btn-info" onClick={copiarWhatsApp}>
            <IconeCopiar cor="currentColor" /> Copiar (WhatsApp)
          </button>
        )}
        {podeEditar && rodadaConcluida && torneio.rodadaAtual < torneio.qtdRodadas && (
          <button className="btn-success" onClick={iniciar} disabled={!podeIniciar}>
            <IconePlay cor="currentColor" /> Nova rodada ({torneio.rodadaAtual + 1}/{torneio.qtdRodadas})
          </button>
        )}
        {podeEditar && podeFinalizar && (
          <button className="btn-primary font-black" onClick={finalizar}>
            <IconeCoroa cor="currentColor" /> Finalizar torneio
          </button>
        )}
        {botaoEncerrarAntes}
      </div>

      {pendentes.length > 0 && (
        <section>
          <h2 className="label mb-2">Mesas em andamento ({pendentes.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendentes.map(({ m, i }) => (
              <CardMesa
                key={`p${i}`}
                mesa={m}
                jogadoresPorId={jogadoresPorId}
                deckPorId={deckPorId}
                onClick={podeEditar ? () => setMesaSel({ mesa: m, idx: i }) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {finalizadas.length > 0 && (
        <section>
          <h2 className="label mb-2">Mesas finalizadas ({finalizadas.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {finalizadas.map(({ m, i }) => (
              <CardMesa
                key={`f${i}`}
                mesa={m}
                jogadoresPorId={jogadoresPorId}
                deckPorId={deckPorId}
                onClick={podeEditar ? () => setMesaSel({ mesa: m, idx: i }) : undefined}
              />
            ))}
          </div>
        </section>
      )}


      <Modal
        open={mesaSel !== null}
        onClose={() => setMesaSel(null)}
        title={mesaSel ? `${mesaSel.mesa.finalizada ? "Editar" : "Resultado"} — Mesa ${mesaSel.mesa.numero}` : ""}
        maxW="max-w-lg"
      >
        {mesaSel && (
          <DialogoResultado
            mesa={mesaSel.mesa}
            mesaIdx={mesaSel.idx}
            jogadoresPorId={jogadoresPorId}
            onFechar={() => setMesaSel(null)}
          />
        )}
      </Modal>
      {podeEditar && (
        <DialogoAvisosTorneio torneio={torneio} aberto={avisosTorneioAberto} onFechar={() => setAvisosTorneioAberto(false)} />
      )}
    </div>
  );
}

function CardMesa({
  mesa,
  jogadoresPorId,
  deckPorId,
  onClick,
}: {
  mesa: Mesa;
  jogadoresPorId: Map<number, string>;
  deckPorId: Map<number, string>;
  onClick?: () => void;
}) {
  const finalizada = mesa.finalizada;
  const parcial = !finalizada && (mesa.eliminacoes.length > 0 || mesa.empateTopoIds.length > 0);
  const ordem = finalizada ? construirOrdem(mesa) : mesa.jogadoresIds;
  // Mapa id → colocação REAL (respeita empates)
  const colocacaoPorId = finalizada || parcial ? calcularColocacoes(mesa) : new Map<number, number>();
  const eliminados = new Set(mesa.eliminacoes.flat());

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-xl p-4 border-2 transition hover:brightness-125
                  ${finalizada ? "border-sucesso/40" : "border-info/40"}`}
      style={{ background: "var(--card-fundo)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-black text-lg">Mesa {mesa.numero}</div>
        {finalizada ? (
          <span className="text-xs bg-sucesso text-bg font-bold px-2 py-0.5 rounded">
            <IconeCheckMesa cor="currentColor" />{mesa.empateTopoIds.length > 1 ? ` empate K=${mesa.empateTopoIds.length}` : ""}
          </span>
        ) : parcial ? (
          <span className="text-xs bg-atencao text-bg font-bold px-2 py-0.5 rounded">PARCIAL</span>
        ) : (
          <span className="text-xs bg-info text-bg font-bold px-2 py-0.5 rounded">JOGANDO</span>
        )}
      </div>
      <div className="text-sm space-y-1">
        {ordem.map((id, i) => {
          const col = colocacaoPorId.get(id) ?? (i + 1);
          return (
          <div key={id} className="flex items-center gap-2">
            {(finalizada || colocacaoPorId.has(id)) && (
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                ${col === 1 ? "bg-atencao text-bg"
                                  : col === 2 ? "bg-gray-300 text-bg"
                                  : col === 3 ? "bg-orange-400 text-bg"
                                  : "bg-fg-muted text-bg"}`}>
                {col}
              </span>
            )}
            <span className="min-w-0">
              <span className={
                col === 1 && finalizada ? "font-bold"
                  : parcial && eliminados.has(id) ? "line-through text-fg-muted" : ""
              }>
                {jogadoresPorId.get(id) ?? "?"}
              </span>
              {deckPorId.get(id) && (
                <span className="block text-xs text-fg-dim break-words">
                  {[deckPorId.get(id), comandanteDoDeck(deckPorId.get(id)!)].filter(Boolean).join(" · ")}
                  {coresDoDeck(deckPorId.get(id)!) !== null && (
                    <> <CoresMana cores={coresDoDeck(deckPorId.get(id)!)!} tamanho={13} /></>
                  )}
                </span>
              )}
            </span>
          </div>
        );
        })}
      </div>
    </button>
  );
}

function construirOrdem(mesa: Mesa): number[] {
  const ordem: number[] = [];
  if (mesa.empateTopoIds.length) ordem.push(...mesa.empateTopoIds);
  else if (mesa.vencedorId !== null) ordem.push(mesa.vencedorId);
  const gruposInv = [...mesa.eliminacoes].reverse();
  for (const g of gruposInv) ordem.push(...g);
  const vistos = new Set(ordem);
  for (const id of mesa.jogadoresIds) {
    if (!vistos.has(id)) { ordem.push(id); vistos.add(id); }
  }
  return ordem;
}
