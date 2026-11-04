import { useEffect, useMemo, useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import {
  listarUsuarios, definirPapel, deletarUsuario, enviarResetSenha,
  renomearJogador, adicionarNome, removerNomeDoUsuario,
  listarNomesPendentes, aprovarNome,
  type NomePendente, type UsuarioInfo,
} from "../core/admin";
import { useToast } from "./ui/Toast";
import { confirmar } from "./ui/Confirm";
import { FUNDO_DE_TELA } from "../banner-image";
import { AuthChip } from "./AuthChip";

interface Props {
  onPedirLogin?: () => void;
  onVincularNome?: () => void;
}

export function TelaUsuarios({ onPedirLogin, onVincularNome }: Props = {}) {
  const voltar = useStore((s) => s.voltarParaLista);
  const torneios = useStore((s) => s.torneios);
  const modoView = useStore((s) => s.modoView);
  const auth = useAuth();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioInfo | null>(null);
  const [confirmandoAdmin, setConfirmandoAdmin] = useState<UsuarioInfo | null>(null);
  const [pendentes, setPendentes] = useState<NomePendente[]>([]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [u, p] = await Promise.all([listarUsuarios(), listarNomesPendentes()]);
      setUsuarios(u);
      setPendentes(p);
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (auth.isAdmin && modoView === "admin" && !auth.loading) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin, modoView, auth.loading]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      u.nomes_jogador.some((n) => n.toLowerCase().includes(q))
    );
  }, [usuarios, busca]);

  // A mesa e o desempenho do jogador dependem do nome ser igual ao do torneio
  const nomesEmTorneios = useMemo(() => new Set(
    torneios.flatMap((t) => t.jogadores.map((j) => j.nome.trim().toLowerCase()))
  ), [torneios]);
  const nomeNoTorneio = (n: string) => nomesEmTorneios.has(n.trim().toLowerCase());
  const totSemTorneio = usuarios.filter((u) => u.nomes_jogador.some((n) => !nomeNoTorneio(n))).length;

  const togglePapel = async (u: UsuarioInfo, campo: "admin" | "organizador") => {
    if (u.user_id === auth.session?.user?.id && campo === "admin") {
      toast("Você não pode remover o próprio acesso admin", "aviso");
      return;
    }
    // Mudar admin exige confirmar a senha de quem está logado
    if (campo === "admin") {
      setConfirmandoAdmin(u);
      return;
    }
    await salvarPapel(u, campo);
  };

  const decidirNome = async (p: NomePendente, aprovar: boolean) => {
    if (!aprovar) {
      const ok = await confirmar({
        titulo: "Recusar nome",
        mensagem: `Recusar o vínculo de "${p.nome_jogador}"? O nome fica livre de novo.`,
        textoOk: "Recusar",
        perigo: true,
      });
      if (!ok) return;
    }
    try {
      if (aprovar) await aprovarNome(p.user_id, p.nome_jogador);
      else await removerNomeDoUsuario(p.user_id, p.nome_jogador);
      setPendentes((prev) => prev.filter((x) => x !== p));
      await carregar();
      toast(aprovar ? `"${p.nome_jogador}" aprovado` : `"${p.nome_jogador}" recusado`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    }
  };

  const salvarPapel = async (u: UsuarioInfo, campo: "admin" | "organizador") => {
    setSalvando(u.user_id);
    try {
      const novo = {
        admin: campo === "admin" ? !u.eh_admin : u.eh_admin,
        organizador: campo === "organizador" ? !u.eh_organizador : u.eh_organizador,
      };
      await definirPapel(u.user_id, novo.admin, novo.organizador);
      setUsuarios((prev) => prev.map((x) => x.user_id === u.user_id
        ? { ...x, eh_admin: novo.admin, eh_organizador: novo.organizador }
        : x));
      toast(`Papéis atualizados`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally {
      setSalvando(null);
    }
  };

  const resetarSenha = async (u: UsuarioInfo) => {
    const ok = await confirmar({
      titulo: "Redefinir senha",
      mensagem: `Enviar email de redefinição de senha para ${u.email}?`,
      textoOk: "Enviar",
    });
    if (!ok) return;
    try {
      await enviarResetSenha(u.email);
      toast(`Email de reset enviado para ${u.email}`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    }
  };

  const excluirUsuario = async (u: UsuarioInfo) => {
    if (u.user_id === auth.session?.user?.id) {
      toast("Você não pode excluir a própria conta", "aviso");
      return;
    }
    const nome = u.nomes_jogador[0] || u.email;
    const ok = await confirmar({
      titulo: "Excluir usuário",
      mensagem: `Excluir permanentemente o usuário "${nome}"?\n\nO login, os nomes vinculados e os papéis serão removidos.\n\nIsso não pode ser desfeito.`,
      textoOk: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setSalvando(u.user_id);
    try {
      await deletarUsuario(u.user_id);
      setUsuarios((prev) => prev.filter((x) => x.user_id !== u.user_id));
      toast(`Usuário "${nome}" excluído`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally {
      setSalvando(null);
    }
  };

  if (auth.perfilErro || (auth.perfilCarregado && (!auth.isAdmin || modoView !== "admin"))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg p-6">
        <div className="text-center">
          <div className="text-2xl mb-2">{auth.perfilErro ? "⚠️ Erro ao carregar seu perfil" : "🔒 Acesso restrito"}</div>
          <div className="text-sm text-fg-dim mb-4">{auth.perfilErro || "Essa página é só para administradores."}</div>
          <button className="btn-primary" onClick={voltar}>Voltar</button>
        </div>
      </div>
    );
  }

  const total = usuarios.length;
  const totAdmin = usuarios.filter((u) => u.eh_admin).length;
  const totOrg = usuarios.filter((u) => u.eh_organizador).length;
  const totJog = usuarios.filter((u) => u.nomes_jogador.length > 0).length;

  return (
    <div
      className="min-h-screen text-fg"
      style={FUNDO_DE_TELA}
    >
      <div className="px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap">
        <button className="btn-ghost" onClick={voltar}>← Voltar</button>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-strong)" }}>
          👥 Gerenciar Usuários
        </h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </div>

      <main className="px-4 md:px-8 pb-12 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMini label="TOTAL" valor={String(total)} cor="#c4c4c4" />
          <KpiMini label="👑 ADMINS" valor={String(totAdmin)} cor="#c9a648" />
          <KpiMini label="🎯 ORGANIZADORES" valor={String(totOrg)} cor="#f5f5f5" />
          <KpiMini label="👤 JOGADORES" valor={String(totJog)} cor="#c4c4c4" />
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔎 Buscar por email ou nome..."
            className="input flex-1 max-w-md"
          />
          <button className="btn-ghost text-sm" onClick={carregar}>↻ Atualizar</button>
        </div>

        {pendentes.length > 0 && (
          <div className="card space-y-2" style={{ borderColor: "rgba(201,166,72,0.4)" }}>
            <div className="text-sm font-bold" style={{ color: "var(--brand-1)" }}>
              Nomes aguardando aprovação ({pendentes.length})
            </div>
            <div className="text-xs text-fg-dim">
              Até aprovar, a conta não vê os torneios desse nome.
            </div>
            {pendentes.map((p) => (
              <div key={`${p.user_id}-${p.nome_jogador}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold" style={{ color: "var(--text-strong)" }}>{p.nome_jogador}</span>
                <span className="text-xs text-fg-dim flex-1 min-w-[120px] truncate">
                  {usuarios.find((u) => u.user_id === p.user_id)?.email ?? p.user_id}
                </span>
                <button className="btn-success !py-1 !px-3 text-xs" onClick={() => decidirNome(p, true)}>Aprovar</button>
                <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => decidirNome(p, false)}>Recusar</button>
              </div>
            ))}
          </div>
        )}

        {totSemTorneio > 0 && (
          <div className="text-xs" style={{ color: "var(--warn)" }}>
            ⚠ {totSemTorneio} {totSemTorneio === 1 ? "usuário tem" : "usuários têm"} nome que não aparece em nenhum torneio.
            Se a pessoa joga com outro nome, ela não verá a própria mesa nem o desempenho. Corrija no botão ✎.
          </div>
        )}

        {carregando ? (
          <div className="text-center py-12 text-fg-dim">Carregando usuários...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-fg-dim">Nenhum usuário encontrado.</div>
        ) : (
          <div className="rounded-2xl overflow-hidden border" style={{
            background: "rgba(15,15,15,0.6)",
            borderColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(14px)",
          }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="tabela-cab">
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">👤 Jogador</th>
                    <th className="text-center py-3 px-2">👑 Admin</th>
                    <th className="text-center py-3 px-2">🎯 Organizador</th>
                    <th className="text-right py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="py-2 px-4">
                        <div className="font-medium truncate max-w-[260px]" style={{ color: "var(--text-strong)" }}>
                          {u.email}
                        </div>
                        <div className="text-[10px] text-fg-dim">
                          {new Date(u.criado_em).toLocaleDateString("pt-BR")}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        {u.nomes_jogador.length === 0 ? (
                          <span className="text-[11px] text-fg-muted italic">— nenhum —</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.nomes_jogador.map((n) => (
                              <span key={n} className="text-[11px] px-2 py-0.5 rounded-full"
                                    title={nomeNoTorneio(n) ? undefined : "Não aparece em nenhum torneio"}
                                    style={nomeNoTorneio(n)
                                      ? { background: "rgba(110,231,183,0.1)", color: "var(--good)", border: "1px solid rgba(110,231,183,0.25)" }
                                      : { background: "rgba(252,211,77,0.1)", color: "var(--warn)", border: "1px solid rgba(252,211,77,0.3)" }}>
                                {nomeNoTorneio(n) ? n : `⚠ ${n}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5" title="Exige sua senha">
                          <span className="text-xs">🔒</span>
                          <ToggleButton
                            ativo={u.eh_admin}
                            corAtivo="var(--brand-1)"
                            disabled={salvando === u.user_id}
                            onClick={() => togglePapel(u, "admin")}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <ToggleButton
                          ativo={u.eh_organizador}
                          corAtivo="var(--brand-2)"
                          disabled={salvando === u.user_id}
                          onClick={() => togglePapel(u, "organizador")}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <IconBtn
                            titulo="Editar nomes"
                            cor="#c9a648"
                            onClick={() => setEditando(u)}
                            disabled={salvando === u.user_id}
                          >✎</IconBtn>
                          <IconBtn
                            titulo="Enviar reset de senha"
                            cor="#c4c4c4"
                            onClick={() => resetarSenha(u)}
                            disabled={salvando === u.user_id}
                          >🔑</IconBtn>
                          <IconBtn
                            titulo="Excluir usuário"
                            cor="#f87171"
                            onClick={() => excluirUsuario(u)}
                            disabled={salvando === u.user_id || u.user_id === auth.session?.user?.id}
                          >🗑</IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal de edição de nomes */}
      {editando && (
        <ModalEditarNomes
          usuario={editando}
          onFechar={() => setEditando(null)}
          onAtualizado={async () => {
            await carregar();
            // Reabre o modal com dados atualizados
            const atualizado = (await listarUsuarios()).find((u) => u.user_id === editando.user_id);
            setEditando(atualizado || null);
          }}
          toast={toast}
        />
      )}

      {/* Modal de confirmação de senha para mudar admin */}
      {confirmandoAdmin && (
        <ModalSenhaAdmin
          usuario={confirmandoAdmin}
          onFechar={() => setConfirmandoAdmin(null)}
          onConfirmar={async (senha) => {
            const u = confirmandoAdmin;
            // Quem confere a senha é o banco
            await definirPapel(u.user_id, !u.eh_admin, u.eh_organizador, senha);
            setUsuarios((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, eh_admin: !u.eh_admin } : x));
            setConfirmandoAdmin(null);
            toast("Papéis atualizados", "sucesso");
          }}
        />
      )}
    </div>
  );
}

function ModalSenhaAdmin({ usuario, onFechar, onConfirmar }: {
  usuario: UsuarioInfo;
  onFechar: () => void;
  onConfirmar: (senha: string) => Promise<void>;
}) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const confirmarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await onConfirmar(senha);
    } catch (e: any) {
      setErro(e.message || "Erro");
      setCarregando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      // Só fecha se o clique começou fora da caixa (arrastar de dentro pra fora não fecha)
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <form
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--ds-surface-2)", border: "1px solid rgba(201,166,72,0.3)" }}
        onSubmit={confirmarSenha}
      >
        <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: "var(--brand-1)" }}>
          🔒 {usuario.eh_admin ? "REMOVER ADMIN" : "TORNAR ADMIN"}
        </div>
        <div className="text-sm mt-1 mb-4 truncate" style={{ color: "var(--text-label)" }}>
          {usuario.email}
        </div>

        <input
          type="password"
          value={senha}
          onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          autoFocus
          className="input w-full !py-2 text-sm"
        />

        {erro && (
          <div className="text-xs mt-2" style={{ color: "var(--critical)" }}>{erro}</div>
        )}

        <button
          type="submit"
          disabled={carregando || !senha}
          className="btn-primary w-full mt-4 text-sm disabled:opacity-40"
        >
          {carregando ? "Confirmando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="w-full mt-2 py-2 text-xs transition hover:text-white"
          style={{ color: "var(--text-2)" }}
        >Cancelar</button>
      </form>
    </div>
  );
}

function ModalEditarNomes({ usuario, onFechar, onAtualizado, toast }: {
  usuario: UsuarioInfo;
  onFechar: () => void;
  onAtualizado: () => Promise<void>;
  toast: (m: string, t?: any) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [valorRenomeio, setValorRenomeio] = useState("");

  const adicionar = async () => {
    const n = novoNome.trim();
    if (!n) return;
    setSalvando(true);
    try {
      await adicionarNome(usuario.user_id, n);
      setNovoNome("");
      await onAtualizado();
      toast(`"${n}" vinculado`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally { setSalvando(false); }
  };

  const salvarRenomeio = async (nomeAntigo: string) => {
    const n = valorRenomeio.trim();
    if (!n || n === nomeAntigo) { setRenomeando(null); return; }
    setSalvando(true);
    try {
      await renomearJogador(usuario.user_id, nomeAntigo, n);
      setRenomeando(null);
      await onAtualizado();
      toast(`Renomeado para "${n}"`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally { setSalvando(false); }
  };

  const remover = async (n: string) => {
    const ok = await confirmar({
      titulo: "Remover nome",
      mensagem: `Remover "${n}" dos nomes vinculados?`,
      textoOk: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await removerNomeDoUsuario(usuario.user_id, n);
      await onAtualizado();
      toast(`"${n}" removido`, "info");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally { setSalvando(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      // Só fecha se o clique começou fora da caixa (arrastar de dentro pra fora não fecha)
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "var(--ds-surface-2)", border: "1px solid rgba(201,166,72,0.3)" }}
      >
        <div className="mb-4">
          <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: "var(--brand-1)" }}>
            EDITAR NOMES VINCULADOS
          </div>
          <div className="text-sm mt-1 truncate" style={{ color: "var(--text-label)" }}>
            {usuario.email}
          </div>
        </div>

        {/* Lista de nomes atuais */}
        <div className="space-y-2 mb-4">
          {usuario.nomes_jogador.length === 0 ? (
            <div className="text-xs text-fg-muted italic text-center py-4">
              Nenhum nome vinculado ainda
            </div>
          ) : (
            usuario.nomes_jogador.map((n) => (
              <div key={n} className="flex items-center gap-2 p-2 rounded-lg"
                   style={{ background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)" }}>
                {renomeando === n ? (
                  <>
                    <input
                      value={valorRenomeio}
                      onChange={(e) => setValorRenomeio(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") salvarRenomeio(n); if (e.key === "Escape") setRenomeando(null); }}
                      className="input flex-1 !py-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => salvarRenomeio(n)} disabled={salvando}
                            className="text-xs px-2 py-1 rounded font-semibold"
                            style={{ background: "var(--good)", color: "var(--page-1)" }}>✓</button>
                    <button onClick={() => setRenomeando(null)}
                            className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-2)" }}>×</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium" style={{ color: "var(--good)" }}>👤 {n}</span>
                    <button onClick={() => { setRenomeando(n); setValorRenomeio(n); }}
                            className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--brand-1)" }}
                            title="Renomear">✎</button>
                    <button onClick={() => remover(n)}
                            className="text-xs px-2 py-1 rounded hover:bg-red-500/10" style={{ color: "var(--critical)" }}
                            title="Remover">×</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Adicionar novo nome */}
        <div className="pt-4 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-2)" }}>
            + Adicionar nome
          </div>
          <div className="flex gap-2">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="Ex.: Luciano Siqueira"
              className="input flex-1 !py-2 text-sm"
            />
            <button onClick={adicionar} disabled={salvando || !novoNome.trim()}
                    className="btn-primary text-sm">Vincular</button>
          </div>
        </div>

        <button
          onClick={onFechar}
          className="w-full mt-4 py-2 text-xs transition hover:text-white"
          style={{ color: "var(--text-2)" }}
        >Fechar</button>
      </div>
    </div>
  );
}

function KpiMini({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="p-3 rounded-xl border" style={{
      background: `${cor}10`, borderColor: `${cor}30`, backdropFilter: "blur(10px)",
    }}>
      <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: cor }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1" style={{ color: "var(--text-strong)" }}>{valor}</div>
    </div>
  );
}

function ToggleButton({ ativo, corAtivo, disabled, onClick }: {
  ativo: boolean; corAtivo: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="relative w-12 h-6 rounded-full transition-colors active:scale-95"
      style={{ background: ativo ? corAtivo : "var(--line)", opacity: disabled ? 0.4 : 1 }}
    >
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
           style={{ left: ativo ? "26px" : "2px" }} />
    </button>
  );
}

function IconBtn({ children, titulo, cor, onClick, disabled }: {
  children: React.ReactNode; titulo: string; cor: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={titulo}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition hover:bg-white/5 active:scale-95 disabled:opacity-30"
      style={{ color: cor, border: `1px solid ${cor}30`, background: `${cor}08` }}
    >
      {children}
    </button>
  );
}
