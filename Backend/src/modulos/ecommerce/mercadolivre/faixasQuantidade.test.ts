import assert from 'assert';
import { corpoFaixas, errosDasFaixas, faixasDoAtacado, faixasDoMl, lerFaixas, normalizarFaixas, precoNaFaixa } from './faixasQuantidade';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('faixas válidas e as regras do ML', () => {
  const boas = [{ minimo: 5, desconto: 5 }, { minimo: 10, desconto: 8 }, { minimo: 24, desconto: 10 }, { minimo: 48, desconto: 12 }, { minimo: 100, desconto: 15 }];
  assert.deepStrictEqual(errosDasFaixas(boas), []);
  assert.ok(errosDasFaixas([...boas, { minimo: 100, desconto: 20 }]).some(e => e.includes('no máximo 5')));
  assert.ok(errosDasFaixas([{ minimo: 1, desconto: 5 }]).some(e => e.includes('de 2 a 100')));
  assert.ok(errosDasFaixas([{ minimo: 5, desconto: 0 }]).some(e => e.includes('maior que 0%')));
  assert.ok(errosDasFaixas([{ minimo: 5, desconto: 8 }, { minimo: 10, desconto: 8 }]).some(e => e.includes('desconto precisa ser maior')));
  assert.ok(errosDasFaixas([{ minimo: 10, desconto: 5 }, { minimo: 10, desconto: 8 }]).some(e => e.includes('quantidade precisa ser maior')));
});

teste('normalizar e ler', () => {
  assert.deepStrictEqual(normalizarFaixas([{ minimo: '10', desconto: '8.456' }, { minimo: 5, desconto: 5 }, { minimo: 'x' }]), [{ minimo: 5, desconto: 5 }, { minimo: 10, desconto: 8.46 }]);
  assert.deepStrictEqual(lerFaixas('[{"minimo":5,"desconto":5}]'), [{ minimo: 5, desconto: 5 }]);
  assert.deepStrictEqual(lerFaixas('lixo'), []);
  assert.deepStrictEqual(lerFaixas(null), []);
});

teste('corpo do envio (substitui a tabela inteira)', () => {
  assert.deepStrictEqual(corpoFaixas([{ minimo: 5, desconto: 5 }]), {
    price_per_quantity: [{ type: 'discount_percentage', percentage: 5, conditions: { context_restrictions: ['channel_marketplace', 'user_type_business'], min_purchase_unit: 5, eligible: true } }],
  });
  assert.deepStrictEqual(corpoFaixas([]), { price_per_quantity: [] });
});

teste('preço na faixa e faixas a partir do atacado', () => {
  assert.strictEqual(precoNaFaixa(42.9, 7), 39.9);
  // atacado do cadastro: 10+ a 38,61 (10%), 50+ a 36,47 (15%); a de 3+ mais cara que o varejo some
  assert.deepStrictEqual(faixasDoAtacado([
    { quantidadeMinima: 50, precoUnitario: 36.47 }, { quantidadeMinima: 10, precoUnitario: 38.61 }, { quantidadeMinima: 3, precoUnitario: 45 },
  ], 42.9), [{ minimo: 10, desconto: 10 }, { minimo: 50, desconto: 14.99 }]);
  assert.deepStrictEqual(faixasDoAtacado([{ quantidadeMinima: 1, precoUnitario: 40 }], 42.9), [{ minimo: 2, desconto: 6.76 }]);
  assert.deepStrictEqual(faixasDoAtacado([], 42.9), []);
});

teste('faixas que já estão no ML (só as de empresa)', () => {
  const precos = { price_per_quantity: [
    { type: 'discount_percentage', percentage: 6.993007, conditions: { context_restrictions: ['channel_marketplace', 'user_type_business'], min_purchase_unit: 3 } },
    { type: 'discount_percentage', percentage: 15, conditions: { context_restrictions: ['channel_marketplace'], min_purchase_unit: 2 } },
  ] };
  assert.deepStrictEqual(faixasDoMl(precos), [{ minimo: 3, desconto: 6.99 }]);
  assert.deepStrictEqual(faixasDoMl({}), []);
});
