// Kits (itens_composicoes, tipo_relacao 'KIT'): o kit é um item de venda comum do catálogo, sem estoque próprio.
// Na venda a baixa sai dos componentes; o custo e o estoque possível do kit vêm deles.
// Regras puras (sem banco), testadas em kits.test.ts.

export const TIPO_KIT = 'KIT';

export class ErroKit extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface ComponenteKit {
  idItem: number;
  quantidade: number; // na unidade base do componente, por 1 kit
}

/** Dados do componente usados nas contas (saldo e custo na unidade base). */
export interface DadosComponente {
  idItem: number;
  saldo: number;
  custo: number;
  servico?: boolean;
  podeVenderSemEstoque?: boolean;
}

const arred4 = (v: number) => Math.round((Number(v) || 0) * 10000) / 10000;
const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Confere e normaliza a lista de componentes: quantidade > 0, sem o próprio kit, sem kit dentro de kit
 * e o mesmo item repetido vira uma linha só (quantidades somadas).
 */
export const normalizarComponentes = (
  entrada: Array<{ idItem: unknown; quantidade: unknown }>,
  idKit: number | null,
  ehKit: (idItem: number) => boolean = () => false
): ComponenteKit[] => {
  if (!Array.isArray(entrada) || entrada.length === 0) throw new ErroKit('Coloque pelo menos um item no kit.');
  const porItem = new Map<number, number>();
  for (const c of entrada) {
    const idItem = Number(c?.idItem);
    const quantidade = Number(c?.quantidade);
    if (!Number.isInteger(idItem) || idItem <= 0) throw new ErroKit('Item inválido na composição do kit.');
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new ErroKit('A quantidade de cada item do kit precisa ser maior que zero.');
    if (idKit && idItem === idKit) throw new ErroKit('O kit não pode conter ele mesmo.');
    if (ehKit(idItem)) throw new ErroKit('Kit dentro de kit não é permitido: coloque os itens do outro kit direto.');
    porItem.set(idItem, arred4((porItem.get(idItem) || 0) + quantidade));
  }
  return [...porItem.entries()].map(([idItem, quantidade]) => ({ idItem, quantidade }));
};

/** Custo do kit: soma do custo de cada componente × quantidade (arredondado por linha). */
export const custoDoKit = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number =>
  arred4(componentes.reduce((total, c) => total + arred4((dados.get(c.idItem)?.custo || 0) * c.quantidade), 0));

/**
 * Quantos kits dá para montar com o estoque atual (o componente mais escasso manda).
 * Serviço e item que pode vender sem estoque não limitam. Sem nenhum limite: null (ilimitado).
 */
export const estoqueDoKit = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number | null => {
  let menor: number | null = null;
  for (const c of componentes) {
    const d = dados.get(c.idItem);
    if (d?.servico || d?.podeVenderSemEstoque) continue;
    const possivel = Math.max(0, Math.floor(arred4((d?.saldo || 0) / c.quantidade)));
    menor = menor === null ? possivel : Math.min(menor, possivel);
  }
  return menor;
};

/** Componente que limita a montagem (o primeiro com menos kits possíveis). */
export const componenteLimitante = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number | null => {
  let melhor: { idItem: number; possivel: number } | null = null;
  for (const c of componentes) {
    const d = dados.get(c.idItem);
    if (d?.servico || d?.podeVenderSemEstoque) continue;
    const possivel = Math.max(0, Math.floor(arred4((d?.saldo || 0) / c.quantidade)));
    if (!melhor || possivel < melhor.possivel) melhor = { idItem: c.idItem, possivel };
  }
  return melhor?.idItem ?? null;
};

/** Saída de cada componente para uma quantidade de kits (unidade base do componente). */
export const saidaDosComponentes = (componentes: ComponenteKit[], quantidadeKits: number) =>
  componentes.map(c => ({ idItem: c.idItem, quantidade: arred4(c.quantidade * quantidadeKits) }));

/**
 * Devolução parcial de uma linha de kit: o que volta de cada componente é proporcional ao que saiu na venda.
 * movimentos = saídas dos componentes registradas na venda dessa linha.
 */
export const voltaDaDevolucao = (
  movimentos: Array<{ idItem: number; quantidade: number; custo: number }>,
  quantidadeVendida: number,
  quantidadeDevolvida: number
) => {
  if (!(quantidadeVendida > 0)) return [];
  const proporcao = Math.min(1, Math.max(0, quantidadeDevolvida / quantidadeVendida));
  return movimentos
    .map(m => ({ idItem: m.idItem, quantidade: arred4(m.quantidade * proporcao), custo: m.custo }))
    .filter(m => m.quantidade > 0);
};

/** Margem e lucro do kit pelo preço (bruto, sem taxa: a tela aplica a taxa da maquininha). */
export const margemDoKit = (preco: number, custo: number) => ({
  lucro: arred2(preco - custo),
  margemPct: preco > 0 ? arred2(((preco - custo) / preco) * 100) : 0,
});

/**
 * Cobertura do componente: em quantos dias o saldo acaba no ritmo das vendas de kits do período.
 * Sem consumo: null (não acaba).
 */
export const diasDeCobertura = (saldo: number, consumoNoPeriodo: number, diasDoPeriodo: number): number | null => {
  if (!(consumoNoPeriodo > 0) || !(diasDoPeriodo > 0)) return null;
  return Math.max(0, Math.floor(saldo / (consumoNoPeriodo / diasDoPeriodo)));
};

/** SKU sugerido para kit novo (o operador pode trocar). */
export const skuSugeridoKit = (idItem: number) => `KIT-${String(idItem).padStart(4, '0')}`;
