// Situação de preço de um item de venda (painel de precificação). Regras puras.
import { analisarDefasagem } from './precificacao';

export const LIMITE_MARGEM_BAIXA = 15; // % sobre o preço

export const SITUACOES_PRECO = {
  SEM_PRECO: { label: 'Sem preço', nivel: 'critico' },
  MARGEM_NEGATIVA: { label: 'Vende abaixo do custo', nivel: 'critico' },
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
}

/** Margem sobre o preço (lucro ÷ preço) usando o custo gerencial, que é a base do preço. null = sem preço ou sem custo. */
export const margemPct = (p: PrecoItem): number | null => {
  const preco = Number(p.precoVarejo) || 0;
  const custo = Number(p.custoGerencial) || 0;
  if (preco <= 0 || custo <= 0) return null;
  return Number((((preco - custo) / preco) * 100).toFixed(2));
};

export const situacoesPreco = (p: PrecoItem): SituacaoPreco[] => {
  const lista: SituacaoPreco[] = [];
  const temPreco = Number(p.precoVarejo) > 0;
  const temCusto = Number(p.custoGerencial) > 0;
  if (!temPreco) lista.push('SEM_PRECO');
  if (!temCusto) lista.push('SEM_CUSTO');
  if (analisarDefasagem(p.custoGerencial, p.custoMedio, p.ultimoCusto).defasado && temCusto) lista.push('CUSTO_DEFASADO');
  const margem = margemPct(p);
  if (margem !== null && margem < 0) lista.push('MARGEM_NEGATIVA');
  else if (margem !== null && margem < LIMITE_MARGEM_BAIXA) lista.push('MARGEM_BAIXA');
  return lista;
};
