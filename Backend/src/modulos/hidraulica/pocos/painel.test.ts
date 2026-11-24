import assert from 'assert';
import { alertasDaObra, lucroDaObra, serieMensal } from './painel';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('painel de poços: lucro da obra', () => {
  assert.deepStrictEqual(lucroDaObra({ total: 20250, recebido: 5000, custoMateriais: 2869.25, materiaisConferidos: true, linhasMateriais: 3 }),
    { total: 20250, recebido: 5000, aReceber: 15250, custoMateriais: 2869.25, custoOutros: 0, custo: 2869.25, lucro: 17380.75, margem: 85.8, custoEstimado: false, semMateriais: false });
  const outros = lucroDaObra({ total: 10000, recebido: 0, custoMateriais: 2500, custoOutros: 1999.99, materiaisConferidos: true, linhasMateriais: 2 });
  assert.deepStrictEqual([outros.custo, outros.lucro, outros.margem], [4499.99, 5500.01, 55]);
  const est = lucroDaObra({ total: 10000, recebido: 0, custoMateriais: 2500, materiaisConferidos: false, linhasMateriais: 2 });
  assert.deepStrictEqual([est.lucro, est.margem, est.custoEstimado], [7500, 75, true]);
  const sem = lucroDaObra({ total: 0, recebido: 0, custoMateriais: 0, materiaisConferidos: false, linhasMateriais: 0 });
  assert.deepStrictEqual([sem.margem, sem.semMateriais, sem.custoEstimado], [null, true, false]);
  assert.strictEqual(lucroDaObra({ total: 1000, recebido: 0, custoMateriais: 1200, materiaisConferidos: true, linhasMateriais: 1 }).margem, -20);   // prejuízo
});

teste('painel de poços: alertas de obra', () => {
  const o = (x: object) => ({ idObra: 1, titulo: 'Obra 1', situacao: 'ORCAMENTO', criadaEm: '2026-10-01', dataPrevisao: null, dataInicio: null, semParcela: 0, aReceber: 0, ...x });
  const hoje = '2026-11-05';
  assert.deepStrictEqual(alertasDaObra(o({}), hoje).map(a => a.texto), ['Orçamento sem resposta há 35 dias.']);
  assert.deepStrictEqual(alertasDaObra(o({ criadaEm: '2026-10-20' }), hoje), []);
  assert.deepStrictEqual(alertasDaObra(o({ situacao: 'AGUARDANDO_SINAL', dataPrevisao: '2026-11-01' }), hoje).map(a => a.texto),
    ['Início previsto para 01/11 e a obra não começou (aguardando sinal).']);
  assert.deepStrictEqual(alertasDaObra(o({ situacao: 'EM_EXECUCAO', dataInicio: '2026-10-15' }), hoje).map(a => a.tipo), ['EXECUCAO_LONGA']);
  assert.deepStrictEqual(alertasDaObra(o({ situacao: 'EM_EXECUCAO', dataInicio: '2026-10-25' }), hoje), []);
  assert.deepStrictEqual(alertasDaObra(o({ situacao: 'CONCLUIDA', semParcela: 2250 }), hoje).map(a => a.texto), ['Concluída com R$ 2250,00 sem parcela lançada.']);
  assert.deepStrictEqual(alertasDaObra(o({ situacao: 'CANCELADA', dataPrevisao: '2026-10-01' }), hoje), []);
});

teste('painel de poços: série dos últimos meses', () => {
  const s = serieMensal('2026-02-10', 3, [{ mes: '2026-02', valor: 100.1 }, { mes: '2026-02', valor: 0.2 }, { mes: '2025-12', valor: 50 }, { mes: '2025-06', valor: 9 }],
    [{ mes: '2026-01', valor: 18000 }]);
  assert.deepStrictEqual(s, [
    { chave: '2025-12', rotulo: 'dez/25', recebido: 50, faturado: 0 },
    { chave: '2026-01', rotulo: 'jan/26', recebido: 0, faturado: 18000 },
    { chave: '2026-02', rotulo: 'fev/26', recebido: 100.3, faturado: 0 },
  ]);
});
