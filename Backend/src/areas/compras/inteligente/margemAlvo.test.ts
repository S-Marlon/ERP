import assert from 'assert';
import { alvoEfetivo, analisarMargem, melhorOferta } from './margemAlvo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('o exemplo: compra 25, vende 29,90 com 5% de taxa', () => {
  const r = analisarMargem({ preco: 29.9, custo: 25, taxaPct: 5, alvoPct: 30 })!;
  assert.strictEqual(r.liquido, 28.41);
  assert.strictEqual(r.lucro, 3.41);
  assert.strictEqual(r.lucroSobreCustoPct, 13.62);
  assert.strictEqual(r.margemSobrePrecoPct, 11.39);
  assert.strictEqual(r.abaixoDoAlvo, true);
  assert.strictEqual(r.prejuizo, false);
  assert.strictEqual(r.custoAlvo, 21.85);       // 28,405 / 1,30
  assert.strictEqual(r.reducaoCustoPct, 12.6);
  assert.strictEqual(r.precoAlvo, 34.21);       // 25 × 1,30 / 0,95
});

teste('no alvo, acima e com prejuízo', () => {
  assert.strictEqual(analisarMargem({ preco: 34.21, custo: 25, taxaPct: 5, alvoPct: 30 })!.abaixoDoAlvo, false);
  const p = analisarMargem({ preco: 25, custo: 25, taxaPct: 5, alvoPct: 30 })!;
  assert.strictEqual(p.prejuizo, true);
  assert.ok(p.lucro < 0);
  assert.strictEqual(analisarMargem({ preco: 0, custo: 10, taxaPct: 5, alvoPct: 30 }), null);
  assert.strictEqual(analisarMargem({ preco: 10, custo: 0, taxaPct: 5, alvoPct: 30 }), null);
});

teste('alvo da família ou padrão', () => {
  assert.deepStrictEqual(alvoEfetivo(180, 30), { alvoPct: 180, origem: 'FAMILIA' });
  assert.deepStrictEqual(alvoEfetivo(null, 30), { alvoPct: 30, origem: 'PADRAO' });
  assert.deepStrictEqual(alvoEfetivo(0, 30), { alvoPct: 30, origem: 'PADRAO' });
});

teste('melhor oferta abaixo do custo', () => {
  const ofertas = [
    { fornecedor: 'A', idFornecedor: 1, precoBase: 24, origem: 'NOTA' as const, data: '2026-01-10' },
    { fornecedor: 'B', idFornecedor: 2, precoBase: 21.4, origem: 'COTACAO' as const, data: '2026-09-01' },
    { fornecedor: 'C', idFornecedor: 3, precoBase: 26, origem: 'NOTA' as const, data: '2026-09-01' },
  ];
  assert.strictEqual(melhorOferta(ofertas, 25)!.fornecedor, 'B');
  assert.strictEqual(melhorOferta(ofertas, 20), null);
});
