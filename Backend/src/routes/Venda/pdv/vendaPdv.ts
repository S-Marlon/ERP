// Cálculo da venda do PDV (sem banco): preço por linha, rateio do desconto geral e pagamentos.
import { FaixaPdv, faixaParaQuantidade, unidadePadraoPdv, UnidadeVendaPdv } from './precoPdv';

export const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'PRAZO', 'TRANSFERENCIA'] as const;
export type FormaPagamento = typeof FORMAS_PAGAMENTO[number];

const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;
const arred4 = (v: number) => Number(v.toFixed(4));

export class ErroVenda extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) {
    super(message);
  }
}

export interface LinhaPedido {
  idItem: number;
  quantidade: number;
  idUnidade?: number | null;
  precoUnitario?: number | null;   // preço praticado (desconto individual); ausente = preço de tabela
}

export interface DadosItemVenda {
  unidades: UnidadeVendaPdv[];
  faixas: FaixaPdv[];
  precoCadastro: number | null;    // preço de venda da unidade base
}

export interface LinhaCalculada {
  idItem: number;
  idUnidade: number | null;
  sigla: string | null;
  fator: number;
  quantidade: number;
  quantidadeBase: number;
  precoTabela: number;
  precoPraticado: number;
  // Preenchidos por fecharVenda
  descontoValor: number;
  totalItem: number;
  precoUnitarioFinal: number;
}

export const calcularLinha = (linha: LinhaPedido, dados: DadosItemVenda): LinhaCalculada => {
  const quantidade = Number(linha.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new ErroVenda(`Quantidade inválida para o item ${linha.idItem}.`);

  const unidade = linha.idUnidade
    ? dados.unidades.find(u => u.idUnidade === Number(linha.idUnidade) && u.permiteVenda) || null
    : unidadePadraoPdv(dados.unidades);
  if (linha.idUnidade && !unidade) throw new ErroVenda(`A unidade informada não está liberada para venda no item ${linha.idItem}.`);

  const fator = unidade?.fator || 1;
  const faixa = unidade ? faixaParaQuantidade(dados.faixas, unidade.idUnidade, quantidade) : null;
  const precoTabela = faixa && faixa.precoUnitario > 0
    ? faixa.precoUnitario
    : arred4((dados.precoCadastro || 0) * fator);

  const praticado = linha.precoUnitario === undefined || linha.precoUnitario === null ? precoTabela : Number(linha.precoUnitario);
  if (!Number.isFinite(praticado) || praticado < 0) throw new ErroVenda(`Preço inválido para o item ${linha.idItem}.`);

  return {
    idItem: linha.idItem,
    idUnidade: unidade?.idUnidade ?? null,
    sigla: unidade?.sigla ?? null,
    fator,
    quantidade,
    quantidadeBase: arred4(quantidade * fator),
    precoTabela,
    precoPraticado: praticado,
    descontoValor: 0,
    totalItem: 0,
    precoUnitarioFinal: 0,
  };
};

/**
 * Fecha os totais: desconto individual (tabela - praticado) + desconto geral rateado pelo valor de cada linha
 * (a última linha recebe a sobra dos centavos).
 */
export const fecharVenda = (linhas: LinhaCalculada[], descontoGeral: number, acrescimoGeral = 0) => {
  if (linhas.length === 0) throw new ErroVenda('A venda não tem itens.');
  const subtotais = linhas.map(l => centavos(l.precoPraticado * l.quantidade));
  const somaSubtotais = subtotais.reduce((a, b) => a + b, 0);
  const descontoC = centavos(Math.max(0, Number(descontoGeral) || 0));
  if (descontoC > somaSubtotais) throw new ErroVenda('O desconto é maior que o valor da venda.');

  // Acréscimo (ex.: crédito parcelado acima do sem juros) rateado como o desconto
  const acrescimoC = centavos(Math.max(0, Number(acrescimoGeral) || 0));
  let restante = descontoC;
  let restanteAcr = acrescimoC;
  const fechadas = linhas.map((l, i) => {
    const ultima = i === linhas.length - 1;
    const parte = ultima
      ? restante
      : somaSubtotais > 0 ? Math.floor((descontoC * subtotais[i]) / somaSubtotais) : 0;
    restante -= parte;
    const parteAcr = ultima
      ? restanteAcr
      : somaSubtotais > 0 ? Math.floor((acrescimoC * subtotais[i]) / somaSubtotais) : 0;
    restanteAcr -= parteAcr;
    const brutoC = centavos(l.precoTabela * l.quantidade);
    const totalC = subtotais[i] - parte + parteAcr;
    return {
      ...l,
      totalItem: reais(totalC),
      descontoValor: reais(Math.max(0, brutoC - totalC)),
      precoUnitarioFinal: arred4(reais(totalC) / l.quantidade),
    };
  });

  const totalBruto = reais(fechadas.reduce((a, l) => a + centavos(l.precoTabela * l.quantidade), 0));
  const totalLiquido = reais(fechadas.reduce((a, l) => a + centavos(l.totalItem), 0));
  return { linhas: fechadas, totalBruto, totalLiquido, totalDesconto: reais(Math.max(0, centavos(totalBruto) - centavos(totalLiquido))) };
};

export interface PagamentoEntrada {
  forma: string;
  valor: number;
  parcelas?: number;
}

/** Soma dos pagamentos precisa cobrir o total; troco só sai do dinheiro. */
export const validarPagamentos = (pagamentos: PagamentoEntrada[], totalLiquido: number) => {
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) throw new ErroVenda('Informe ao menos uma forma de pagamento.');
  const normalizados = pagamentos.map(p => {
    const forma = String(p.forma || '').toUpperCase() as FormaPagamento;
    if (!FORMAS_PAGAMENTO.includes(forma)) throw new ErroVenda(`Forma de pagamento inválida: ${p.forma}.`);
    const valorC = centavos(Number(p.valor));
    if (!Number.isFinite(valorC) || valorC <= 0) throw new ErroVenda('Valor de pagamento inválido.');
    const parcelas = forma === 'CREDITO' || forma === 'PRAZO' ? Math.max(1, Math.floor(Number(p.parcelas) || 1)) : 1;
    return { forma, valorC, parcelas, trocoC: 0 };
  });

  const pagoC = normalizados.reduce((a, p) => a + p.valorC, 0);
  const totalC = centavos(totalLiquido);
  if (pagoC < totalC) throw new ErroVenda(`Pagamento insuficiente: faltam R$ ${reais(totalC - pagoC).toFixed(2)}.`);

  let trocoC = pagoC - totalC;
  if (trocoC > 0) {
    const dinheiroC = normalizados.filter(p => p.forma === 'DINHEIRO').reduce((a, p) => a + p.valorC, 0);
    if (trocoC > dinheiroC) throw new ErroVenda('O valor pago passa do total e só pode haver troco em dinheiro.');
    // Troco registrado nos pagamentos em dinheiro (do último para o primeiro)
    for (let i = normalizados.length - 1; i >= 0 && trocoC > 0; i--) {
      if (normalizados[i].forma !== 'DINHEIRO') continue;
      const parte = Math.min(trocoC, normalizados[i].valorC);
      normalizados[i].trocoC = parte;
      trocoC -= parte;
    }
  }

  return normalizados.map(p => ({ forma: p.forma, valor: reais(p.valorC), parcelas: p.parcelas, troco: reais(p.trocoC) }));
};

// Saída de estoque por item (várias linhas do mesmo item somam) e itens que ficariam negativos
export const conferirEstoque = (
  linhas: LinhaCalculada[],
  saldos: Map<number, number>,
  podeVenderSemEstoque: Map<number, boolean>
) => {
  const saidaPorItem = new Map<number, number>();
  for (const l of linhas) saidaPorItem.set(l.idItem, arred4((saidaPorItem.get(l.idItem) || 0) + l.quantidadeBase));
  const faltas: Array<{ idItem: number; saldo: number; saida: number }> = [];
  for (const [idItem, saida] of saidaPorItem) {
    const saldo = saldos.get(idItem) || 0;
    if (saida > saldo + 1e-9 && !podeVenderSemEstoque.get(idItem)) faltas.push({ idItem, saldo, saida });
  }
  return { saidaPorItem, faltas };
};
