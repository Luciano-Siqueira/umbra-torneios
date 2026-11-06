import { useState, type ReactNode } from "react";
import { partesDoTexto, type FichaDaCarta } from "../../core/fichaDaCarta";
import { SimboloDeCusto } from "./SimboloMana";

// Texto de regras com os símbolos desenhados; o código entre chaves fica para leitores de tela
function TextoComSimbolos({ texto, tamanho = 14 }: { texto: string; tamanho?: number }) {
  return (
    <>
      {partesDoTexto(texto).map((p, i): ReactNode =>
        "texto" in p ? p.texto : (
          <span key={i} className="inline-block mx-px" style={{ verticalAlign: "-0.15em" }}>
            <SimboloDeCusto codigo={p.simbolo} tamanho={tamanho} />
            <span className="sr-only">{`{${p.simbolo}}`}</span>
          </span>
        )
      )}
    </>
  );
}

const ESTILO_ROTULO = "text-[10px] font-bold tracking-widest uppercase";

export function FichaCarta({ ficha }: { ficha: FichaDaCarta }) {
  const temPt = Boolean(ficha.textoPt || ficha.tipoPt);
  const [idioma, setIdioma] = useState<"pt" | "en">(temPt ? "pt" : "en");
  const emPt = idioma === "pt" && temPt;
  const tipo = (emPt && ficha.tipoPt) || ficha.tipo;
  const texto = emPt ? ficha.textoPt : ficha.texto;

  return (
    <section
      aria-label="Ficha da carta"
      className="w-full max-w-[360px] rounded-2xl p-4 space-y-3 text-sm text-left cursor-auto"
      style={{ background: "var(--ds-surface)", border: "1px solid var(--line)", color: "var(--text-label)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-base leading-tight" style={{ color: "var(--text-strong)" }}>{ficha.nome}</h2>
          {ficha.nomePt && <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>{ficha.nomePt}</div>}
        </div>
        {ficha.custo && (
          <div className="flex-shrink-0 whitespace-nowrap" aria-label={`Custo ${ficha.custo}`}>
            <TextoComSimbolos texto={ficha.custo} tamanho={18} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: "var(--text-2)" }}>
        <span className="font-medium" style={{ color: "var(--text-strong)" }}>{tipo}</span>
        {ficha.raridade && <span>· {ficha.raridade}</span>}
      </div>

      {temPt && (
        <div className="flex gap-1" role="group" aria-label="Idioma do texto">
          {(["pt", "en"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={idioma === i}
              className="text-[11px] px-2 py-0.5 rounded-full border transition"
              style={idioma === i
                ? { background: "var(--brand-1)", borderColor: "var(--brand-1)", color: "#141414" }
                : { borderColor: "var(--line)", color: "var(--text-2)" }}
              onClick={() => setIdioma(i)}
            >
              {i === "pt" ? "Português" : "Inglês"}
            </button>
          ))}
        </div>
      )}

      {texto ? (
        <div className="whitespace-pre-line leading-relaxed">
          <TextoComSimbolos texto={texto} />
        </div>
      ) : (
        <div className="text-xs" style={{ color: "var(--text-2)" }}>Sem texto de regras.</div>
      )}
      {emPt && (
        <div className="text-[11px]" style={{ color: "var(--text-muted-ds)" }}>
          Tradução impressa na carta. Para as regras atuais, veja em inglês.
        </div>
      )}

      {(ficha.forca || ficha.lealdade) && (
        <div className="flex justify-end">
          <span
            className="font-bold tabular-nums px-2 py-0.5 rounded-md"
            style={{ background: "var(--ds-surface-2)", color: "var(--text-strong)" }}
            aria-label={ficha.forca ? `Poder e resistência ${ficha.forca}` : `Lealdade ${ficha.lealdade}`}
          >
            {ficha.forca ?? `Lealdade ${ficha.lealdade}`}
          </span>
        </div>
      )}

      <div className="rounded-xl p-3 space-y-1" style={{ background: "var(--ds-surface-2)" }}>
        <div className="flex items-center gap-2">
          <span className={`${ESTILO_ROTULO} flex-1`} style={{ color: "var(--brand-1)" }}>Preço</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(201,166,72,0.15)", color: "var(--brand-1)" }}
          >
            Em desenvolvimento
          </span>
        </div>
        <div className="text-xs" style={{ color: "var(--text-2)" }}>
          Em breve, o preço da carta nas lojas brasileiras.
        </div>
      </div>

      {(ficha.artista || ficha.colecao) && (
        <div className="text-[11px] flex gap-2 flex-wrap" style={{ color: "var(--text-muted-ds)" }}>
          {ficha.artista && <span>Arte: {ficha.artista}</span>}
          {ficha.colecao && <span>{ficha.colecao}{ficha.numero && ` #${ficha.numero}`}</span>}
        </div>
      )}
    </section>
  );
}
