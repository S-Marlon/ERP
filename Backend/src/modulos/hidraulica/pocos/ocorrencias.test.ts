import assert from 'assert';
import { codigosValidos, marcadas, ocorrenciasDoPoco, OCORRENCIAS } from './ocorrencias';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('ocorrências do poço: catálogo, marcadas e códigos válidos', () => {
  assert.strictEqual(new Set(OCORRENCIAS.map(o => o.codigo)).size, OCORRENCIAS.length);
  assert.deepStrictEqual(marcadas({ chkCaimento: true, chkRuido: false, chkCheiro: true }), ['chkCaimento', 'chkCheiro']);
  assert.deepStrictEqual(codigosValidos('chkEnergiaRuim, xyz,chkEnergiaRuim,chkRuido'), ['chkEnergiaRuim', 'chkRuido']);
  assert.deepStrictEqual(codigosValidos(['chkCheiro', 1]), ['chkCheiro']);
});

teste('ocorrências do poço: histórico juntando obras e registros', () => {
  const h = ocorrenciasDoPoco([
    { codigos: ['chkCaimento', 'chkAguaNaoLimpou'], data: '2025-03-10', origem: 'Obra 4' },
    { codigos: ['chkEnergiaRuim'], data: '2026-08-01', origem: 'Visita' },
    { codigos: ['chkAguaNaoLimpou', 'chkAguaNaoLimpou'], data: '2026-10-02', origem: 'Obra 9' },
  ]);
  assert.deepStrictEqual(h.map(x => [x.codigo, x.vezes, x.ultimaVez, x.origem]), [
    ['chkAguaNaoLimpou', 2, '2026-10-02', 'Obra 9'], ['chkEnergiaRuim', 1, '2026-08-01', 'Visita'], ['chkCaimento', 1, '2025-03-10', 'Obra 4'],
  ]);
});
