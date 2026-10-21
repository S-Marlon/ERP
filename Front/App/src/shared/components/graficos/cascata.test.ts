import assert from 'assert';
import { barrasDaCascata } from './cascata';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('cascata: deduções saem de onde a anterior parou', () => {
  const c = barrasDaCascata([
    { tipo: 'RECEITA', valor: 100 }, { tipo: 'DEDUCAO', valor: -30 }, { tipo: 'SUBTOTAL', valor: 70 },
    { tipo: 'DEDUCAO', valor: -90 }, { tipo: 'RESULTADO', valor: -20 },
  ]);
  assert.deepStrictEqual(c.barras, [{ de: 0, ate: 100 }, { de: 100, ate: 70 }, { de: 0, ate: 70 }, { de: 70, ate: -20 }, { de: 0, ate: -20 }]);
  assert.deepStrictEqual([c.min, c.max], [-20, 100]);
});

teste('cascata: tudo zerado não quebra a escala', () => {
  const c = barrasDaCascata([{ tipo: 'RECEITA', valor: 0 }, { tipo: 'RESULTADO', valor: 0 }]);
  assert.deepStrictEqual([c.min, c.max], [0, 1]);
});
