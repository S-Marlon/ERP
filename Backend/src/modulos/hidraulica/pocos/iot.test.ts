import assert from 'assert';
import {
  avancarContexto, chaveConfere, chaveDoDispositivo, condicoesDaLeitura, contextoDasAnteriores, contextoVazio, Leitura, leituraVazia, lerArquivo, lerLote, Limites,
  reconciliar, relatorioDoMes, resumoPorDia, statusDoDispositivo, validarComando, validarDispositivo,
} from './iot';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const MESTRA = 'chave-mestra-de-teste-bem-longa';

teste('iot de poços: chave do aparelho', () => {
  const k = chaveDoDispositivo(MESTRA, 'esp32-a1b2');
  assert.strictEqual(k.length, 32);
  assert.strictEqual(k, chaveDoDispositivo(MESTRA, ' ESP32-A1B2 '));            // não depende de maiúscula/espaço
  assert.notStrictEqual(k, chaveDoDispositivo(MESTRA, 'ESP32-A1B3'));
  assert.notStrictEqual(k, chaveDoDispositivo(`${MESTRA}x`, 'ESP32-A1B2'));       // trocar a mestra invalida
  assert.ok(chaveConfere(MESTRA, 'ESP32-A1B2', k.toUpperCase()));
  assert.ok(!chaveConfere(MESTRA, 'ESP32-A1B2', 'errada'));
  assert.throws(() => chaveDoDispositivo('', 'X'), /IOT_CHAVE_MESTRA/);
});

teste('iot de poços: cadastro do aparelho', () => {
  const d = validarDispositivo({ nome: 'Sensor 1', identificador: 'aa:bb:cc:dd:ee:ff', conexao: 'offline', alimentacao: 'trifasico', intervaloMin: '10',
    correnteMinA: 3, correnteMaxA: 9, partidasMaxHora: 6, aceitaComandos: true });
  assert.deepStrictEqual([d.identificador, d.conexao, d.alimentacao, d.intervaloMin, d.partidasMaxHora, d.aceitaComandos, d.situacao],
    ['AA:BB:CC:DD:EE:FF', 'OFFLINE', 'TRIFASICO', 10, 6, 1, 'ATIVO']);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'x' }), /Identificador/);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'ABCD', correnteMinA: 9, correnteMaxA: 3 }), /menor que a máxima/);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'ABCD', alimentacao: 'QUADRIFASICO' }), /Alimentação/);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'ABCD', partidasMaxHora: 0 }), /Partidas/);
});

teste('iot de poços: lote de leituras e arquivo do poço sem internet', () => {
  const agora = new Date('2026-10-22T15:00:00-03:00');
  const l = lerLote({ leituras: [
    { em: '2026-10-22T14:30:00-03:00', coluna_m: 21.6, corrente_a: 6.8, bomba: 1, vazao_lh: 3200, fase_a_v: 220, comando: true, boia: '1', modo: 'auto', termico_ok: 1 },
    { em: '2026-10-22T14:00:00-03:00', nivel_m: 18, bomba: false },
  ] }, agora, 60);
  assert.deepStrictEqual(l.map(x => [x.em.slice(11, 16), x.nivelM, x.bombaLigada]), [['14:00', 18, false], ['14:30', 38.4, true]]);
  assert.deepStrictEqual([l[1].faseAV, l[1].comandoLigado, l[1].boiaPedindo, l[1].modo, l[1].termicoOk], [220, true, true, 'AUTO', true]);
  assert.strictEqual(lerLote({ nivel_m: 10 }, agora, null)[0].nivelM, 10);
  assert.throws(() => lerLote({ leituras: [{ em: '2026-10-22T16:00:00-03:00' }] }, agora, null), /futuro/);
  assert.throws(() => lerLote({ leituras: [{ em: '2026-07-01T10:00:00-03:00' }] }, agora, null), /60 dias/);
  assert.strictEqual(lerLote({ leituras: [{ em: '2026-07-01 10:00:00' }] }, agora, null, 365).length, 1);   // importação aceita mais antigo
  assert.throws(() => lerLote({ leituras: [{ corrente_a: -1 }] }, agora, null), /Corrente fora da faixa/);
  // arquivo: CSV com ; e vírgula decimal, JSONL e JSON do envio
  const csv = lerArquivo('﻿em;nivel_m;corrente_a;bomba\n2026-10-01 08:00:00;35,2;6,5;1\n2026-10-01 08:15:00;35,9;6,4;1\n');
  assert.deepStrictEqual(csv[1], { em: '2026-10-01 08:15:00', nivel_m: '35,9', corrente_a: '6,4', bomba: '1' });
  assert.strictEqual(lerLote({ leituras: csv }, agora, null, 365)[0].nivelM, 35.2);
  assert.strictEqual(lerArquivo('{"em":"2026-10-01 08:00:00","nivel_m":30}\n{"em":"2026-10-01 08:15:00","nivel_m":31}').length, 2);
  assert.strictEqual(lerArquivo('{"leituras":[{"nivel_m":1},{"nivel_m":2},{"nivel_m":3}]}').length, 3);
  assert.throws(() => lerArquivo('nivel;corrente\n1;2'), /coluna "em"/);
});

const L = (x: Partial<Leitura>): Leitura => ({ ...leituraVazia('2026-10-22 10:00:00'), ...x });
const lim: Limites = { alimentacao: 'MONOFASICO', nivelAlertaM: 45, correnteMinA: 3, correnteMaxA: 9, vazaoMinLh: 1000, tensaoMinV: 200, tensaoMaxV: 240,
  pressaoMinBar: null, horasMaxLigada: null, partidasMaxHora: null };
const tri: Limites = { ...lim, alimentacao: 'TRIFASICO', pressaoMinBar: 1.5, horasMaxLigada: 6, partidasMaxHora: 4 };
const tipos = (l: Limites, x: Partial<Leitura>, ctx = contextoVazio()) => condicoesDaLeitura(l, L(x), ctx).map(c => c.tipo);

teste('iot de poços: alertas da bomba (nível, a seco, corrente, vazão, tensão)', () => {
  assert.deepStrictEqual(tipos(lim, { nivelM: 46, correnteA: 1.2, bombaLigada: true, vazaoLh: 200, tensaoV: 190 }), ['NIVEL_BAIXO', 'A_SECO', 'VAZAO_BAIXA', 'TENSAO']);
  assert.deepStrictEqual(tipos(lim, { correnteA: 12 }), ['SOBRECORRENTE']);
  assert.deepStrictEqual(tipos(lim, { correnteA: 0.1, vazaoLh: 0 }), []);
  assert.deepStrictEqual(tipos({ ...lim, nivelAlertaM: null }, { nivelM: 99 }), []);
});

teste('iot de poços: alertas do quadro de comando', () => {
  // trifásico: uma fase caiu; todas caíram (sem energia não gera os alertas da bomba)
  assert.deepStrictEqual(tipos(tri, { faseAV: 221, faseBV: 0, faseCV: 219 }), ['FALTA_FASE']);
  assert.deepStrictEqual(tipos(tri, { faseAV: 0, faseBV: 0, faseCV: 0, comandoLigado: true, correnteA: 0 }), ['SEM_ENERGIA']);
  assert.deepStrictEqual(tipos(lim, { faseAV: 0 }), ['SEM_ENERGIA']);                                           // monofásico sem tensão
  // contator ligado, energia boa e corrente zero: bomba queimada / cabo
  assert.deepStrictEqual(tipos(tri, { faseAV: 220, faseBV: 220, faseCV: 220, comandoLigado: true, correnteA: 0.1 }), ['SEM_FUNCIONAMENTO']);
  // térmico desarmado: é ele, não "sem funcionamento"
  assert.deepStrictEqual(tipos(tri, { comandoLigado: true, correnteA: 0, termicoOk: false }), ['TERMICO']);
  // boia pede, energia ok, AUTO e o contator não liga: só na segunda leitura seguida
  const naoParte = { faseAV: 220, faseBV: 220, faseCV: 220, boiaPedindo: true, comandoLigado: false, modo: 'AUTO' as const };
  assert.deepStrictEqual(tipos(tri, naoParte), []);
  assert.deepStrictEqual(tipos(tri, naoParte, { ...contextoVazio(), naoParteAntes: true }), ['NAO_PARTE']);
  assert.deepStrictEqual(tipos(tri, { ...naoParte, modo: 'MANUAL' }, { ...contextoVazio(), naoParteAntes: true }), []);   // seletora em manual: não é defeito
  // pressão baixa com a bomba trabalhando: cano estourado
  assert.deepStrictEqual(tipos(tri, { correnteA: 6.5, bombaLigada: true, pressaoBar: 0.3 }), ['PRESSAO_BAIXA']);
  // ligada demais e partidas demais (pelo contexto)
  assert.deepStrictEqual(tipos(tri, { correnteA: 6.5, bombaLigada: true, em: '2026-10-22 17:00:00' }, { ...contextoVazio(), ligadaDesde: '2026-10-22 10:30:00' }), ['LIGADA_DEMAIS']);
  assert.deepStrictEqual(tipos(tri, { correnteA: 6.5 }, { ...contextoVazio(), partidasHora: ['a', 'b', 'c', 'd', 'e'] }), ['PARTIDAS_DEMAIS']);
});

teste('iot de poços: contexto (desde quando ligada, partidas da hora)', () => {
  const seq = ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25'].map((h, i) => L({ em: `2026-10-22 ${h}:00`, bombaLigada: i % 2 === 1 }));
  const ctx = contextoDasAnteriores(seq, tri);
  assert.deepStrictEqual([ctx.partidasHora.length, ctx.ligadaDesde, ctx.ultimaLigada], [3, '2026-10-22 10:25:00', true]);
  const depois = avancarContexto(ctx, L({ em: '2026-10-22 11:12:00', bombaLigada: true }), tri);
  assert.deepStrictEqual([depois.partidasHora.length, depois.ligadaDesde], [2, '2026-10-22 10:25:00']);    // às 11:12, as das 10:15 e 10:25 ainda estão na última hora
  const mais = ['10:30', '10:35', '10:40', '10:45'].map((h, i) => L({ em: `2026-10-22 ${h}:00`, bombaLigada: i % 2 === 1 }));
  const r = reconciliar([], [...seq, ...mais.slice(0, 2)], tri);
  assert.deepStrictEqual(r.abrir, []);                                                           // 4 partidas na hora: dentro do limite (4)
  const r5 = reconciliar([], [...seq, ...mais], tri);
  assert.deepStrictEqual(r5.abrir.map(a => [a.tipo, a.inicio]), [['PARTIDAS_DEMAIS', '2026-10-22 10:45:00']]);   // a 5ª partida, na própria leitura
});

teste('iot de poços: abrir e fechar alertas', () => {
  const r = reconciliar(['SEM_SINAL', 'TENSAO'], [
    L({ em: '2026-10-22 10:00:00', correnteA: 1, bombaLigada: true }),
    L({ em: '2026-10-22 10:15:00', correnteA: 6, bombaLigada: true, tensaoV: 220 }),
  ], lim);
  assert.deepStrictEqual(r.abrir.map(a => [a.tipo, a.inicio, a.fim]), [['A_SECO', '2026-10-22 10:00:00', '2026-10-22 10:15:00']]);
  assert.deepStrictEqual(r.fechar, [{ tipo: 'SEM_SINAL', fim: '2026-10-22 10:00:00' }, { tipo: 'TENSAO', fim: '2026-10-22 10:15:00' }]);
  const r2 = reconciliar([], [L({ nivelM: 50 }), L({ em: '2026-10-22 10:15:00', nivelM: 51 })], lim);
  assert.deepStrictEqual(r2.abrir.map(a => [a.tipo, a.inicio]), [['NIVEL_BAIXO', '2026-10-22 10:00:00']]);
});

teste('iot de poços: situação, resumo do dia e relatório do mês', () => {
  const agora = new Date('2026-10-22T10:40:00');
  assert.deepStrictEqual([statusDoDispositivo('2026-10-22 10:30:00', 15, agora), statusDoDispositivo('2026-10-22 10:05:00', 15, agora),
    statusDoDispositivo('2026-10-22 09:00:00', 15, agora), statusDoDispositivo(null, 15, agora), statusDoDispositivo(null, 15, agora, 'OFFLINE')],
  ['ONLINE', 'ATRASADO', 'SEM_SINAL', 'NUNCA', 'OFFLINE']);
  const leituras = [
    L({ em: '2026-10-22 08:00:00', nivelM: 18, bombaLigada: false, energiaKwh: 100 }),
    L({ em: '2026-10-22 08:15:00', nivelM: 38, bombaLigada: true, vazaoLh: 3000, pressaoBar: 3, energiaKwh: 100.5 }),
    L({ em: '2026-10-22 08:30:00', nivelM: 40, bombaLigada: true, vazaoLh: 2800, pressaoBar: 2.8, energiaKwh: 101.2 }),
    L({ em: '2026-10-22 12:30:00', nivelM: 19, bombaLigada: false, energiaKwh: 101.6 }),
  ];
  assert.deepStrictEqual(resumoPorDia(leituras, 15), [{ dia: '2026-10-22', leituras: 4, nivelEstaticoM: 18.5, nivelDinamicoM: 39, vazaoMediaLh: 2900,
    pressaoMediaBar: 2.9, horasBomba: 0.75, volumeM3: 2.15, partidas: 1, energiaKwh: 1.6 }]);
  const rel = relatorioDoMes('2026-10', leituras, 15, 0.85, [{ tipo: 'A_SECO' }, { tipo: 'A_SECO' }, { tipo: 'NIVEL_BAIXO' }], new Date('2026-10-22T12:30:00'));
  assert.deepStrictEqual([rel.totais.horasBomba, rel.totais.volumeM3, rel.totais.partidas, rel.totais.energiaKwh, rel.totais.custoEnergia, rel.totais.m3PorKwh],
    [0.75, 2.15, 1, 1.6, 1.36, 1.34]);
  assert.deepStrictEqual(rel.alertasPorTipo, { A_SECO: 2, NIVEL_BAIXO: 1 });
  assert.ok(rel.totais.disponibilidade! < 1);                                    // 4 leituras de ~2.000 esperadas no mês até agora
});

teste('iot de poços: comandos remotos', () => {
  assert.deepStrictEqual(validarComando({ comando: 'liberar' }, true), { comando: 'LIBERAR', motivo: null });
  assert.throws(() => validarComando({ comando: 'BLOQUEAR' }, true), /motivo/);
  assert.throws(() => validarComando({ comando: 'LIBERAR' }, false), /não aceita comandos/);
  assert.throws(() => validarComando({ comando: 'LIGAR_FORCADO' }, true), /inválido/);
});
