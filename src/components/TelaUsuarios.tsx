import { useEffect, useMemo, useState } from "react";
import { useStore } from "../core/store";
import { useAuth } from "../core/auth";
import {
  listarUsuarios, definirPapel, deletarUsuario, enviarResetSenha,
  renomearJogador, adicionarNome, removerNomeDoUsuario,
  type UsuarioInfo,
} from "../core/admin";
import { useToast } from "./ui/Toast";
import { AuthChip } from "./AuthChip";
import { BANNER_IMAGE } from "../banner-image";

interface Props {
  onPedirLogin?: () => void;
  onVincularNome?: () => void;
}

export function TelaUsuarios({ onPedirLogin, onVincularNome }: Props = {}) {
  const voltar = useStore((s) => s.voltarParaLista);
  const auth = useAuth();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioInfo | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const u = await listarUsuarios();
      setUsuarios(u);
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (auth.isAdmin && !auth.loading) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin, auth.loading]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      u.nomes_jogador.some((n) => n.toLowerCase().includes(q))
    );
  }, [usuarios, busca]);

  const togglePapel = async (u: UsuarioInfo, campo: "admin" | "organizador") => {
    if (u.user_id === auth.session?.user?.id && campo === "admin") {
      toast("Você não pode remover o próprio acesso admin", "aviso");
      return;
    }
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
    if (!confirm(`Enviar email de redefinição de senha para ${u.email}?`)) return;
    try {
      await enviarResetSenha(u.email);
      toast(`Email de reset enviado para ${u.email}`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    }
  };

  const excluirUsuario = async (u: UsuarioInfo) => {
    if (u.user_id === auth.session?.user?.id) {
      toast("Você não pode deletar a si mesmo", "aviso");
      return;
    }
    const nome = u.nomes_jogador[0] || u.email;
    if (!confirm(`⚠️ DELETAR permanentemente o usuário "${nome}"?\n\nTudo associado (login, nomes vinculados, papéis) será removido.\n\nIsso não pode ser desfeito.`)) return;
    setSalvando(u.user_id);
    try {
      await deletarUsuario(u.user_id);
      setUsuarios((prev) => prev.filter((x) => x.user_id !== u.user_id));
      toast(`Usuário "${nome}" deletado`, "sucesso");
    } catch (e: any) {
      toast("Erro: " + e.message, "erro");
    } finally {
      setSalvando(null);
    }
  };

  if (auth.perfilErro || (auth.perfilCarregado && !auth.isAdmin)) {
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
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(10,9,22,0.55) 0%, rgba(10,9,22,0.65) 100%), url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <header className="relative h-32 md:h-40 pointer-events-none" />

      <div className="px-6 md:px-10 py-4 flex items-center gap-3 flex-wrap">
        <button className="btn-ghost" onClick={voltar}>← Voltar</button>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-strong)" }}>
          👥 Gerenciar Usuários
        </h1>
        <div className="flex-1" />
        <AuthChip auth={auth} onLoginClick={onPedirLogin} onVincularNome={onVincularNome} onSair={voltar} />
      </div>

      <main className="px-6 md:px-10 pb-12 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMini label="TOTAL" valor={String(total)} cor="#c4c4c4" />
          <KpiMini label="👑 ADMINS" valor={String(totAdmin)} cor="#c9a648" />
          <KpiMini label="🎯 ORGANIZADORES" valor={String(totOrg)} cor="#38bdf8" />
          <KpiMini label="👤 JOGADORES" valor={String(totJog)} cor="#7bc47f" />
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
                  <tr style={{ color: "#8a8a8a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase">EMAIL</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase">NOMES VINCULADOS</th>
                    <th className="text-center py-3 px-2 text-[10px] font-bold tracking-widest uppercase">👑</th>
                    <th className="text-center py-3 px-2 text-[10px] font-bold tracking-widest uppercase">🎯</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase">AÇÕES</th>
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
                                    style={{ background: "rgba(123,196,127,0.1)", color: "#7bc47f", border: "1px solid rgba(123,196,127,0.25)" }}>
                                {n}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <ToggleButton
                          ativo={u.eh_admin}
                          corAtivo="#c9a648"
                          disabled={salvando === u.user_id}
                          onClick={() => togglePapel(u, "admin")}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <ToggleButton
                          ativo={u.eh_organizador}
                          corAtivo="#38bdf8"
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
                            cor="#38bdf8"
                            onClick={() => resetarSenha(u)}
                            disabled={salvando === u.user_id}
                          >🔑</IconBtn>
                          <IconBtn
                            titulo="Deletar usuário"
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
    if (!confirm(`Remover "${n}" dos nomes vinculados?`)) return;
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
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#1a1a1a", border: "1px solid rgba(201,166,72,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: "#c9a648" }}>
            EDITAR NOMES VINCULADOS
          </div>
          <div className="text-sm mt-1 truncate" style={{ color: "#c4c4c4" }}>
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
                   style={{ background: "rgba(123,196,127,0.08)", border: "1px solid rgba(123,196,127,0.2)" }}>
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
                            style={{ background: "#7bc47f", color: "#0a0a0a" }}>✓</button>
                    <button onClick={() => setRenomeando(null)}
                            className="text-xs px-2 py-1 rounded" style={{ color: "#8a8a8a" }}>×</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium" style={{ color: "#7bc47f" }}>👤 {n}</span>
                    <button onClick={() => { setRenomeando(n); setValorRenomeio(n); }}
                            className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: "#c9a648" }}
                            title="Renomear">✎</button>
                    <button onClick={() => remover(n)}
                            className="text-xs px-2 py-1 rounded hover:bg-red-500/10" style={{ color: "#f87171" }}
                            title="Remover">×</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Adicionar novo nome */}
        <div className="pt-4 border-t" style={{ borderColor: "#2a2a2a" }}>
          <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "#8a8a8a" }}>
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
          style={{ color: "#8a8a8a" }}
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
      style={{ background: ativo ? corAtivo : "#2a2a2a", opacity: disabled ? 0.4 : 1 }}
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
