// Sistema de backup: exporta/importa TUDO (torneios + nomes cadastrados)
// como um único JSON. Permite compartilhar pasta com outras pessoas.

import * as storage from "./storage";
import * as sync from "./sync";

interface BackupData {
  versao: string;
  data: string;
  torneios: any[];
  nomes: string[];
}

const VERSAO = "1.0";

export function exportarTudo(): void {
  const dados: BackupData = {
    versao: VERSAO,
    data: new Date().toISOString(),
    torneios: storage.listarTorneios(),
    nomes: storage.carregarNomes(),
  };
  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dataStr = new Date().toISOString().slice(0, 10);
  a.download = `mtg-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importarTudo(json: string): Promise<{ torneios: number; nomes: number; errosNuvem: string[] }> {
  const dados = JSON.parse(json) as BackupData;
  if (!dados.torneios || !Array.isArray(dados.torneios)) {
    throw new Error("Arquivo inválido (falta campo 'torneios')");
  }

  // 1) Mescla no localStorage — mantém local se foi renomeado
  const existentes = new Map(
    storage.listarTorneios().map((t: any) => [t.id, t])
  );
  for (const t of dados.torneios) {
    const atual = existentes.get(t.id);
    if (!atual) {
      // Novo torneio: adiciona normalmente
      existentes.set(t.id, t);
    } else if (atual.nome === t.nome) {
      // Mesmo id + mesmo nome: sobrescreve (atualiza versão)
      existentes.set(t.id, t);
    } else {
      // Mesmo id mas nome diferente: usuário renomeou o local.
      // Cria um id novo pro torneio importado, preservando o local.
      let novoId = `${t.id}_imp_${Date.now()}`;
      while (existentes.has(novoId)) novoId = `${novoId}_${Math.floor(Math.random() * 1000)}`;
      existentes.set(novoId, { ...t, id: novoId });
    }
  }
  const arr = Array.from(existentes.values());
  arr.sort((a: any, b: any) => (b.dataCriacao || "").localeCompare(a.dataCriacao || ""));
  localStorage.setItem("mtg.torneios.v1", JSON.stringify(arr));

  const nomesAtuais = new Set(storage.carregarNomes().map((n) => n.toLowerCase()));
  const novosNomes = [...storage.carregarNomes()];
  let adicionados = 0;
  for (const n of dados.nomes || []) {
    if (!nomesAtuais.has(n.toLowerCase())) {
      novosNomes.push(n);
      nomesAtuais.add(n.toLowerCase());
      adicionados++;
    }
  }
  novosNomes.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  localStorage.setItem("mtg.jogadores.v1", JSON.stringify(novosNomes));

  // 2) Empurra TUDO pro Supabase (se logado como admin)
  const resSync = await sync.empurrarTudo();

  return {
    torneios: dados.torneios.length,
    nomes: adicionados,
    errosNuvem: resSync.erros,
  };
}
