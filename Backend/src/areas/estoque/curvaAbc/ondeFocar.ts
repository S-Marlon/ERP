// "Onde focar": a curva ABC virando decisão. Categorias em quatro quadrantes (proteger, rever preço, divulgar, liquidar),
// a lista de propaganda (parados com margem para desconto, com o desconto máximo que ainda respeita a margem mínima), os
// chamarizes (mais vendidos), o que repor e o que não recomprar, e quem subiu/caiu desde a foto do mês anterior.
// Regras puras, sem banco, com teste.
import type { ClasseExibida, ItemClassificado } from './curvaAbc';

export interface ItemFoco extends ItemClassificado {
  sku: string; nome: string; unidade: string | null; categoriaTopoNome: string | null; precoVenda: number;
  /** Decisão de compra gravada no item (Marcas e equivalentes). */
  decisaoCompra?: string | null;
}

export type Quadrante = 'PROTEGER' | 'REVER_PRECO' | 'DIVULGAR' | 'LIQUIDAR' | 'ACOMPANHAR';

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Margem de tabela do item: (preço − custo) ÷ preço. */
export const margemTabela = (i: { precoVenda: number; custoUnitario: number }) => (i.precoVenda > 0 ? (i.precoVenda - i.custoUnitario) / i.precoVenda : null);

/**
 * Categorias em quadrantes. "Vende bem" = 10% ou mais do faturamento, ou tem item A. Margem boa = pelo menos o alvo
 * (margem da venda; sem venda, a de tabela ponderada pelo estoque). Parado alto = R$ 500 ou mais e 60%+ do estoque dela.
 */
export const categoriasEmFoco = (itens: ItemFoco[], margemAlvo: number) => {
  const total = itens.reduce((a, i) => a + i.receita, 0);
  const grupos = new Map<string, ItemFoco[]>();
  for (const i of itens) {
    const k = i.categoriaTopoNome || 'Sem categoria';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(i);
  }
  return [...grupos.entries()].map(([categoria, l]) => {
    const receita = l.reduce((a, i) => a + i.receita, 0);
    const lucro = l.reduce((a, i) => a + i.lucro, 0);
    const estoque = l.reduce((a, i) => a + i.valorEstoque, 0);
    const parado = l.filter(i => i.situacao === 'PARADO').reduce((a, i) => a + i.valorEstoque, 0);
    const base = l.filter(i => i.precoVenda > 0 && i.estoque > 0);
    const precoEstoque = base.reduce((a, i) => a + i.precoVenda * i.estoque, 0);
    const margemTab = precoEstoque > 0 ? base.reduce((a, i) => a + (i.precoVenda - i.custoUnitario) * i.estoque, 0) / precoEstoque : null;
    const margem = receita > 0 ? lucro / receita : null;
    const participacao = total > 0 ? receita / total : 0;
    const vendeBem = participacao >= 0.1 || l.some(i => i.venda === 'A');
    const margemRef = margem ?? margemTab;
    const margemBoa = margemRef !== null && margemRef >= margemAlvo;
    const paradoAlto = parado >= 500 && estoque > 0 && parado / estoque >= 0.6;
    const quadrante: Quadrante = vendeBem ? (margemBoa ? 'PROTEGER' : 'REVER_PRECO') : paradoAlto ? (margemBoa ? 'DIVULGAR' : 'LIQUIDAR') : 'ACOMPANHAR';
    const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
    const motivo = {
      PROTEGER: `Faz ${pct(participacao)} do faturamento com margem de ${pct(margemRef)}: não deixar faltar e dar destaque`,
      REVER_PRECO: `Faz ${pct(participacao)} do faturamento, mas a margem é ${pct(margemRef)} (alvo ${pct(margemAlvo)}): renegociar compra ou subir preço`,
      DIVULGAR: `${pct(estoque > 0 ? parado / estoque : 0)} do estoque parado com margem de ${pct(margemRef)}: dá para fazer promoção sem perder dinheiro`,
      LIQUIDAR: `${pct(estoque > 0 ? parado / estoque : 0)} do estoque parado e margem de ${pct(margemRef)}: queima ou devolução, e parar de recomprar`,
      ACOMPANHAR: 'Sem destaque por enquanto',
    }[quadrante];
    return {
      categoria, itens: l.length, vendidos: l.filter(i => i.situacao === 'NORMAL').length, receita: r2(receita), lucro: r2(lucro),
      margem: margem === null ? null : r4(margem), margemTabela: margemTab === null ? null : r4(margemTab), estoque: r2(estoque), parado: r2(parado),
      participacao: r4(participacao), giro: estoque > 0 ? r4(receita / estoque) : null, quadrante, motivo,
    };
  }).sort((a, b) => b.receita - a.receita || b.parado - a.parado);
};

/** Desconto máximo (fração, para baixo em 1%) que ainda deixa a margem mínima: preço mínimo = custo ÷ (1 − mínima). */
export const descontoMaximo = (preco: number, custo: number, margemMinima: number) => {
  if (!(preco > 0) || !(custo >= 0) || margemMinima >= 1) return 0;
  const precoMinimo = custo / (1 - margemMinima);
  return Math.max(0, Math.floor((1 - precoMinimo / preco) * 100) / 100);
};

/**
 * Lista de propaganda: parados com estoque de pelo menos R$ 50 e margem de tabela 10 pontos acima da mínima, em ordem
 * de "dinheiro parado × margem". Desconto sugerido = o menor entre o máximo e 15%, arredondado para baixo em 5%.
 */
export const listaPropaganda = (itens: ItemFoco[], margemMinima: number, limite = 30) => itens
  .filter(i => i.situacao === 'PARADO' && i.valorEstoque >= 50)
  .map(i => ({ i, m: margemTabela(i) }))
  .filter(x => x.m !== null && x.m >= margemMinima + 0.1)
  .sort((a, b) => b.i.valorEstoque * (b.m as number) - a.i.valorEstoque * (a.m as number))
  .slice(0, limite)
  .map(({ i, m }) => {
    const max = descontoMaximo(i.precoVenda, i.custoUnitario, margemMinima);
    const sugerido = Math.floor(Math.min(max, 0.15) * 20) / 20;
    return {
      idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade, categoria: i.categoriaTopoNome, estoque: i.estoque, valorEstoque: i.valorEstoque,
      preco: i.precoVenda, margemTabela: r4(m as number), descontoMaximo: max, descontoSugerido: sugerido, precoPromocao: r2(i.precoVenda * (1 - sugerido)),
    };
  });

/** Chamarizes: os mais vendidos que vendem sempre (A com X/Y) e têm estoque — bons para vitrine e anúncio. */
export const chamarizes = (itens: ItemFoco[], limite = 8) => itens
  .filter(i => i.venda === 'A' && (i.xyz === 'X' || i.xyz === 'Y') && i.estoque > 0)
  .sort((a, b) => b.receita - a.receita).slice(0, limite)
  .map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, categoria: i.categoriaTopoNome, receita: i.receita, preco: i.precoVenda, xyz: i.xyz }));

/** Repor (vende e está acabando) e não recomprar (estoque para muito tempo, parado com valor alto, ou decidido "não recomprar"). */
export const listasDeCompra = (itens: ItemFoco[], dias: number, limite = 40) => ({
  repor: itens
    .filter(i => i.decisaoCompra !== 'NAO_RECOMPRAR' && (i.venda === 'A' || i.venda === 'B') && (i.estoque <= 0 || (i.coberturaDias !== null && i.coberturaDias < 15)))
    .sort((a, b) => b.receita - a.receita).slice(0, limite)
    .map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, categoria: i.categoriaTopoNome, classe: i.venda, estoque: i.estoque, coberturaDias: i.coberturaDias, vendidoNoPeriodo: i.quantidade, unidade: i.unidade })),
  naoRecomprar: itens
    .filter(i => i.decisaoCompra === 'NAO_RECOMPRAR' || (i.decisaoCompra !== 'PREFERIDO'
      && ((i.coberturaDias !== null && i.coberturaDias > dias * 4 && i.valorEstoque >= 100) || (i.situacao === 'PARADO' && (i.estoqueClasse === 'A' || i.estoqueClasse === 'B')))))
    .sort((a, b) => b.valorEstoque - a.valorEstoque).slice(0, limite)
    .map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, categoria: i.categoriaTopoNome, estoque: i.estoque, valorEstoque: i.valorEstoque, coberturaDias: i.coberturaDias, unidade: i.unidade,
      motivo: i.decisaoCompra === 'NAO_RECOMPRAR' ? 'decidido: não recomprar' : i.situacao === 'PARADO' ? 'parado' : `estoque para ~${i.coberturaDias} dias` })),
});

/** Quem subiu para A e quem caiu de A desde a foto anterior (classe de venda). */
export const evolucao = (atual: Map<number, ClasseExibida>, anterior: Map<number, string>, nomes: Map<number, { sku: string; nome: string }>) => {
  const subiram: Array<{ idItem: number; sku: string; nome: string; de: string; para: string }> = [];
  const cairam: typeof subiram = [];
  for (const [id, para] of atual) {
    const de = anterior.get(id);
    if (!de || de === para) continue;
    const x = { idItem: id, ...(nomes.get(id) || { sku: '', nome: `Item ${id}` }), de, para };
    if (para === 'A') subiram.push(x);
    else if (de === 'A') cairam.push(x);
  }
  return { subiram, cairam };
};
