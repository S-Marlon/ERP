import assert from 'assert';
import { grupoOcorrencia, itensDosGrupos, marcadas, OCORRENCIAS, rotuloOcorrencia } from './ocorrencias';
import { ANOMALIAS, OCORRENCIAS_OBRA } from './relatorioPoco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('ocorrências: códigos únicos e os antigos continuam', () => {
  assert.strictEqual(new Set(OCORRENCIAS.map(o => o.codigo)).size, OCORRENCIAS.length);
  for (const antigo of ['chkCaimento', 'chkEstruturas', 'chkReducaoVazao', 'chkPresencaFerro', 'chkAguaNaoLimpou', 'chkLajeInfiltracao', 'chkEnergiaRuim', 'chkAquecimentoBomba']) {
    assert.ok(grupoOcorrencia(antigo), antigo);
  }
  assert.strictEqual(rotuloOcorrencia('chkAguaNaoLimpou'), 'Água turva / areia');
  assert.strictEqual(rotuloOcorrencia('xyz'), 'xyz');
});

teste('ocorrências: grupos do relatório e marcadas', () => {
  assert.ok(OCORRENCIAS_OBRA.some(([k]) => k === 'chkCaimento') && OCORRENCIAS_OBRA.some(([k]) => k === 'chkClimaAdverso'));
  assert.ok(ANOMALIAS.some(([k]) => k === 'chkEnergiaRuim') && !ANOMALIAS.some(([k]) => k === 'chkCaimento'));
  assert.strictEqual(ANOMALIAS.length + OCORRENCIAS_OBRA.length, OCORRENCIAS.length);
  assert.deepStrictEqual(itensDosGrupos('AGUA').slice(0, 1), [['chkAguaNaoLimpou', 'Água turva / areia']]);
  assert.deepStrictEqual(marcadas({ chkCaimento: true, chkCheiro: true, chkRuido: false, outro: true }), ['chkCaimento', 'chkCheiro']);
});
