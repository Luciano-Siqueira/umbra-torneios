import { useState } from "react";
import { IconeCadeado, IconePessoa } from "./ui/Icones";
import { DialogoPro } from "./DialogoPro";
import { NOME_DO_PLANO, type Plano } from "../core/pro";
import { podeVenderNoApp } from "../core/plataforma";

// No lugar de uma tela ou recurso Pro, para quem ainda não tem o plano
export function BloqueioPro({ plano = "jogador", recurso, descricao }: { plano?: Plano; recurso: string; descricao: string }) {
  const [aberto, setAberto] = useState(false);
  const nome = NOME_DO_PLANO[plano];
  return (
    <div className="ds-card text-center py-10 px-6 space-y-3 max-w-lg mx-auto">
      <div className="flex justify-center"><IconeCadeado tamanho={40} /></div>
      <div className="text-lg font-bold" style={{ color: "var(--text-strong)" }}>{recurso} é do {nome}</div>
      <p className="text-sm" style={{ color: "var(--text-2)" }}>{descricao}</p>
      {podeVenderNoApp() && (
        <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
          <IconePessoa cor="currentColor" /> Conhecer o {nome}
        </button>
      )}
      <DialogoPro aberto={aberto} plano={plano} onFechar={() => setAberto(false)} />
    </div>
  );
}
