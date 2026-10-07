// Taxa da maquininha que o preço de tabela embute (Vendas › Taxas de pagamento → taxa de referência).
// preço = custo x fator da unidade x markup x fatorTaxa, com fatorTaxa = 1 / (1 - taxa).
// O markup é líquido: depois de descontada a taxa, o preço rende o markup sobre o custo.
// Carregada no início do app; as contas de preço do front leem o valor atual.
import { useSyncExternalStore } from 'react';
import { API_URL } from '../../shared/api/config';

const API = `${API_URL}/api/vendas/taxas`;

let estado = { percentual: 0, fator: 1, carregado: false };
const ouvintes = new Set<() => void>();

export const fatorTaxaPreco = () => estado.fator;
export const percentualTaxaPreco = () => estado.percentual;

export const carregarTaxaPreco = async () => {
  try {
    const r = await fetch(API);
    if (!r.ok) return;
    const cfg = await r.json();
    const p = Number(cfg.taxaReferencia) || 0;
    estado = { percentual: p, fator: p > 0 && p < 100 ? 1 / (1 - p / 100) : 1, carregado: true };
    ouvintes.forEach(o => o());
  } catch {
    // Sem backend: fica sem taxa (fator 1)
  }
};

export const useTaxaPreco = () => useSyncExternalStore(
  (o) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; },
  () => estado,
);

/** Markup líquido a partir de um preço digitado: preço / (custo da unidade x fator da taxa). */
export const markupPorPreco = (preco: number, custoUnidade: number) =>
  custoUnidade > 0 ? preco / (custoUnidade * estado.fator) : 1;

/** Lucro e margem depois da taxa embutida. */
export const lucroLiquido = (preco: number, custoUnidade: number) => preco * (1 - estado.percentual / 100) - custoUnidade;
export const margemLiquidaPct = (preco: number, custoUnidade: number) => (preco > 0 ? (lucroLiquido(preco, custoUnidade) / preco) * 100 : 0);
