import assert from 'assert';
import { coberturaDias, conversao, numeros, periodos, somar, variacao, vendasNoPeriodo, visitasNoPeriodo } from './desempenho';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('desempenho: períodos até ontem, e o anterior do mesmo tamanho', () => {
  const p = periodos(new Date('2026-10-16T15:00:00Z'), 30);
  assert.deepStrictEqual(p.atual, { de: '2026-09-16', ate: '2026-10-15' });
  assert.deepStrictEqual(p.anterior, { de: '2026-08-17', ate: '2026-09-15' });
  const s = periodos(new Date('2026-10-09T08:00:00Z'), 8);
  assert.deepStrictEqual(s.atual, { de: '2026-10-01', ate: '2026-10-08' });   // "De 1/out a 8/out", como no painel
});

teste('desempenho: visitas por dia do ML (dados do 1460-PCT)', () => {
  const porDia = [
    { date: '2026-10-13T00:00:00Z', total: 1 }, { date: '2026-10-14T00:00:00Z', total: 1 },
    { date: '2026-10-15T00:00:00Z', total: 1 }, { date: '2026-09-10T00:00:00Z', total: 4 },
  ];
  const p = periodos(new Date('2026-10-16T12:00:00Z'));
  assert.strictEqual(visitasNoPeriodo(porDia, p.atual), 3);
  assert.strictEqual(visitasNoPeriodo(porDia, p.anterior), 4);
});

teste('desempenho: vendas só dos pedidos pagos, um pedido = uma venda', () => {
  const p = { de: '2026-10-01', ate: '2026-10-15' };
  const m = vendasNoPeriodo([
    { data: '2026-10-02 10:00:00', pago: true, itens: [{ mlbId: 'MLB1', quantidade: 2 }, { mlbId: 'MLB1', quantidade: 1 }, { mlbId: 'MLB2', quantidade: 1 }] },
    { data: '2026-10-05 10:00:00', pago: true, itens: [{ mlbId: 'MLB1', quantidade: 10 }] },
    { data: '2026-10-06 10:00:00', pago: false, itens: [{ mlbId: 'MLB1', quantidade: 5 }] },
    { data: '2026-09-20 10:00:00', pago: true, itens: [{ mlbId: 'MLB1', quantidade: 5 }] },
  ], p);
  assert.deepStrictEqual(m.get('MLB1'), { vendas: 2, unidades: 13 });
  assert.deepStrictEqual(m.get('MLB2'), { vendas: 1, unidades: 1 });
});

teste('desempenho: conversão, variação, soma e cobertura', () => {
  assert.strictEqual(conversao(12, 340), 3.5);
  assert.strictEqual(conversao(1, 0), null);
  assert.strictEqual(variacao(30, 40), -25);
  assert.strictEqual(variacao(3, 0), 'novo');
  assert.strictEqual(variacao(0, 0), null);
  const t = somar([numeros(300, { vendas: 9, unidades: 12 }), numeros(40, { vendas: 3, unidades: 3 })]);
  assert.deepStrictEqual(t, { visitas: 340, vendas: 12, unidades: 15, conversao: 3.5 });
  assert.strictEqual(coberturaDias(10, 30, 30), 10);   // 1 por dia, 10 no ML
  assert.strictEqual(coberturaDias(10, 0, 30), null);
  assert.strictEqual(coberturaDias(0, 5, 30), 0);
});
