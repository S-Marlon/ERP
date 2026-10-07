import { calcularAjuste, situacaoSaldo } from './ajusteEstoque';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const lanca = (fn: () => unknown, trecho: string, message: string) => {
  try { fn(); } catch (e: any) { assert(String(e.message).includes(trecho), `${message} (veio: ${e.message})`); return; }
  throw new Error(`${message} (não lançou erro)`);
};

export const runAjusteEstoqueTests = (): void => {
  const saldo = { quantidade: 10, custoMedio: 5, custoReferencia: 4 };

  const e1 = calcularAjuste('ENTRADA', 10, saldo, 7);
  assert(e1.tipoMovimento === 'ENTRADA' && e1.saldoPosterior === 20 && e1.custoMedioPosterior === 6, 'Entrada com custo recalcula a média (10x5 + 10x7) / 20 = 6.');
  const e2 = calcularAjuste('ENTRADA', 5, saldo);
  assert(e2.custoUnitario === 5 && e2.custoMedioPosterior === 5, 'Entrada sem custo usa o custo médio e não mexe na média.');

  const s1 = calcularAjuste('SAIDA', 3, saldo);
  assert(s1.tipoMovimento === 'SAIDA' && s1.saldoPosterior === 7 && s1.custoMedioPosterior === 5, 'Saída baixa o saldo e mantém a média.');
  assert(calcularAjuste('SAIDA', 15, saldo).saldoPosterior === -5, 'Saída maior que o saldo deixa negativo (ajuste é decisão do operador).');

  const c1 = calcularAjuste('CONTAGEM', 12, saldo);
  assert(c1.tipoMovimento === 'ENTRADA' && c1.quantidade === 2 && c1.saldoPosterior === 12, 'Contagem acima do saldo gera entrada da diferença.');
  const c2 = calcularAjuste('CONTAGEM', 7.5, saldo);
  assert(c2.tipoMovimento === 'SAIDA' && c2.quantidade === 2.5 && c2.saldoPosterior === 7.5, 'Contagem abaixo gera saída da diferença.');
  const c3 = calcularAjuste('CONTAGEM', 10, saldo);
  assert(c3.tipoMovimento === null && c3.quantidade === 0, 'Contagem igual ao saldo não lança nada.');
  assert(calcularAjuste('CONTAGEM', 0, saldo).saldoPosterior === 0, 'Contar zero é válido (zera o saldo).');

  // Item sem custo médio: entrada sem custo usa o custo do cadastro
  const semMedia = calcularAjuste('ENTRADA', 4, { quantidade: 0, custoMedio: 0, custoReferencia: 8 });
  assert(semMedia.custoUnitario === 8 && semMedia.custoMedioPosterior === 8, 'Sem custo médio, entra pelo custo do cadastro.');

  lanca(() => calcularAjuste('ENTRADA', 0, saldo), 'maior que zero', 'Entrada zero é recusada.');
  lanca(() => calcularAjuste('CONTAGEM', -1, saldo), 'contada inválida', 'Contagem negativa é recusada.');

  assert(situacaoSaldo(-1) === 'NEGATIVO' && situacaoSaldo(0) === 'ZERADO', 'Negativo e zerado.');
  assert(situacaoSaldo(2, 5) === 'ABAIXO_MINIMO' && situacaoSaldo(5, 5) === 'OK' && situacaoSaldo(3, null) === 'OK', 'Abaixo do mínimo só com mínimo definido.');
};
