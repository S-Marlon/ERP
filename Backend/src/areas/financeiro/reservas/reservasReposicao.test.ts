import assert from 'assert';
import { extratoComSaldo, resumoDoFundo, validarAjuste, validarFundo } from './reservasReposicao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('fundo: validação', () => {
  assert.deepStrictEqual(validarFundo({ nome: ' Fios ', saldoInicial: '1500', dataInicio: '2026-11-01' }),
    { nome: 'Fios', percentualCusto: 1, saldoInicial: 1500, dataInicio: '2026-11-01', ativo: 1 });
  assert.strictEqual(validarFundo({ nome: 'Bombas', percentualCusto: 1.1, dataInicio: '2026-11-01' }).percentualCusto, 1.1);
  assert.throws(() => validarFundo({ nome: '', dataInicio: '2026-11-01' }), /nome/);
  assert.throws(() => validarFundo({ nome: 'X', percentualCusto: 0, dataInicio: '2026-11-01' }), /Percentual/);
  assert.throws(() => validarFundo({ nome: 'X' }), /data/);
  assert.throws(() => validarAjuste({ valor: 0, motivo: 'x', data: '2026-11-01' }), /valor/);
  assert.deepStrictEqual(validarAjuste({ valor: '-200.5', motivo: 'usei no aluguel', data: '2026-11-10' }), { valor: -200.5, motivo: 'usei no aluguel', data: '2026-11-10' });
});

teste('fundo: extrato com saldo e compra acima do saldo', () => {
  const ex = extratoComSaldo([
    { data: '2026-11-05', tipo: 'COMPRA', descricao: 'NF 10', valor: -900 },
    { data: '2026-11-01', tipo: 'INICIAL', descricao: 'Saldo inicial', valor: 500 },
    { data: '2026-11-03', tipo: 'VENDA', descricao: 'Vendas do dia', valor: 300.1 },
    { data: '2026-11-03', tipo: 'DEVOLUCAO', descricao: 'Devolução', valor: -50 },
    { data: '2026-11-05', tipo: 'VENDA', descricao: 'Vendas do dia', valor: 200 },
    { data: '2026-11-08', tipo: 'AJUSTE', descricao: 'Transferi para a reserva', valor: 100 },
  ]);
  assert.deepStrictEqual(ex.map(m => [m.tipo, m.saldo, m.compraAcimaDoSaldo]), [
    ['INICIAL', 500, false], ['VENDA', 800.1, false], ['DEVOLUCAO', 750.1, false], ['VENDA', 950.1, false], ['COMPRA', 50.1, false], ['AJUSTE', 150.1, false],
  ]);
  const ex2 = extratoComSaldo([{ data: '2026-11-01', tipo: 'VENDA', descricao: '', valor: 100 }, { data: '2026-11-02', tipo: 'COMPRA', descricao: 'NF 11', valor: -300 }]);
  assert.strictEqual(ex2[1].compraAcimaDoSaldo, true);
  const r = resumoDoFundo(ex, 600, '2026-11');
  assert.deepStrictEqual(r, { saldo: 150.1, entradas: 450.1, compras: 900, ajustes: 600, entradasMes: 450.1, comprasMes: 900, estoque: 600, cobertura: 0.2502, comprasAcimaDoSaldo: 0 });
  assert.strictEqual(resumoDoFundo([], 0, '2026-11').cobertura, null);
});
