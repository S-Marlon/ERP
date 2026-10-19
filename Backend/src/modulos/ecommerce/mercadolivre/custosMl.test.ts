import assert from 'assert';
import { acharLimiteTaxaFixa, alertasDePreco, avisosDeDegrau, freteDiverge, freteDoVendedorNasOpcoes, precoQueEmpata, textoDoDegrau19, montarCenarios, precoQueCompensaFrete, quantidadesParaAnalise, resultadoVenda, valorNaTabelaDeFrete, vendedorPagaFrete } from './custosMl';

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

teste('tabela do frete que o ML cobra (conferida com o painel)', () => {
  // abaixo de 79 com frete grátis: a tabela de 79 (R$ 23,40 / 438 g pagou R$ 13,85 = a de R$ 79)
  assert.strictEqual(valorNaTabelaDeFrete(23.4, true), 79);
  // abaixo sem frete grátis: a do próprio valor (R$ 12,59 / 400 g pagou R$ 5,95, mesmo com o comprador pagando o envio)
  assert.strictEqual(valorNaTabelaDeFrete(12.59, false), 12.59);
  assert.strictEqual(valorNaTabelaDeFrete(100, true), 100);
  assert.strictEqual(valorNaTabelaDeFrete(100, false), 100);
  const c = montarCenarios({ preco: 12.59, custoUnit: 3.5, tarifas: { gold_special: CLASSICO, gold_pro: PREMIUM }, frete: 13.85, freteSemGratis: 5.95, tipoAtual: 'gold_special', freteGratisAtual: false });
  assert.deepStrictEqual(c.filter(x => x.tipo === 'gold_special').map(x => [x.freteGratis, x.frete]), [[true, 13.85], [false, 5.95]]);
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

teste('frete do vendedor lido das opções de envio do anúncio (ML em 2026-10-19)', () => {
  // 1460-PCT, frete grátis ligado: o comprador paga 0 e o vendedor 14,45
  assert.strictEqual(freteDoVendedorNasOpcoes([{ cost: 0, list_cost: 14.45 }, { cost: 9.99, list_cost: 9.99 }]), 14.45);
  // abraçadeira de R$ 26 com frete grátis desligado: o ML dá grátis ao comprador (≥ R$ 19) e cobra 6,95 do vendedor
  assert.strictEqual(freteDoVendedorNasOpcoes([{ cost: 0, list_cost: 6.95 }, { cost: 9.99, list_cost: 9.99 }]), 6.95);
  // abaixo de R$ 19, comprador pagando: não aparece o custo do vendedor
  assert.strictEqual(freteDoVendedorNasOpcoes([{ cost: 17.99, list_cost: 17.99 }, { cost: 8.99, list_cost: 8.99 }]), null);
  assert.strictEqual(freteDoVendedorNasOpcoes(null), null);
  assert.strictEqual(freteDiverge(5.65, 6.85), true);    // o par do 6902-ZZ
  assert.strictEqual(freteDiverge(6.95, 6.95), false);
  assert.strictEqual(freteDiverge(null, 6.95), false);
});

teste('degrau dos R$ 19: preço que mantém o lucro e os avisos (a ABR-3.6-200 em 2026-10-19)', () => {
  // a R$ 18,90: lucro 5,18 (tarifa 12%, frete 5,95, custo 5,50); a partir de R$ 19 o frete vai a 6,95
  const empata = precoQueEmpata({ lucroAlvo: 5.18, custo: 5.5, comissaoPct: 12, fixa: 0, frete: 6.95 });
  assert.strictEqual(empata, 20.04);
  const d = { freteAbaixo: 5.95, freteAcima: 6.95, empataEm: empata, lucroEm19: 4.27, lucroHoje: 5.18 };
  assert.ok(textoDoDegrau19(d).includes('com R$ 20,04 ou mais o seu lucro fica igual'));
  // a R$ 15,90 (lucro 2,54) subir para R$ 19 já dá mais: 4,27
  assert.ok(textoDoDegrau19({ ...d, empataEm: 19, lucroHoje: 2.54 }).includes('sobe de R$ 2,54 para R$ 4,27'));
  const abaixo = alertasDePreco({ preco: 18.9, lucro: 5.18, pct: 94, taxaFixa: null, frete: null, degrau19: d });
  assert.strictEqual(abaixo[0].tipo, 'ABAIXO_19');
  assert.strictEqual(abaixo[0].precoSugerido, 20.04);
  assert.ok(abaixo[0].texto.includes('o ML dá frete grátis a ele'));
  assert.strictEqual(alertasDePreco({ preco: 19.5, lucro: 4.5, pct: 80, taxaFixa: null, frete: null, degrau19: d })[0].tipo, 'PERTO_19');
  assert.strictEqual(alertasDePreco({ preco: 10, lucro: 1, pct: 20, taxaFixa: null, frete: null, degrau19: d }).length, 0);   // longe de 19
  assert.strictEqual(alertasDePreco({ preco: 18.9, lucro: 5.18, pct: 94, taxaFixa: null, frete: null, degrau19: null }).length, 0);   // frete grátis ligado
});
