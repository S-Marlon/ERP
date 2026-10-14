import assert from 'assert';
import { acharLimiteTaxaFixa, alertasDePreco, avisosDeDegrau, montarCenarios, precoQueCompensaFrete, quantidadesParaAnalise, resultadoVenda, vendedorPagaFrete } from './custosMl';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

// disco Starrett c/12: R$ 1,99 a unidade, R$ 42,90 o pacote, Premium 17%, frete grátis R$ 7,15 (API) ou R$ 14,45 (tela do ML)
const PREMIUM = { comissaoPct: 17, fixa: 0 };
const CLASSICO = { comissaoPct: 12, fixa: 0 };

teste('você recebe e lucro de uma venda (disco c/12)', () => {
  const r = resultadoVenda({ precoUnit: 42.9, custoUnit: 23.88, tarifa: PREMIUM, frete: 7.15 });
  assert.deepStrictEqual([r.tarifa, r.frete, r.recebe, r.lucro, r.lucroSobreCustoPct], [7.29, 7.15, 28.46, 4.58, 19.18]);
  const tela = resultadoVenda({ precoUnit: 42.9, custoUnit: 23.88, tarifa: PREMIUM, frete: 14.45 });
  assert.deepStrictEqual([tela.recebe, tela.lucro], [21.16, -2.72]);
});

teste('quantidade: tarifa por unidade, frete por envio', () => {
  const r = resultadoVenda({ precoUnit: 40.76, quantidade: 5, custoUnit: 23.88, tarifa: PREMIUM, frete: 20 });
  assert.deepStrictEqual([r.receita, r.tarifa, r.recebe, r.custo, r.lucro, r.lucroPorUnidade], [203.8, 34.65, 149.15, 119.4, 29.75, 5.95]);
  const fixa = resultadoVenda({ precoUnit: 9.9, quantidade: 2, custoUnit: 3, tarifa: { comissaoPct: 12, fixa: 4.94 }, frete: 0 });
  assert.strictEqual(fixa.tarifa, 12.26);
});

teste('quem paga o frete', () => {
  assert.strictEqual(vendedorPagaFrete(42.9, false), false);
  assert.strictEqual(vendedorPagaFrete(42.9, true), true);
  assert.strictEqual(vendedorPagaFrete(85.8, false), true);
});

teste('cenários Clássico × Premium, com e sem frete grátis', () => {
  const c = montarCenarios({ preco: 42.9, custoUnit: 23.88, tarifas: { gold_special: CLASSICO, gold_pro: PREMIUM }, frete: 7.15, tipoAtual: 'gold_pro', freteGratisAtual: true });
  assert.deepStrictEqual(c.map(x => [x.tipo, x.freteGratis, x.recebe, x.lucro, x.atual]), [
    ['gold_special', true, 30.6, 6.72, false], ['gold_special', false, 37.75, 13.87, false],
    ['gold_pro', true, 28.46, 4.58, true], ['gold_pro', false, 35.61, 11.73, false],
  ]);
  const caro = montarCenarios({ preco: 99, custoUnit: 50, tarifas: { gold_special: CLASSICO, gold_pro: PREMIUM }, frete: 14.45, tipoAtual: 'gold_special', freteGratisAtual: false });
  assert.deepStrictEqual(caro.map(x => [x.tipo, x.freteGratis, x.obrigatorio, x.atual]), [['gold_special', true, true, true], ['gold_pro', true, true, false]]);
});

teste('degraus: limite do frete grátis e taxa fixa', () => {
  assert.strictEqual(precoQueCompensaFrete({ preco: 75, comissaoPct: 17, freteHoje: 7.15, freteAcima: 14.45 }), 83.8);
  const perto = avisosDeDegrau({ preco: 75, comissaoPct: 17, freteGratis: true, freteAbaixo: 7.15, freteAcima: 14.45, tarifaFixa: 0, precoSemFixa: null });
  assert.ok(perto[0].includes('Subir o preço só compensa a partir de R$ 83,80'));
  const disco = avisosDeDegrau({ preco: 42.9, comissaoPct: 17, freteGratis: true, freteAbaixo: 7.15, freteAcima: 14.45, tarifaFixa: 0, precoSemFixa: null });
  assert.ok(disco[0].startsWith('Quem compra 2 ou mais passa de R$ 79,00'));
  const acima = avisosDeDegrau({ preco: 85, comissaoPct: 17, freteGratis: true, freteAbaixo: 8.45, freteAcima: 14.45, tarifaFixa: 0, precoSemFixa: null });
  assert.ok(acima[0].includes('receberia R$ 0,94 a mais'));
  const barato = avisosDeDegrau({ preco: 9.9, comissaoPct: 12, freteGratis: false, freteAbaixo: 6.85, freteAcima: 12.95, tarifaFixa: 4.94, precoSemFixa: 19 });
  assert.deepStrictEqual(barato, ['Item barato: o ML cobra R$ 4,94 fixos por unidade, além da comissão (some a partir de R$ 19,00). Pacote ou kit dilui essa taxa.']);
});

teste('quantidades para analisar', () => {
  assert.deepStrictEqual(quantidadesParaAnalise(42.9, [{ minimo: 5, desconto: 5 }, { minimo: 24, desconto: 25 }]),
    [{ quantidade: 1, desconto: 0 }, { quantidade: 2, desconto: 0 }, { quantidade: 5, desconto: 5 }, { quantidade: 24, desconto: 25 }]);
  assert.deepStrictEqual(quantidadesParaAnalise(120, []), [{ quantidade: 1, desconto: 0 }]);
});

teste('limite exato da taxa fixa (busca ao centavo)', async () => {
  const chamadas: number[] = [];
  const fixaDe = async (p: number) => { chamadas.push(p); return p <= 12.5 ? r(p * 0.5) : 0; };
  const r = (v: number) => Math.round(v * 100) / 100;
  assert.strictEqual(await acharLimiteTaxaFixa(fixaDe), 12.51);
  assert.ok(chamadas.length <= 14);
  assert.strictEqual(await acharLimiteTaxaFixa(async () => 0), null);
  assert.strictEqual(await acharLimiteTaxaFixa(async () => 5), null);
});

teste('alertas de degrau de preço', () => {
  const barato = alertasDePreco({ preco: 12.5, lucro: 1.26, pct: 36, taxaFixa: { limite: 12.51, fixa: 6.24, noLimite: { lucro: 7.51, pct: 214.57 } }, frete: null });
  assert.strictEqual(barato[0].tipo, 'TAXA_FIXA');
  assert.strictEqual(barato[0].precoSugerido, 12.51);
  assert.strictEqual(barato[0].texto, 'Até R$ 12,50 o ML cobra R$ 6,24 de taxa fixa por unidade. Com R$ 12,51 (+R$ 0,01) o lucro vai de R$ 1,26 (36,0%) para R$ 7,51 (214,6%).');
  assert.strictEqual(alertasDePreco({ preco: 12.6, lucro: 6, pct: 200, taxaFixa: { limite: 12.51, fixa: 0, noLimite: null }, frete: null })[0].tipo, 'PERTO_TAXA_FIXA');
  assert.deepStrictEqual(alertasDePreco({ preco: 20, lucro: 6, pct: 50, taxaFixa: { limite: 12.51, fixa: 0, noLimite: null }, frete: null }), []);
  const acima = alertasDePreco({ preco: 82, lucro: 20, pct: 40, taxaFixa: null, frete: { abaixo: { lucro: 21.5, pct: 43 }, freteHoje: 14.45, freteAcima: null, compensaAPartir: null } });
  assert.deepStrictEqual([acima[0].tipo, acima[0].grave, acima[0].precoSugerido], ['FRETE_ACIMA_79', true, 78.9]);
  const perto = alertasDePreco({ preco: 72, lucro: 20, pct: 40, taxaFixa: null, frete: { abaixo: null, freteHoje: 8.45, freteAcima: 14.45, compensaAPartir: 79.23 } });
  assert.ok(perto[0].texto.endsWith('só suba o preço se for para R$ 79,23 ou mais.'));
});
