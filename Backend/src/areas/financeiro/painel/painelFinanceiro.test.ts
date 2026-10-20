import assert from 'assert';
import { atrasosPorFaixa, inicioDoPeriodo, montarFluxo, rotuloMes, ultimosMeses } from './painelFinanceiro';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('painel financeiro: período da semana começa na segunda', () => {
  assert.strictEqual(inicioDoPeriodo('2026-10-20', 'semana'), '2026-10-19');   // terça -> segunda
  assert.strictEqual(inicioDoPeriodo('2026-10-25', 'semana'), '2026-10-19');   // domingo -> segunda anterior
  assert.strictEqual(inicioDoPeriodo('2026-10-19', 'semana'), '2026-10-19');
  assert.strictEqual(inicioDoPeriodo('2026-10-20', 'dia'), '2026-10-20');
});

teste('painel financeiro: fluxo por dia com acumulado', () => {
  const f = montarFluxo([
    { data: '2026-10-20', valor: 100, tipo: 'ENTRADA' },
    { data: '2026-10-21', valor: 250.1, tipo: 'SAIDA' },
    { data: '2026-10-21', valor: 50, tipo: 'ENTRADA' },
    { data: '2026-10-19', valor: 999, tipo: 'SAIDA' },      // vencido: fica nos atrasados
    { data: '2026-10-30', valor: 999, tipo: 'SAIDA' },      // depois do período
  ], { hoje: '2026-10-20', dias: 3, agrupamento: 'dia' });
  assert.deepStrictEqual(f.map(p => [p.chave, p.entradas, p.saidas, p.saldo, p.acumulado]), [
    ['2026-10-20', 100, 0, 100, 100], ['2026-10-21', 50, 250.1, -200.1, -100.1], ['2026-10-22', 0, 0, 0, -100.1],
  ]);
  assert.strictEqual(f[0].rotulo, 'ter 20/10');
});

teste('painel financeiro: fluxo por semana (a primeira começa hoje)', () => {
  const f = montarFluxo([
    { data: '2026-10-25', valor: 10, tipo: 'SAIDA' },        // domingo: semana de 19/10
    { data: '2026-10-26', valor: 30, tipo: 'ENTRADA' },
  ], { hoje: '2026-10-20', dias: 14, agrupamento: 'semana' });
  assert.deepStrictEqual(f.map(p => [p.de, p.ate, p.saldo, p.acumulado]), [
    ['2026-10-20', '2026-10-25', -10, -10], ['2026-10-26', '2026-11-01', 30, 20], ['2026-11-02', '2026-11-02', 0, 20],
  ]);
  assert.strictEqual(f[0].rotulo, '20/10 a 25/10');
});

teste('painel financeiro: atrasados por faixa', () => {
  const a = atrasosPorFaixa([
    { vencimento: '2026-10-19', valor: 10 },     // 1 dia
    { vencimento: '2026-10-05', valor: 20 },     // 15 dias
    { vencimento: '2026-10-04', valor: 30 },     // 16 dias
    { vencimento: '2026-08-01', valor: 40 },     // 80 dias
    { vencimento: '2026-10-20', valor: 99 },     // vence hoje: não é atraso
  ], '2026-10-20');
  assert.deepStrictEqual(a.map(f => [f.valor, f.qtd]), [[30, 2], [30, 1], [0, 0], [40, 1]]);
});

teste('painel financeiro: meses do realizado', () => {
  assert.deepStrictEqual(ultimosMeses('2026-02-15', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.strictEqual(rotuloMes('2026-10'), 'out/26');
});
