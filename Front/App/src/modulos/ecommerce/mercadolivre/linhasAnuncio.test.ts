import assert from 'assert';
import { linhasDoItem, produtosDoAnuncio, rotuloDaUnidade, umaLinhaPorItem, unidadesLivres } from './linhasAnuncio';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const kit = { idUnidade: 9, sigla: 'KIT10', nome: 'Kit c/10', fator: 10, preco: null };
const cx = { idUnidade: 7, sigla: 'CX', nome: 'Caixa c/100', fator: 100, preco: null };
const linha = (idLinha: number, idItem: number, unidadeMl: typeof kit | null = null) => ({ idLinha, idItem, unidadeMl, unidades: [kit, cx], siglaBase: 'UN' });

teste('linhas: unidades em que o item ainda pode entrar', () => {
  const un = linha(1, 50);
  assert.deepStrictEqual(unidadesLivres([un], un).map(o => o.idUnidade), [9, 7]);
  const k = linha(2, 50, kit);
  assert.deepStrictEqual(unidadesLivres([un, k], k).map(o => o.idUnidade), [7]);
  assert.deepStrictEqual(unidadesLivres([k], k).map(o => o.idUnidade), [null, 7]);
  assert.strictEqual(unidadesLivres([un], un)[0].rotulo, 'Kit c/10 (10 UN)');
  // outro item com a mesma unidade não conta
  assert.deepStrictEqual(unidadesLivres([un, linha(3, 60, kit)], un).map(o => o.idUnidade), [9, 7]);
});

teste('linhas: rótulo da unidade e contagem por item', () => {
  assert.strictEqual(rotuloDaUnidade({ unidadeMl: kit, siglaBase: 'UN' }), 'KIT10 · 10 UN');
  assert.strictEqual(rotuloDaUnidade({ unidadeMl: null, siglaBase: 'UN' }), '');
  assert.strictEqual(linhasDoItem([linha(1, 50), linha(2, 50, kit), linha(3, 60)], 50), 2);
});

teste('linhas: uma por item para fotos e editor (a da unidade base)', () => {
  const det = { itens: [linha(2, 50, kit), linha(1, 50), linha(3, 60, kit)] };
  assert.deepStrictEqual(umaLinhaPorItem(det).itens.map(l => l.idLinha), [1, 3]);
});

teste('linhas: produtos com as formas de venda dentro (o 6902-ZZ e a abraçadeira)', () => {
  const kit = (fator: number) => ({ idUnidade: fator, sigla: `KIT${fator}`, nome: `Kit c/${fator}`, fator, preco: null });
  const linhas = [
    { idItem: 7, idLinha: 19, sku: '6902-ZZ/HHMS-KIT10', nome: 'Rolamento 6902', unidadeMl: kit(10) },
    { idItem: 3, idLinha: 1, sku: 'ABR-3.6-100', nome: 'Abraçadeira', unidadeMl: null },
    { idItem: 7, idLinha: 13, sku: '6902-ZZ/HHMS', nome: 'Rolamento 6902', unidadeMl: null },
    { idItem: 7, idLinha: 20, sku: '6902-ZZ/HHMS-KIT2', nome: 'Rolamento 6902', unidadeMl: kit(2) },
  ];
  const p = produtosDoAnuncio(linhas);
  assert.deepStrictEqual(p.map(x => [x.idItem, x.sku, x.linhas.map(l => l.idLinha)]), [
    [7, '6902-ZZ/HHMS', [13, 20, 19]],   // unidade, kit 2, kit 10
    [3, 'ABR-3.6-100', [1]],
  ]);
  assert.strictEqual(produtosDoAnuncio([linhas[0]])[0].sku, '6902-ZZ/HHMS');   // só o kit: SKU sem o "-KIT10"
});
