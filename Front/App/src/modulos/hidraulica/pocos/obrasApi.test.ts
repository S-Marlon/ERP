import assert from 'assert';
import { contarObras, csvDoRelatorio, dataBr, diasDoCompromisso, haQuanto, Obra, periodoRapido, totaisAReceber } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: contagem por situação e data', () => {
  const o = (situacao: Obra['situacao']) => ({ situacao }) as Obra;
  assert.deepStrictEqual(contarObras([o('ORCAMENTO'), o('EM_EXECUCAO'), o('EM_EXECUCAO')]), { ORCAMENTO: 1, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 2, CONCLUIDA: 0, CANCELADA: 0 });
  assert.strictEqual(dataBr('2026-10-21'), '21/10/2026');
  assert.strictEqual(dataBr(null), '—');
});

teste('obras de poços: dias de um compromisso da agenda', () => {
  assert.deepStrictEqual(diasDoCompromisso({ dataInicio: '2026-10-30', dataFim: '2026-11-02' }), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepStrictEqual(diasDoCompromisso({ dataInicio: '2026-10-26', dataFim: '2026-10-26' }), ['2026-10-26']);
});

teste('obras de poços: períodos rápidos do painel', () => {
  const hoje = new Date(2026, 0, 15);   // 15/01/2026
  assert.deepStrictEqual(periodoRapido('MES', hoje), { de: '2026-01-01', ate: '2026-01-15' });
  assert.deepStrictEqual(periodoRapido('MES_ANTERIOR', hoje), { de: '2025-12-01', ate: '2025-12-31' });
  assert.deepStrictEqual(periodoRapido('ANO', hoje), { de: '2026-01-01', ate: '2026-01-15' });
});

teste('obras de poços: há quanto tempo veio a leitura', () => {
  const agora = new Date('2026-10-22T10:00:00');
  assert.deepStrictEqual([haQuanto('2026-10-22 09:55:00', agora), haQuanto('2026-10-22 07:00:00', agora), haQuanto('2026-10-19 10:00:00', agora),
    haQuanto('2026-10-22 10:00:20', agora), haQuanto(null, agora)], ['há 5 min', 'há 3 h', 'há 3 dias', 'agora', 'nunca']);
});

teste('obras de poços: CSV do relatório do IoT', () => {
  const csv = csvDoRelatorio({ dias: [{ dia: '2026-10-22', leituras: 96, nivelEstaticoM: 18.5, nivelDinamicoM: 39, vazaoMediaLh: 2900, pressaoMediaBar: null,
    horasBomba: 6.25, volumeM3: 18.1, partidas: 4, energiaKwh: 12.3 }] });
  assert.strictEqual(csv.split('\r\n')[1], '2026-10-22;6,25;4;18,1;12,3;18,5;39;2900;;96');
});

teste('obras de poços: totais do a receber', () => {
  assert.deepStrictEqual(totaisAReceber([
    { situacao: 'VENCIDO', saldo: 100.1 }, { situacao: 'VENCIDO', saldo: 0.2 }, { situacao: 'SEM_PRAZO', saldo: 5000 }, { situacao: 'A_VENCER', saldo: 1 },
  ]), { VENCIDO: 100.3, VENCE_HOJE: 0, A_VENCER: 1, SEM_PRAZO: 5000, total: 5101.3 });
});
