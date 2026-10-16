import assert from 'assert';
import { fichaDaLinha } from './ficha';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const categoria = [
  { id: 'BRAND', nome: 'Marca', obrigatorio: true },
  { id: 'MODEL', nome: 'Modelo', obrigatorio: true },
  { id: 'LINE', nome: 'Linha', obrigatorio: false },
  { id: 'MATERIAL', nome: 'Material', obrigatorio: false },
];

teste('ficha: igual, diferente, falta, só no ML e automáticos (o 1460-PCT do dia 16/10)', () => {
  const linhas = fichaDaLinha({
    categoria,
    envio: [
      { id: 'BRAND', value_name: 'Starrett' }, { id: 'MODEL', value_name: 'Starrett Fino Inox 4.1/2' },
      { id: 'SELLER_SKU', value_name: '1460-PCT' }, { id: 'SELLER_PACKAGE_WEIGHT', value_name: '0,4 kg' },
    ],
    noMl: [
      { id: 'BRAND', value_name: 'starrett' }, { id: 'MODEL', value_name: 'DAC115-14' }, { id: 'LINE', value_name: 'Extra Fino' },
      { id: 'SELLER_SKU', value_name: '1460' }, { id: 'SELLER_PACKAGE_WEIGHT', value_name: '400 g' }, { id: 'ITEM_CONDITION', value_name: 'Novo' },
    ],
    origens: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo' } },
  });
  const por = Object.fromEntries(linhas.map(l => [l.id, l]));
  assert.strictEqual(por.BRAND.situacao, 'IGUAL');
  assert.strictEqual(por.BRAND.origem, 'marca');
  assert.strictEqual(por.MODEL.situacao, 'DIFERENTE');
  assert.deepStrictEqual([por.MODEL.erp, por.MODEL.ml], ['Starrett Fino Inox 4.1/2', 'DAC115-14']);
  assert.strictEqual(por.LINE.situacao, 'SO_ML');                 // o ML tem, o ERP não manda
  assert.strictEqual(por.SELLER_SKU.origem, 'automatico');
  assert.strictEqual(por.SELLER_SKU.nome, 'SKU do vendedor');
  assert.strictEqual(por.SELLER_PACKAGE_WEIGHT.situacao, 'IGUAL'); // 0,4 kg = 400 g
  assert.strictEqual(por.MATERIAL.situacao, 'SEM_VALOR');
  assert.strictEqual(por.ITEM_CONDITION, undefined);              // interno do ML: fora
  assert.deepStrictEqual(linhas.slice(0, 2).map(l => l.situacao), ['DIFERENTE', 'DIFERENTE']);   // o que pede atenção primeiro
  // obrigatório que o ERP não manda mas o ML tem: não falta (o 6902-ZZ: "Número de peça" só no ML)
  const so = fichaDaLinha({ categoria: [{ id: 'PART_NUMBER', nome: 'Número de peça', obrigatorio: true }], envio: [], noMl: [{ id: 'PART_NUMBER', value_name: '6902-ZZ' }], origens: {} });
  assert.strictEqual(so[0].situacao, 'SO_ML');
});

teste('ficha: obrigatório sem valor e item ainda não publicado', () => {
  const linhas = fichaDaLinha({ categoria, envio: [{ id: 'BRAND', value_name: 'HHMS' }], noMl: null, origens: {} });
  const por = Object.fromEntries(linhas.map(l => [l.id, l]));
  assert.strictEqual(por.MODEL.situacao, 'FALTA');
  assert.strictEqual(por.BRAND.situacao, 'A_PUBLICAR');
  assert.strictEqual(por.BRAND.ml, null);
  assert.strictEqual(linhas[0].id, 'MODEL');
});
