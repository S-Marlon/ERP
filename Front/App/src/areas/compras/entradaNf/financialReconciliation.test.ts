import { reconcileFinancial } from './financialReconciliation';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runFinancialReconciliationTests = (): void => {
  const baseNote = {
    produtos: 100,
    frete: 10,
    seguro: 2,
    outrasDespesas: 3,
    desconto: 5,
    ipi: 4,
    icmsSt: 6,
    total: 120,
  };

  const itens = [{
    valorProdutos: 100,
    freightAdded: 10,
    seguro: 2,
    outrasDespesas: 3,
    desconto: 5,
    ipi: 4,
    icmsSt: 6,
  }];

  assert(reconcileFinancial(baseNote, itens).matches, 'Totais financeiros iguais deveriam conciliar.');
  assert(reconcileFinancial({ ...baseNote, total: 120.01 }, itens).matches, 'Diferença de um centavo deveria conciliar.');
  assert(!reconcileFinancial({ ...baseNote, frete: 11 }, itens).matches, 'Frete divergente deveria reprovar.');
  assert(!reconcileFinancial({ ...baseNote, ipi: 5 }, itens).matches, 'IPI divergente deveria reprovar.');
  assert(!reconcileFinancial({ ...baseNote, icmsSt: 7 }, itens).matches, 'ICMS-ST divergente deveria reprovar.');
  assert(!reconcileFinancial({ ...baseNote, total: 125 }, itens).matches, 'Total da nota divergente deveria reprovar.');
};
