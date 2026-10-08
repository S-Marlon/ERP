// Precificação em lote: o que muda em cada item. Regras puras.
// - Custo novo: todas as faixas (unidades e atacado) são recalculadas mantendo o markup de cada uma.
// - Markup ou preço: valem para o varejo da unidade base (preço digitado → markup = preço ÷ (custo × fator da taxa)).
// - Item sem varejo na unidade base ganha essa faixa.
import { calcularPrecoUnidade } from './precificacao';

export interface FaixaAtual {
  idFaixa: number; tipo: 'VAREJO' | 'ATACADO'; ordem: number; fator: number;
  markup: number; preco: number; ehBase: boolean; padraoPdv: boolean;
}

export interface PedidoPreco {
  idItem: number; custo?: number | null; markup?: number | null; preco?: number | null;
  /** Sigla da unidade base para item que ainda não tem (ex.: itens antigos da importação) */
  unidade?: string | null;
}

export interface PlanoItem {
  novoCusto: number;
  custoMudou: boolean;
  /** Faixas que mudam (só as diferentes do que está gravado) */
  faixas: Array<{ idFaixa: number; markup: number; preco: number }>;
  /** Varejo da unidade base a criar (item ainda sem preço) */
  criarVarejoBase: { markup: number; preco: number } | null;
  /** Preço de referência do item (varejo padrão do PDV ou da base) para telas antigas */
  referencia: { preco: number; custoUnidade: number } | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const positivo = (v: unknown) => (v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null);

export class ErroLote extends Error {}

export const planejarItem = (custoAtual: number | null, faixas: FaixaAtual[], pedido: PedidoPreco, fatorTaxa: number): PlanoItem => {
  const custoPedido = positivo(pedido.custo);
  const novoCusto = custoPedido ?? (Number(custoAtual) || 0);
  if (!(novoCusto > 0)) throw new ErroLote('Informe o custo: o item não tem custo para calcular o preço.');
  const custoMudou = custoPedido !== null && Math.abs(custoPedido - (Number(custoAtual) || 0)) >= 0.00005;

  const base = faixas.filter(f => f.ehBase && f.tipo === 'VAREJO').sort((a, b) => a.ordem - b.ordem)[0];
  const precoPedido = positivo(pedido.preco);
  const markupPedido = positivo(pedido.markup);
  const markupBase = precoPedido !== null
    ? r4(precoPedido / (novoCusto * (fatorTaxa || 1)))
    : markupPedido ?? (base ? base.markup : null);
  if (!markupBase || !(markupBase > 0)) throw new ErroLote('Informe o markup ou o preço de venda.');
  const precoBase = precoPedido !== null ? r2(precoPedido) : calcularPrecoUnidade(novoCusto, 1, markupBase, fatorTaxa);

  const mudancas: PlanoItem['faixas'] = [];
  const finais = faixas.map(f => {
    if (base && f.idFaixa === base.idFaixa) return { ...f, markup: markupBase, preco: precoBase };
    if (custoMudou) return { ...f, preco: calcularPrecoUnidade(novoCusto, f.fator, f.markup, fatorTaxa) };
    return f;
  });
  finais.forEach((f, i) => {
    const antes = faixas[i];
    if (Math.abs(f.preco - antes.preco) >= 0.005 || Math.abs(f.markup - antes.markup) >= 0.00005) {
      mudancas.push({ idFaixa: f.idFaixa, markup: f.markup, preco: f.preco });
    }
  });

  const varejos = finais.filter(f => f.tipo === 'VAREJO');
  const ref = varejos.find(f => f.padraoPdv) || varejos.find(f => f.ehBase);
  return {
    novoCusto,
    custoMudou,
    faixas: mudancas,
    criarVarejoBase: base ? null : { markup: markupBase, preco: precoBase },
    referencia: ref ? { preco: ref.preco, custoUnidade: novoCusto * ref.fator } : base ? null : { preco: precoBase, custoUnidade: novoCusto },
  };
};
