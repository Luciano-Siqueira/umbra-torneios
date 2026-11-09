import { useEffect, useState, useRef } from "react";
import { listarUsuarios } from "../core/admin";
import { useStore } from "../core/store";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { confirmar } from "./ui/Confirm";
import { DialogoTorneio } from "./DialogoTorneio";
import type { Torneio } from "../core/types";
import { exportarTudo, importarTudo } from "../core/backup";
import { useAuth } from "../core/auth";
import { AuthChip } from "./AuthChip";
import { calcularMetricas, metricasRecentes } from "../core/metricas";
import { ranking } from "../core/resultados";
import { podeEditarTorneios, torneioParado, torneiosVisiveis } from "../core/visibilidade";
import { BANNER_IMAGE } from "../banner-image";
import { EscritaUmbra, IconeDecks } from "./ui/LogoUmbra";
import { SegredoUmbra } from "./ui/SegredoUmbra";
import { CartaoAvisos } from "./CartaoAvisos";
import { SeloStatus } from "./ui/SeloStatus";
import { filtrarPorPeriodo, filtrarTorneios } from "../core/buscaTorneios";
import {
  IconeAlerta, IconeAnalytics, IconeBaixar, IconeBusca, IconeCaixa, IconeDado, IconeDocumento, IconeHistorico,
  IconeLapis, IconeLixeira, IconePasta, IconePlay, IconeRaio, IconeReiniciar, IconeTrofeu, IconeUsuarios,
} from "./ui/Icones";
import { SimboloMana, type CorMana } from "./ui/SimboloMana";
import { ItemMenu, MenuBarra, TituloMenu } from "./ui/MenuBarra";
import { contar, formatarNumero, formatarReais } from "../core/formato";

const CORES_MTG: { hex: string; nome: string; mana: CorMana }[] = [
  { hex: "#f9f5e3", nome: "PLAINS", mana: "w" },
  { hex: "#5b9bd5", nome: "ISLAND", mana: "u" },
  { hex: "#6d5e7d", nome: "SWAMP", mana: "b" },
  { hex: "#e15b5b", nome: "MOUNTAIN", mana: "r" },
  { hex: "#7bc47f", nome: "FOREST", mana: "g" },
];

function EsqueletoTorneios() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Carregando torneios">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 rounded-2xl border animate-pulse"
          style={{ background: "rgba(15,15,15,0.6)", borderColor: "rgba(201,166,72,0.2)" }}
        />
      ))}
    </div>
  );
}

export function TelaTorneios({ onPedirLogin, onVincularNome }: { onPedirLogin?: () => void; onVincularNome?: () => void } = {}) {
  const torneiosAll = useStore((s) => s.torneios);
  const sincronizando = useStore((s) => s.sincronizando);
  const modoView = useStore((s) => s.modoView);
  const abrirTorneio = useStore((s) => s.abrirTorneio);
  const removerTorneio = useStore((s) => s.removerTorneio);
  const importarTorneio = useStore((s) => s.importarTorneio);
  const criarTorneioTeste = useStore((s) => s.criarTorneioTeste);
  const auth = useAuth();
  // Edição liberada só pra admin em modo admin (ou organizador em modo organizador)
  const podeEditar = podeEditarTorneios(modoView, auth);

  // Filtra torneios conforme modo de visualização atual
  const torneios = torneiosVisiveis(torneiosAll, modoView, auth);
  // Torneio atualmente "em andamento" (rodada > 0, não finalizado) — mais recente
  const torneioEmAndamento = torneios
    .filter((t) => !t.finalizado && t.rodadaAtual > 0 && !torneioParado(t))
    .sort((a, b) => (b.dataCriacao || "").localeCompare(a.dataCriacao || ""))[0];
  const torneiosParados = podeEditar ? torneios.filter((t) => torneioParado(t)) : [];
  const verCriador = auth.isAdmin && modoView === "admin";
  const [nomesDasContas, setNomesDasContas] = useState<Map<string, string>>(new Map());
  const [emailsDasContas, setEmailsDasContas] = useState<Map<string, string>>(new Map());
  const [busca, setBusca] = useState("");
  const [periodoDe, setPeriodoDe] = useState(""); // AAAA-MM-DD, do calendário
  const [periodoAte, setPeriodoAte] = useState("");
  // Só o admin consulta a lista de contas. Conta sem nome vinculado fica sem a linha "Criado por"
  useEffect(() => {
    if (!verCriador) {
      setNomesDasContas(new Map());
      setEmailsDasContas(new Map());
      return;
    }
    let ativo = true;
    listarUsuarios().then(
      (contas) => {
        if (!ativo) return;
        setNomesDasContas(new Map(
          contas.filter((c) => c.nomes_jogador.length > 0).map((c) => [c.user_id, c.nomes_jogador[0]])
        ));
        setEmailsDasContas(new Map(contas.map((c) => [c.user_id, c.email])));
      },
      () => { /* sem a lista, os cards seguem sem essa informação */ }
    );
    return () => { ativo = false; };
  }, [verCriador]);
  const metricas = calcularMetricas(torneios);
  // Busca só para quem gerencia: o admin acha também por quem organizou (nome ou e-mail)
  const mostrarBusca = podeEditar && torneios.length > 0;
  const torneiosDaLista = mostrarBusca
    ? filtrarPorPeriodo(
        filtrarTorneios(torneios, busca, (t) =>
          verCriador && t.criadoPor ? `${nomesDasContas.get(t.criadoPor) ?? ""} ${emailsDasContas.get(t.criadoPor) ?? ""}` : ""),
        periodoDe,
        periodoAte,
      )
    : torneios;
  const filtrando = Boolean(busca.trim() || periodoDe || periodoAte);
  const ult30 = metricasRecentes(torneios, 30);
  const ultimoCampeao = (() => {
    const finalizados = torneios
      .filter((t) => t.finalizado)
      .sort((a, b) => (b.dataCriacao || "").localeCompare(a.dataCriacao || ""));
    if (finalizados.length === 0) return null;
    const t = finalizados[0];
    const campeao = ranking(t)[0];
    return campeao ? { nome: campeao.nome, torneio: t.nome } : null;
  })();
  const irPara = useStore((s) => s.irPara);
  const { toast } = useToast();
  const [dialogoAberto, setDialogoAberto] = useState<null | "novo" | "editar">(null);
  const [editando, setEditando] = useState<Torneio | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const recarregar = useStore((s) => s.recarregar);

  const editar = (t: Torneio) => {
    setEditando(t);
    setDialogoAberto("editar");
  };

  const exportar = (t: Torneio) => {
    const json = JSON.stringify(t, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Torneio exportado", "sucesso");
  };

  const excluir = async (t: Torneio) => {
    const ok = await confirmar({
      titulo: "Confirmar exclusão",
      mensagem: `Excluir permanentemente o torneio "${t.nome}"?`,
      perigo: true,
      textoOk: "Excluir",
    });
    if (ok) {
      removerTorneio(t.id);
      toast("Torneio excluído", "sucesso");
    }
  };

  const importar = () => fileRef.current?.click();

  const onFileImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const texto = await f.text();
      const t = JSON.parse(texto) as Torneio;
      if (!t.id || !t.nome) {
        toast("Erro: JSON inválido", "erro");
      } else {
        importarTorneio(t);
        toast(`Importado: ${t.nome}`, "sucesso");
      }
    } catch (err: any) {
      toast(`Erro: ${err.message}`, "erro");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div
      className="min-h-screen text-fg relative"
      style={{
        // Overlay bem leve: dragões continuam visíveis na tela inteira
        backgroundImage: `linear-gradient(to bottom,
          rgba(10,10,10,0.25) 0%,
          rgba(10,10,10,0.45) 60%,
          rgba(10,10,10,0.55) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Topbar fixa estilo navbar */}
      <div className="sticky top-0 z-30 px-4 md:px-8 py-3"
        style={{
          background: "linear-gradient(to bottom, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.0) 100%)",
        }}
      >
        <div
          className="flex md:flex-wrap gap-2 items-center rounded-full pl-2 pr-3 py-2 border"
          style={{
            background: "rgba(15,15,15,0.72)",
            borderColor: "rgba(201,166,72,0.18)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            boxShadow: "0 20px 60px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <span className="flex items-center pl-2 pr-1"><SegredoUmbra tamanho={26} /></span>
          {/* O logo nunca encolhe; quem cede espaço em tela estreita é o nome da conta */}
          <span className="flex-1 md:flex-none pr-1"><EscritaUmbra tamanho={14} /></span>

          {/* CTA principal — só admin vê */}
          {podeEditar && (
            <>
              <button
                className="rounded-full px-4 xl:px-5 py-2 font-semibold text-sm transition active:scale-95 text-white hidden md:flex items-center gap-2"
                style={{
                  background: "var(--sig-d)",
                  boxShadow: "0 6px 24px -4px rgba(201,166,72,0.55), inset 0 1px 0 rgba(255,255,255,0.2)"
                }}
                onClick={() => setDialogoAberto("novo")}
              >
                <span className="text-base leading-none">+</span>
                <span>Novo torneio</span>
              </button>
              <div className="hidden md:block w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            </>
          )}

          {/* Analytics — destaque sutil */}
          <button
            className="rounded-full px-3 xl:px-4 py-2 font-semibold text-sm transition active:scale-95 hidden md:flex items-center gap-1.5"
            style={{
              background: "rgba(201,166,72,0.12)",
              color: "var(--action)",
              border: "1px solid rgba(201,166,72,0.25)"
            }}
            onClick={() => irPara("analytics")}
          >
            <IconeAnalytics tamanho={18} />
            <span>Analytics</span>
          </button>

          {/* Decks — só admin, no modo admin */}
          {auth.isAdmin && modoView === "admin" && (
            <button
              className="rounded-full px-3 xl:px-4 py-2 font-semibold text-sm transition active:scale-95 hidden md:flex items-center gap-1.5"
              style={{
                background: "rgba(201,166,72,0.12)",
                color: "var(--action)",
                border: "1px solid rgba(201,166,72,0.25)"
              }}
              onClick={() => irPara("decks")}
            >
              <IconeDecks tamanho={18} />
              <span>Decks</span>
            </button>
          )}

          {/* Botão Gerenciar Usuários — só admin, no modo admin */}
          {auth.isAdmin && modoView === "admin" && (
            <button
              className="rounded-full px-3 xl:px-4 py-2 font-semibold text-sm transition active:scale-95 hidden md:flex items-center gap-1.5"
              style={{
                background: "rgba(201,166,72,0.12)",
                color: "var(--brand-1)",
                border: "1px solid rgba(201,166,72,0.3)"
              }}
              onClick={() => irPara("usuarios")}
            >
              <IconeUsuarios tamanho={18} />
              <span>Usuários</span>
            </button>
          )}

        {/* Importar e exportar — só edição liberada */}
        {podeEditar && (
          <MenuBarra icone={<IconePasta tamanho={18} />} rotulo="Importar / Exportar">
            <TituloMenu>Importar</TituloMenu>
            <ItemMenu onClick={importar}><IconeDocumento /> Torneio (JSON)</ItemMenu>
            <ItemMenu onClick={() => backupRef.current?.click()}><IconeCaixa /> Backup completo</ItemMenu>
            <ItemMenu
              onClick={() => {
                const t = criarTorneioTeste();
                toast(`Torneio teste criado: 29 jogadores`, "sucesso");
                abrirTorneio(t.id);
              }}
            ><IconeDado /> Torneio de teste</ItemMenu>
            <div className="border-t border-bg-cardalt mt-1" />
            <TituloMenu>Exportar</TituloMenu>
            <ItemMenu
              onClick={() => {
                exportarTudo();
                toast("Backup baixado", "sucesso");
              }}
            ><IconeCaixa /> Backup completo</ItemMenu>
          </MenuBarra>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onFileImportar}
        />
        <input
          ref={backupRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const texto = await f.text();
              const res = await importarTudo(texto);
              recarregar();
              if (res.errosNuvem.length > 0) {
                toast(`Restaurado local: ${res.torneios} torneios. Erro nuvem: ${res.errosNuvem[0]}`, "aviso");
              } else {
                const copias = res.copias > 0 ? ` · ${res.copias} de outra conta viraram cópia sua` : "";
                toast(`Restaurado: ${res.torneios} torneios · ${res.nomes} nomes${copias} · sincronizado na nuvem`, "sucesso");
              }
            } catch (err: any) {
              toast(`Erro: ${err.message}`, "erro");
            }
            if (backupRef.current) backupRef.current.value = "";
          }}
        />

        <div className="hidden md:block w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} />
        </div>
      </div>

      {/* Faixa "Em andamento" + KPIs rápidos — colados abaixo do menu */}
      <div className="px-4 md:px-8 space-y-4 mb-4 mt-2">
        {/* Busca e período no topo, logo abaixo do menu */}
        {mostrarBusca && (
          <div
            className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl border"
            style={{ background: "rgba(15,15,15,0.78)", borderColor: "rgba(201,166,72,0.18)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          >
            <span className="relative flex-1 min-w-[200px] sm:max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><IconeBusca /></span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={verCriador ? "Buscar por torneio ou organizador" : "Buscar por torneio"}
              aria-label="Buscar torneios"
              className="input w-full !pl-9"
            />
            </span>
            {/* Período pela data de criação: o campo de data abre o calendário do aparelho */}
            <div className="flex gap-2 w-full sm:w-auto">
            <label className="flex flex-1 min-w-0 items-center gap-1.5 text-xs" style={{ color: "var(--text-label)" }}>
              De
              <input
                type="date"
                value={periodoDe}
                max={periodoAte || undefined}
                onChange={(e) => setPeriodoDe(e.target.value)}
                aria-label="Criados a partir de"
                className="input !py-1.5 !px-2 min-w-0 w-full sm:w-[9.5rem]"
                style={{ colorScheme: "dark" }}
              />
            </label>
            <label className="flex flex-1 min-w-0 items-center gap-1.5 text-xs" style={{ color: "var(--text-label)" }}>
              Até
              <input
                type="date"
                value={periodoAte}
                min={periodoDe || undefined}
                onChange={(e) => setPeriodoAte(e.target.value)}
                aria-label="Criados até"
                className="input !py-1.5 !px-2 min-w-0 w-full sm:w-[9.5rem]"
                style={{ colorScheme: "dark" }}
              />
            </label>
            </div>
            {filtrando && (
              <>
                <button
                  type="button"
                  className="text-xs underline"
                  style={{ color: "var(--brand-1)" }}
                  onClick={() => { setBusca(""); setPeriodoDe(""); setPeriodoAte(""); }}
                >
                  Limpar
                </button>
                <span className="text-xs" style={{ color: "var(--text-2)" }}>
                  {torneiosDaLista.length} de {contar(torneios.length, "torneio")}
                </span>
              </>
            )}
          </div>
        )}

        {/* Avisos da mesa: só para quem pode ver as mesas */}
        {auth.session && (auth.verMesas || auth.isAdmin) && <CartaoAvisos uid={auth.session.user.id} />}
        {torneioEmAndamento && (
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition hover:brightness-110"
            style={{
              background: "linear-gradient(90deg, rgba(252,211,77,0.12), rgba(252,211,77,0.03))",
              borderColor: "rgba(252,211,77,0.35)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: "0 10px 40px -20px rgba(252,211,77,0.4)",
            }}
            onClick={() => abrirTorneio(torneioEmAndamento.id)}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(252,211,77,0.35), rgba(252,211,77,0.1))",
                color: "var(--warn)",
                border: "1px solid rgba(252,211,77,0.35)",
                animation: "pulseAtivo 2s ease-in-out infinite",
              }}
            ><IconeRaio tamanho={28} cor="currentColor" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--warn)" }}>
                EM ANDAMENTO
              </div>
              <div className="text-base md:text-lg font-semibold truncate" style={{ color: "var(--text-strong)" }}>
                {torneioEmAndamento.nome} · Rodada {torneioEmAndamento.rodadaAtual} de {torneioEmAndamento.qtdRodadas}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                {contar(torneioEmAndamento.mesas.length, "mesa")} · {contar(torneioEmAndamento.jogadores.length, "jogador", "jogadores")}
              </div>
            </div>
            <button
              className="rounded-xl px-5 py-2.5 font-bold text-sm transition active:scale-95 flex-shrink-0"
              style={{
                background: "var(--warn)",
                color: "var(--page-1)",
                boxShadow: "0 4px 16px -4px rgba(252,211,77,0.5)",
              }}
              onClick={(e) => { e.stopPropagation(); abrirTorneio(torneioEmAndamento.id); }}
            ><span className="inline-flex items-center gap-1.5"><IconePlay cor="currentColor" /> Continuar</span></button>
          </div>
        )}

        {torneiosParados.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border text-sm"
            style={{
              background: "rgba(15,15,15,0.7)",
              borderColor: "rgba(252,211,77,0.3)",
              color: "var(--text-2)",
            }}
          >
            <span className="flex-1 min-w-[200px]">
              <IconeAlerta cor="var(--warn)" /> <b style={{ color: "var(--text-strong)" }}>{t.nome}</b> está parado na rodada {t.rodadaAtual} há mais de 3 dias.
              Abra para finalizar ou continuar.
            </span>
            <button className="btn-ghost text-sm" onClick={() => abrirTorneio(t.id)}>Abrir</button>
          </div>
        ))}

        {/* Mini KPIs */}
        {torneios.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKpi
              corFundo="rgba(201,166,72,0.1)"
              corBorda="rgba(201,166,72,0.25)"
              corLabel="var(--brand-1)"
              label="Torneios"
              valor={String(torneios.length)}
              sub={`${ult30.qtd} nos últimos 30 dias`}
            />
            <MiniKpi
              corFundo="rgba(201,166,72,0.1)"
              corBorda="rgba(201,166,72,0.25)"
              corLabel="var(--brand-1)"
              label="Jogadores únicos"
              valor={String(metricas.totalJogadoresUnicos)}
              sub={`média ${formatarNumero(metricas.mediaJogadoresPorTorneio, 1)} por torneio`}
            />
            <MiniKpi
              corFundo="rgba(201,166,72,0.1)"
              corBorda="rgba(201,166,72,0.25)"
              corLabel="var(--brand-1)"
              label="Partidas"
              valor={String(metricas.totalPartidas)}
              sub="no histórico"
            />
            <MiniKpi
              corFundo="rgba(201,166,72,0.1)"
              corBorda="rgba(201,166,72,0.25)"
              corLabel="var(--brand-1)"
              label="Último campeão"
              valor={ultimoCampeao ? ultimoCampeao.nome : "—"}
              icone={ultimoCampeao ? <IconeTrofeu /> : undefined}
              sub={ultimoCampeao ? ultimoCampeao.torneio : "nenhum torneio finalizado"}
              valorPequeno
            />
          </div>
        )}

      </div>

      {/* Grid de cards — ocupa toda a tela */}
      <main className="px-4 md:px-8 pb-24 md:pb-12">
        {torneios.length === 0 && (sincronizando || (!auth.perfilCarregado && !auth.perfilErro)) ? (
          <EsqueletoTorneios />
        ) : torneios.length === 0 ? (
          <div
            className="text-center py-16 px-8 rounded-2xl border max-w-xl mx-auto"
            style={{
              background: "rgba(15,15,15,0.6)",
              borderColor: "rgba(201,166,72,0.2)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <div className="mb-4 flex justify-center"><IconeTrofeu tamanho={48} /></div>
            <div className="text-xl font-bold mb-2" style={{ color: "var(--text-strong)" }}>
              {auth.isAdmin ? "Nenhum torneio ainda" : "Nenhum torneio para mostrar"}
            </div>
            <div className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
              {auth.isAdmin
                ? "Clique em + Novo torneio ou em Importar / Exportar para começar."
                : auth.session && auth.nomesPendentes.length > 0 && auth.nomesJogador.length === 0
                  ? <>O nome <b style={{color: "var(--brand-1)"}}>{auth.nomesPendentes.join(", ")}</b> está aguardando a aprovação do admin.<br/>Seus torneios aparecem aqui depois disso.</>
                : auth.session && auth.nomesJogador.length > 0
                  ? <>Você está vinculado como <b style={{color: "var(--text-label)"}}>{auth.nomesJogador.join(", ")}</b>.<br/>Peça pro admin adicionar você em algum torneio.</>
                  : auth.session
                    ? "Volte mais tarde — você ainda não está vinculado a um nome."
                    : "Entre ou crie uma conta para começar."}
            </div>
            {!auth.session && (
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-4 py-2 rounded-full border transition hover:bg-white/5"
                style={{ color: "var(--brand-1)", borderColor: "rgba(201,166,72,0.3)" }}
              >
                <IconeReiniciar cor="currentColor" /> Atualizar
              </button>
            )}
          </div>
        ) : (
          <>
          {torneiosDaLista.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-2)" }}>
              Nenhum torneio encontrado com esses filtros. Tente outro nome{verCriador ? ", outra pessoa" : ""} ou um período maior.
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {torneiosDaLista.map((t) => (
              <CardTorneio
                key={t.id}
                torneio={t}
                cor={CORES_MTG[torneios.indexOf(t) % CORES_MTG.length]}
                criadoPor={t.criadoPor ? nomesDasContas.get(t.criadoPor) : undefined}
                onAbrir={() => abrirTorneio(t.id)}
                acoes={podeEditar ? { editar: () => editar(t), exportar: () => exportar(t), excluir: () => excluir(t) } : undefined}
              />
            ))}
          </div>
          )}
          </>
        )}
      </main>

      {/* No celular, a barra superior dá lugar a este botão */}
      {podeEditar && (
        <button
          type="button"
          aria-label="Novo torneio"
          onClick={() => setDialogoAberto("novo")}
          className="md:hidden fixed right-4 bottom-20 z-30 w-14 h-14 rounded-full flex items-center justify-center text-3xl leading-none text-white active:scale-95 transition"
          style={{ background: "var(--sig-d)", boxShadow: "0 8px 24px -4px rgba(0,0,0,0.7)", marginBottom: "env(safe-area-inset-bottom)" }}
        >+</button>
      )}

      {/* Dialogos */}
      <Modal
        open={dialogoAberto !== null}
        onClose={() => setDialogoAberto(null)}
        title={dialogoAberto === "novo" ? "Novo Torneio" : "Editar Torneio"}
        maxW="max-w-lg"
      >
        <DialogoTorneio
          torneioExistente={dialogoAberto === "editar" ? editando : null}
          onFechar={() => setDialogoAberto(null)}
        />
      </Modal>
    </div>
  );
}


function CardTorneio({
  torneio,
  cor,
  criadoPor,
  onAbrir,
  acoes,
}: {
  torneio: Torneio;
  cor: typeof CORES_MTG[0];
  criadoPor?: string;
  onAbrir: () => void;
  acoes?: { editar: () => void; exportar: () => void; excluir: () => void };
}) {
  const data = torneio.dataCriacao
    ? new Date(torneio.dataCriacao).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "-";


  // Converte hex em rgba para efeitos
  const corRgba = (a: number) => {
    const h = cor.hex.replace("#", "");
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <div
      onClick={onAbrir}
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 border"
      style={{
        background: `linear-gradient(135deg, ${corRgba(0.22)} 0%, rgba(26,26,26,0.65) 55%, rgba(15,15,15,0.75) 100%)`,
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        borderColor: "rgba(255,255,255,0.1)",
        boxShadow: `0 15px 35px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* Glow colorido no fundo (visível no hover) */}
      <div
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 group-hover:opacity-40 transition-opacity blur-2xl pointer-events-none"
        style={{ background: cor.hex }}
      />

      {/* Barra colorida gradient no topo */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${cor.hex}, ${corRgba(0.4)})` }} />

      <div className="relative p-4">
        {/* Header: símbolo grande + status pill */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${corRgba(0.3)}, ${corRgba(0.1)})`,
              border: `1px solid ${corRgba(0.3)}`,
              boxShadow: `0 4px 12px -2px ${corRgba(0.3)}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            <SimboloMana cor={cor.mana} tamanho={34} />
          </div>
          <SeloStatus torneio={torneio} />
        </div>

        {/* Nome do torneio */}
        <h3 className={`font-semibold text-base leading-snug break-words tracking-tight ${criadoPor ? "" : "min-h-[3rem]"}`}
            style={{ color: "var(--text-strong)" }}>
          <button type="button" className="text-left break-words hover:underline" onClick={(e) => { e.stopPropagation(); onAbrir(); }}>
            {torneio.nome}
          </button>
        </h3>
        {criadoPor && (
          <div className="text-xs mt-0.5 min-h-[1.5rem] break-words" style={{ color: "var(--text-2)" }}>
            Criado por {criadoPor}
          </div>
        )}

        {/* Data */}
        <div className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
          <IconeHistorico tamanho={13} cor="currentColor" /> {data}
        </div>

        {/* Divisor com gradiente */}
        <div className="h-px my-3"
             style={{ background: `linear-gradient(90deg, transparent, ${corRgba(0.3)}, transparent)` }} />

        {/* Stats grid 2x2 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Stat label="JOGADORES" valor={String(torneio.jogadores.length)} cor={cor.hex} />
          <Stat
            label="RODADAS"
            valor={`${torneio.rodadaAtual}/${torneio.qtdRodadas}`}
            cor={cor.hex}
          />
          <Stat label="TEMPO" valor={`${torneio.tempoRodadaMin}min`} cor={cor.hex} />
          <Stat label="TAXA" valor={formatarReais(torneio.taxaInscricao)} cor={cor.hex} />
        </div>

        {acoes && (
          <div className="flex justify-end gap-1 mt-3 -mb-1">
            <AcaoDoCard titulo={`Editar ${torneio.nome}`} onClick={acoes.editar}><IconeLapis /></AcaoDoCard>
            <AcaoDoCard titulo={`Exportar ${torneio.nome}`} onClick={acoes.exportar}><IconeBaixar /></AcaoDoCard>
            <AcaoDoCard titulo={`Excluir ${torneio.nome}`} onClick={acoes.excluir}><IconeLixeira cor="var(--critical)" /></AcaoDoCard>
          </div>
        )}
      </div>
    </div>
  );
}

// O clique não pode chegar ao card, que abriria o torneio
function AcaoDoCard({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition hover:bg-white/10 active:scale-95"
    >
      {children}
    </button>
  );
}

function Stat({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold tracking-widest" style={{ color: cor, opacity: 0.85 }}>
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
        {valor}
      </div>
    </div>
  );
}

function MiniKpi({ corFundo, corBorda, corLabel, label, valor, sub, valorPequeno, icone }: {
  corFundo: string; corBorda: string; corLabel: string;
  label: string; valor: string; sub?: string; valorPequeno?: boolean; icone?: React.ReactNode;
}) {
  return (
    <div
      className="p-3 md:p-4 rounded-2xl border"
      style={{
        background: corFundo,
        borderColor: corBorda,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: corLabel }}>
        {label}
      </div>
      <div
        className={`${valorPequeno ? "text-base" : "text-2xl md:text-3xl"} font-bold tabular-nums mt-1 truncate`}
        style={{ color: "var(--text-strong)" }}
      >
        {icone && <span className="mr-1.5">{icone}</span>}{valor}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
