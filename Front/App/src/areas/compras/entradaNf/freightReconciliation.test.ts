import { reconcileFreight } from './freightReconciliation';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runFreightReconciliationTests = (): void => {
  assert(
    reconcileFreight(10, [{ freightAdded: 4 }, { freightAdded: 6 }]).matches,
    'Frete igual ao total dos itens deveria conciliar.'
  );

  assert(
    reconcileFreight(10, [{ freightAdded: 9.995 }]).matches,
    'Diferença de arredondamento de centavos deveria conciliar.'
  );

  assert(
    !reconcileFreight(10, [{ freightAdded: 0 }]).matches,
    'Frete na nota sem frete nos itens deveria divergir.'
  );

  assert(
    !reconcileFreight(0, [{ freightAdded: 10 }]).matches,
    'Frete nos itens sem frete na nota deveria divergir.'
  );

  assert(
    reconcileFreight(10, [
      { freightOriginal: 2, freightDistributed: 8, freightAdded: 8 },
      { freightOriginal: 8, freightDistributed: 2, freightAdded: 2 },
    ]).matches,
    'Rateio manual posterior deveria ser usado como frete considerado.'
  );
};
