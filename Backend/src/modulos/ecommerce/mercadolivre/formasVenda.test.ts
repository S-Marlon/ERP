import assert from 'assert';
import { formasDoItem, lerPrecos, lerQuantidades, precoPorUnidade, quantidadeDaLinha, siglaDoKit } from './formasVenda';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('formas de venda: sigla e quantidades pedidas', () => {
  assert.strictEqual(siglaDoKit(10), 'KIT10');
  assert.ok(siglaDoKit(999).length <= 10);
  assert.deepStrictEqual(lerQuantidades('10, 2,1,2,x,0,1000'), [1, 2, 10]);
  assert.deepStrictEqual(lerQuantidades(''), [1, 2, 10]);
  assert.deepStrictEqual(lerQuantidades('5'), [5]);
});

teste('formas de venda: preços para simular', () => {
  const m = lerPrecos('10:34.9,2:7,abc,3:-1');
  assert.strictEqual(m.get(10), 34.9);
  assert.strictEqual(m.get(2), 7);
  assert.strictEqual(m.has(3), false);
});

teste('formas de venda: junta as pedidas com as linhas que já existem', () => {
  const un = { idLinha: 1, unidadeMl: null };
  const kit8 = { idLinha: 2, unidadeMl: { fator: 8 } };
  const formas = formasDoItem([un, kit8], [1, 2, 10]);
  assert.deepStrictEqual(formas.map(f => [f.quantidade, f.linha?.idLinha ?? null]), [[1, 1], [2, null], [8, 2], [10, null]]);
  assert.strictEqual(quantidadeDaLinha(kit8), 8);
  assert.strictEqual(precoPorUnidade(34.9, 10), 3.49);
});
