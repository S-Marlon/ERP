import { roundCents } from './freightReconciliation';

export interface FinancialItemLike {
  valorProdutos?: number | string;
  freightAdded?: number | string;
  seguro?: number | string;
  outrasDespesas?: number | string;
  desconto?: number | string;
  ipi?: number | string;
  icmsSt?: number | string;
}

export interface FinancialTotals {
  produtos: number;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  desconto: number;
  ipi: number;
  icmsSt: number;
  total: number;
}

export interface FinancialReconciliation {
  note: FinancialTotals;
  items: FinancialTotals;
  differences: FinancialTotals;
  totalDifference: number;
  matches: boolean;
}

const numberOrZero = (value: number | string | null | undefined): number =>
  Number(value) || 0;

export const reconcileFinancial = (
  note: Partial<Record<keyof FinancialTotals, number | string>>,
  items: FinancialItemLike[]
): FinancialReconciliation => {
  const noteTotals: FinancialTotals = {
    produtos: roundCents(numberOrZero(note.produtos)),
    frete: roundCents(numberOrZero(note.frete)),
    seguro: roundCents(numberOrZero(note.seguro)),
    outrasDespesas: roundCents(numberOrZero(note.outrasDespesas)),
    desconto: roundCents(numberOrZero(note.desconto)),
    ipi: roundCents(numberOrZero(note.ipi)),
    icmsSt: roundCents(numberOrZero(note.icmsSt)),
    total: roundCents(numberOrZero(note.total)),
  };

  const itemTotals: FinancialTotals = items.reduce((total, item) => ({
    produtos: total.produtos + numberOrZero(item.valorProdutos),
    frete: total.frete + numberOrZero(item.freightAdded),
    seguro: total.seguro + numberOrZero(item.seguro),
    outrasDespesas: total.outrasDespesas + numberOrZero(item.outrasDespesas),
    desconto: total.desconto + numberOrZero(item.desconto),
    ipi: total.ipi + numberOrZero(item.ipi),
    icmsSt: total.icmsSt + numberOrZero(item.icmsSt),
    total: 0,
  }), {
    produtos: 0,
    frete: 0,
    seguro: 0,
    outrasDespesas: 0,
    desconto: 0,
    ipi: 0,
    icmsSt: 0,
    total: 0,
  });

  itemTotals.produtos = roundCents(itemTotals.produtos);
  itemTotals.frete = roundCents(itemTotals.frete);
  itemTotals.seguro = roundCents(itemTotals.seguro);
  itemTotals.outrasDespesas = roundCents(itemTotals.outrasDespesas);
  itemTotals.desconto = roundCents(itemTotals.desconto);
  itemTotals.ipi = roundCents(itemTotals.ipi);
  itemTotals.icmsSt = roundCents(itemTotals.icmsSt);
  itemTotals.total = roundCents(
    itemTotals.produtos - itemTotals.desconto + itemTotals.frete +
    itemTotals.seguro + itemTotals.outrasDespesas + itemTotals.ipi + itemTotals.icmsSt
  );

  const differences: FinancialTotals = {
    produtos: roundCents(Math.abs(noteTotals.produtos - itemTotals.produtos)),
    frete: roundCents(Math.abs(noteTotals.frete - itemTotals.frete)),
    seguro: roundCents(Math.abs(noteTotals.seguro - itemTotals.seguro)),
    outrasDespesas: roundCents(Math.abs(noteTotals.outrasDespesas - itemTotals.outrasDespesas)),
    desconto: roundCents(Math.abs(noteTotals.desconto - itemTotals.desconto)),
    ipi: roundCents(Math.abs(noteTotals.ipi - itemTotals.ipi)),
    icmsSt: roundCents(Math.abs(noteTotals.icmsSt - itemTotals.icmsSt)),
    total: roundCents(Math.abs(noteTotals.total - itemTotals.total)),
  };

  return {
    note: noteTotals,
    items: itemTotals,
    differences,
    totalDifference: differences.total,
    matches: Object.values(differences).every(value => value <= 0.01),
  };
};
