import { calcularLinha, conferirEstoque, fecharVenda, validarPagamentos, DadosItemVenda } from './vendaPdv';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const lanca = (fn: () => unknown, trecho: string, message: string) => {
  try { fn(); } catch (e: any) { assert(String(e.message).includes(trecho), `${message} (veio: ${e.message})`); return; }
  throw new Error(`${message} (não lançou erro)`);
};

export const runVendaPdvTests = (): void => {
  // Mangueira: base metro (R$ 10, atacado R$ 8 a partir de 50 m) e rolo de 150 m
  const mangueira: DadosItemVenda = {
    unidades: [
      { idUnidade: 1, sigla: 'M', fator: 1, isBase: true, padraoPdv: true, permiteVenda: true, gtin: null, nomeExibicao: null },
      { idUnidade: 2, sigla: 'RL', fator: 150, isBase: false, padraoPdv: false, permiteVenda: true, gtin: '789', nomeExibicao: 'Rolo' },
      { idUnidade: 3, sigla: 'CX', fator: 10, isBase: false, padraoPdv: false, permiteVenda: false, gtin: null, nomeExibicao: null },
    ],
    faixas: [
      { idUnidade: 1, tipoFaixa: 'VAREJO', ordem: 1, quantidadeMinima: 0, quantidadeMaxima: null, precoUnitario: 10 },
      { idUnidade: 1, tipoFaixa: 'ATACADO', ordem: 2, quantidadeMinima: 50, quantidadeMaxima: null, precoUnitario: 8 },
    ],
    precoCadastro: 9.5,
  };

  const l1 = calcularLinha({ idItem: 1, quantidade: 3 }, mangueira);
  assert(l1.sigla === 'M' && l1.precoTabela === 10 && l1.quantidadeBase === 3, 'Sem unidade, vende na padrão do PDV com preço de varejo.');
  assert(calcularLinha({ idItem: 1, quantidade: 60 }, mangueira).precoTabela === 8, 'Quantidade de atacado aplica a faixa de atacado.');
  const rolo = calcularLinha({ idItem: 1, quantidade: 2, idUnidade: 2 }, mangueira);
  assert(rolo.quantidadeBase === 300 && rolo.precoTabela === 1425, 'Rolo sem faixa: preço do cadastro x fator e baixa 300 m.');
  lanca(() => calcularLinha({ idItem: 1, quantidade: 1, idUnidade: 3 }, mangueira), 'não está liberada', 'Unidade que não permite venda é recusada.');
  lanca(() => calcularLinha({ idItem: 1, quantidade: 0 }, mangueira), 'Quantidade inválida', 'Quantidade zero é recusada.');

  // Desconto individual (9 em vez de 10) + desconto geral de R$ 1,00 rateado
  const a = calcularLinha({ idItem: 1, quantidade: 3, precoUnitario: 9 }, mangueira);      // 27,00
  const b = calcularLinha({ idItem: 2, quantidade: 1 }, { ...mangueira, precoCadastro: null }); // 10,00
  const venda = fecharVenda([a, b], 1);
  assert(venda.totalBruto === 40 && venda.totalLiquido === 36 && venda.totalDesconto === 4, 'Totais: bruto 40, líquido 36, desconto 4.');
  const soma = venda.linhas.reduce((s, l) => s + l.totalItem, 0);
  assert(Math.abs(soma - 36) < 1e-9, 'O rateio fecha exatamente com o total.');
  assert(venda.linhas[0].totalItem === 26.28 && venda.linhas[1].totalItem === 9.72, 'Rateio proporcional com a sobra na última linha.');
  lanca(() => fecharVenda([b], 50), 'maior que o valor', 'Desconto acima do total é recusado.');

  // Pagamentos
  const pag = validarPagamentos([{ forma: 'pix', valor: 20 }, { forma: 'DINHEIRO', valor: 20 }], 36);
  assert(pag[1].troco === 4 && pag[0].troco === 0, 'Troco sai do dinheiro.');
  lanca(() => validarPagamentos([{ forma: 'PIX', valor: 40 }], 36), 'troco em dinheiro', 'PIX acima do total é recusado.');
  lanca(() => validarPagamentos([{ forma: 'DINHEIRO', valor: 30 }], 36), 'faltam R$ 6.00', 'Pagamento insuficiente é recusado.');
  lanca(() => validarPagamentos([{ forma: 'CHEQUE', valor: 36 }], 36), 'inválida', 'Forma desconhecida é recusada.');
  assert(validarPagamentos([{ forma: 'CREDITO', valor: 36, parcelas: 3 }], 36)[0].parcelas === 3, 'Crédito guarda as parcelas.');

  // Estoque: duas linhas do mesmo item somam
  const est = conferirEstoque([l1, rolo], new Map([[1, 200]]), new Map());
  assert(est.saidaPorItem.get(1) === 303 && est.faltas.length === 1, 'Soma das linhas passa do saldo.');
  assert(conferirEstoque([l1, rolo], new Map([[1, 200]]), new Map([[1, true]])).faltas.length === 0, 'Item que pode vender sem estoque passa.');
};

// Acréscimo geral (crédito parcelado acima do sem juros) rateado nas linhas
{
  const base = { idUnidade: null, sigla: null, fator: 1, quantidadeBase: 1, descontoValor: 0, totalItem: 0, precoUnitarioFinal: 0 };
  const v = fecharVenda([
    { ...base, idItem: 1, quantidade: 1, precoTabela: 60, precoPraticado: 60 },
    { ...base, idItem: 2, quantidade: 1, precoTabela: 40, precoPraticado: 40 },
  ], 0, 5);
  if (v.totalLiquido !== 105 || v.linhas[0].totalItem !== 63 || v.linhas[1].totalItem !== 42 || v.totalDesconto !== 0) {
    throw new Error(`acréscimo: ${JSON.stringify(v)}`);
  }
  console.log('acréscimo geral: ok');
}
