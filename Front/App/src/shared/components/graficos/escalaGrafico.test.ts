import assert from 'assert';
import { limitesDoGrafico, passoDosRotulos } from './escalaGrafico';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const series = [{ chave: 'a', nome: 'A', cor: '' }, { chave: 'b', nome: 'B', cor: '' }, { chave: 's', nome: 'S', cor: '', negativa: true }];

teste('gráfico: limites com pilhas e linha', () => {
  assert.deepStrictEqual(limitesDoGrafico([
    { chave: '1', rotulo: '', valores: { a: 10, b: 5, s: 3 } },
    { chave: '2', rotulo: '', valores: { a: 2, s: 20 }, linha: -30 },
  ], series), { max: 15, min: -30 });
  assert.deepStrictEqual(limitesDoGrafico([{ chave: '1', rotulo: '', valores: {} }], series), { max: 1, min: 0 });
  assert.deepStrictEqual(limitesDoGrafico([{ chave: '1', rotulo: '', valores: { a: 4 }, linha: 9 }], series), { max: 9, min: 0 });
});

teste('gráfico: passo dos rótulos', () => {
  assert.strictEqual(passoDosRotulos(10), 1);
  assert.strictEqual(passoDosRotulos(30), 3);
});
