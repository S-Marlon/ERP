import assert from 'assert';
import { markupDoVarejo, planejarPolitica, Politica, validarPolitica } from './politicaPreco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const op = { fatorTaxa: 1, taxaPct: 0, alvoPct: 30 };
const atacado = (nivel1: { quantidade: number; markup: number } | null, nivel2: { quantidade: number; markup: number } | null = null, pularQuemTem = false) =>
  ({ modo: 'DEFINIR' as const, nivel1, nivel2, pularQuemTem });

teste('política: markup do varejo por faixa de custo', () => {
  const r = { modo: 'POR_CUSTO' as const, faixas: [{ ateCusto: 2, markup: 6 }, { ateCusto: 5, markup: 4.5 }, { ateCusto: null, markup: 3 }] };
  assert.strictEqual(markupDoVarejo(r, 1.2, null), 6);
  assert.strictEqual(markupDoVarejo(r, 2, null), 6);
  assert.strictEqual(markupDoVarejo(r, 4.99, null), 4.5);
  assert.strictEqual(markupDoVarejo(r, 30, null), 3);
  assert.strictEqual(markupDoVarejo({ modo: 'MANTER' }, 30, 2.2), 2.2);
});

teste('política: varejo 4,5x e atacado 10+ a 2x (rolamento pequeno)', () => {
  const p: Politica = { varejo: { modo: 'MARKUP', markup: 4.5 }, atacado: atacado({ quantidade: 10, markup: 2 }) };
  const plano = planejarPolitica({ custo: 1.5, varejoAtual: { markup: 3, preco: 4.5 }, atacadoAtual: [] }, p, op);
  assert.strictEqual(plano.situacao, 'ALTERA');
  assert.deepStrictEqual(plano.faixas.map(f => [f.tipo, f.quantidadeMinima, f.quantidadeMaxima, f.markup, f.preco, f.lucroPct]), [
    ['VAREJO', 0, 9, 4.5, 6.75, 350], ['ATACADO', 10, null, 2, 3, 100],
  ]);
  assert.deepStrictEqual(plano.avisos, []);
});

teste('política: dois atacados, taxa embutida e aviso de alvo', () => {
  const p: Politica = { varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 2 }, { quantidade: 50, markup: 1.25 }) };
  const plano = planejarPolitica({ custo: 10, varejoAtual: { markup: 3, preco: 31.5 }, atacadoAtual: [] }, p, { fatorTaxa: 1.05, taxaPct: 4.76, alvoPct: 30 });
  assert.deepStrictEqual(plano.faixas.map(f => [f.ordem, f.quantidadeMinima, f.quantidadeMaxima, f.preco]), [[1, 0, 9, 31.5], [2, 10, 49, 21], [3, 50, null, 13.13]]);
  assert.strictEqual(plano.avisos.length, 1);                          // 1,25x com a taxa: ~25% sobre o custo
  assert.ok(plano.avisos[0].startsWith('Atacado 2 (50+)'));
});

teste('política: bloqueios', () => {
  const base = { custo: 10, varejoAtual: { markup: 2, preco: 20 }, atacadoAtual: [] };
  assert.strictEqual(planejarPolitica({ ...base, custo: 0 }, { varejo: { modo: 'MANTER' }, atacado: { modo: 'MANTER' } }, op).erro?.startsWith('Sem custo'), true);
  assert.strictEqual(planejarPolitica({ ...base, varejoAtual: null }, { varejo: { modo: 'MANTER' }, atacado: { modo: 'MANTER' } }, op).erro?.startsWith('Sem preço'), true);
  // atacado mais caro que o varejo
  assert.ok(planejarPolitica(base, { varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 2.5 }) }, op).erro?.includes('não fica mais barato'));
  // prejuízo
  assert.ok(planejarPolitica(base, { varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 0.9 }) }, op).erro?.includes('prejuízo'));
  assert.throws(() => validarPolitica({ varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 2 }, { quantidade: 5, markup: 1.5 }) }), /quantidade maior/);
  assert.throws(() => validarPolitica({ varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 2 }, { quantidade: 50, markup: 2.2 }) }), /markup menor/);
  assert.throws(() => validarPolitica({ varejo: { modo: 'MANTER' }, atacado: atacado(null, { quantidade: 50, markup: 2 }) }), /atacado 1 antes/);
  assert.throws(() => validarPolitica({ varejo: { modo: 'POR_CUSTO', faixas: [{ ateCusto: 5, markup: 3 }, { ateCusto: 2, markup: 6 }] }, atacado: { modo: 'MANTER' } }), /ordem crescente/);
});

teste('política: quem já tem atacado e o que não muda', () => {
  const comAtacado = { custo: 2, varejoAtual: { markup: 4, preco: 8 }, atacadoAtual: [{ quantidade: 12, markup: 2.5, preco: 5 }] };
  const pula = planejarPolitica(comAtacado, { varejo: { modo: 'MANTER' }, atacado: atacado({ quantidade: 10, markup: 2 }, null, true) }, op);
  assert.strictEqual(pula.mexeNoAtacado, false);
  assert.deepStrictEqual(pula.faixas.map(f => [f.quantidadeMinima, f.preco]), [[0, 8], [12, 5]]);   // fica o atacado próprio
  assert.strictEqual(pula.situacao, 'IGUAL');
  // aplicar de novo a mesma política: nada muda
  const p: Politica = { varejo: { modo: 'MARKUP', markup: 4 }, atacado: atacado({ quantidade: 12, markup: 2.5 }) };
  assert.strictEqual(planejarPolitica(comAtacado, p, op).situacao, 'IGUAL');
  // tirar o atacado
  const sem = planejarPolitica(comAtacado, { varejo: { modo: 'MANTER' }, atacado: atacado(null) }, op);
  assert.deepStrictEqual([sem.situacao, sem.faixas.length, sem.faixas[0].quantidadeMaxima], ['ALTERA', 1, null]);
});
