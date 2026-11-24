import assert from 'assert';
import { compararEstimadoReal, faltaDaEstimativa, estimarCusto, incluirPelosServicos, kmAteOPoco, trechosIniciais } from './custoObra';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const formacoes = [{ formacao: 'Argila', custoMetro: 15, rendimentoMH: 5 }, { formacao: 'Rocha sã', custoMetro: 60, rendimentoMH: 1.5 }];
const par = { horasMobilizacao: 4, horasRevestimento100m: 3, horasLimpeza: 4, horasInstalacaoBomba: 4, horasPorDia: 8, custoDia: 60 };
const emp = { custoHoraEquipe: 80, custoKm: 1.5, impostosPct: 0.06, taxaCobrancaPct: 0.03, inadimplenciaPct: 0.03, margemPct: 0.25, margemMinimaPct: 0.1, arredondarPara: 50 };

teste('custo da obra: perfuração por formação, horas, dias e deslocamento', () => {
  const e = estimarCusto({
    trechos: [{ formacao: 'Argila', metros: 30 }, { formacao: 'Rocha sã', metros: 90 }],
    incluir: { perfuracao: true, revestimento: true, limpeza: true, bomba: true },
    materiais: 2000, outrosMateriais: 100, bombaCusto: 2250, km: 60, preco: 20000,
  }, formacoes, par, emp);
  assert.strictEqual(e.custoPerfuracao, 30 * 15 + 90 * 60);                 // 5850
  assert.deepStrictEqual(e.horas, { perfuracao: 6 + 60, mobilizacao: 4, revestimento: 3.6, limpeza: 4, bomba: 4 });
  assert.strictEqual(e.horasTotal, 81.6);
  assert.strictEqual(e.dias, 11);                                            // 81,6 h ÷ 8 h
  assert.strictEqual(e.equipe, 6528);                                        // 81,6 × 80
  assert.strictEqual(e.deslocamento, 990);                                   // 60 km × 11 dias × 1,5
  assert.strictEqual(e.despesasDia, 660);
  assert.strictEqual(e.custo, 5850 + 2100 + 2250 + 6528 + 990 + 660);        // 18378
  assert.strictEqual(e.precoMinimo, 23600);                                  // 18378 ÷ 0,78 = 23561,5 → de 50 em 50
});

teste('custo da obra: preço mínimo, sugerido e margem do contratado', () => {
  const e = estimarCusto({ trechos: [{ formacao: 'Argila', metros: 100 }], incluir: { perfuracao: true, revestimento: false, limpeza: false, bomba: false },
    materiais: 0, outrosMateriais: 0, bombaCusto: 0, km: 0, preco: 3000 }, formacoes, { ...par, horasMobilizacao: 0 }, emp);
  // 100 m de argila: 1500 + 20 h × 80 + 3 dias × 60 = 3280
  assert.strictEqual(e.custo, 3280);
  assert.strictEqual(e.precoMinimo, Math.ceil(3280 / 0.78 / 50) * 50);      // deduções 12% + margem mínima 10%
  assert.strictEqual(e.precoSugerido, Math.ceil(3280 / 0.63 / 50) * 50);    // + margem desejada 25%
  assert.strictEqual(e.lucro, 3000 * 0.88 - 3280);
  assert.strictEqual(e.situacao, 'PREJUIZO');
  const ok = estimarCusto({ trechos: [{ formacao: 'Argila', metros: 100 }], incluir: { perfuracao: true, revestimento: false, limpeza: false, bomba: false },
    materiais: 0, outrosMateriais: 0, bombaCusto: 0, km: 0, preco: 6000 }, formacoes, { ...par, horasMobilizacao: 0 }, emp);
  assert.strictEqual(ok.situacao, 'OK');
  assert.strictEqual(ok.margem, Math.round(((6000 * 0.88 - 3280) / 6000) * 1000) / 1000);
});

teste('custo da obra: alertas e partida', () => {
  const e = estimarCusto({ trechos: [{ formacao: 'Rocha alterada', metros: 50 }], incluir: { perfuracao: true, revestimento: false, limpeza: false, bomba: true },
    materiais: 0, outrosMateriais: 0, bombaCusto: 0, km: 0, preco: 0 }, formacoes, par, emp);
  assert.ok(e.alertas.some(a => a.includes('Rocha alterada')) && e.alertas.some(a => a.startsWith('Bomba sem custo')));
  assert.strictEqual(e.situacao, 'SEM_PRECO');
  assert.deepStrictEqual(incluirPelosServicos(['INSTALACAO']), { perfuracao: false, revestimento: false, limpeza: false, bomba: true });
  assert.deepStrictEqual(trechosIniciais({ perfilGeologico: [{ geoDe: 0, geoAte: 30, geoTipo: 'Argila' }, { geoDe: 30, geoAte: 31, geoTipo: 'Fratura com água' }, { geoDe: 31, geoAte: 120, geoTipo: 'Rocha sã' }] }, 120, 'Argila'),
    [{ formacao: 'Argila', metros: 30 }, { formacao: 'Rocha sã', metros: 89 }]);
  assert.deepStrictEqual(trechosIniciais(null, 100, 'Argila'), [{ formacao: 'Argila', metros: 100 }]);
});

teste('custo da obra: km até o poço', () => {
  const base = { baseLatitude: -23.1, baseLongitude: -46.55, fatorEstrada: 1.3 };
  const km = kmAteOPoco(base, -23.0566517, -46.6253881)!;
  assert.ok(km > 20 && km < 30, String(km));                 // ~8,9 km em linha reta × 1,3 × 2
  assert.strictEqual(kmAteOPoco({ ...base, baseLatitude: null }, -23, -46), null);
  assert.strictEqual(kmAteOPoco(base, null, null), null);
});

teste('custo da obra: estimado × real', () => {
  const est = { custoPerfuracao: 2000, materiais: 3000, bomba: 1500, equipe: 1200, deslocamento: 300, despesasDia: 200, custo: 8200, deducoesPct: 0.1, margem: 0.2, horasTotal: 24 };
  const c = compararEstimadoReal(est, {
    materiais: 3300, bomba: 1500,
    lancamentos: [
      { tipo: 'COMBUSTIVEL', valor: 1500, quantidade: null }, { tipo: 'DESGASTE', valor: 700, quantidade: null },
      { tipo: 'EQUIPE', valor: 1600, quantidade: 32 }, { tipo: 'KM', valor: 300, quantidade: 250 }, { tipo: 'TERCEIRO', valor: 400, quantidade: null },
    ],
  }, 12000, 0.2);
  assert.deepStrictEqual(c.linhas.map(l => [l.grupo, l.estimado, l.real, l.diferenca, l.diferencaPct]), [
    ['PERFURACAO', 2000, 2200, 200, 10], ['MATERIAIS', 3000, 3300, 300, 10], ['BOMBA', 1500, 1500, 0, 0], ['EQUIPE', 1200, 1600, 400, 33.3],
    ['DESLOCAMENTO', 300, 300, 0, 0], ['DESPESAS', 200, 0, -200, -100], ['OUTROS', 0, 400, 400, null],
  ]);
  // custo real 9300; deduções da estimativa (10%): 12000 × 0,9 − 9300 = 1500 → 12,5%
  assert.deepStrictEqual([c.custoReal, c.custoEstimado, c.diferenca, c.lucroReal, c.margemReal, c.margemEstimada, c.horasReais, c.horasEstimadas, c.kmReais],
    [9300, 8200, 1100, 1500, 0.125, 0.2, 32, 24, 250]);
  // sem estimativa: só o real, com as deduções da empresa
  const s = compararEstimadoReal(null, { materiais: 1000, bomba: 0, lancamentos: [] }, 2000, 0.2);
  assert.deepStrictEqual([s.linhas.length, s.linhas[0].estimado, s.custoEstimado, s.lucroReal, s.margemReal, s.margemEstimada], [1, null, null, 600, 0.3, null]);
});

teste('custo da obra: o que falta lançar pela estimativa', () => {
  assert.deepStrictEqual(faltaDaEstimativa({ horasTotal: 24.5, dias: 3 }, { km: 42 }, []), { horas: 24.5, km: 126 });
  assert.deepStrictEqual(faltaDaEstimativa({ horasTotal: 24.5, dias: 3 }, { km: 42 }, [{ tipo: 'EQUIPE', quantidade: 10 }, { tipo: 'KM', quantidade: 130 }, { tipo: 'DESPESA', quantidade: null }]),
    { horas: 14.5, km: 0 });
  assert.deepStrictEqual(faltaDaEstimativa(null, null, []), { horas: null, km: null });
});
