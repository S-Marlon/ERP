import assert from 'assert';
import { ajusteDaLinha, ajustesDoCarrinho } from './ajustesCarrinho';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('acréscimo no item (23 -> 30)', () => {
  assert.deepStrictEqual(ajusteDaLinha({ price: 30, quantity: 2, originalPrice: 23 }), { tipo: 'ACRESCIMO', pct: 30.4, valor: 14 });
  assert.deepStrictEqual(ajusteDaLinha({ price: 20, quantity: 1, originalPrice: 25 }), { tipo: 'DESCONTO', pct: 20, valor: 5 });
  assert.deepStrictEqual(ajusteDaLinha({ price: 23, quantity: 1 }), { tipo: 'NENHUM', pct: 0, valor: 0 });
});

teste('desconto e acréscimo separados nos totais (um não esconde o outro)', () => {
  const r = ajustesDoCarrinho([
    { price: 30, quantity: 1, originalPrice: 23 },   // +7
    { price: 20, quantity: 1, originalPrice: 25 },   // -5
    { price: 10, quantity: 3 },
  ]);
  assert.deepStrictEqual(r, { subtotalTabela: 78, descontos: 5, acrescimos: 7 });
});
