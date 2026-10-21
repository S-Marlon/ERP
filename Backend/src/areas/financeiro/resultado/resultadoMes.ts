// Resultado do mês (DRE gerencial, por competência): vendas − devoluções − custo das mercadorias − taxas (cartão e
// Mercado Livre) = margem de contribuição; − despesas da loja por grupo de categoria = resultado. Regras puras.
// Compra de mercadoria não é despesa aqui: o custo dela entra quando a mercadoria é vendida.

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export interface DadosDoMes {
  vendas: number;          // vendas concluídas (líquido de desconto)
  qtdVendas: number;
  devolucoes: number;      // valor devolvido ao cliente
  custoVendas: number;     // custo das mercadorias vendidas
  custoRecuperado: number; // custo do que voltou ao estoque na devolução
  taxasCartao: number;     // taxas das vendas do balcão
  taxasMl: number;         // tarifa + frete das vendas do Mercado Livre
  despesas: { grupo: string; categoria: string; valor: number }[];
}

export type TipoLinha = 'RECEITA' | 'DEDUCAO' | 'SUBTOTAL' | 'RESULTADO';
export interface LinhaResultado { chave: string; rotulo: string; tipo: TipoLinha; valor: number; pct: number | null; detalhe?: { nome: string; valor: number }[] }

/** As linhas do resultado em ordem (valores de dedução negativos), com o % sobre a receita líquida. */
export const montarResultado = (d: DadosDoMes): LinhaResultado[] => {
  const receitaLiquida = r2(d.vendas - d.devolucoes);
  const cmv = r2(d.custoVendas - d.custoRecuperado);
  const lucroBruto = r2(receitaLiquida - cmv);
  const margem = r2(lucroBruto - d.taxasCartao - d.taxasMl);
  const grupos = new Map<string, { valor: number; categorias: Map<string, number> }>();
  for (const x of d.despesas) {
    const g = grupos.get(x.grupo) || { valor: 0, categorias: new Map() };
    g.valor = r2(g.valor + x.valor);
    g.categorias.set(x.categoria, r2((g.categorias.get(x.categoria) || 0) + x.valor));
    grupos.set(x.grupo, g);
  }
  const totalDespesas = r2([...grupos.values()].reduce((a, g) => a + g.valor, 0));
  const pct = (v: number) => (receitaLiquida > 0 ? r2((v / receitaLiquida) * 100) : null);
  const linha = (chave: string, rotulo: string, tipo: TipoLinha, valor: number, detalhe?: LinhaResultado['detalhe']): LinhaResultado =>
    ({ chave, rotulo, tipo, valor: r2(valor), pct: pct(valor), ...(detalhe ? { detalhe } : {}) });
  return [
    linha('vendas', `Vendas (${d.qtdVendas})`, 'RECEITA', d.vendas),
    linha('devolucoes', 'Devoluções', 'DEDUCAO', -d.devolucoes),
    linha('receita', 'Receita líquida', 'SUBTOTAL', receitaLiquida),
    linha('cmv', 'Custo das mercadorias vendidas', 'DEDUCAO', -cmv),
    linha('bruto', 'Lucro bruto', 'SUBTOTAL', lucroBruto),
    linha('cartao', 'Taxas de cartão', 'DEDUCAO', -d.taxasCartao),
    linha('ml', 'Tarifas e frete do Mercado Livre', 'DEDUCAO', -d.taxasMl),
    linha('margem', 'Margem de contribuição', 'SUBTOTAL', margem),
    ...[...grupos.entries()].sort((a, b) => b[1].valor - a[1].valor).map(([grupo, g]) =>
      linha(`desp:${grupo}`, grupo, 'DEDUCAO', -g.valor,
        [...g.categorias.entries()].sort((a, b) => b[1] - a[1]).map(([nome, valor]) => ({ nome, valor: r2(valor) })))),
    linha('resultado', 'Resultado do mês', 'RESULTADO', margem - totalDespesas),
  ];
};

/** Boleto de NF sem categoria é compra de mercadoria (não entra como despesa). */
export const ehCompraDeMercadoria = (t: { idLote: number | null; grupo: string | null }) =>
  t.grupo === 'Mercadoria' || (t.idLote !== null && !t.grupo);
