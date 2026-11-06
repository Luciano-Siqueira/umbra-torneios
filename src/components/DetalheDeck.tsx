import { useEffect, useState } from "react";
import { buscarDeckCompleto, type CartaDoDeck, type DeckCompleto, type IdGrupo } from "../core/deckCompleto";
import { IconeEngrenagem, IconeEspiral, IconeEstrela, IconeGarra, IconeMoeda, IconeMontanha, IconeRaio } from "./ui/Icones";
import type { DeckCommander } from "../core/decks";
import { contar } from "../core/formato";
import { nomeDaCombinacao } from "../core/coresMagic";
import { colecaoConhecida, nomeDaColecao } from "../core/colecoes";
import { CoresMana } from "./ui/SimboloMana";
import { usePrevisaoDeCarta } from "./ui/PrevisaoDeCarta";

const ICONE_DO_GRUPO: Record<IdGrupo, (props: { tamanho?: number }) => JSX.Element> = {
  criaturas: IconeGarra,
  encantamentos: IconeEstrela,
  magicas: IconeRaio,
  artefatos: IconeEngrenagem,
  terrenos: IconeMontanha,
  outros: IconeEspiral,
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function CartaComandante({ carta }: { carta: CartaDoDeck }) {
  const [semImagem, setSemImagem] = useState(!carta.imagem);
  return (
    <figure className="m-0 w-full max-w-[300px]">
      {semImagem ? (
        <div
          className="aspect-[5/7] rounded-2xl flex items-center justify-center text-center p-4 font-semibold border"
          style={{ background: "var(--ds-surface-2)", borderColor: "var(--line)", color: "var(--text-strong)" }}
        >
          {carta.nome}
        </div>
      ) : (
        <img
          src={carta.imagem!}
          alt={carta.nome}
          onError={() => setSemImagem(true)}
          className="w-full aspect-[5/7] rounded-2xl object-cover"
          style={{ boxShadow: "0 18px 50px -12px rgba(201,166,72,0.55)", background: "var(--ds-surface-2)" }}
        />
      )}
      <figcaption className="mt-3 text-center">
        <div className="font-bold" style={{ color: "var(--text-strong)" }}>{carta.nome}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>{carta.tipo}</div>
      </figcaption>
    </figure>
  );
}

export function DetalheDeck({ deck, onVoltar }: { deck: DeckCommander; onVoltar: () => void }) {
  const [dados, setDados] = useState<DeckCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const { eventos, previsao } = usePrevisaoDeCarta();

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, []);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(null);
    buscarDeckCompleto(deck).then(
      (d) => { if (ativo) setDados(d); },
      (e: Error) => { if (ativo) setErro(e.message); }
    );
    return () => { ativo = false; };
  }, [deck, tentativa]);

  return (
    <div className="space-y-4">
      <button className="btn-ghost text-sm" onClick={onVoltar}>← Todos os decks</button>

      <div className="card">
        <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-strong)" }}>{deck.nome}</h2>
        <div className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
          <CoresMana cores={deck.cores} tamanho={16} /> {nomeDaCombinacao(deck.cores)} · {colecaoConhecida(deck.colecao) ? `${nomeDaColecao(deck.colecao)} (${deck.colecao})` : deck.colecao} · {formatarData(deck.lancamento)}
          {dados && ` · ${contar(dados.totalCartas, "carta")}`}
        </div>
      </div>

      {erro ? (
        <div className="card text-center py-8 space-y-3">
          <div style={{ color: "var(--critical)" }}>Não foi possível abrir o deck: {erro}</div>
          <button className="btn-ghost text-sm" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
        </div>
      ) : !dados ? (
        <div className="card text-center py-12 text-fg-dim">Carregando as cartas do deck...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-4 items-start">
          <section aria-label="Comandante" className="card flex flex-col items-center gap-5">
            <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--brand-1)" }}>
              {dados.comandantes.length > 1 ? "Comandantes" : "Comandante"}
            </div>
            {dados.comandantes.map((c) => <CartaComandante key={c.nome} carta={c} />)}
          </section>

          {/* Em colunas, os grupos curtos não deixam buracos ao lado dos longos */}
          <div className="md:columns-2 gap-4">
            {dados.grupos.map((g) => {
              const Icone = ICONE_DO_GRUPO[g.id];
              return (
              <section key={g.id} aria-label={g.titulo} className="card min-w-0 mb-4 break-inside-avoid">
                <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
                  <Icone tamanho={18} />
                  <span className="flex-1">{g.titulo}</span>
                  <span className="text-sm tabular-nums" style={{ color: "var(--brand-1)" }}>{g.total}</span>
                </h3>
                <ul className="text-sm">
                  {g.cartas.map((c) => (
                    <li
                      key={c.nome}
                      {...eventos(c)}
                      className="flex gap-2 py-1"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <span className="tabular-nums w-5 text-right flex-shrink-0" style={{ color: "var(--text-2)" }}>
                        {c.quantidade}
                      </span>
                      <span className="min-w-0 break-words" title={c.tipo}>{c.nome}</span>
                    </li>
                  ))}
                </ul>
              </section>
              );
            })}

            <section aria-label="Tokens" className="card min-w-0 mb-4 break-inside-avoid">
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
                <IconeMoeda tamanho={18} />
                <span className="flex-1">Tokens</span>
                {dados.tokensOrigem === "deck" && (
                  <span className="text-sm tabular-nums" style={{ color: "var(--brand-1)" }}>{dados.totalTokens}</span>
                )}
              </h3>
              {dados.tokensOrigem === "cartas" && (
                <div className="text-xs mb-2" style={{ color: "var(--text-2)" }}>
                  A lista deste deck não informa os tokens da caixa. Estes são os que as cartas dele criam, segundo a Scryfall.
                </div>
              )}
              {dados.tokens.length === 0 ? (
                <div className="text-xs" style={{ color: "var(--text-2)" }}>Não encontramos tokens para este deck.</div>
              ) : (
                <ul className="text-sm">
                  {dados.tokens.map((t) => (
                    <li
                      key={`${t.nome}|${t.forca}|${t.imagem}`}
                      {...eventos(t)}
                      className="flex gap-2 py-1"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      {dados.tokensOrigem === "deck" && (
                        <span className="tabular-nums w-5 text-right flex-shrink-0" style={{ color: "var(--text-2)" }}>
                          {t.quantidade}
                        </span>
                      )}
                      <span className="min-w-0 break-words flex-1" title={t.tipo}>{t.nome}</span>
                      {t.forca && <span className="tabular-nums" style={{ color: "var(--text-2)" }}>{t.forca}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {previsao}

      <div className="text-[11px] text-center" style={{ color: "var(--text-muted-ds)" }}>
        Listas: MTGJSON. Imagens: Scryfall. Magic: The Gathering pertence à Wizards of the Coast.
      </div>
    </div>
  );
}
