import assert from 'assert';
import { analisarAdesao, multaProporcional } from './adesaoPlano';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('adesão: serviço de 6.000 cobrado 2.000 com 24 meses', () => {
  // plano de R$ 235: custo 150, deduções 12%, lucro esperado 56,80 (pessimista 20)
  const plano = { preco: 235, custoMensal: 150, deducoesPct: 0.12, lucroEsperado: 56.8, lucroPessimista: 20, arredondarPara: 5 };
  const a = analisarAdesao({ valorCheio: 6000, cobrado: 2000, meses: 24 }, plano);
  // 4.000 de desconto ÷ 56,80 = 70,4 → 71 meses; em 24 meses o plano deixa 1.363,20: faltam 2.636,80
  assert.deepStrictEqual([a.desconto, a.porMes, a.mesesEsperado, a.mesesPessimista, a.pagaEsperado, a.pagaPessimista], [4000, 166.67, 71, 200, false, false]);
  assert.deepStrictEqual([a.sobraEsperada, a.sobraPessimista], [-2636.8, -3520]);
  // para pagar em 24 meses: (150 + 166,67) ÷ 0,88 = 359,85 → R$ 360
  assert.strictEqual(a.precoParaPagar, 360);
  // desconto menor: 6.000 cobrado 5.000 → 1.000 ÷ 56,80 = 18 meses (esperado) e 50 (pessimista)
  const b = analisarAdesao({ valorCheio: 6000, cobrado: 5000, meses: 24 }, plano);
  assert.deepStrictEqual([b.mesesEsperado, b.pagaEsperado, b.pagaPessimista, b.sobraEsperada], [18, true, false, 363.2]);
});

teste('adesão: sem desconto, plano sem lucro e prejuízo de caixa', () => {
  const plano = { preco: 100, custoMensal: 90, deducoesPct: 0.12, lucroEsperado: -2, lucroPessimista: -10 };
  assert.deepStrictEqual([analisarAdesao({ valorCheio: 1000, cobrado: 1000, meses: 12 }, plano).mesesEsperado, analisarAdesao({ valorCheio: 1000, cobrado: 1000, meses: 12 }, plano).precoParaPagar], [0, null]);
  const c = analisarAdesao({ valorCheio: 6000, cobrado: 2000, meses: 12, custoServico: 2500 }, plano);
  assert.deepStrictEqual([c.mesesEsperado, c.pagaEsperado, c.prejuizoCaixa], [null, false, 500]);
});

teste('adesão: multa proporcional', () => {
  assert.deepStrictEqual([0, 6, 12, 18, 24, 30].map(m => multaProporcional(4000, 24, m)), [4000, 3000, 2000, 1000, 0, 0]);
});
