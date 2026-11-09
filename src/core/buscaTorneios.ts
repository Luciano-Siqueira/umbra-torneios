// Busca na lista de torneios: nome, quem organizou (só para o admin) e data de criação.
// Cada palavra digitada precisa aparecer em algum desses campos, sem diferenciar acento nem maiúscula.
import type { Torneio } from "./types";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// "08/11/2026 novembro 2026": cobre "08/11", "11/2026", "nov", "novembro" e "2026"
export function textoDaData(iso: string | undefined): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function filtrarTorneios(
  torneios: Torneio[],
  termo: string,
  organizadorDe: (t: Torneio) => string = () => "",
): Torneio[] {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return torneios;
  return torneios.filter((t) => {
    const onde = semAcento(`${t.nome} ${organizadorDe(t)} ${textoDaData(t.dataCriacao)}`);
    return palavras.every((p) => onde.includes(p));
  });
}

// "AAAA-MM-DD" no fuso do aparelho, o mesmo formato do campo de calendário (input type="date")
export function diaLocal(iso: string | undefined): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Período pela data de criação; "de" e "ate" são opcionais e incluem o próprio dia
export function filtrarPorPeriodo(torneios: Torneio[], de: string, ate: string): Torneio[] {
  if (!de && !ate) return torneios;
  return torneios.filter((t) => {
    const dia = diaLocal(t.dataCriacao);
    if (!dia) return false;
    return (!de || dia >= de) && (!ate || dia <= ate);
  });
}
