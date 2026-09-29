import { roundCents } from './freightReconciliation';

export type FreightMode = 'original' | 'proportional_value' | 'proportional_quantity' | 'equal';

export const FREIGHT_MODE_LABELS: Record<FreightMode, string> = {
  original: 'Valor Original (XML)',
  proportional_value: 'Proporcional ao Valor',
  proportional_quantity: 'Proporcional à Quantidade',
  equal: 'Dividido Igualmente',
};

export interface FreightItem {
  quantidade?: number;
  valorProdutos?: number;
  seguro?: number;
  outrasDespesas?: number;
  desconto?: number;
  ipi?: number;
  icmsSt?: number;
  freightOriginal?: number;    // vFrete do item no XML (nunca é alterado)
  freightAdded?: number;       // frete total considerado no custo do item (nota + adicional)
  freightDistributed?: number; // parcela que veio de rateio
  freightExtra?: number;       // parcela do frete adicional (pago fora da NF)
  valorTotal?: number;
  valorUnitario?: number;
}

const num = (value: unknown): number => Number(value) || 0;

// Custo do item sem nenhum frete (mesma composição do vNF, com desconto abatido):
// base estável para recalcular a partir de qualquer modo
export const itemCostWithoutFreight = (item: FreightItem): number =>
  num(item.valorProdutos) - num(item.desconto) + num(item.seguro) + num(item.outrasDespesas) + num(item.ipi) + num(item.icmsSt);

const weightFor = (item: FreightItem, mode: Exclude<FreightMode, 'original'>): number => {
  if (mode === 'proportional_quantity') return num(item.quantidade);
  if (mode === 'equal') return 1;
  return itemCostWithoutFreight(item);
};

/**
 * Rateia `total` pelos pesos, em centavos, garantindo que a soma das parcelas seja exatamente o total.
 * A sobra do arredondamento vai para as maiores frações (método do maior resto).
 * Sem peso algum (ex.: todos zerados), divide igualmente.
 */
export const allocateByWeight = (total: number, weights: number[]): number[] => {
  const cents = Math.round(num(total) * 100);
  if (cents <= 0 || weights.length === 0) return weights.map(() => 0);

  const weightSum = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  const safeWeights = weightSum > 0 ? weights.map(w => Math.max(0, w)) : weights.map(() => 1);
  const safeSum = weightSum > 0 ? weightSum : weights.length;

  const raw = safeWeights.map(w => (cents * w) / safeSum);
  const parts = raw.map(Math.floor);
  let rest = cents - parts.reduce((acc, p) => acc + p, 0);

  const byRemainder = raw
    .map((value, index) => ({ index, remainder: value - parts[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let k = 0; rest > 0; k++, rest--) {
    parts[byRemainder[k % byRemainder.length].index] += 1;
  }

  return parts.map(p => p / 100);
};

/**
 * Recalcula frete e custo de todos os itens a partir do modo escolhido.
 * - 'original': cada item mantém o vFrete do XML; o frete adicional é rateado pelo valor.
 * - demais modos: frete da NF + frete adicional são rateados pelo critério.
 * Sempre parte de `freightOriginal` e do custo sem frete, então alternar entre modos é reversível.
 */
export const distributeFreight = <T extends FreightItem>(
  items: T[],
  mode: FreightMode,
  nfeFreight: number,
  additionalFreight: number
): T[] => {
  const extraMode = mode === 'original' ? 'proportional_value' : mode;

  const notaParts = mode === 'original'
    ? items.map(item => num(item.freightOriginal))
    : allocateByWeight(nfeFreight, items.map(item => weightFor(item, mode)));

  const extraParts = allocateByWeight(additionalFreight, items.map(item => weightFor(item, extraMode)));

  return items.map((item, index) => {
    const freightExtra = extraParts[index];
    const freightAdded = roundCents(notaParts[index] + freightExtra);
    const valorTotal = roundCents(itemCostWithoutFreight(item) + freightAdded);
    const quantidade = num(item.quantidade);

    return {
      ...item,
      freightAdded,
      freightExtra,
      freightDistributed: mode === 'original' ? freightExtra : freightAdded,
      valorTotal,
      valorUnitario: quantidade > 0 ? Number((valorTotal / quantidade).toFixed(4)) : valorTotal,
    };
  });
};
