// Números e textos no formato brasileiro, iguais em todas as telas
const casasFixas = (casas: number) => ({ minimumFractionDigits: casas, maximumFractionDigits: casas });

export function formatarNumero(valor: number, casas = 0): string {
  return valor.toLocaleString("pt-BR", casasFixas(casas));
}

export function formatarReais(valor: number): string {
  return `R$ ${formatarNumero(valor, 2)}`;
}

// Recebe a fração: 0,5 vira "50,0%"
export function formatarPercentual(fracao: number, casas = 1): string {
  return `${formatarNumero(fracao * 100, casas)}%`;
}

// "1 jogador", "2 jogadores"
export function contar(qtd: number, singular: string, pluralDoNome = `${singular}s`): string {
  return `${qtd} ${qtd === 1 ? singular : pluralDoNome}`;
}
