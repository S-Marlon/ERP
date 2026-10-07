export interface FreightItemLike {
  freightOriginal?: number | string;
  freightDistributed?: number | string;
  freightAdded?: number | string;
}

export interface FreightReconciliation {
  noteTotal: number;
  itemsTotal: number;
  difference: number;
  matches: boolean;
}

export const roundCents = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const reconcileFreight = (
  noteFreight: number | string | null | undefined,
  items: FreightItemLike[]
): FreightReconciliation => {
  const noteTotal = roundCents(Number(noteFreight) || 0);
  // freightAdded é o frete efetivamente embutido no custo do item (após qualquer rateio)
  const itemsTotal = roundCents(items.reduce((total, item) => {
    const considered = Number(item.freightAdded ?? item.freightOriginal ?? 0) || 0;
    return total + considered;
  }, 0));
  const difference = roundCents(Math.abs(noteTotal - itemsTotal));

  return {
    noteTotal,
    itemsTotal,
    difference,
    matches: difference <= 0.01,
  };
};
