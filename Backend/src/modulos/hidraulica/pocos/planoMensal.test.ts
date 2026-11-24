import assert from 'assert';
import { CUSTOS_PADRAO, custoVisita, riscoDoPlano, divisor, kmAteOPoco, kmDaVisita, NivelPlano, planoSugerido, precoDoPlano, validarCustos, validarNivel } from './planoMensal';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const nivel = (x: Partial<NivelPlano>): NivelPlano => ({
  nome: 'X', descricao: null, visitasAno: 1, limpezaACadaMeses: null, chamadosAno: 0, descontoPecasPct: 0, descontoLimpezaPct: 0, prioridade: false, monitoramento: false,
  reservaBombaPct: 0, fidelidadeMeses: 12, ordem: 0, ativo: true, ...x,
});
const poco = { profundidadeM: 80, potenciaCv: 1.5, pocos: 1 };

teste('plano mensal: custo da visita', () => {
  // (3 h + 1,5 h × 0,8) × R$ 80 + R$ 50 de material + 60 km × R$ 1,50 = 336 + 50 + 90
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 80), 476);
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 200), 620, 'poço fundo: 6 h de equipe');
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 80, 2), 862, 'dois poços: equipe e material dobram, o deslocamento não');
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, null), 476, 'sem profundidade usa 80 m');
  assert.strictEqual(divisor(CUSTOS_PADRAO), 0.63);
});

teste('plano mensal: preço, lucro e economia do cliente', () => {
  // 476/ano ÷ 12 = 39,67 ÷ 0,63 = 62,96 → R$ 65; líquido 65 × 0,88 = 57,20 − 39,67 = 17,53 de lucro (27%)
  const p = precoDoPlano({ ...CUSTOS_PADRAO, precoVisitaAvulsa: 900 }, nivel({}), poco);
  assert.deepStrictEqual([p.precoMensal, p.custoMensal, p.lucroMensal, p.margemReal], [65, 39.67, 17.53, 0.2697]);
  assert.deepStrictEqual([p.avulsoAnual, p.economiaAnual, p.viavel], [900, 120, true]);
  // visita avulsa barata: o cliente pagaria menos avulso, o plano não se vende
  const caro = precoDoPlano({ ...CUSTOS_PADRAO, precoVisitaAvulsa: 600 }, nivel({}), poco);
  assert.strictEqual(caro.viavel, false);
  assert.ok(caro.avisos[0].includes('avulso'));
  // sem preço avulso nem média: compara pelo custo com margem e não reprova por isso
  const est = precoDoPlano(CUSTOS_PADRAO, nivel({}), poco);
  assert.deepStrictEqual([est.comparacaoEstimada, est.viavel], [true, true]);
  // a média das manutenções da empresa vale como preço avulso
  assert.strictEqual(precoDoPlano(CUSTOS_PADRAO, nivel({}), poco, 900).avulsoAnual, 900);
});

teste('plano mensal: o que cada item custa', () => {
  const p = precoDoPlano(CUSTOS_PADRAO, nivel({ visitasAno: 2, limpezaACadaMeses: 24, chamadosAno: 1, monitoramento: true, reservaBombaPct: 0.5 }), poco);
  // emergência pelo uso esperado (30% de 476); monitoramento: (25 + 900/36) × 12; bomba: 0,5 × 1,5 × 1500 ÷ 6
  assert.deepStrictEqual(p.custos.map(c => c.anual), [952, 400, 142.8, 600, 187.5]);
  assert.strictEqual(p.custoMensal, 190.19);
  assert.strictEqual(p.precoMensal, 300);
  // margem mínima: 30% de margem com arredondamento para baixo não fecha
  const apertado = precoDoPlano({ ...CUSTOS_PADRAO, margemPct: 0.1, margemMinimaPct: 0.1, arredondarPara: 50 }, nivel({}), poco);
  assert.strictEqual(apertado.precoMensal, 50);
  assert.strictEqual(apertado.viavel, false);
});

teste('plano mensal: sugestão e validação', () => {
  const lista = [
    { nome: 'A', preco: { viavel: true, economiaAnual: 100, precoMensal: 60 } },
    { nome: 'B', preco: { viavel: true, economiaAnual: 300, precoMensal: 150 } },
    { nome: 'C', preco: { viavel: false, economiaAnual: 900, precoMensal: 20 } },
  ] as any[];
  assert.strictEqual(planoSugerido(lista)!.nome, 'B');
  assert.strictEqual(planoSugerido([lista[2]]), null);
  assert.throws(() => validarCustos({ ...CUSTOS_PADRAO, margemPct: 0.85 }), /95%/);
  assert.throws(() => validarCustos({ ...CUSTOS_PADRAO, margemMinimaPct: 0.3 }), /mínima/);
  assert.throws(() => validarCustos({ ...CUSTOS_PADRAO, kmMedio: '' }), /Km/);
  assert.strictEqual(validarCustos({ ...CUSTOS_PADRAO, precoVisitaAvulsa: '' }).precoVisitaAvulsa, null);
  assert.throws(() => validarNivel({ nome: '' }), /nome/);
  assert.throws(() => validarNivel({ nome: 'Nada', visitasAno: 0 }), /incluir/);
  assert.strictEqual(validarNivel({ nome: ' Completo ', visitasAno: 2, limpezaACadaMeses: 0 }).limpezaACadaMeses, null);
});

teste('plano mensal: transporte pela distância até o poço', () => {
  const base = { ...CUSTOS_PADRAO, baseLatitude: -23.1, baseLongitude: -46.5 };
  // 0,1° de latitude ≈ 11,1 km em linha reta × 1,3 da estrada × 2 = 29 km
  assert.strictEqual(kmAteOPoco(base, -23.2, -46.5), 29);
  assert.strictEqual(kmAteOPoco(CUSTOS_PADRAO, -23.2, -46.5), null, 'sem base');
  assert.strictEqual(kmAteOPoco(base, null, null), null, 'poço sem GPS');
  assert.deepStrictEqual(kmDaVisita(base, { latitude: -23.2, longitude: -46.5 }), { km: 29, origem: 'GPS' });
  assert.deepStrictEqual(kmDaVisita(base, { latitude: -23.2, longitude: -46.5, kmIdaVolta: 100 }), { km: 100, origem: 'INFORMADO' });
  assert.deepStrictEqual(kmDaVisita(base, {}), { km: 60, origem: 'MEDIA' });
  // cliente perto: a visita sai 31 km × R$ 1,50 mais barata
  const perto = precoDoPlano(base, nivel({}), { ...poco, latitude: -23.2, longitude: -46.5 });
  assert.deepStrictEqual([perto.km, perto.kmOrigem, perto.custoMensal], [29, 'GPS', 35.79]);
  const c = validarCustos({ ...CUSTOS_PADRAO, baseGps: '-23.1171, -46.5565' });
  assert.deepStrictEqual([c.baseLatitude, c.baseLongitude], [-23.1171, -46.5565]);
  assert.strictEqual(validarCustos({ ...CUSTOS_PADRAO, baseGps: '' }).baseLatitude, null);
  assert.throws(() => validarCustos({ ...CUSTOS_PADRAO, baseGps: 'perto da praça' }), /Base da empresa/);
});

teste('plano mensal: risco, faixa de lucro e raio da distância', () => {
  // 1 visita/ano a 80 m, km médio 60 (sem GPS), preço R$ 65: líquido 65 × 0,88 = 57,20
  const r = riscoDoPlano(CUSTOS_PADRAO, nivel({}), poco, 65);
  assert.deepStrictEqual([r.esperado.custoMensal, r.esperado.lucroMensal, r.esperado.margem], [39.67, 17.53, 0.2697]);
  // otimista: km −40% (36 km), sem inadimplência: 440/12 = 36,67; 65 × 0,91 = 59,15 → 22,48
  assert.strictEqual(r.otimista.lucroMensal, 22.48);
  // pessimista: km +40% (84 km), visita 25% mais longa (5,25 h), inadimplência 6%: 596/12 = 49,67; 65 × 0,85 = 55,25 → 5,58
  assert.strictEqual(r.pessimista.lucroMensal, 5.58);
  // R$ 0,125 por km/mês: lucro zera em 200 km e a margem mínima (R$ 6,50) vai até 148 km
  assert.deepStrictEqual([r.kmEquilibrio, r.kmMargemMinima, r.nivel, r.precisao], [200, 148, 'BAIXO', 'BAIXA']);
  assert.ok(r.estimados[0].startsWith('distância pelo km médio'));
  // longe (180 km informados): margem esperada de 3,9% → risco alto, com o motivo da distância
  const longe = riscoDoPlano(CUSTOS_PADRAO, nivel({}), { ...poco, kmIdaVolta: 180 }, 65);
  assert.deepStrictEqual([longe.esperado.lucroMensal, longe.nivel, longe.precisao], [2.53, 'ALTO', 'BOA']);
  assert.ok(longe.fatores.some(f => f.startsWith('Longe: 180 km')), JSON.stringify(longe.fatores));
  // emergências incluídas: o pessimista conta todas usadas; se ficar negativo, risco médio
  const comEmerg = { ...poco, kmIdaVolta: 60 };
  const emerg = riscoDoPlano(CUSTOS_PADRAO, nivel({ chamadosAno: 2 }), comEmerg, precoDoPlano(CUSTOS_PADRAO, nivel({ chamadosAno: 2 }), comEmerg).precoMensal);
  assert.ok(emerg.pessimista.lucroMensal < 0 && emerg.esperado.lucroMensal > 0 && emerg.nivel === 'MEDIO', JSON.stringify(emerg));
  assert.ok(emerg.fatores.some(f => f.startsWith('Se usar as 2 emergência')));
  // sem profundidade e sem bomba com reserva: os dois entram como estimados
  const sem = riscoDoPlano(CUSTOS_PADRAO, nivel({ reservaBombaPct: 0.5 }), { profundidadeM: null, potenciaCv: null, pocos: 1, kmIdaVolta: 50 }, 120);
  assert.deepStrictEqual([sem.estimados.length, sem.precisao], [2, 'BAIXA']);
});
