import assert from 'assert';
import { atributosDivergentes, descricaoDiverge, divergenciasDaLinha, fotosDivergentes, pacoteParaTrazer, valorComparavel } from './divergencias';
import { lerMedidaMl } from './sugestoes';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('divergências: valor de atributo sem ligar para formato', () => {
  assert.strictEqual(valorComparavel('0,4 kg'), valorComparavel('400 g'));
  assert.strictEqual(valorComparavel('15 mm'), valorComparavel('1,5 cm'));
  assert.strictEqual(valorComparavel(' Preto '), valorComparavel('preto'));
  assert.notStrictEqual(valorComparavel('400 g'), valorComparavel('425 g'));
  assert.strictEqual(valorComparavel('7'), valorComparavel('7,0'));
});

teste('divergências: atributos diferentes ou faltando no ML', () => {
  const erp = [
    { id: 'BRAND', value_name: 'HHMS' },
    { id: 'SELLER_PACKAGE_WEIGHT', value_name: '400 g' },
    { id: 'COLOR', value_id: '52049', value_name: 'Preto' },
    { id: 'UNITS_PER_PACK', value_name: '10' },
  ];
  const ml = [
    { id: 'BRAND', value_name: 'hhms' },
    { id: 'SELLER_PACKAGE_WEIGHT', value_name: '0,4 kg' },
    { id: 'COLOR', value_id: '52055', value_name: 'Branco' },
  ];
  assert.deepStrictEqual(atributosDivergentes(erp, ml), [
    { id: 'COLOR', erp: 'Preto', ml: 'Branco' },
    { id: 'UNITS_PER_PACK', erp: '10', ml: null },   // o kit 10 sem "unidades por pacote" no ML
  ]);
});

teste('divergências: fotos (novas, ordem, quantidade)', () => {
  assert.strictEqual(fotosDivergentes([{ idMl: 'a' }, { idMl: 'b' }], ['a', 'b']), null);
  assert.strictEqual(fotosDivergentes([{ idMl: 'a' }, { idMl: null }], ['a']), '1 foto(s) nova(s) para subir');
  assert.strictEqual(fotosDivergentes([{ idMl: 'b' }, { idMl: 'a' }], ['a', 'b']), 'ordem das fotos diferente');
  assert.strictEqual(fotosDivergentes([{ idMl: 'a' }], ['a', 'b']), 'o ML tem 2 foto(s), o ERP manda 1');
  assert.strictEqual(fotosDivergentes([{ idMl: 'a' }, { idMl: null, link: true }], ['a', 'x']), null);   // a do link ganha outro id lá
});

teste('divergências: descrição e título (o 6902-ZZ do dia 16/10)', () => {
  assert.strictEqual(descricaoDiverge('linha 1  \r\nlinha 2\n', 'linha 1\nlinha 2'), false);   // a igual não manda (evita a recusa)
  assert.strictEqual(descricaoDiverge('nova', 'velha'), true);
  assert.strictEqual(descricaoDiverge('', 'qualquer'), false);   // sem descrição no ERP: não apaga a do ML
  const d = divergenciasDaLinha({
    atributos: { erp: [], ml: [] }, fotos: null, descricao: { erp: 'a', ml: 'a' },
    titulo: { erp: 'Kit 10 Unidades ROLAMENTO 6902-ZZ', ml: 'Rolamento 6902-zz | Kit 10 Unidades', temFamilia: true },
  });
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].campo, 'TITULO');
  assert.strictEqual(d[0].enviavel, false);   // family_name: só pelo painel
  assert.deepStrictEqual(divergenciasDaLinha({
    atributos: { erp: [], ml: [] }, fotos: null, descricao: null, titulo: { erp: 'ROLAMENTO 6902', ml: 'Rolamento 6902', temFamilia: false },
  }), []);   // só maiúsculas: igual
  assert.deepStrictEqual(divergenciasDaLinha({
    atributos: { erp: [], ml: [] }, fotos: null, descricao: null,
    titulo: { erp: 'ABRAÇADEIRA de NYLON - 3.6x100mm - C/ 100 UN NYLON', ml: 'Abraçadeira De Nylon - 3.6x100mm - C/ 100 Un Nylon Preto', temFamilia: true, familia: 'Abraçadeira De Nylon - 3.6x100mm - C/ 100 Un Nylon' },
  }), []);   // o ML acrescenta a cor ao nome da família: não é diferença
});

teste('divergências: embalagem do ML para trazer ao cadastro (o 6902-ZZ do dia 16/10)', () => {
  const erp = [
    { id: 'SELLER_PACKAGE_HEIGHT', value_name: '7 cm' }, { id: 'SELLER_PACKAGE_WIDTH', value_name: '3.1 cm' },
    { id: 'SELLER_PACKAGE_LENGTH', value_name: '3.1 cm' }, { id: 'SELLER_PACKAGE_WEIGHT', value_name: '10 g' },
  ];
  const ml = [
    { id: 'SELLER_PACKAGE_HEIGHT', value_name: '4 cm' }, { id: 'SELLER_PACKAGE_WIDTH', value_name: '4 cm' },
    { id: 'SELLER_PACKAGE_LENGTH', value_name: '2 cm' }, { id: 'SELLER_PACKAGE_WEIGHT', value_name: '95 g' },
  ];
  assert.deepStrictEqual(pacoteParaTrazer(erp, ml, lerMedidaMl), { pesoG: 95, alturaCm: 4, larguraCm: 4, comprimentoCm: 2 });
  assert.strictEqual(pacoteParaTrazer(ml, ml, lerMedidaMl), null);                        // igual: nada a trazer
  assert.strictEqual(pacoteParaTrazer(erp, ml.slice(0, 2), lerMedidaMl), null);           // ML sem as 4 medidas
});
