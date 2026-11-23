import assert from 'assert';
import { agruparPorRaiz, cnpjValido, estabelecimentoCnpj, formatarCnpj, limparCnpj, raizCnpj } from './cnpj';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('cnpj: limpar, validar, formatar', () => {
  assert.strictEqual(limparCnpj('10.573.521/0001-91'), '10573521000191');
  assert.ok(cnpjValido('10.573.521/0001-91'));          // Mercado Pago
  assert.ok(cnpjValido('88613922000972'));              // IMDEPA filial 0009
  assert.ok(cnpjValido('88613922001782'));              // IMDEPA filial 0017
  assert.ok(!cnpjValido('88613922000973'));             // dígito errado
  assert.ok(!cnpjValido('11111111111111'));
  assert.ok(!cnpjValido('00000000000000'));             // compra avulsa não é CNPJ válido (o cadastro libera à parte)
  assert.ok(!cnpjValido('123'));
  assert.strictEqual(formatarCnpj('88613922000972'), '88.613.922/0009-72');
  assert.strictEqual(formatarCnpj('abc'), 'abc');
});

teste('cnpj: empresa e estabelecimento', () => {
  assert.strictEqual(raizCnpj('88.613.922/0009-72'), '88613922');
  assert.strictEqual(raizCnpj('00000000000000'), null);
  assert.strictEqual(estabelecimentoCnpj('10573521000191'), 'Matriz');
  assert.strictEqual(estabelecimentoCnpj('88613922001782'), 'Filial 0017');
  assert.strictEqual(estabelecimentoCnpj('00000000000000'), null);   // compra avulsa
  const g = agruparPorRaiz([
    { cnpj: '88613922000972', nome: 'IMDEPA ROLAMENTOS IMPORT. E COMERC. LTDA' },
    { cnpj: '88.613.922/0017-82', nome: 'IMDEPA ROLAMENTOS IMPORT.COMERC.LTDA' },
    { cnpj: '10573521000191', nome: 'Mercado Pago' },
    { cnpj: '00000000000000', nome: 'COMPRA AVULSA' },
    { cnpj: '00000000000000', nome: 'COMPRA AVULSA 2' },
  ]);
  assert.deepStrictEqual(g.map(x => [x.raiz, x.nome, x.estabelecimentos.length]), [['88613922', 'IMDEPA ROLAMENTOS IMPORT.COMERC.LTDA', 2]]);
});
