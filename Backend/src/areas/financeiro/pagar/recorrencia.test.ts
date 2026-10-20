import assert from 'assert';
import { competenciasNoPeriodo, titulosQueFaltam, vencimentoNaCompetencia } from './recorrencia';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('recorrência: vencimento no mês (dia 31 em mês curto)', () => {
  assert.strictEqual(vencimentoNaCompetencia('2026-10-01', 10), '2026-10-10');
  assert.strictEqual(vencimentoNaCompetencia('2026-02-01', 31), '2026-02-28');
  assert.strictEqual(vencimentoNaCompetencia('2028-02-01', 30), '2028-02-29');
  assert.strictEqual(vencimentoNaCompetencia('2026-04-01', 31), '2026-04-30');
});

teste('recorrência: competências por periodicidade', () => {
  const mensal = { inicio: '2026-09-15', fim: null, periodicidade: 'MENSAL' as const, diaVencimento: 10 };
  assert.deepStrictEqual(competenciasNoPeriodo(mensal, '2026-10-20', '2027-01-01'), ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']);
  // anual contado do início: seguro de março vence todo março
  const anual = { ...mensal, inicio: '2026-03-01', periodicidade: 'ANUAL' as const };
  assert.deepStrictEqual(competenciasNoPeriodo(anual, '2026-10-01', '2028-12-01'), ['2027-03-01', '2028-03-01']);
  const bimestral = { ...mensal, inicio: '2026-01-01', periodicidade: 'BIMESTRAL' as const };
  assert.deepStrictEqual(competenciasNoPeriodo(bimestral, '2026-10-01', '2027-02-01'), ['2026-11-01', '2027-01-01']);
  // contrato com fim
  assert.deepStrictEqual(competenciasNoPeriodo({ ...mensal, fim: '2026-11-01' }, '2026-10-01', '2027-06-01'), ['2026-10-01', '2026-11-01']);
  // começa no futuro
  assert.deepStrictEqual(competenciasNoPeriodo({ ...mensal, inicio: '2026-12-01' }, '2026-10-01', '2027-01-01'), ['2026-12-01', '2027-01-01']);
});

teste('recorrência: só o que falta lançar, do mês atual ao horizonte', () => {
  const luz = { inicio: '2026-01-01', fim: null, periodicidade: 'MENSAL' as const, diaVencimento: 31 };
  assert.deepStrictEqual(titulosQueFaltam(luz, { hoje: '2026-10-20', horizonteMeses: 2, existentes: ['2026-10-01'] }), [
    { competencia: '2026-11-01', vencimento: '2026-11-30' }, { competencia: '2026-12-01', vencimento: '2026-12-31' },
  ]);
});
