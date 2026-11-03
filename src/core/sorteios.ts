// Quem deu drop sai do sorteio ao dar o drop, mas pode ser marcado de novo à mão.
// Só mexe em quem mudou de situação, para não desfazer essa escolha.
export function ajustarSelecaoPorDrop(selecionados: string[], conhecidos: string[], dropados: string[]): string[] {
  const novos = dropados.filter((n) => !conhecidos.includes(n));
  const voltaram = conhecidos.filter((n) => !dropados.includes(n));
  const resultado = selecionados.filter((n) => !novos.includes(n));
  voltaram.forEach((n) => { if (!resultado.includes(n)) resultado.push(n); });
  return resultado;
}
