// Orçamento de negociação: margem de cada item e do orçamento inteiro (lucro ÷ preço, com o markup ao lado), preço para
// uma margem, "equilibrar para o alvo" (os itens não travados vão para a margem que fecha o orçamento no alvo), faixas por
// quantidade e o que fica abaixo da margem mínima (pede a senha). Regras puras (sem banco), com teste.

export interface LinhaNegociacao {
  /** Quantidade na unidade da linha e o preço unitário praticado (na unidade da linha). */
  quantidade: number; preco: number;
  /** Custo de 1 unidade da linha (custo base × fator). 0 = sem custo conhecido. */
  custoUnitario: number;
  travado?: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Margem sobre o preço (0,3 = 30%). Sem preço ou sem custo = null. */
export const margem = (preco: number, custo: number) => (preco > 0 && custo > 0 ? r4((preco - custo) / preco) : null);
/** Markup sobre o custo (0,4286 = 42,86%). */
export const markup = (preco: number, custo: number) => (custo > 0 ? r4((preco - custo) / custo) : null);
/** Preço que dá a margem pedida sobre o custo (arredondado no centavo). Margem de 95% ou mais não existe. */
export const precoParaMargem = (custo: number, m: number) => r2(custo / (1 - Math.min(Math.max(m, -5), 0.95)));

/** Totais do orçamento: receita, custo, lucro, margem e markup (só linhas com custo entram na margem). */
export const resumoNegociacao = (linhas: LinhaNegociacao[]) => {
  const receita = r2(linhas.reduce((s, l) => s + r2(l.preco * l.quantidade), 0));
  const comCusto = linhas.filter(l => l.custoUnitario > 0);
  const receitaComCusto = r2(comCusto.reduce((s, l) => s + r2(l.preco * l.quantidade), 0));
  const custo = r2(comCusto.reduce((s, l) => s + r2(l.custoUnitario * l.quantidade), 0));
  const lucro = r2(receitaComCusto - custo);
  return {
    receita, custo, lucro, margem: receitaComCusto > 0 ? r4(lucro / receitaComCusto) : null, markup: custo > 0 ? r4(lucro / custo) : null,
    semCusto: linhas.length - comCusto.length,
  };
};

/**
 * Equilibrar para o alvo: os itens travados ficam como estão e os outros vão todos para a mesma margem, a que faz o
 * orçamento inteiro dar a margem alvo. Devolve os preços novos (na ordem das linhas), a margem aplicada nos livres e um
 * aviso quando não dá (travados já passam do alvo e os livres teriam de ficar abaixo do custo, ou os livres passariam de 90%).
 */
export const equilibrar = (linhas: LinhaNegociacao[], alvo: number) => {
  const comCusto = (l: LinhaNegociacao) => l.custoUnitario > 0;
  const livres = linhas.filter(l => !l.travado && comCusto(l));
  if (!livres.length) return { precos: linhas.map(l => l.preco), margemLivres: null as number | null, aviso: 'Não há itens livres (com custo) para ajustar: destrave algum.' };
  const fixos = linhas.filter(l => l.travado && comCusto(l));
  const custoTotal = [...fixos, ...livres].reduce((s, l) => s + l.custoUnitario * l.quantidade, 0);
  const receitaAlvo = custoTotal / (1 - alvo);
  const receitaFixos = fixos.reduce((s, l) => s + l.preco * l.quantidade, 0);
  const custoLivres = livres.reduce((s, l) => s + l.custoUnitario * l.quantidade, 0);
  const receitaLivres = receitaAlvo - receitaFixos;
  let m = receitaLivres > 0 ? 1 - custoLivres / receitaLivres : -Infinity;
  let aviso: string | null = null;
  if (m < 0) { aviso = 'Os itens travados já passam do alvo: os outros ficariam abaixo do custo (ficam no custo; baixe o preço travado ou suba o alvo).'; m = 0; }
  if (m > 0.9) { aviso = 'Os itens livres teriam de passar de 90% de margem: trave menos itens ou baixe o alvo.'; m = 0.9; }
  m = r4(m);
  return { precos: linhas.map(l => (!l.travado && comCusto(l) ? precoParaMargem(l.custoUnitario, m) : l.preco)), margemLivres: m, aviso };
};

/** Leva todas as linhas livres (com custo) para a mesma margem (régua geral ou de uma categoria). */
export const aplicarMargem = (linhas: LinhaNegociacao[], m: number) =>
  linhas.map(l => (!l.travado && l.custoUnitario > 0 ? precoParaMargem(l.custoUnitario, m) : l.preco));

export interface FaixaQuantidade { quantidadeMinima: number; precoUnitario: number }

/**
 * Faixas por quantidade de um item: a partir da quantidade X, o preço Y. Ordena, tira repetidas e as de quantidade ≤ 1
 * (a primeira faixa é o próprio preço da linha). Preço precisa ser positivo.
 */
export const normalizarFaixas = (faixas: unknown): FaixaQuantidade[] => {
  if (!Array.isArray(faixas)) return [];
  const vistas = new Set<number>();
  return faixas
    .map((f: any) => ({ quantidadeMinima: r4(Number(f?.quantidadeMinima)), precoUnitario: r4(Number(f?.precoUnitario)) }))
    .filter(f => Number.isFinite(f.quantidadeMinima) && f.quantidadeMinima > 1 && Number.isFinite(f.precoUnitario) && f.precoUnitario > 0)
    .sort((a, b) => a.quantidadeMinima - b.quantidadeMinima)
    .filter(f => (vistas.has(f.quantidadeMinima) ? false : (vistas.add(f.quantidadeMinima), true)));
};

/** Preço da quantidade: o da maior faixa alcançada, senão o preço da linha. */
export const precoDaQuantidade = (precoLinha: number, faixas: FaixaQuantidade[], quantidade: number) =>
  [...faixas].reverse().find(f => quantidade >= f.quantidadeMinima)?.precoUnitario ?? precoLinha;

/**
 * O que precisa de senha: linha (ou faixa) com margem abaixo da mínima. Sem custo não entra (não se sabe a margem).
 * Devolve as mensagens, uma por item.
 */
export const abaixoDaMinima = (
  linhas: Array<{ nome: string; preco: number; custoUnitario: number; faixas?: FaixaQuantidade[] }>, minima: number,
) => linhas.flatMap(l => {
  if (!(l.custoUnitario > 0)) return [];
  const precos = [l.preco, ...(l.faixas || []).map(f => f.precoUnitario)];
  const pior = Math.min(...precos);
  const m = margem(pior, l.custoUnitario)!;
  return m < minima - 1e-9 ? [`${l.nome}: margem de ${(m * 100).toFixed(1).replace('.', ',')}% (mínima ${(minima * 100).toFixed(0)}%)`] : [];
});
