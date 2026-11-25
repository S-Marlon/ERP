// Vendas › resultado do pedido (fechamento): quanto o pedido deixa de lucro — receita dos produtos (já com os descontos e,
// no orçamento, o desconto combinado por pagar na forma), custo das mercadorias, taxas dos meios de pagamento (as
// lançadas na venda, ou estimadas pela condição no orçamento), devoluções e frete à parte — e se o lucro está bom: a
// margem contra a margem alvo e a mínima da loja (as mesmas da negociação), com os motivos que puxam o lucro para baixo.
// Só leitura: não muda nenhum valor do pedido. Puro, com teste.

export interface ItemResultado {
  nome: string; sku: string; quantidade: number; unidade: string;
  /** Preço de tabela (unitário), total cobrado do item (já com o desconto) e o custo total do item. */
  precoTabela: number; totalItem: number; custoTotal: number;
}
export interface EntradaResultado {
  itens: ItemResultado[];
  /** Frete cobrado (fica à parte: paga a entrega) e o que já foi devolvido. */
  frete: number; devolvido: number;
  /** Taxas dos meios de pagamento; estimadas = orçamento (pela condição combinada), não lançadas. */
  taxas: number; taxasEstimadas: boolean;
  /** Orçamento: desconto combinado por pagar na forma (0,10 = 10%). Na venda já está nos itens. */
  descontoFormaPct: number;
  margemAlvo: number; margemMinima: number;
}
export type NivelResultado = 'PREJUIZO' | 'ABAIXO_MINIMA' | 'ABAIXO_ALVO' | 'BOA' | 'OTIMA';

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const resultadoDoPedido = (e: EntradaResultado) => {
  const tabela = r2(e.itens.reduce((s, i) => s + i.precoTabela * i.quantidade, 0));
  const vendido = r2(e.itens.reduce((s, i) => s + i.totalItem, 0));
  const descontoItens = r2(Math.max(0, tabela - vendido));
  const descontoForma = r2(vendido * (e.descontoFormaPct || 0));
  const custoCheio = r2(e.itens.reduce((s, i) => s + i.custoTotal, 0));
  // devolução: tira a receita devolvida e o custo na mesma proporção (a mercadoria voltou)
  const parteDevolvida = vendido > 0 ? Math.min(1, e.devolvido / vendido) : 0;
  const receita = r2(vendido - descontoForma - e.devolvido);
  const custo = r2(custoCheio * (1 - parteDevolvida));
  const lucroBruto = r2(receita - custo);
  const lucro = r2(lucroBruto - e.taxas);
  const margem = receita > 0 ? Math.round((lucro / receita) * 10000) / 10000 : null;

  const itens = e.itens.map(i => {
    const receitaItem = r2(i.totalItem * (1 - (e.descontoFormaPct || 0)));
    const lucroItem = r2(receitaItem - i.custoTotal);
    return {
      ...i, receita: receitaItem, lucro: lucroItem, semCusto: !(i.custoTotal > 0),
      margem: receitaItem > 0 && i.custoTotal > 0 ? Math.round((lucroItem / receitaItem) * 10000) / 10000 : null,
      descontoPct: i.precoTabela * i.quantidade > 0 ? Math.round((1 - i.totalItem / (i.precoTabela * i.quantidade)) * 10000) / 10000 : 0,
    };
  });

  const nivel: NivelResultado = lucro < 0 ? 'PREJUIZO'
    : margem !== null && margem < e.margemMinima ? 'ABAIXO_MINIMA'
      : margem !== null && margem < e.margemAlvo ? 'ABAIXO_ALVO'
        : margem !== null && margem >= e.margemAlvo + 0.1 ? 'OTIMA' : 'BOA';

  // o que puxa o lucro (para a "perspectiva")
  const fatores: string[] = [];
  const semCusto = itens.filter(i => i.semCusto);
  if (semCusto.length) fatores.push(`${semCusto.length} item(ns) sem custo cadastrado (${semCusto.slice(0, 3).map(i => i.sku).join(', ')}): o lucro real é menor que o mostrado.`);
  const abaixo = itens.filter(i => !i.semCusto && i.lucro < 0);
  if (abaixo.length) fatores.push(`Vendido abaixo do custo: ${abaixo.map(i => `${i.sku} (${brl(i.lucro)})`).join(', ')}.`);
  const descontoTotal = r2(descontoItens + descontoForma);
  if (tabela > 0 && descontoTotal / tabela >= 0.05) {
    fatores.push(`Desconto de ${pct(descontoTotal / tabela)} sobre a tabela (${brl(descontoTotal)})${descontoForma ? `, sendo ${brl(descontoForma)} do desconto da forma de pagamento` : ''}.`);
  }
  const fortes = itens.filter(i => i.descontoPct >= 0.2);
  if (fortes.length) fatores.push(`Desconto forte em ${fortes.map(i => `${i.sku} (${pct(i.descontoPct)})`).join(', ')}.`);
  if (receita > 0 && e.taxas / receita >= 0.02) fatores.push(`Taxas da maquininha${e.taxasEstimadas ? ' (estimadas)' : ''}: ${brl(e.taxas)} (${pct(e.taxas / receita)} da receita).`);
  if (e.devolvido > 0) fatores.push(`Devolução de ${brl(e.devolvido)} já descontada.`);

  // quanto faltou (ou sobrou) para a margem alvo: o preço que daria a margem alvo com o mesmo custo e taxas
  const receitaNoAlvo = e.margemAlvo < 1 ? r2((custo + e.taxas) / (1 - e.margemAlvo)) : null;
  const faltaParaAlvo = receitaNoAlvo !== null && receita < receitaNoAlvo ? r2(receitaNoAlvo - receita) : 0;
  const melhor = [...itens].filter(i => !i.semCusto).sort((a, b) => b.lucro - a.lucro)[0];
  const textos: Record<NivelResultado, string> = {
    PREJUIZO: `Este pedido dá prejuízo de ${brl(-lucro)}.`,
    ABAIXO_MINIMA: `Lucro baixo: margem de ${margem !== null ? pct(margem) : '—'}, abaixo da mínima (${pct(e.margemMinima)}).`,
    ABAIXO_ALVO: `Lucro aceitável: margem de ${margem !== null ? pct(margem) : '—'}, entre a mínima (${pct(e.margemMinima)}) e o alvo (${pct(e.margemAlvo)}).`,
    BOA: `Lucro bom: margem de ${margem !== null ? pct(margem) : '—'}, no alvo da loja (${pct(e.margemAlvo)}).`,
    OTIMA: `Lucro ótimo: margem de ${margem !== null ? pct(margem) : '—'}, bem acima do alvo (${pct(e.margemAlvo)}).`,
  };

  return {
    tabela, descontoItens, descontoForma, receita, frete: r2(e.frete), devolvido: r2(e.devolvido), custo, lucroBruto, taxas: r2(e.taxas),
    taxasEstimadas: e.taxasEstimadas, lucro, margem, nivel, avaliacao: textos[nivel], margemAlvo: e.margemAlvo, margemMinima: e.margemMinima,
    faltaParaAlvo, receitaNoAlvo, fatores, itens,
    melhorItem: melhor ? { sku: melhor.sku, nome: melhor.nome, lucro: melhor.lucro } : null,
    /** Lucro conta com custo de todos os itens? Sem custo cadastrado, o número é otimista. */
    custoCompleto: semCusto.length === 0,
  };
};
export type ResultadoPedido = ReturnType<typeof resultadoDoPedido>;
