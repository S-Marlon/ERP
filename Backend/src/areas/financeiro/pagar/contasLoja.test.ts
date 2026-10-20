import assert from 'assert';
import { validarContaAvulsa, validarContaFixa } from './contasLoja';
import { vencimentosMensais } from './recorrencia';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('contas da loja: parcelas mensais no mesmo dia', () => {
  assert.deepStrictEqual(vencimentosMensais('2026-12-31', 3), ['2026-12-31', '2027-01-31', '2027-02-28']);
  assert.deepStrictEqual(vencimentosMensais('2026-10-10', 1), ['2026-10-10']);
});

teste('contas da loja: conta avulsa', () => {
  const c = validarContaAvulsa({ descricao: ' Seguro da loja ', favorecido: 'Porto Seguro', vencimento: '2026-11-15', valor: '120.456', parcelas: 3, forma: 'pix' });
  assert.strictEqual(c.descricao, 'Seguro da loja');
  assert.strictEqual(c.forma, 'PIX');
  assert.deepStrictEqual(c.parcelas.map(p => [p.parcela, p.vencimento, p.valor]), [[1, '2026-11-15', 120.46], [2, '2026-12-15', 120.46], [3, '2027-01-15', 120.46]]);
  assert.strictEqual(c.idFornecedor, null);
  assert.throws(() => validarContaAvulsa({ descricao: 'Luz', vencimento: '2026-11-15', valor: 10 }), /quem recebe/);
  assert.throws(() => validarContaAvulsa({ descricao: 'Luz', favorecido: 'Copel', vencimento: '2026-02-30', valor: 10 }), /Vencimento/);
  assert.throws(() => validarContaAvulsa({ descricao: 'Luz', favorecido: 'Copel', vencimento: '2026-11-15', valor: 0 }), /valor/);
  assert.throws(() => validarContaAvulsa({ descricao: 'Luz', favorecido: 'Copel', vencimento: '2026-11-15', valor: 1, forma: 'CHEQUE' }), /Forma/);
  assert.strictEqual(validarContaAvulsa({ descricao: 'Luz', idFornecedor: 4, vencimento: '2026-11-15', valor: 1, forma: 'DEBITO_AUTOMATICO' }).forma, 'DEBITO_AUTOMATICO');
});

teste('contas da loja: conta fixa', () => {
  const f = validarContaFixa({ descricao: 'Aluguel', favorecido: 'Imobiliária X', valor: 2500, diaVencimento: 10, inicio: '2026-10-20', fim: '2027-09' });
  assert.deepStrictEqual([f.periodicidade, f.inicio, f.fim, f.valorVariavel], ['MENSAL', '2026-10-01', '2027-09-01', false]);
  assert.throws(() => validarContaFixa({ descricao: 'Luz', favorecido: 'Copel', valor: 300, diaVencimento: 32, inicio: '2026-10' }), /Dia/);
  assert.throws(() => validarContaFixa({ descricao: 'Luz', favorecido: 'Copel', valor: 300, diaVencimento: 5, inicio: '2026-10', fim: '2026-09' }), /antes/);
  assert.throws(() => validarContaFixa({ descricao: 'Luz', favorecido: 'Copel', valor: 300, diaVencimento: 5, inicio: '2026-10', periodicidade: 'QUINZENAL' }), /Periodicidade/);
  assert.throws(() => validarContaFixa({ descricao: 'Luz', favorecido: 'Copel', valor: 0, valorVariavel: true, diaVencimento: 5, inicio: '2026-10' }), /estimativa/);
});
