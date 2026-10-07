// Regras do ajuste de estoque (sem banco): entrada, saída ou contagem (inventário).
import { calcularCustoMedio } from '../compras/staging/penteFino';

export type TipoAjuste = 'ENTRADA' | 'SAIDA' | 'CONTAGEM';

// CONSUMO_INTERNO: baixa de uso do almoxarifado (graxa da oficina, limpeza, EPI)
export const ORIGENS_AJUSTE = ['AJUSTE_MANUAL', 'INVENTARIO', 'CONSUMO_INTERNO'] as const;
export type OrigemAjuste = typeof ORIGENS_AJUSTE[number];

export class ErroAjuste extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface SaldoAtual {
  quantidade: number;
  custoMedio: number;
  custoReferencia: number;   // custo gerencial do cadastro, quando não há custo médio
}

export interface ResultadoAjuste {
  tipoMovimento: 'ENTRADA' | 'SAIDA' | null;   // null = contagem igual ao saldo (nada a lançar)
  quantidade: number;                            // sempre positiva
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitario: number;
  custoMedioPosterior: number;
}

const arred4 = (v: number) => Number(v.toFixed(4));

/**
 * ENTRADA/SAIDA: quantidade movimentada. CONTAGEM: quantidade contada (o movimento é a diferença).
 * Entrada com custo informado recalcula o custo médio; sem custo, entra pelo custo médio atual (não altera a média).
 */
export const calcularAjuste = (
  tipo: TipoAjuste,
  quantidadeInformada: number,
  saldo: SaldoAtual,
  custoInformado?: number | null
): ResultadoAjuste => {
  const qtd = Number(quantidadeInformada);
  if (!Number.isFinite(qtd) || qtd < 0 || (tipo !== 'CONTAGEM' && qtd === 0)) {
    throw new ErroAjuste(tipo === 'CONTAGEM' ? 'Quantidade contada inválida.' : 'Informe uma quantidade maior que zero.');
  }
  const custoAtual = saldo.custoMedio > 0 ? saldo.custoMedio : saldo.custoReferencia;
  const custoEntrada = custoInformado !== undefined && custoInformado !== null && Number(custoInformado) > 0
    ? Number(custoInformado) : custoAtual;
  if (custoInformado !== undefined && custoInformado !== null && Number(custoInformado) < 0) {
    throw new ErroAjuste('Custo unitário inválido.');
  }

  let tipoMovimento: ResultadoAjuste['tipoMovimento'];
  let quantidade: number;
  if (tipo === 'CONTAGEM') {
    const diferenca = arred4(qtd - saldo.quantidade);
    tipoMovimento = diferenca > 0 ? 'ENTRADA' : diferenca < 0 ? 'SAIDA' : null;
    quantidade = Math.abs(diferenca);
  } else {
    tipoMovimento = tipo;
    quantidade = arred4(qtd);
  }

  const saldoPosterior = tipoMovimento === 'ENTRADA' ? arred4(saldo.quantidade + quantidade)
    : tipoMovimento === 'SAIDA' ? arred4(saldo.quantidade - quantidade)
    : saldo.quantidade;
  const custoUnitario = tipoMovimento === 'ENTRADA' ? custoEntrada : custoAtual;
  const custoMedioPosterior = tipoMovimento === 'ENTRADA' && custoEntrada > 0
    ? arred4(calcularCustoMedio(saldo.quantidade, saldo.custoMedio, quantidade, custoEntrada))
    : saldo.custoMedio;

  return { tipoMovimento, quantidade, saldoAnterior: saldo.quantidade, saldoPosterior, custoUnitario, custoMedioPosterior };
};

export type SituacaoSaldo = 'NEGATIVO' | 'ZERADO' | 'ABAIXO_MINIMO' | 'OK';

export const situacaoSaldo = (quantidade: number, minimo?: number | null): SituacaoSaldo => {
  if (quantidade < 0) return 'NEGATIVO';
  if (quantidade === 0) return 'ZERADO';
  if (minimo !== undefined && minimo !== null && minimo > 0 && quantidade < minimo) return 'ABAIXO_MINIMO';
  return 'OK';
};
