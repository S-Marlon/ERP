import assert from 'assert';
import { compararCenarios } from './cenariosMl';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

// abraçadeira a R$ 12,74 (custo R$ 3,50): hoje Premium sem frete grátis
const cenarios = [
  { tipo: 'gold_special', freteGratis: true, atual: false, lucro: 1.76 },
  { tipo: 'gold_special', freteGratis: false, atual: false, lucro: 7.71 },
  { tipo: 'gold_pro', freteGratis: true, atual: false, lucro: 1.12 },
  { tipo: 'gold_pro', freteGratis: false, atual: true, lucro: 7.07 },
];

teste('vendas para lucrar o mesmo que hoje', () => {
  const r = compararCenarios(cenarios, 10);
  assert.deepStrictEqual(r.map(c => [c.lucroMes, c.vendasParaEmpatar, c.multiplicador, c.melhorPorVenda]), [
    [17.6, 41, 4.1, false],
    [77.1, 10, 1, true],
    [11.2, 64, 6.4, false],
    [70.7, 10, 1, false],
  ]);
});

teste('cenário com prejuízo nunca empata; hoje com prejuízo, qualquer venda ganha', () => {
  const r = compararCenarios([{ tipo: 'a', freteGratis: true, atual: true, lucro: 4.58 }, { tipo: 'b', freteGratis: true, atual: false, lucro: -2.72 }], 10);
  assert.deepStrictEqual([r[1].vendasParaEmpatar, r[1].multiplicador], [null, null]);
  const p = compararCenarios([{ tipo: 'a', freteGratis: true, atual: true, lucro: -2.72 }, { tipo: 'b', freteGratis: false, atual: false, lucro: 3 }], 10);
  assert.strictEqual(p[1].vendasParaEmpatar, 1);
});
