import { useEffect, useRef, useState } from "react";
import { IconeAmpulheta, IconeCheck, IconeInfo, IconeLapis, IconeMais, IconeSair, IconeSino } from "./ui/Icones";
import { sair, desvincularNome, type AuthState } from "../core/auth";
import { temEnviosPendentes } from "../core/sync";
import { useStore, type ModoView } from "../core/store";
import { useToast } from "./ui/Toast";
import { confirmar } from "./ui/Confirm";
import { IconeAlvo, IconeCadeado, IconeCoroa, IconePessoa } from "./ui/Icones";
import { DialogoExcluirConta } from "./DialogoExcluirConta";
import { DialogoSobre } from "./DialogoSobre";
import { DialogoPro } from "./DialogoPro";
import { formatarData, statusPro, type Plano } from "../core/pro";
import { podeVenderNoApp } from "../core/plataforma";
import { useAvisos } from "../core/notificacoes";

interface Props {
  auth: AuthState;
  onLoginClick?: () => void;
  onSair?: () => void;
  onVincularNome?: () => void;
}

function IconeDoModo({ modo, cor }: { modo: ModoView; cor: string }) {
  const Icone = modo === "admin" ? IconeCoroa : modo === "organizador" ? IconeAlvo : IconePessoa;
  return <Icone tamanho={14} cor={cor} />;
}

export function AuthChip({ auth, onLoginClick, onSair, onVincularNome }: Props) {
  const modoView = useStore((s) => s.modoView);
  const setModoView = useStore((s) => s.setModoView);

  // Modos disponíveis pra esse usuário
  const modosDisp: ModoView[] = [];
  if (auth.isAdmin) modosDisp.push("admin");
  if (auth.isOrganizador || auth.isAdmin) modosDisp.push("organizador");
  modosDisp.push("jogador"); // Qualquer usuário pode ver como jogador
  // Jogador é default; só valida se o modo atual ainda é permitido
  if (auth.perfilCarregado && !modosDisp.includes(modoView)) {
    setTimeout(() => setModoView("jogador"), 0);
  }

  const labelModo = (m: ModoView) => (
    <><IconeDoModo modo={m} cor="currentColor" /> {m === "admin" ? "Administrador" : m === "organizador" ? "Organizador" : "Jogador"}</>
  );
  // Todos os modos em dourado, como o resto da marca
  const corModo = (_m: ModoView) => "var(--brand-1)";
  const DOURADO_FUNDO = "rgba(201,166,72,0.10)";
  const DOURADO_BORDA = "rgba(201,166,72,0.35)";

  const { toast } = useToast();
  const [abrindoMenu, setAbrindoMenu] = useState(false);
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [planoAberto, setPlanoAberto] = useState<Plano | null>(null);
  const pro = statusPro(auth);
  // No app da Play Store cada plano só aparece para quem já tem (a compra é pelo site)
  const venda = podeVenderNoApp();
  const planosNoMenu: { plano: Plano; nome: string; ativo: boolean; ate: string | null }[] = [
    { plano: "jogador" as Plano, nome: "Jogador Pro", ativo: pro.jogador, ate: pro.ate.jogador ?? pro.ate.organizador },
    ...((auth.isOrganizador || auth.isAdmin)
      ? [{ plano: "organizador" as Plano, nome: "Organizador Pro", ativo: pro.organizador, ate: pro.ate.organizador }]
      : []),
  ].filter((p) => venda || p.ativo);
  const avisos = useAvisos();
  const raiz = useRef<HTMLDivElement>(null);
  const [abrirParaDireita, setAbrirParaDireita] = useState(false);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!abrindoMenu) return;
    const aoClicar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbrindoMenu(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbrindoMenu(false);
    };
    document.addEventListener("pointerdown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [abrindoMenu]);

  if (auth.loading) return null;

  if (!auth.session) {
    return (
      <button
        onClick={onLoginClick}
        className="rounded-full px-3 md:px-4 py-2 font-semibold text-xs md:text-sm transition active:scale-95 flex items-center gap-1.5"
        style={{
          background: "linear-gradient(135deg, var(--brand-1), var(--brand-2))",
          color: "#fff",
        }}
      >
        <IconeCadeado cor="currentColor" /> <span className="hidden sm:inline">Login</span>
      </button>
    );
  }

  const email = auth.session.user.email || "";
  const emailCurto = email.split("@")[0];

  return (
    <div ref={raiz} className="relative flex-shrink-0">
      <button
        onClick={() => {
          // Perto da borda esquerda, abrir para a esquerda cortaria o menu
          setAbrirParaDireita((raiz.current?.getBoundingClientRect().right ?? 999) < 280);
          setAbrindoMenu((v) => !v);
        }}
        className="flex items-center gap-1.5 md:gap-2 rounded-full px-2 md:px-3 py-1.5 transition hover:bg-white/5"
        style={{
          background: DOURADO_FUNDO,
          border: `1px solid ${DOURADO_BORDA}`,
        }}
      >
        <span className="text-xs">
          <IconeDoModo modo={modoView} cor={corModo(modoView)} />
        </span>
        <span
          className="text-[10px] font-bold tracking-widest uppercase hidden xl:inline"
          style={{ color: corModo(modoView) }}
        >
          {modoView === "admin" ? "ADMINISTRADOR" : modoView === "organizador" ? "ORGANIZADOR" : "JOGADOR"}
        </span>
        {/* Em celular bem estreito só o ícone aparece, para o logo caber; o menu mostra a conta inteira */}
        <span className="text-xs truncate hidden min-[420px]:inline max-w-[96px] sm:max-w-[110px] md:max-w-[140px]" style={{ color: "var(--text-label)" }}>
          {/* Sempre o nick; o e-mail só aparece sem nome vinculado */}
          {auth.nomesJogador[0] ?? emailCurto}
        </span>
      </button>

      {abrindoMenu && (
        <>
          <div
            className={`absolute ${abrirParaDireita ? "left-0" : "right-0"} mt-1 rounded-lg shadow-2xl z-40 min-w-[180px] w-max max-w-[calc(100vw-2rem)] overflow-hidden`}
            style={{
              background: "var(--ds-surface-2)",
              border: "1px solid rgba(201,166,72,0.2)",
            }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
              <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                   style={{ color: "var(--brand-1)" }}>
                {auth.isAdmin && <span><IconeCoroa cor="currentColor" /> Administrador</span>}
                {!auth.isAdmin && <span><IconePessoa cor="currentColor" /> Jogador</span>}
                {auth.isAdmin && auth.nomesJogador.length > 0 && (
                  <span>+ <IconePessoa cor="currentColor" /> Jogador</span>
                )}
              </div>
              {auth.nomesJogador[0] && (
                <div className="text-sm font-semibold mt-1 truncate" style={{ color: "var(--text-strong)" }}>
                  {auth.nomesJogador[0]}
                </div>
              )}
              <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                {email}
              </div>
              {auth.nomesJogador.length > 1 && (
                <div className="text-[11px] mt-1" style={{ color: "var(--text-2)" }}>
                  Nome(s): <span style={{ color: "var(--text-label)" }}>{auth.nomesJogador.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Seletor de modo de visualização */}
            {modosDisp.length > 1 && (
              <div className="px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
                <div className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "var(--text-muted-ds)" }}>
                  Ver como:
                </div>
                <div className="flex flex-col gap-1">
                  {modosDisp.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setModoView(m); setAbrindoMenu(false); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition text-xs"
                      style={{
                        background: m === modoView ? DOURADO_FUNDO : "transparent",
                        border: `1px solid ${m === modoView ? DOURADO_BORDA : "transparent"}`,
                        color: m === modoView ? corModo(m) : "#c4c4c4",
                      }}
                    >
                      {labelModo(m)}
                      {m === modoView && <span className="ml-auto"><IconeCheck cor="currentColor" /></span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Só o admin pode estar sem nome, pois a conta nova já vincula um ao ser criada */}
            <button
              onClick={() => { setAbrindoMenu(false); onVincularNome?.(); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
              style={{ color: "var(--brand-1)" }}
            >
              {auth.nomesJogador.length + auth.nomesPendentes.length === 0
                ? <><IconeMais cor="currentColor" /> Vincular meu nome</>
                : <><IconeLapis cor="currentColor" /> Trocar nome</>}
            </button>

            {/* Remover nomes existentes */}
            {auth.nomesPendentes.length > 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--brand-1)" }}>
                <IconeAmpulheta cor="currentColor" /> Aguardando aprovação: {auth.nomesPendentes.join(", ")}
              </div>
            )}
            {[...auth.nomesJogador, ...auth.nomesPendentes].map((n) => (
              <button
                key={n}
                onClick={async () => {
                  setAbrindoMenu(false);
                  const ok = await confirmar({
                    titulo: "Remover nome",
                    mensagem: `Remover "${n}" da sua conta? Você vai parar de ver os torneios desse nome.`,
                    textoOk: "Remover",
                    perigo: true,
                  });
                  if (!ok) return;
                  await desvincularNome(n);
                  toast(`"${n}" removido`, "info");
                  window.location.reload();
                }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition"
                style={{ color: "var(--text-2)" }}
              >
                − Remover "{n}"
              </button>
            ))}

            {planosNoMenu.length > 0 && (
              <div style={{ borderTop: "1px solid var(--line)" }}>
                {planosNoMenu.map((p) => (
                  <button
                    key={p.plano}
                    onClick={() => { setAbrindoMenu(false); setPlanoAberto(p.plano); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
                    style={{ color: "var(--brand-1)" }}
                  >
                    {p.plano === "organizador" ? <IconeCoroa cor="currentColor" /> : <IconePessoa cor="currentColor" />} {p.nome}
                    <span className="block text-[10px] pl-5" style={{ color: "var(--text-2)" }}>
                      {pro.ehAdmin ? "incluído para administradores" : p.ativo && p.ate ? `ativo até ${formatarData(p.ate)}` : "conheça e assine"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--line)" }}>
              {avisos.estado !== "sem-suporte" && (auth.verMesas || auth.isAdmin) && (
                <button
                  onClick={async () => {
                    if (avisos.estado === "bloqueado") {
                      toast("Os avisos estão bloqueados no navegador. Libere nas configurações do site.", "aviso");
                      return;
                    }
                    try {
                      await avisos.alternar();
                    } catch (e: any) {
                      toast("Não foi possível mudar os avisos: " + (e?.message ?? ""), "erro");
                    }
                  }}
                  disabled={avisos.ocupado}
                  className="block w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition"
                  style={{ color: "var(--text-2)" }}
                >
                  <IconeSino cor="currentColor" /> Avisos da mesa: {avisos.estado === "ligado" ? "ligados" : avisos.estado === "bloqueado" ? "bloqueados" : "desligados"}
                </button>
              )}
              <button
                onClick={() => { setAbrindoMenu(false); setSobreAberto(true); }}
                className="block w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition"
                style={{ color: "var(--text-2)" }}
              >
                <IconeInfo cor="currentColor" /> Sobre o app
              </button>
              <a
                href="privacidade.html"
                target="_blank"
                rel="noopener"
                onClick={() => setAbrindoMenu(false)}
                className="block w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition"
                style={{ color: "var(--text-2)" }}
              >
                Política de privacidade
              </a>
              <button
                onClick={() => { setAbrindoMenu(false); setExcluindoConta(true); }}
                className="block w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition"
                style={{ color: "var(--text-2)" }}
              >
                Excluir minha conta
              </button>
            </div>

            {/* Sair fica por último, separado */}
            <div style={{ borderTop: "1px solid var(--line)" }}>
              <button
                onClick={async () => {
                  setAbrindoMenu(false);
                  if (temEnviosPendentes()) {
                    const ok = await confirmar({
                      titulo: "Sair da conta",
                      mensagem: "Há alterações que ainda não foram enviadas e serão perdidas se você sair.",
                      textoOk: "Sair mesmo assim",
                      perigo: true,
                    });
                    if (!ok) return;
                  }
                  await sair();
                  toast("Você saiu da conta", "info");
                  onSair?.();
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition"
                style={{ color: "var(--critical)" }}
              >
                <IconeSair cor="currentColor" /> Sair
              </button>
            </div>
          </div>
        </>
      )}
      <DialogoSobre aberto={sobreAberto} onFechar={() => setSobreAberto(false)} />
      <DialogoPro aberto={planoAberto !== null} plano={planoAberto ?? "jogador"} onFechar={() => setPlanoAberto(null)} />
      <DialogoExcluirConta
        aberto={excluindoConta}
        email={auth.session?.user?.email ?? ""}
        onFechar={() => setExcluindoConta(false)}
        onExcluida={() => { setExcluindoConta(false); toast("Sua conta foi excluída", "info"); onSair?.(); }}
      />
    </div>
  );
}
