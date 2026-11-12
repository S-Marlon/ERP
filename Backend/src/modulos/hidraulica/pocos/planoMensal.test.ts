import assert from 'assert';
import { CUSTOS_PADRAO, custoVisita, divisor, NivelPlano, planoSugerido, precoDoPlano, validarCustos, validarNivel } from './planoMensal';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const nivel = (x: Partial<NivelPlano>): NivelPlano => ({
  nome: 'X', descricao: null, visitasAno: 1, limpezaACadaMeses: null, chamadosAno: 0, descontoPecasPct: 0, monitoramento: false,
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
  assert.deepStrictEqual(p.custos.map(c => c.anual), [952, 400, 476, 600, 187.5]);   // monitoramento: (25 + 900/36) × 12; bomba: 0,5 × 1,5 × 1500 ÷ 6
  assert.strictEqual(p.custoMensal, 217.96);
  assert.strictEqual(p.precoMensal, 345);
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
