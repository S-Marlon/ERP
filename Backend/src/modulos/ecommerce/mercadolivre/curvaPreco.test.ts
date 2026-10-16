import assert from 'assert';
import { precosDaCurva } from './curvaPreco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('curva de preço: faixa em volta do atual e os degraus em pé', () => {
  // kit 10 do 6902-ZZ: R$ 34,90, custo 15,30, alvo ~R$ 30
  const p = precosDaCurva({ atual: 34.9, custo: 15.3, alvo: 30.21, marcas: [] });
  assert.strictEqual(p[0], 16.07);                    // começa perto do custo
  assert.ok(p[p.length - 1] >= 79);                   // estica até passar de R$ 79 (está a menos de 2,5×)
  assert.ok(p.includes(78.99) && p.includes(79));     // o degrau do frete em pé
  assert.ok(p.includes(34.9) && p.includes(34.89));   // o preço de hoje
  assert.deepStrictEqual([...p].sort((a, b) => a - b), p);
  assert.strictEqual(new Set(p).size, p.length);
});

teste('curva de preço: preço alto não estica até R$ 79; marca fora da faixa fica de fora', () => {
  const p = precosDaCurva({ atual: 150, custo: 90, alvo: 120, marcas: [12.5] });
  assert.ok(p[0] >= 90 && p[p.length - 1] <= 240);
  assert.ok(!p.includes(12.5));
  const barato = precosDaCurva({ atual: 12.51, custo: 1.53, alvo: 16.88, marcas: [12.5] });
  assert.ok(barato.includes(12.49) && barato.includes(12.5));   // taxa fixa perto do preço: o degrau aparece
  assert.ok(barato[barato.length - 1] < 79);                     // R$ 79 é longe (mais de 2,5×): não estica
});
