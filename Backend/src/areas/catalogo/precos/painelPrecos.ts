// Situação de preço de um item de venda (painel de precificação). Regras puras.
// O preço de tabela embute a taxa da maquininha (Vendas › Taxas de pagamento):
//   preço = custo × markup × fatorTaxa, com fatorTaxa = 1 / (1 − taxa).
// A margem do painel é a líquida (depois da taxa), a mesma do editor de preço.
import { analisarDefasagem, calcularPrecoUnidade, precoSegueMarkup } from './precificacao';

export const LIMITE_MARGEM_BAIXA = 15; // % sobre o preço

export const SITUACOES_PRECO = {
  SEM_PRECO: { label: 'Sem preço', nivel: 'critico' },
  MARGEM_NEGATIVA: { label: 'Vende abaixo do custo', nivel: 'critico' },
  TAXA_ANTIGA: { label: 'Taxa mudou', nivel: 'atencao' },
  SEM_TAXA: { label: 'Preço sem a taxa', nivel: 'atencao' },
  FORA_DO_MARKUP: { label: 'Preço fora do markup', nivel: 'atencao' },
  SEM_CUSTO: { label: 'Sem custo', nivel: 'atencao' },
  CUSTO_DEFASADO: { label: 'Custo defasado', nivel: 'atencao' },
  MARGEM_BAIXA: { label: `Margem abaixo de ${LIMITE_MARGEM_BAIXA}%`, nivel: 'atencao' },
} as const;

export type SituacaoPreco = keyof typeof SITUACOES_PRECO;

export interface PrecoItem {
  custoGerencial: number | null;
  custoMedio: number | null;
  ultimoCusto: number | null;
  precoVarejo: number | null;   // preço de varejo da unidade base
  markupVarejo?: number | null; // markup gravado nessa faixa
  taxaEmbutida?: number | null; // taxa com que o preço foi calculado (null = preço anterior a esse registro)
}

/** Taxa embutida no preço (percentual e fator 1 / (1 − taxa)). Sem taxa: { 0, 1 }. */
export interface TaxaPreco { percentual: number; fator: number }
export const SEM_TAXA: TaxaPreco = { percentual: 0, fator: 1 };

/** Margem líquida sobre o preço: (preço depois da taxa − custo) ÷ preço. null = sem preço ou sem custo. */
export const margemPct = (p: PrecoItem, taxa: TaxaPreco = SEM_TAXA): number | null => {
  const preco = Number(p.precoVarejo) || 0;
  const custo = Number(p.custoGerencial) || 0;
  if (preco <= 0 || custo <= 0) return null;
  return Number((((preco * (1 - taxa.percentual / 100) - custo) / preco) * 100).toFixed(2));
};

/** Composição do preço de varejo: custo × markup = preço sem taxa; + taxa = preço de tabela. */
export const composicaoPreco = (p: PrecoItem, taxa: TaxaPreco = SEM_TAXA) => {
  const custo = Number(p.custoGerencial) || 0;
  const markup = Number(p.markupVarejo) || 0;
  if (custo <= 0 || markup <= 0) return null;
  const semTaxa = calcularPrecoUnidade(custo, 1, markup, 1);
  const esperado = calcularPrecoUnidade(custo, 1, markup, taxa.fator);
  return { custo, markup, semTaxa, valorTaxa: Number((esperado - semTaxa).toFixed(2)), esperado, taxaEmbutida: p.taxaEmbutida ?? null };
};

/**
 * Preço gravado x preço que o markup manda (com a taxa atual). Mudar a taxa não muda preço: a diferença é acusada aqui.
 * - TAXA_ANTIGA: calculado com outra taxa (registrada na faixa) — a taxa mudou depois;
 * - SEM_TAXA: bate com custo × markup sem taxa nenhuma (preço de antes da taxa embutida);
 * - FORA_DO_MARKUP: não bate com nada (preço à mão, arredondado, ou taxa mudou num preço sem registro da taxa).
 */
export const conferenciaTaxa = (p: PrecoItem, taxa: TaxaPreco = SEM_TAXA): 'OK' | 'TAXA_ANTIGA' | 'SEM_TAXA' | 'FORA_DO_MARKUP' | null => {
  const c = composicaoPreco(p, taxa);
  const preco = Number(p.precoVarejo) || 0;
  if (!c || preco <= 0) return null;
  const registrada = p.taxaEmbutida === null || p.taxaEmbutida === undefined ? null : Number(p.taxaEmbutida);
  if (registrada !== null && Math.abs(registrada - taxa.percentual) >= 0.005) return registrada > 0 ? 'TAXA_ANTIGA' : 'SEM_TAXA';
  if (precoSegueMarkup(preco, c.custo, c.markup, taxa.fator)) return 'OK';
  if (taxa.percentual > 0 && precoSegueMarkup(preco, c.custo, c.markup, 1)) return 'SEM_TAXA';
  return 'FORA_DO_MARKUP';
};

export const situacoesPreco = (p: PrecoItem, taxa: TaxaPreco = SEM_TAXA): SituacaoPreco[] => {
  const lista: SituacaoPreco[] = [];
  const temPreco = Number(p.precoVarejo) > 0;
  const temCusto = Number(p.custoGerencial) > 0;
  if (!temPreco) lista.push('SEM_PRECO');
  if (!temCusto) lista.push('SEM_CUSTO');
  if (analisarDefasagem(p.custoGerencial, p.custoMedio, p.ultimoCusto).defasado && temCusto) lista.push('CUSTO_DEFASADO');
  const conf = conferenciaTaxa(p, taxa);
  if (conf === 'TAXA_ANTIGA' || conf === 'SEM_TAXA' || conf === 'FORA_DO_MARKUP') lista.push(conf);
  const margem = margemPct(p, taxa);
  if (margem !== null && margem < 0) lista.push('MARGEM_NEGATIVA');
  else if (margem !== null && margem < LIMITE_MARGEM_BAIXA) lista.push('MARGEM_BAIXA');
  return lista;
};
