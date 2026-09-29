import { allocateByWeight, distributeFreight, FreightItem } from './freightDistribution';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const sum = (values: number[]): number => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

export const runFreightDistributionTests = (): void => {
  assert(
    sum(allocateByWeight(10, [1, 1, 1])) === 10,
    'Rateio de 10 em 3 partes iguais deveria somar exatamente 10.'
  );

  assert(
    allocateByWeight(10, [0, 0]).join() === '5,5',
    'Sem pesos, o rateio deveria dividir igualmente.'
  );

  const items: FreightItem[] = [
    { quantidade: 2, valorProdutos: 100, freightOriginal: 8 },
    { quantidade: 1, valorProdutos: 300, freightOriginal: 2 },
  ];

  const byValue = distributeFreight(items, 'proportional_value', 10, 0);
  assert(
    byValue[0].freightAdded === 2.5 && byValue[1].freightAdded === 7.5,
    'Rateio por valor deveria seguir a proporção 100/300.'
  );
  assert(byValue[0].valorUnitario === 51.25, 'Custo unitário deveria incluir o frete rateado.');

  const backToOriginal = distributeFreight(byValue, 'original', 10, 0);
  assert(
    backToOriginal[0].freightAdded === 8 && backToOriginal[1].freightAdded === 2,
    'Voltar ao modo original deveria restaurar o vFrete do XML.'
  );
  assert(backToOriginal[0].valorTotal === 108, 'Voltar ao modo original deveria restaurar o custo.');

  const withExtra = distributeFreight(items, 'original', 10, 4);
  assert(
    withExtra[0].freightAdded === 9 && withExtra[1].freightAdded === 5 && withExtra[1].freightExtra === 3,
    'No modo original, o frete adicional deveria ser rateado pelo valor sobre o vFrete do XML.'
  );
  assert(
    sum(withExtra.map(i => i.freightAdded ?? 0)) === 14,
    'Frete dos itens deveria somar nota + adicional.'
  );

  const comDesconto = distributeFreight<FreightItem>(
    [{ quantidade: 4, valorProdutos: 100, desconto: 10, ipi: 5, freightOriginal: 5 }],
    'original', 5, 0
  );
  assert(
    comDesconto[0].valorTotal === 100 && comDesconto[0].valorUnitario === 25,
    'Desconto deveria ser abatido do custo do item (100 - 10 + 5 + 5).'
  );
};
