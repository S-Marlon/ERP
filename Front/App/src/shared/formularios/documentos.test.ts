import assert from 'assert';
import {
  aplicarMascara, cepValido, cnpjValido, cpfValido, formatarCep, formatarDocumento, formatarTelefone, limparRg, limparTelefone,
  mascaraCep, mascaraCnpj, mascaraCpf, mascaraCpfCnpj, mascaraTelefone, regraCnpj, regraCpf, regraTelefone, telefoneValido,
} from './documentos';

const teste = async (nome: string, fn: () => void | Promise<void>) => { await fn(); console.log(`${nome}: ok`); };

(async () => {
  await teste('máscara progressiva', () => {
    assert.strictEqual(aplicarMascara('52998', '###.###.###-##'), '529.98');
    assert.strictEqual(aplicarMascara('', '###.###'), '');
    assert.strictEqual(mascaraCpf('52998224725'), '529.982.247-25');
    assert.strictEqual(mascaraCnpj('105735210001'), '10.573.521/0001');
    assert.strictEqual(mascaraCpfCnpj('529982247251'), '52.998.224/7251');   // passou de 11: CNPJ
    assert.strictEqual(mascaraCep('013101'), '01310-1');
  });

  await teste('cpf e cnpj', () => {
    assert.ok(cpfValido('529.982.247-25') && !cpfValido('529.982.247-24') && !cpfValido('11111111111'));
    assert.ok(cnpjValido('10.573.521/0001-91') && !cnpjValido('10573521000192') && !cnpjValido('00000000000000'));
    assert.strictEqual(formatarDocumento('52998224725'), '529.982.247-25');
    assert.strictEqual(formatarDocumento('10573521000191'), '10.573.521/0001-91');
    assert.strictEqual(formatarDocumento('123'), '123');
  });

  await teste('telefone', () => {
    assert.strictEqual(mascaraTelefone('1198888'), '(11) 9888-8');
    assert.strictEqual(mascaraTelefone('1144112233'), '(11) 4411-2233');
    assert.strictEqual(mascaraTelefone('11988887777'), '(11) 98888-7777');
    assert.strictEqual(mascaraTelefone('08001234567'), '0800 123 4567');
    assert.strictEqual(limparTelefone('+55 (54) 99707-7069'), '54997077069');
    assert.ok(telefoneValido('(11) 98888-7777') && telefoneValido('1144112233') && !telefoneValido('98888-7777') && !telefoneValido('11888887777'));
    assert.strictEqual(formatarTelefone('(11)4411-2233'), '(11) 4411-2233');
    assert.strictEqual(formatarTelefone('5511988887777'), '(11) 98888-7777');
    assert.strictEqual(formatarTelefone('ramal 12'), 'ramal 12');
  });

  await teste('cep e rg', () => {
    assert.ok(cepValido('01310-100') && !cepValido('0131010'));
    assert.strictEqual(formatarCep('01310100'), '01310-100');
    assert.strictEqual(limparRg('12.345.678-x'), '12345678X');
  });

  await teste('regras do formulário', async () => {
    await regraCpf.validator(null, '');                      // vazio passa (obrigatório é outra regra)
    await regraCpf.validator(null, '52998224725');
    await assert.rejects(regraCpf.validator(null, '52998224724'), /CPF inválido/);
    await regraCnpj({ aceitaCompraAvulsa: true }).validator(null, '00000000000000');
    await assert.rejects(regraCnpj().validator(null, '00000000000000'), /CNPJ inválido/);
    await assert.rejects(regraTelefone.validator(null, '988887777'), /DDD/);
  });
})();
