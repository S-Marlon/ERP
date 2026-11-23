import assert from 'assert';
import { estimarCusto, incluirPelosServicos, kmAteOPoco, trechosIniciais } from './custoObra';

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
