import assert from 'assert';
import { contarObras, dataBr, Obra } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: contagem por situação e data', () => {
  const o = (situacao: Obra['situacao']) => ({ situacao }) as Obra;
  assert.deepStrictEqual(contarObras([o('ORCAMENTO'), o('EM_EXECUCAO'), o('EM_EXECUCAO')]), { ORCAMENTO: 1, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 2, CONCLUIDA: 0, CANCELADA: 0 });
  assert.strictEqual(dataBr('2026-10-21'), '21/10/2026');
  assert.strictEqual(dataBr(null), '—');
});
