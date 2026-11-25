import assert from 'assert';
import { resultadoDoPedido } from './resultadoPedido';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const item = (x: Partial<Parameters<typeof resultadoDoPedido>[0]['itens'][number]>) => ({
  nome: 'Item', sku: 'X', quantidade: 1, unidade: 'UN', precoTabela: 100, totalItem: 100, custoTotal: 60, ...x,
});
const base = { frete: 0, devolvido: 0, taxas: 0, taxasEstimadas: false, descontoFormaPct: 0, margemAlvo: 0.3, margemMinima: 0.1 };

teste('resultado do pedido: lucro, margem e avaliação', () => {
  // 2 itens: 100 (custo 60) e 50 (custo 20) → receita 150, custo 80, lucro 70 − 3 de taxa = 67 (44,7%)
  const r = resultadoDoPedido({ ...base, taxas: 3, itens: [item({ sku: 'A' }), item({ sku: 'B', precoTabela: 50, totalItem: 50, custoTotal: 20 })] });
  assert.deepStrictEqual([r.receita, r.custo, r.lucroBruto, r.lucro, r.margem, r.nivel], [150, 80, 70, 67, 0.4467, 'OTIMA']);
  assert.strictEqual(r.melhorItem!.sku, 'A');
  assert.ok(r.custoCompleto);
});

teste('resultado do pedido: desconto, abaixo da mínima e quanto falta para o alvo', () => {
  // tabela 200, vendido 150 (25% de desconto), custo 130: lucro 20 (13,3%) → abaixo do alvo (30%)
  const r = resultadoDoPedido({ ...base, itens: [item({ sku: 'A', quantidade: 2, totalItem: 150, custoTotal: 130 })] });
  assert.deepStrictEqual([r.descontoItens, r.lucro, r.margem, r.nivel], [50, 20, 0.1333, 'ABAIXO_ALVO']);
  // no alvo: 130 ÷ 0,7 = 185,71 → faltaram 35,71
  assert.deepStrictEqual([r.receitaNoAlvo, r.faltaParaAlvo], [185.71, 35.71]);
  assert.ok(r.fatores.some(f => f.startsWith('Desconto de 25%')) && r.fatores.some(f => f.startsWith('Desconto forte em A')));
  const minima = resultadoDoPedido({ ...base, itens: [item({ totalItem: 100, custoTotal: 95 })] });
  assert.strictEqual(minima.nivel, 'ABAIXO_MINIMA');
  const prejuizo = resultadoDoPedido({ ...base, itens: [item({ totalItem: 100, custoTotal: 110 })] });
  assert.deepStrictEqual([prejuizo.nivel, prejuizo.avaliacao.replace(/\s/g, ' ')], ['PREJUIZO', 'Este pedido dá prejuízo de R$ 10,00.']);
  assert.ok(prejuizo.fatores.some(f => f.startsWith('Vendido abaixo do custo: X')));
});

teste('resultado do pedido: desconto da forma (orçamento), item sem custo, devolução e taxa', () => {
  // orçamento com 10% no PIX: receita 200 → 180; custo 100 → lucro 80
  const pix = resultadoDoPedido({ ...base, descontoFormaPct: 0.1, itens: [item({ precoTabela: 200, totalItem: 200, custoTotal: 100 })] });
  assert.deepStrictEqual([pix.descontoForma, pix.receita, pix.lucro, pix.itens[0].receita], [20, 180, 80, 180]);
  // sem custo: avisa que o lucro é otimista
  const sem = resultadoDoPedido({ ...base, itens: [item({ sku: 'S', custoTotal: 0 })] });
  assert.ok(!sem.custoCompleto && sem.fatores[0].startsWith('1 item(ns) sem custo cadastrado (S)'));
  // devolveu metade: receita 50, custo 30
  const dev = resultadoDoPedido({ ...base, devolvido: 50, itens: [item({})] });
  assert.deepStrictEqual([dev.receita, dev.custo, dev.lucro], [50, 30, 20]);
  // taxa alta vira motivo
  const taxa = resultadoDoPedido({ ...base, taxas: 5, taxasEstimadas: true, itens: [item({})] });
  assert.ok(taxa.fatores.some(f => f.startsWith('Taxas da maquininha (estimadas)')));
});
