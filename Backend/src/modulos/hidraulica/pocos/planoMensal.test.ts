import assert from 'assert';
import { CUSTOS_PADRAO, custoChamado, custoVisita, materialAnual, riscoDoPlano, divisor, kmAteOPoco, kmDaVisita, NivelPlano, planoSugerido, precoDoPlano, validarCustos, validarNivel } from './planoMensal';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const nivel = (x: Partial<NivelPlano>): NivelPlano => ({
  nome: 'X', descricao: null, visitasAno: 1, limpezaACadaMeses: null, chamadosAno: 0, descontoPecasPct: 0, descontoLimpezaPct: 0, prioridade: false, aguaEmergencial: false, monitoramento: false,
  reservaBombaPct: 0, fidelidadeMeses: 12, ordem: 0, ativo: true, ...x,
});
const poco = { profundidadeM: 80, potenciaCv: 1.5, pocos: 1 };

teste('plano mensal: custo da preventiva e do chamado', () => {
  // preventiva: 3 h × 1 pessoa × R$ 30 + R$ 50 de material + 60 km × R$ 1,50 = 90 + 50 + 90 (sem tirar a bomba)
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 80), 230);
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 200), 230, 'poço fundo não muda a preventiva');
  assert.strictEqual(custoVisita(CUSTOS_PADRAO, 80, 2), 370, 'dois poços: pessoa e material dobram, o deslocamento não');
  assert.strictEqual(divisor(CUSTOS_PADRAO), 0.63);
  // chamado a 80 m: (4 h + 1,5 h × 0,8) = 5,2 h × 3 pessoas × R$ 30 = 468 + 50 + 90 = 608; no domingo, hora em dobro: 936 + 140
  assert.deepStrictEqual(custoChamado(CUSTOS_PADRAO, 80), { total: 608, maoDeObra: 468, horas: 5.2, viagens: 1 });
  assert.strictEqual(custoChamado(CUSTOS_PADRAO, 80, 60, true).total, 1076);
  // poço de 400 m: 4 + 6 = 10 h, passa da jornada → 2 viagens: 900 + 50 + 180
  assert.deepStrictEqual(custoChamado(CUSTOS_PADRAO, 400), { total: 1130, maoDeObra: 900, horas: 10, viagens: 2 });
});

teste('plano mensal: preço, lucro e economia do cliente', () => {
  // 230/ano ÷ 12 = 19,17 ÷ 0,63 = 30,43 → R$ 30; líquido 30 × 0,88 = 26,40 − 19,17 = 7,23 de lucro (24,1%)
  const p = precoDoPlano({ ...CUSTOS_PADRAO, precoVisitaAvulsa: 900 }, nivel({}), poco);
  assert.deepStrictEqual([p.precoMensal, p.custoMensal, p.lucroMensal, p.margemReal], [30, 19.17, 7.23, 0.241]);
  assert.deepStrictEqual([p.avulsoAnual, p.economiaAnual, p.viavel, p.maoDeObraMensal, p.atendimentosAno], [900, 540, true, 7.5, 1]);
  // visita avulsa barata: o cliente pagaria menos avulso, o plano não se vende
  const caro = precoDoPlano({ ...CUSTOS_PADRAO, precoVisitaAvulsa: 300 }, nivel({}), poco);
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
  // 2 preventivas de 230; limpeza a cada 2 anos; 1 chamado esperado (dia útil, sem prioridade) de 608;
  // monitoramento: (25 + 900/36) × 12; bomba: 0,5 × 1,5 × 1500 ÷ 6
  assert.deepStrictEqual(p.custos.map(c => c.anual), [460, 400, 608, 600, 187.5]);
  assert.strictEqual(p.custoMensal, 187.96);
  assert.strictEqual(p.precoMensal, 300);
  assert.deepStrictEqual([p.chamadosAno, p.custoUmChamado, p.atendimentosAno], [1, 608, 3]);
  assert.deepStrictEqual(p.custos.map(c => c.tipo), ['PREVENTIVA', 'LIMPEZA', 'CHAMADOS', 'MONITORAMENTO', 'BOMBA']);
  assert.deepStrictEqual([p.custoUmaPreventiva, p.custoChamadoDomingo], [230, 1076]);
  // com prioridade, 17% dos chamados no domingo (1076) e caminhão-pipa de R$ 400 em 10% deles:
  // 0,83 × 608 + 0,17 × 1076 + 40 = 727,56
  const top = precoDoPlano({ ...CUSTOS_PADRAO, custoPipa: 400 }, nivel({ chamadosAno: 5, prioridade: true, aguaEmergencial: true }), poco);
  assert.strictEqual(top.custos.find(c => c.item.startsWith('Chamados'))!.anual, 727.56);
  // margem mínima: o arredondamento para baixo (de 50 em 50) não fecha
  const apertado = precoDoPlano({ ...CUSTOS_PADRAO, margemPct: 0.1, margemMinimaPct: 0.1, arredondarPara: 50 }, nivel({ visitasAno: 3 }), poco);
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
  // cliente perto: a visita sai 31 km × R$ 1,50 mais barata (140 + 43,50 = 183,50 por ano)
  const perto = precoDoPlano(base, nivel({}), { ...poco, latitude: -23.2, longitude: -46.5 });
  assert.deepStrictEqual([perto.km, perto.kmOrigem, perto.custoMensal], [29, 'GPS', 15.29]);
  const c = validarCustos({ ...CUSTOS_PADRAO, baseGps: '-23.1171, -46.5565' });
  assert.deepStrictEqual([c.baseLatitude, c.baseLongitude], [-23.1171, -46.5565]);
  assert.strictEqual(validarCustos({ ...CUSTOS_PADRAO, baseGps: '' }).baseLatitude, null);
  assert.throws(() => validarCustos({ ...CUSTOS_PADRAO, baseGps: 'perto da praça' }), /Base da empresa/);
});

teste('plano mensal: risco, faixa de lucro e raio da distância', () => {
  // 1 preventiva/ano, km médio 60 (sem GPS), preço R$ 30: líquido 30 × 0,88 = 26,40
  const r = riscoDoPlano(CUSTOS_PADRAO, nivel({}), poco, 30);
  assert.deepStrictEqual([r.esperado.custoMensal, r.esperado.lucroMensal, r.esperado.margem], [19.17, 7.23, 0.241]);
  // otimista: km −40% (36 km), sem inadimplência: 194/12 = 16,17; 30 × 0,91 = 27,30 → 11,13
  assert.strictEqual(r.otimista.lucroMensal, 11.13);
  // pessimista: km +40% (84 km), visita 25% mais longa (3,75 h), inadimplência 6%: 288,50/12 = 24,04; 30 × 0,85 = 25,50 → 1,46
  assert.strictEqual(r.pessimista.lucroMensal, 1.46);
  // R$ 0,125 por km/mês: lucro zera em 117 km e a margem mínima (R$ 3) vai até 93 km
  assert.deepStrictEqual([r.kmEquilibrio, r.kmMargemMinima, r.nivel, r.precisao], [117, 93, 'BAIXO', 'BAIXA']);
  assert.ok(r.estimados[0].startsWith('distância pelo km médio'));
  // longe (180 km informados): prejuízo já no esperado → risco alto, com o motivo da distância
  const longe = riscoDoPlano(CUSTOS_PADRAO, nivel({}), { ...poco, kmIdaVolta: 180 }, 30);
  assert.deepStrictEqual([longe.esperado.lucroMensal, longe.nivel, longe.precisao], [-7.77, 'ALTO', 'BOA']);
  assert.ok(longe.fatores.some(f => f.startsWith('Longe: 180 km')), JSON.stringify(longe.fatores));
  // chamados: o esperado é 1 por poço; o pessimista conta os 2 do limite (e mais demorados): negativo → risco médio
  const comEmerg = { ...poco, kmIdaVolta: 60 };
  const emerg = riscoDoPlano(CUSTOS_PADRAO, nivel({ chamadosAno: 2 }), comEmerg, precoDoPlano(CUSTOS_PADRAO, nivel({ chamadosAno: 2 }), comEmerg).precoMensal);
  assert.ok(emerg.pessimista.lucroMensal < 0 && emerg.esperado.lucroMensal > 0 && emerg.nivel === 'MEDIO', JSON.stringify(emerg));
  assert.ok(emerg.fatores.some(f => f.startsWith('Se usar os 2 chamados')));
  // sem profundidade e sem bomba com reserva: os dois entram como estimados
  const sem = riscoDoPlano(CUSTOS_PADRAO, nivel({ reservaBombaPct: 0.5 }), { profundidadeM: null, potenciaCv: null, pocos: 1, kmIdaVolta: 50 }, 120);
  assert.deepStrictEqual([sem.estimados.length, sem.precisao], [2, 'BAIXA']);
});

teste('plano mensal: desconto em material pela profundidade da bomba (a bomba vai pela reserva)', () => {
  const c = { ...CUSTOS_PADRAO, materialMetro: 35, materialVidaAnos: 10, materialAnoPoco: 50, precoVisitaAvulsa: 900 };
  // sem a profundidade da bomba: 70% de 80 m = 56 m × R$ 35 ÷ 10 anos = 196 + 50 de conexões = 246 por ano
  assert.strictEqual(materialAnual(c, 80), 246);
  // bomba a 60 m: 210 + 50; poço de 160 m sem bomba registrada: 112 m → 392 + 50
  assert.deepStrictEqual([materialAnual(c, 80, 60), materialAnual(c, 160)], [260, 442]);
  const linha = (d: number, reserva = 0, p: any = poco) => precoDoPlano(c, nivel({ descontoPecasPct: d, reservaBombaPct: reserva }), p).custos.find(l => l.item.startsWith('Desconto'));
  assert.deepStrictEqual([linha(0.2)?.anual, linha(0.5)?.anual, linha(1)?.anual], [49.2, 123, 246]);
  assert.strictEqual(linha(0), undefined, 'sem desconto, sem linha');
  // a reserva da bomba não mexe mais no desconto (ela cobre a bomba; o desconto, o material)
  assert.strictEqual(linha(1, 1)?.anual, 246);
  assert.strictEqual(linha(1, 0, { ...poco, profundidadeBombaM: 60 })?.anual, 260);
  assert.ok(linha(0.5)!.item.includes('material (tubo, fio, conexões)'));
  // o preço sobe com o desconto, e o cliente compara com o material cheio (avulso)
  const sem = precoDoPlano(c, nivel({}), poco), cem = precoDoPlano(c, nivel({ descontoPecasPct: 1 }), poco);
  assert.ok(cem.precoMensal > sem.precoMensal && cem.avulsoAnual === sem.avulsoAnual + 246, JSON.stringify([sem.precoMensal, cem.precoMensal, sem.avulsoAnual, cem.avulsoAnual]));
  assert.strictEqual(validarNivel({ nome: 'Top', visitasAno: 1, descontoPecasPct: 1 }).descontoPecasPct, 1);
  assert.throws(() => validarNivel({ nome: 'Top', visitasAno: 1, descontoPecasPct: 1.1 }), /Desconto em material/);
  assert.deepStrictEqual([validarCustos({ ...c }).materialMetro, validarCustos({ ...CUSTOS_PADRAO }).materialVidaAnos], [35, 10]);
});
