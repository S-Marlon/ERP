import assert from 'assert';
import { diametroEmNumero, barrasDoTrecho, caboSugerido, consumoDoRelatorio, corDoMaterial, corPadrao, sugerirDadosTecnicos, textoBarras } from './materiaisPoco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('materiais: dados técnicos pelo nome e cor', () => {
  assert.deepStrictEqual(sugerirDadosTecnicos('Tubo geomecânico 6" (barra)', 'TUBO'), { diametro: '6"', comprimentoM: 6, classe: null, cor: '#2f54eb' });
  assert.deepStrictEqual(sugerirDadosTecnicos('Tubo 5" Asperbras 6 m PN80', 'TUBO'), { diametro: '5"', comprimentoM: 6, classe: 'PN80', cor: '#69b1ff' });
  assert.deepStrictEqual(sugerirDadosTecnicos('Tubo edutor 1 1/4" (m)', 'TUBO'), { diametro: '1 1/4"', comprimentoM: null, classe: null, cor: '#fa8c16' });
  assert.strictEqual(sugerirDadosTecnicos('Tubo de revestimento aço 6" (m)', 'TUBO').cor, '#595959');
  assert.strictEqual(sugerirDadosTecnicos('Cabo PP 3x4 mm (m)', 'CABO').diametro, null);
  assert.strictEqual(sugerirDadosTecnicos('Cimento (saco)', 'OUTRO').cor, '#8c8c8c');   // "saco" não é aço
  assert.strictEqual(sugerirDadosTecnicos('Pré-filtro / cascalho (saco)', 'PRE_FILTRO').cor, '#d4b106');
  assert.strictEqual(corPadrao('Filtro geomecânico 4"', 'FILTRO'), '#2f54eb');
  assert.strictEqual(corPadrao('Coisa', 'FILTRO'), '#13a8a8');
  assert.strictEqual(corDoMaterial({ nome: 'Tubo aço', categoria: 'TUBO', cor: '#ff0000' }), '#ff0000');
});

teste('materiais: barras e cabo', () => {
  assert.strictEqual(barrasDoTrecho(0, 48, 6), 8);
  assert.strictEqual(barrasDoTrecho(0, 50, 6), 9);
  assert.strictEqual(barrasDoTrecho(0, 0, 6), null);
  assert.strictEqual(textoBarras(8, 6), '8 barras de 6 m');
  assert.strictEqual(textoBarras(1, 5.8), '1 barra de 5,8 m');
  assert.strictEqual(caboSugerido(72), 82);
  assert.deepStrictEqual(diametroEmNumero('1 1/4"'), { valor: 1.25, unidade: '"' });
  assert.deepStrictEqual(diametroEmNumero('6"'), { valor: 6, unidade: '"' });
  assert.deepStrictEqual(diametroEmNumero('150 mm'), { valor: 150, unidade: 'mm' });
  assert.strictEqual(diametroEmNumero('x'), null);
});

teste('materiais: consumo do relatório para lançar na obra', () => {
  const cat = [
    { idMaterial: 1, nome: 'Tubo geomecânico 6" (barra)', categoria: 'TUBO', unidade: 'un', comprimentoM: 6 },
    { idMaterial: 3, nome: 'Tubo aço 6" (m)', categoria: 'TUBO', unidade: 'm' },
    { idMaterial: 4, nome: 'Filtro geomecânico 6"', categoria: 'FILTRO', unidade: 'un', comprimentoM: 3 },
    { idMaterial: 10, nome: 'Tubo edutor 1 1/4"', categoria: 'TUBO', unidade: 'un', comprimentoM: 6 },
    { idMaterial: 7, nome: 'Cabo PP 3x4', categoria: 'CABO', unidade: 'm' },
    { idMaterial: 11, nome: 'Pré-filtro', categoria: 'PRE_FILTRO', unidade: 'sc' },
  ];
  const c = consumoDoRelatorio({
    revestimentos: [
      { revIdMaterial: 1, revDe: 0, revAte: 42 }, { revIdMaterial: 4, revDe: 42, revAte: 48, revTipo: 'FILTRO' }, { revIdMaterial: 1, revDe: 48, revAte: 54 },
      { revIdMaterial: 3, revDe: 0, revAte: 12.5 }, { revMaterial: 'avulso sem cadastro', revDe: 0, revAte: 6 },
    ],
    bombaIdTubo: 10, bombaQtdTubos: 12, bombaTamTubo: 6, bombaIdCabo: 7, bombaCaboMetros: 82, compIdPreFiltro: 11, compPreFiltroQtd: 10,
  }, cat);
  assert.deepStrictEqual(c.map(x => [x.idMaterial, x.quantidade, x.origem]), [
    [1, 8, 'revestimento'], [4, 2, 'filtro'], [3, 12.5, 'revestimento'], [10, 12, 'tubo edutor'], [7, 82, 'cabo da bomba'], [11, 10, 'pré-filtro'],
  ]);
});
