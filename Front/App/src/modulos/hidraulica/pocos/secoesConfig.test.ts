import assert from 'assert';
import type { ConfigProcesso } from './obrasApi';
import { contarClausulas, faltasDaSecao, secaoDoPedido, temAlteracao } from './secoesConfig';
import { MODELO_CONTRATO_PADRAO } from './documentosPocos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('configuração: o que falta em cada seção', () => {
  assert.deepStrictEqual(faltasDaSecao('EMPRESA', { empresaNome: 'Mac Poços', empresaTelefone: '', logo: null, empresaDocumento: '1' }), ['telefone', 'logo']);
  assert.deepStrictEqual(faltasDaSecao('CONTRATO', { foroCidade: 'Atibaia', responsavelTecnico: null, empresaRepresentante: 'José' }), ['responsável técnico']);
  assert.deepStrictEqual(faltasDaSecao('HORARIO', {}), []);
});

teste('configuração: seção pedida e modelo', () => {
  assert.strictEqual(secaoDoPedido('CONFIG:CONTRATO'), 'CONTRATO');
  assert.strictEqual(secaoDoPedido('CONFIG'), 'EMPRESA');
  assert.strictEqual(secaoDoPedido('CONFIG:XYZ'), 'EMPRESA');
  assert.strictEqual(contarClausulas(MODELO_CONTRATO_PADRAO), 11, 'o contrato da empresa tem 11 cláusulas');
  const c = { empresaNome: 'A' } as ConfigProcesso;
  assert.strictEqual(temAlteracao(c, { ...c }, null), false);
  assert.strictEqual(temAlteracao(c, { ...c, empresaNome: 'B' }, null), true);
  assert.strictEqual(temAlteracao(c, c, 'data:image/png;base64,x'), true);
});
