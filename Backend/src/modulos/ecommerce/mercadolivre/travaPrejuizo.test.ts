import assert from 'assert';
import { daPrejuizo, decidirTrava, motivoDaPausa, pausadoPelaTrava, recusaPorPrejuizo, textoPrejuizo } from './travaPrejuizo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('trava: prejuízo é lucro abaixo de zero (margem baixa passa; sem custo não trava)', () => {
  assert.strictEqual(daPrejuizo({ custo: 8.5, lucro: -1.76 }), true);
  assert.strictEqual(daPrejuizo({ custo: 8.5, lucro: 0.2 }), false);
  assert.strictEqual(daPrejuizo({ custo: 8.5, lucro: -0.004 }), false);
  assert.strictEqual(daPrejuizo({ custo: 0, lucro: -5 }), false);
});

teste('trava: textos (números do ABR-7.2-250)', () => {
  const t = textoPrejuizo('ABR-7.2-250', { preco: 23.4, lucro: -1.76, precoMinimo: 25.9 });
  assert.ok(t.includes('a R$ 23,40 dá prejuízo de R$ 1,76'));
  assert.ok(t.includes('a partir de R$ 25,90'));
  const m = motivoDaPausa('ABR-7.2-250', { preco: 23.4, lucro: -1.76, precoMinimo: null });
  assert.ok(pausadoPelaTrava(m));
  assert.ok(!m.includes('a partir de'));
  assert.strictEqual(pausadoPelaTrava('O ML recusou o preço'), false);
  assert.strictEqual(pausadoPelaTrava(null), false);
  assert.ok(recusaPorPrejuizo('reativar', ['a', 'b', 'c', 'd']).endsWith('(e mais 1)'));
});

teste('trava: o que a sincronização faz com cada linha', () => {
  const motivo = motivoDaPausa('X', { preco: 10, lucro: -1, precoMinimo: 12 });
  const base = { status: 'active', linhaAtiva: true, erroAntes: null, estoque: 5, prejuizo: null };
  // ativa e com lucro: nada
  assert.deepStrictEqual(decidirTrava(base), { acao: 'MANTER', erro: null });
  // ativa e em prejuízo: pausa e grava o motivo
  assert.deepStrictEqual(decidirTrava({ ...base, prejuizo: motivo }), { acao: 'PAUSAR', erro: motivo });
  // pausada pela trava e ainda em prejuízo: continua (motivo atualizado)
  assert.deepStrictEqual(decidirTrava({ ...base, status: 'paused', erroAntes: motivo, prejuizo: motivo }), { acao: 'MANTER', erro: motivo });
  // pausada pela trava e voltou a dar lucro: reativa
  assert.deepStrictEqual(decidirTrava({ ...base, status: 'paused', erroAntes: motivo }), { acao: 'REATIVAR', erro: null });
  // ... mas sem estoque espera (o ML não reativa sem estoque)
  assert.deepStrictEqual(decidirTrava({ ...base, status: 'paused', erroAntes: motivo, estoque: 0 }), { acao: 'MANTER', erro: motivo });
  // pausada pelo operador: a trava não mexe, nem reativa
  assert.deepStrictEqual(decidirTrava({ ...base, status: 'paused' }), { acao: 'MANTER', erro: null });
  assert.deepStrictEqual(decidirTrava({ ...base, status: 'paused', prejuizo: motivo }), { acao: 'MANTER', erro: null });
  // linha desligada no ERP: fica como está
  assert.deepStrictEqual(decidirTrava({ ...base, linhaAtiva: false, prejuizo: motivo }), { acao: 'MANTER', erro: null });
});
