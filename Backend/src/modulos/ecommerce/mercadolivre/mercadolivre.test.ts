import assert from 'assert';
import { extrairCodigo, lerConfigML, mensagemErroML, montarUrlAutorizacao, precisaRenovar } from './mercadolivre';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('configuração do .env', () => {
  assert.deepStrictEqual(lerConfigML({}).faltando, ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_REDIRECT_URI']);
  const c = lerConfigML({ ML_CLIENT_ID: ' 123 ', ML_CLIENT_SECRET: 'abc', ML_REDIRECT_URI: 'https://www.google.com.br/' });
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.clientId, '123');
});

teste('url de autorização', () => {
  const u = montarUrlAutorizacao({ clientId: '123', redirectUri: 'https://www.google.com.br/' }, 'xyz');
  assert.strictEqual(u, 'https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=123&redirect_uri=https%3A%2F%2Fwww.google.com.br%2F&state=xyz');
});

teste('código colado: endereço inteiro ou só o código', () => {
  assert.deepStrictEqual(extrairCodigo('https://www.google.com.br/?code=TG-6512abc-123456&state=xyz'), { codigo: 'TG-6512abc-123456', state: 'xyz' });
  assert.deepStrictEqual(extrairCodigo('  TG-6512abc-123456 '), { codigo: 'TG-6512abc-123456', state: null });
  assert.strictEqual(extrairCodigo('https://www.google.com.br/'), null);
  assert.strictEqual(extrairCodigo(''), null);
});

teste('renovação do token antes de vencer', () => {
  const agora = new Date('2026-10-13T12:00:00Z');
  assert.strictEqual(precisaRenovar(new Date('2026-10-13T12:05:00Z'), agora), true);
  assert.strictEqual(precisaRenovar(new Date('2026-10-13T17:00:00Z'), agora), false);
});

teste('mensagem de erro do ML', () => {
  assert.strictEqual(mensagemErroML({ message: 'Validation error', cause: [{ message: 'title is too long' }] }, 400), 'Validation error: title is too long');
  assert.strictEqual(mensagemErroML({ error: 'invalid_grant', error_description: 'code expired' }, 400), 'code expired');
  assert.strictEqual(mensagemErroML(null, 500), 'HTTP 500');
});
