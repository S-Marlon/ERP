import assert from 'assert';
import {
  analisarFaixas, classificarLucro, classificarPreco, conselhos, estatisticas, lucroNoMl, precoParaAlvo, unidadesDoProduto,
} from './precificacao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('unidades do produto: atributo ou nome', () => {
  assert.strictEqual(unidadesDoProduto('100', 'Disco Menegotti'), 100);
  assert.strictEqual(unidadesDoProduto('1', 'Kit 50 Disco Corte Ferro Inox'), 50);
  assert.strictEqual(unidadesDoProduto(null, '10 Un Disco Corte Fino 1mm'), 10);
  assert.strictEqual(unidadesDoProduto(undefined, 'Disco De Corte Fino Inox Starrett -c/12'), 12);
  assert.strictEqual(unidadesDoProduto(null, 'Disco Corte Fino 4.1/2 Pol'), 1);
});

teste('estatísticas do mercado (por unidade)', () => {
  const e = estatisticas([1.42, 1.62, 1.76, 1.99, 2.84, 3.11, 7.7, 9, 0, NaN])!;
  assert.deepStrictEqual(e, { n: 8, min: 1.42, p25: 1.73, mediana: 2.42, p75: 4.26, max: 9 });
  assert.strictEqual(estatisticas([]), null);
});

teste('lucro no ML e preço para o alvo (disco c/12)', () => {
  // custo do pacote: 12 × R$ 2,27; Premium 17%
  const l = lucroNoMl({ preco: 42.9, custo: 27.24, tarifa: { comissaoPct: 17, fixa: 0 } });
  assert.deepStrictEqual(l, { preco: 42.9, tarifa: 7.29, frete: 0, liquido: 35.61, custo: 27.24, lucro: 8.37, lucroSobreCustoPct: 30.73, margemSobrePrecoPct: 19.51 });
  assert.strictEqual(precoParaAlvo({ custo: 27.24, tarifa: { comissaoPct: 17, fixa: 0 }, alvoPct: 30 }), 42.67);
  assert.strictEqual(precoParaAlvo({ custo: 10, tarifa: { comissaoPct: 17, fixa: 6 }, frete: 4, alvoPct: 30 }), 27.71);
  assert.strictEqual(lucroNoMl({ preco: 10, custo: 0, tarifa: { comissaoPct: 17, fixa: 0 } }).lucroSobreCustoPct, null);
});

teste('classificação do lucro e do preço', () => {
  assert.strictEqual(classificarLucro(-5, 30), 'PREJUIZO');
  assert.strictEqual(classificarLucro(20, 30), 'BAIXO');
  assert.strictEqual(classificarLucro(45, 30), 'BOM');
  assert.strictEqual(classificarLucro(90, 30), 'ALTO');
  assert.strictEqual(classificarLucro(null, 30), 'SEM_CUSTO');
  const m = estatisticas([1.42, 1.62, 1.76, 1.99, 2.84, 3.11])!;
  assert.deepStrictEqual(classificarPreco(3.58, m), { nivel: 'ACIMA', difMedianaPct: 90.43 });
  assert.strictEqual(classificarPreco(2, m).nivel, 'COMPETITIVO');
  assert.strictEqual(classificarPreco(1.3, m).nivel, 'ABAIXO');
  assert.strictEqual(classificarPreco(2, estatisticas([2, 3])).nivel, 'SEM_REFERENCIA');
});

teste('faixas por quantidade: lucro em cada uma', () => {
  const f = analisarFaixas([{ minimo: 5, desconto: 5 }, { minimo: 24, desconto: 25 }], { preco: 42.9, custo: 27.24, tarifaDaFaixa: () => ({ comissaoPct: 17, fixa: 0 }), alvoPct: 30 });
  assert.deepStrictEqual(f.map(x => [x.minimo, x.preco, x.lucro, x.nivel]), [[5, 40.75, 6.58, 'BAIXO'], [24, 32.17, -0.54, 'PREJUIZO']]);
});

teste('conselhos', () => {
  const c = conselhos({ nivelLucro: 'BOM', nivelPreco: 'ACIMA', difMedianaPct: 51, precoAtual: 42.9, precoAlvo: 42.66, precoMercado: 25, unidades: 12, faixasNegativas: [24], faixasAbaixoAlvo: [5], mesmaMarcaMediana: null, porUnidade: 3.58 });
  assert.ok(c.some(t => t.startsWith('Preço acima do mercado (51%')));
  assert.ok(c.some(t => t.includes('24 un. dão prejuízo')));
  const avulso = conselhos({ nivelLucro: 'BAIXO', nivelPreco: 'SEM_REFERENCIA', difMedianaPct: null, precoAtual: 19.9, precoAlvo: 22, precoMercado: null, unidades: 1, faixasNegativas: [], faixasAbaixoAlvo: [], mesmaMarcaMediana: null, porUnidade: 19.9 });
  assert.ok(avulso.some(t => t.includes('vender em pacote')));
  const barato = conselhos({ nivelLucro: 'BAIXO', nivelPreco: 'ABAIXO', difMedianaPct: -52, precoAtual: 9.6, precoAlvo: 10.61, precoMercado: 21, unidades: 100, faixasNegativas: [], faixasAbaixoAlvo: [], mesmaMarcaMediana: null, porUnidade: 0.1, tarifaFixa: 4.79, tarifaTotal: 5.94 });
  assert.ok(barato.some(t => t.includes('subir para perto de R$ 21,00')));
  assert.ok(barato.some(t => t.startsWith('A tarifa do ML leva 62% do preço')));
  const poucos = conselhos({ nivelLucro: 'BAIXO', nivelPreco: 'SEM_REFERENCIA', difMedianaPct: null, precoAtual: 9.6, precoAlvo: 10.61, precoMercado: null, unidades: 100, faixasNegativas: [], faixasAbaixoAlvo: [], mesmaMarcaMediana: null, porUnidade: 0.1, poucos: { min: 0.21, max: 0.25, n: 2 } });
  assert.ok(poucos.some(t => t.startsWith('Poucos anúncios iguais para comparar (2): R$ 21,00 a R$ 25,00')));
  assert.deepStrictEqual(conselhos({ nivelLucro: 'BOM', nivelPreco: 'COMPETITIVO', difMedianaPct: 2, precoAtual: 42.9, precoAlvo: 37.4, precoMercado: 42, unidades: 12, faixasNegativas: [], faixasAbaixoAlvo: [], mesmaMarcaMediana: null, porUnidade: 3.58 }), ['Preço competitivo e lucro dentro do alvo: pode manter.']);
  assert.ok(conselhos({ nivelLucro: 'SEM_CUSTO', nivelPreco: 'SEM_REFERENCIA', difMedianaPct: null, precoAtual: 10, precoAlvo: null, precoMercado: null, unidades: 1, faixasNegativas: [], faixasAbaixoAlvo: [], mesmaMarcaMediana: null, porUnidade: 10 })[0].includes('não tem custo'));
});
