import { useEffect, useState } from "react";
import { IconeCadeado, IconeCoroa, IconeSino } from "./ui/Icones";
import { Modal } from "./ui/Modal";
import { DialogoPro } from "./DialogoPro";
import { useStore } from "../core/store";
import { atualizarPerfil, useAuth } from "../core/auth";
import { statusPro } from "../core/pro";
import { podeVenderNoApp } from "../core/plataforma";
import { avisoLigadoNoTorneio, type AvisosDoTorneio, type Torneio } from "../core/types";

const OPCOES: { chave: keyof AvisosDoTorneio; titulo: string; descricao: string }[] = [
  { chave: "mesa", titulo: "Mesa da rodada", descricao: "Ao iniciar cada rodada, cada jogador recebe a mesa e com quem joga." },
  { chave: "tempo", titulo: "Tempo extra e último turno", descricao: "Quando começa o tempo extra e quando ele acaba." },
  { chave: "finalizado", titulo: "Torneio finalizado", descricao: "Convite para ver o ranking final." },
];

// Recurso do Organizador Pro: escolher quais notificações este torneio manda.
// Vale dentro do que o administrador liberou em Usuários → Configurar notificações.
export function DialogoAvisosTorneio({ torneio, aberto, onFechar }: { torneio: Torneio; aberto: boolean; onFechar: () => void }) {
  const auth = useAuth();
  const pro = statusPro(auth);
  const atualizarTorneio = useStore((s) => s.atualizarTorneio);
  const [proAberto, setProAberto] = useState(false);
  const liberado = pro.organizador;

  // O Pro pode ter sido dado ou comprado com o app aberto: confere de novo ao abrir
  useEffect(() => { if (aberto) atualizarPerfil(); }, [aberto]);

  const alternar = (chave: keyof AvisosDoTorneio) => {
    const novo = !avisoLigadoNoTorneio(torneio, chave);
    atualizarTorneio((t) => { t.avisos = { ...(t.avisos ?? {}), [chave]: novo }; });
  };

  return (
    <>
      <Modal
        open={aberto && !proAberto}
        onClose={onFechar}
        title={<span className="inline-flex items-center gap-2"><IconeSino tamanho={20} /> Notificações deste torneio</span>}
        fecharAoClicarFora
      >
        <div className="space-y-3 text-sm">
          <p style={{ color: "var(--text-2)" }}>
            Escolha o que os jogadores deste torneio recebem no celular.
          </p>

          {!liberado && auth.perfilCarregado && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--ds-surface-2)", border: "1px solid rgba(201,166,72,0.3)" }}>
              <div className="font-semibold flex items-center gap-2" style={{ color: "var(--brand-1)" }}>
                <IconeCadeado cor="currentColor" /> Recurso do Organizador Pro
              </div>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>
                Sem o Pro, todo torneio manda todas as notificações liberadas pelo administrador.
              </p>
              {podeVenderNoApp() && (
                <button type="button" className="btn-primary text-xs" onClick={() => setProAberto(true)}>
                  <IconeCoroa cor="currentColor" /> Conhecer o Organizador Pro
                </button>
              )}
            </div>
          )}

          <ul className="space-y-1">
            {OPCOES.map((o) => {
              const ligado = avisoLigadoNoTorneio(torneio, o.chave);
              return (
                <li key={o.chave} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ color: "var(--text-strong)" }}>{o.titulo}</div>
                    <div className="text-xs" style={{ color: "var(--text-2)" }}>{o.descricao}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ligado}
                    aria-label={o.titulo}
                    disabled={!liberado}
                    onClick={() => alternar(o.chave)}
                    className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 active:scale-95 disabled:opacity-40"
                    style={{ background: ligado ? "var(--brand-1)" : "var(--line)" }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{ left: ligado ? "26px" : "2px" }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={onFechar}>Pronto</button>
          </div>
        </div>
      </Modal>
      <DialogoPro aberto={proAberto} plano="organizador" onFechar={() => setProAberto(false)} />
    </>
  );
}
