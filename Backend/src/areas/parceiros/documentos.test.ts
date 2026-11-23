import assert from 'assert';
import {
  celular, cepDoCadastro, cepValido, cpfValido, documentoDaPessoa, formatarCep, formatarCpf, formatarTelefone, limparRg,
  limparTelefone, telefoneDoCadastro, telefoneValido, ufDoCadastro, ufValida,
} from './documentos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('cpf: validar e formatar', () => {
  assert.ok(cpfValido('529.982.247-25'));
  assert.ok(!cpfValido('529.982.247-24'));
  assert.ok(!cpfValido('111.111.111-11'));
  assert.ok(!cpfValido('5299822472'));
  assert.strictEqual(formatarCpf('52998224725'), '529.982.247-25');
});

teste('telefone: limpar, validar, formatar', () => {
  assert.strictEqual(limparTelefone('+55 (54) 99707-7069'), '54997077069');
  assert.strictEqual(limparTelefone('011 4411-2233'), '1144112233');
  assert.strictEqual(limparTelefone('0800 123 4567'), '08001234567');
  assert.ok(telefoneValido('(11) 98888-7777'));
  assert.ok(telefoneValido('1144112233'));
  assert.ok(telefoneValido('0800 123 4567'));
  assert.ok(!telefoneValido('98888-7777'));          // sem DDD
  assert.ok(!telefoneValido('(11) 88888-7777'));     // 11 números sem o 9
  assert.ok(celular('11988887777') && !celular('1144112233'));
  assert.strictEqual(formatarTelefone('11988887777'), '(11) 98888-7777');
  assert.strictEqual(formatarTelefone('(11)4411-2233'), '(11) 4411-2233');
  assert.strictEqual(formatarTelefone('08001234567'), '0800 123 4567');
  assert.strictEqual(formatarTelefone('123'), '123');
});

teste('cep, uf, rg', () => {
  assert.ok(cepValido('01310-100') && !cepValido('0131010') && !cepValido('00000-000'));
  assert.strictEqual(formatarCep('01310100'), '01310-100');
  assert.ok(ufValida('sp') && !ufValida('XX'));
  assert.strictEqual(limparRg('12.345.678-x'), '12345678X');
});

teste('cadastro manual: limpa e recusa o que está errado', () => {
  assert.strictEqual(documentoDaPessoa('PF', '529.982.247-25'), '52998224725');
  assert.strictEqual(documentoDaPessoa('PF', ''), null);
  assert.throws(() => documentoDaPessoa('PF', '123.456.789-00'), /CPF inválido/);
  assert.strictEqual(documentoDaPessoa('PJ', '10.573.521/0001-91'), '10573521000191');
  assert.throws(() => documentoDaPessoa('PJ', '00000000000000'), /CNPJ inválido/);
  assert.strictEqual(documentoDaPessoa('PJ', '00000000000000', { aceitaCompraAvulsa: true }), '00000000000000');
  assert.strictEqual(telefoneDoCadastro('(11) 98888-7777'), '11988887777');
  assert.strictEqual(telefoneDoCadastro('  '), null);
  assert.throws(() => telefoneDoCadastro('9888-7777'), /DDD/);
  assert.strictEqual(cepDoCadastro('01310-100'), '01310100');
  assert.strictEqual(cepDoCadastro(''), '');
  assert.throws(() => cepDoCadastro('0131'), /8 números/);
  assert.strictEqual(ufDoCadastro(' rs '), 'RS');
  assert.throws(() => ufDoCadastro('XX'), /não existe/);
});
