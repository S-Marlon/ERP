import assert from 'assert';
import { analisarGrupo, confiancaDas, demandaPorAtributo, giroPorMarca, ItemEquivalencia, montarGrupos, normalizarValor } from './equivalencias';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const POT = 225;
const item = (x: Partial<ItemEquivalencia> & { pot?: string }): ItemEquivalencia => ({
  idItem: 1, sku: 'S', nome: 'Bomba', categoriaId: 61, categoria: 'Bombas', marca: 'EBARA', familia: null, atributos: new Map(x.pot ? [[POT, normalizarValor(x.pot)]] : []),
  quantidade: 0, receita: 0, lucro: 0, vendas: 0, estoque: 0, valorEstoque: 0, custoUnitario: 500, precoVenda: 700, decisaoCompra: null, ...x,
});

teste('equivalentes: normalização e grupos', () => {
  assert.strictEqual(normalizarValor(' 0,75 HP'), '0.75hp');
  const grupos = montarGrupos([
    item({ idItem: 53, pot: '0,75', marca: 'EBARA' }),
    item({ idItem: 808, pot: '0.75', marca: 'TETIS' }),
    item({ idItem: 54, pot: '1', marca: 'EBARA' }),
    item({ idItem: 807, pot: '1', marca: 'TETIS' }),
    item({ idItem: 52, pot: '0,5', marca: 'EBARA' }),            // sozinho: não é grupo
    item({ idItem: 60, pot: '0,75', marca: 'EBARA', categoriaId: 99 }),  // outra categoria
    item({ idItem: 61, marca: 'TETIS' }),                         // sem atributo: fora
  ]);
  assert.deepStrictEqual(grupos.map(g => g.itens.map(i => i.idItem)), [[53, 808], [54, 807]]);
  // mesma marca nos dois: não há escolha
  assert.strictEqual(montarGrupos([item({ idItem: 1, pot: '1' }), item({ idItem: 2, pot: '1' })]).length, 0);
});

teste('equivalentes: quem vende e quem trava (Ebara x Tetis 0,75)', () => {
  const g = analisarGrupo([
    item({ idItem: 53, pot: '0,75', marca: 'EBARA', quantidade: 1, vendas: 1, receita: 606.56, estoque: 2, valorEstoque: 1000, precoVenda: 606.56, custoUnitario: 500 }),
    item({ idItem: 808, pot: '0,75', marca: 'TETIS', quantidade: 0, estoque: 7, valorEstoque: 3668, precoVenda: 710, custoUnitario: 524 }),
  ], 0.1);
  assert.deepStrictEqual(g.itens.map(i => [i.idItem, i.papel, i.partVendas, i.partEstoque]), [[53, 'VENDE', 1, 0.222], [808, 'TRAVA', 0, 0.778]]);
  assert.strictEqual(g.alerta, 'TETIS tem 78% do estoque e 0% das vendas: o cliente prefere EBARA');
  assert.deepStrictEqual(g.alertas, [{ trava: 'TETIS', partEstoque: 0.778, partVendas: 0, preferida: 'EBARA' }]);
  assert.strictEqual(g.confianca, 'BAIXA');
  assert.strictEqual(g.valorTravado, 3668);
  // escoar: 10% abaixo da Ebara (545,90) seria abaixo do mínimo da Tetis (524 / 0,9 = 582,22): fica no mínimo
  const tetis = g.itens.find(i => i.idItem === 808)!;
  assert.strictEqual(tetis.precoEscoar, 582.22);
  assert.strictEqual(tetis.precoEscoarNoMinimo, true);
  // ninguém vendeu: não dá para julgar
  const parado = analisarGrupo([item({ idItem: 1, pot: '1', estoque: 3 }), item({ idItem: 2, pot: '1', marca: 'TETIS', estoque: 3 })], 0.1);
  assert.strictEqual(parado.alerta, null);
  assert.ok(parado.itens.every(i => i.papel === 'OK'));
  // decisão contrária aos números
  const c = analisarGrupo([item({ idItem: 1, pot: '1', quantidade: 5, vendas: 5, decisaoCompra: 'NAO_RECOMPRAR' }), item({ idItem: 2, pot: '1', marca: 'TETIS', estoque: 9 })], 0.1);
  assert.strictEqual(c.conflito, true);
  assert.deepStrictEqual([confiancaDas(2), confiancaDas(6), confiancaDas(20)], ['BAIXA', 'MEDIA', 'ALTA']);
});

teste('equivalentes: demanda por atributo e giro por marca', () => {
  const itens = [
    item({ idItem: 53, pot: '0,75', marca: 'EBARA', quantidade: 3, receita: 1800, estoque: 2 }),
    item({ idItem: 808, pot: '0,75', marca: 'TETIS', quantidade: 0, estoque: 7 }),
    item({ idItem: 54, pot: '1', marca: 'EBARA', quantidade: 1, receita: 700, estoque: 3 }),
  ];
  const d = demandaPorAtributo(itens, new Map([[POT, 'Potência (HP)']]), new Map([[`${POT}|0.75`, '0,75']]));
  assert.deepStrictEqual(d.map(x => [x.valor, x.quantidade, x.estoque, x.marcas]), [['0,75', 3, 9, ['EBARA', 'TETIS']], ['1', 1, 3, ['EBARA']]]);
  const m = giroPorMarca(itens.map(i => ({ ...i, valorEstoque: i.estoque * 500 })));
  assert.deepStrictEqual(m.map(x => [x.marca, x.quantidade, x.giro]), [['EBARA', 4, 0.57], ['TETIS', 0, 0]]);
});
