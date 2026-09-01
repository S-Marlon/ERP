interface ItemNotaXML {
  quantidadeXml: number;
  valorUnitarioXml: number;
  valorDesconto?: number;
  valorIpi?: number;
  valorIcmsSt?: number;
}

interface TotaisNota {
  valorTotalProdutos: number;
  valorFreteTotal: number;
  valorOutrasDespesasTotal: number;
}

interface ParametrosCalculoCusto {
  item: ItemNotaXML;
  totaisNota: TotaisNota;
  fatorConversao: number; // Ex: 12 se compra em Caixa e estoca em Unidade
}

interface ResultadoCustoItem {
  valorBruto: number;
  proporcao: number;
  freteRateado: number;
  despesaRateada: number;
  custoTotalItem: number;
  quantidadeConvertida: number;
  custoUnitarioReal: number;
}

function calcularCustoRealItem(params: ParametrosCalculoCusto): ResultadoCustoItem {
  const { item, totaisNota, fatorConversao } = params;

  // 1. Valor bruto do item na nota
  const valorBruto = item.quantidadeXml * item.valorUnitarioXml;
  const desconto = item.valorDesconto || 0;
  const ipi = item.valorIpi || 0;
  const icmsSt = item.valorIcmsSt || 0;

  // 2. Proporção do item em relação ao total de produtos da nota (Evita divisão por zero)
  const proporcao = totaisNota.valorTotalProdutos > 0 
    ? valorBruto / totaisNota.valorTotalProdutos 
    : 0;

  // 3. Rateio proporcional de frete e despesas
  const freteRateado = totaisNota.valorFreteTotal * proporcao;
  const despesaRateada = totaisNota.valorOutrasDespesasTotal * proporcao;

  // 4. Custo total do item (Bruto - Descontos + Impostos + Frete Rateado + Despesas Rateadas)
  const custoTotalItem = (valorBruto - desconto) + ipi + icmsSt + freteRateado + despesaRateada;

  // 5. Quantidade convertida para a unidade interna de estoque
  const qtdConv = fatorConversao > 0 ? fatorConversao : 1.0;
  const quantidadeConvertida = item.quantidadeXml * qtdConv;

  // 6. Custo Unitário Real final para o estoque
  const custoUnitarioReal = quantidadeConvertida > 0 
    ? custoTotalItem / quantidadeConvertida 
    : 0;

  return {
    valorBruto,
    proporcao,
    freteRateado: Number(freteRateado.toFixed(4)),
    despesaRateada: Number(despesaRateada.toFixed(4)),
    custoTotalItem: Number(custoTotalItem.toFixed(4)),
    quantidadeConvertida,
    custoUnitarioReal: Number(custoUnitarioReal.toFixed(4))
  };
}

// ==========================================
// Exemplo de Uso Prático:
// ==========================================
const totaisDaNota: TotaisNota = {
  valorTotalProdutos: 1000.00, // Soma dos produtos da NF = R$ 1.000,00
  valorFreteTotal: 100.00,     // Frete cobrado na NF = R$ 100,00
  valorOutrasDespesasTotal: 50.00 // Outras despesas = R$ 50,00
};

const itemDaNota: ItemNotaXML = {
  quantidadeXml: 10,           // Comprou 10 caixas
  valorUnitarioXml: 100.00,    // Cada caixa custou R$ 100,00 (Total bruto = R$ 1.000,00)
  valorDesconto: 0,
  valorIpi: 10.00
};

// Fator de conversão: Cada 1 caixa tem 12 unidades dentro
const resultado = calcularCustoRealItem({
  item: itemDaNota,
  totaisNota: totaisDaNota,
  fatorConversao: 12 
});

console.log("Resultado do Cálculo de Custo:", resultado);