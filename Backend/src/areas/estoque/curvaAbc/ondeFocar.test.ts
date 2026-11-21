import assert from 'assert';
import { classificarItens, ItemCurva } from './curvaAbc';
import { categoriasEmFoco, chamarizes, descontoMaximo, evolucao, ItemFoco, listaPropaganda, listasDeCompra } from './ondeFocar';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const base = (x: Partial<ItemCurva>): ItemCurva => ({
  idItem: 1, categoriaTopo: 1, receita: 0, lucro: 0, quantidade: 0, vendas: 0, semanasComVenda: 0, estoque: 0, custoUnitario: 1, diasDesdeEntrada: 200, ultimaVenda: null, ...x,
});
const montar = (lista: Array<Partial<ItemCurva> & { cat: string; preco: number }>): ItemFoco[] => {
  const c = classificarItens(lista.map(l => base(l)), 90);
  return c.map((i, k) => ({ ...i, sku: `S${i.idItem}`, nome: `Item ${i.idItem}`, unidade: 'UN', categoriaTopoNome: lista[k].cat, precoVenda: lista[k].preco }));
};

teste('foco: desconto máximo', () => {
  assert.strictEqual(descontoMaximo(100, 50, 0.1), 0.44);   // preço mínimo 55,56
  assert.strictEqual(descontoMaximo(100, 95, 0.1), 0);
  assert.strictEqual(descontoMaximo(0, 10, 0.1), 0);
});

teste('foco: quadrantes por categoria', () => {
  const itens = montar([
    { idItem: 1, cat: 'Hidráulica', receita: 3000, lucro: 1300, quantidade: 30, semanasComVenda: 6, estoque: 100, custoUnitario: 50, preco: 90 },
    { idItem: 2, cat: 'Bombas', receita: 2500, lucro: 400, quantidade: 3, semanasComVenda: 2, estoque: 5, custoUnitario: 700, preco: 830 },
    { idItem: 3, cat: 'Rolamentos', estoque: 100, custoUnitario: 30, preco: 75 },
    { idItem: 4, cat: 'PVC', estoque: 500, custoUnitario: 18, preco: 22 },
    { idItem: 5, cat: 'EPI', estoque: 2, custoUnitario: 10, preco: 20 },
  ]);
  const q = Object.fromEntries(categoriasEmFoco(itens, 0.3).map(c => [c.categoria, c.quadrante]));
  assert.deepStrictEqual(q, { Hidráulica: 'PROTEGER', Bombas: 'REVER_PRECO', Rolamentos: 'DIVULGAR', PVC: 'LIQUIDAR', EPI: 'ACOMPANHAR' });
  const roll = categoriasEmFoco(itens, 0.3).find(c => c.categoria === 'Rolamentos')!;
  assert.strictEqual(roll.margemTabela, 0.6);
  assert.match(roll.motivo, /100% do estoque parado/);
});

teste('foco: propaganda, chamarizes e compras', () => {
  const itens = montar([
    { idItem: 1, cat: 'A', receita: 3000, lucro: 1000, quantidade: 30, semanasComVenda: 6, estoque: 2, custoUnitario: 60, preco: 100 },
    { idItem: 2, cat: 'B', estoque: 100, custoUnitario: 30, preco: 75 },     // parado, margem 60%: R$ 3.000
    { idItem: 3, cat: 'B', estoque: 10, custoUnitario: 30, preco: 75 },      // parado, R$ 300
    { idItem: 4, cat: 'C', estoque: 500, custoUnitario: 18, preco: 22 },     // parado, margem 18%: não entra na propaganda
    { idItem: 5, cat: 'C', estoque: 1, custoUnitario: 10, preco: 30 },       // R$ 10: pequeno demais
  ]);
  const p = listaPropaganda(itens, 0.1);
  assert.deepStrictEqual(p.map(x => [x.idItem, x.descontoMaximo, x.descontoSugerido, x.precoPromocao]), [[2, 0.55, 0.15, 63.75], [3, 0.55, 0.15, 63.75]]);
  assert.deepStrictEqual(chamarizes(itens).map(x => x.idItem), [1]);
  const c = listasDeCompra(itens, 90);
  assert.deepStrictEqual(c.repor.map(x => [x.idItem, x.coberturaDias]), [[1, 6]]);
  assert.deepStrictEqual(c.naoRecomprar.map(x => x.idItem), [4, 2]);
});

teste('foco: evolução desde a foto anterior', () => {
  const nomes = new Map([[1, { sku: 'S1', nome: 'Um' }], [2, { sku: 'S2', nome: 'Dois' }], [3, { sku: 'S3', nome: 'Três' }]]);
  const e = evolucao(new Map([[1, 'A'], [2, 'C'], [3, 'B']]), new Map([[1, 'B'], [2, 'A'], [3, 'B']]), nomes);
  assert.deepStrictEqual(e.subiram.map(x => [x.idItem, x.de, x.para]), [[1, 'B', 'A']]);
  assert.deepStrictEqual(e.cairam.map(x => [x.idItem, x.de, x.para]), [[2, 'A', 'C']]);
});
