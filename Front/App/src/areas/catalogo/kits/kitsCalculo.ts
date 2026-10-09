// Contas do editor de kit (iguais às do backend): custo, quantos dá para montar e preço sugerido.

export interface LinhaKit {
  idItem: number;
  quantidade: number;
  saldo: number;
  custoUnitario: number;
  servico: boolean;
}

const arred4 = (v: number) => Math.round((Number(v) || 0) * 10000) / 10000;
const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** Custo de cada linha arredondado antes de somar. */
export const custoDaLinha = (l: LinhaKit) => arred4(l.custoUnitario * (Number(l.quantidade) || 0));
export const custoDoKit = (linhas: LinhaKit[]) => arred4(linhas.reduce((a, l) => a + custoDaLinha(l), 0));

/** Quantos kits dá para montar (serviço não limita; sem nenhum produto: null = ilimitado). */
export const podeMontar = (linhas: LinhaKit[]): number | null => {
  let menor: number | null = null;
  for (const l of linhas) {
    if (l.servico || !(l.quantidade > 0)) continue;
    const n = Math.max(0, Math.floor(arred4(l.saldo / l.quantidade)));
    menor = menor === null ? n : Math.min(menor, n);
  }
  return menor;
};

/** Preço pelo markup líquido, com a taxa da maquininha embutida (mesma regra da Precificação). */
export const precoPorMarkup = (custo: number, markup: number, fatorTaxa: number) => arred2(custo * fatorTaxa * markup);

/** Junta um item na lista (se já estiver, soma a quantidade). */
export const adicionarLinha = <T extends LinhaKit>(linhas: T[], nova: T): T[] => {
  const existe = linhas.find(l => l.idItem === nova.idItem);
  if (!existe) return [...linhas, nova];
  return linhas.map(l => (l.idItem === nova.idItem ? { ...l, quantidade: arred4(l.quantidade + nova.quantidade) } : l));
};

/** Cobertura em dias -> cor do aviso de compra. */
export const corCobertura = (dias: number | null) => (dias === null ? 'default' : dias <= 15 ? 'red' : dias <= 30 ? 'orange' : 'green');
