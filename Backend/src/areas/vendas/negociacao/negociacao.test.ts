import assert from 'assert';
import { abaixoDaMinima, aplicarMargem, equilibrar, margem, markup, normalizarFaixas, precoDaQuantidade, precoParaMargem, resumoNegociacao } from './negociacao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('negociação: margem, markup e preço', () => {
  assert.strictEqual(margem(100, 70), 0.3);
  assert.strictEqual(markup(100, 70), 0.4286);
  assert.strictEqual(margem(100, 0), null, 'sem custo');
  assert.strictEqual(precoParaMargem(70, 0.3), 100);
  assert.strictEqual(precoParaMargem(70, 0.2), 87.5);
  assert.strictEqual(precoParaMargem(70, 0.99), 1400, 'trava em 95%');
});

teste('negociação: resumo do orçamento', () => {
  const r = resumoNegociacao([{ quantidade: 2, preco: 100, custoUnitario: 70 }, { quantidade: 1, preco: 50, custoUnitario: 0 }]);
  assert.deepStrictEqual(r, { receita: 250, custo: 140, lucro: 60, margem: 0.3, markup: 0.4286, semCusto: 1 });
});

teste('negociação: equilibrar para o alvo', () => {
  // A travado a 15% (custo 85, preço 100); B livre com custo 70: o orçamento precisa fechar em 30%
  const linhas = [{ quantidade: 1, preco: 100, custoUnitario: 85, travado: true }, { quantidade: 1, preco: 100, custoUnitario: 70 }];
  const e = equilibrar(linhas, 0.3);
  // custo total 155 ÷ 0,7 = 221,43; B precisa de 121,43 → margem 42,35%
  assert.strictEqual(e.margemLivres, 0.4235);
  assert.deepStrictEqual(e.precos, [100, 121.42]);
  assert.ok(Math.abs(resumoNegociacao(linhas.map((l, i) => ({ ...l, preco: e.precos[i] }))).margem! - 0.3) < 0.001);
  // travado já passa do alvo: os livres iriam abaixo do custo
  const alto = equilibrar([{ quantidade: 10, preco: 200, custoUnitario: 70, travado: true }, { quantidade: 1, preco: 10, custoUnitario: 8 }], 0.3);
  assert.deepStrictEqual([alto.margemLivres, alto.precos[1]], [0, 8]);
  assert.ok(alto.aviso!.includes('já passam do alvo'));
  // travado abaixo do custo: os livres teriam de passar de 90%
  const baixo = equilibrar([{ quantidade: 10, preco: 50, custoUnitario: 70, travado: true }, { quantidade: 1, preco: 10, custoUnitario: 8 }], 0.3);
  assert.strictEqual(baixo.margemLivres, 0.9);
  assert.ok(baixo.aviso!.includes('90%'));
  assert.ok(equilibrar([{ quantidade: 1, preco: 10, custoUnitario: 8, travado: true }], 0.3).aviso!.includes('destrave'));
  assert.deepStrictEqual(aplicarMargem([{ quantidade: 1, preco: 1, custoUnitario: 70 }, { quantidade: 1, preco: 9, custoUnitario: 70, travado: true }], 0.3), [100, 9]);
});

teste('negociação: faixas por quantidade e margem mínima', () => {
  const f = normalizarFaixas([{ quantidadeMinima: 10, precoUnitario: 90 }, { quantidadeMinima: 1, precoUnitario: 99 }, { quantidadeMinima: 5, precoUnitario: 95 },
    { quantidadeMinima: 10, precoUnitario: 80 }, { quantidadeMinima: 20, precoUnitario: 0 }, null]);
  assert.deepStrictEqual(f, [{ quantidadeMinima: 5, precoUnitario: 95 }, { quantidadeMinima: 10, precoUnitario: 90 }]);
  assert.deepStrictEqual([precoDaQuantidade(100, f, 3), precoDaQuantidade(100, f, 5), precoDaQuantidade(100, f, 12)], [100, 95, 90]);
  const avisos = abaixoDaMinima([
    { nome: 'A', preco: 100, custoUnitario: 70, faixas: [{ quantidadeMinima: 10, precoUnitario: 75 }] },
    { nome: 'B', preco: 100, custoUnitario: 80 }, { nome: 'C', preco: 1, custoUnitario: 0 },
  ], 0.1);
  assert.deepStrictEqual(avisos, ['A: margem de 6,7% (mínima 10%)']);
});
