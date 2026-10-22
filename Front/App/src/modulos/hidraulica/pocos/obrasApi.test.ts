import assert from 'assert';
import { contarObras, dataBr, Obra, totaisAReceber } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: contagem por situação e data', () => {
  const o = (situacao: Obra['situacao']) => ({ situacao }) as Obra;
  assert.deepStrictEqual(contarObras([o('ORCAMENTO'), o('EM_EXECUCAO'), o('EM_EXECUCAO')]), { ORCAMENTO: 1, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 2, CONCLUIDA: 0, CANCELADA: 0 });
  assert.strictEqual(dataBr('2026-10-21'), '21/10/2026');
  assert.strictEqual(dataBr(null), '—');
});

teste('obras de poços: totais do a receber', () => {
  assert.deepStrictEqual(totaisAReceber([
    { situacao: 'VENCIDO', saldo: 100.1 }, { situacao: 'VENCIDO', saldo: 0.2 }, { situacao: 'SEM_PRAZO', saldo: 5000 }, { situacao: 'A_VENCER', saldo: 1 },
  ]), { VENCIDO: 100.3, VENCE_HOJE: 0, A_VENCER: 1, SEM_PRAZO: 5000, total: 5101.3 });
});
